// ─────────────────────────────────────────────────────────────────────
//  KPI Computation Engine
//
//  Every safety KPI rendered anywhere in the platform flows through
//  this class. Formulas live in ./kpi-registry; this file is the only
//  place that translates registry entries into Prisma queries and
//  numerical results.
//
//  Design notes:
//    • Dependency-injected PrismaClient → testable from scripts +
//      reusable inside Next server components without coupling to a
//      singleton path alias.
//    • Snapshot-at-lock: KpiResult is the canonical shape stored in
//      ManhoursSubmission.kpiSnapshot at lock-time (Commit 3). Future
//      re-renders read the snapshot — they do NOT re-run the engine.
//    • Net vs gross hours: prefers ManhoursSubmission.netExposureHours.
//      Falls back to legacy `Manhours.employeeHours + contractorHours`
//      (gross) when no submission exists for the period, and flags
//      `fellBackToLegacyGrossHours: true` so callers can warn. This
//      bridge dies when C6 backfills submissions for every month.
//    • Scope is plantId-only in Commit 1. Department + contractor
//      scope land in Commit 4.
// ─────────────────────────────────────────────────────────────────────

import type { PrismaClient } from "@prisma/client";
import {
  KPI_REGISTRY,
  type KpiCode,
  type KpiDefinition,
  type KpiBand,
  type KpiSource
} from "./kpi-registry";

// ─── Public I/O types ──────────────────────────────────────────────

export interface KpiScope {
  /** Single-plant scope. Omit for company-wide. */
  plantId?: string;
  /** Reserved for Commit 4. Engine throws if set. */
  departmentId?: string;
  /** Reserved for Commit 4. Engine throws if set. */
  contractorCompanyId?: string;
}

export interface KpiPeriod {
  year: number;
  /** 1-12. Required for monthly, optional anchor for rolling/YTD. */
  month?: number;
  quarter?: 1 | 2 | 3 | 4;
  /** Year-to-date: Jan 1 → end of `month` (or now). */
  isYTD?: boolean;
  /** Rolling 12 months ending at end of `month` (or now). */
  isRolling12?: boolean;
  customStart?: Date;
  /** Exclusive. */
  customEnd?: Date;
}

export interface KpiPeriodBounds {
  start: Date;
  /** Exclusive upper bound. */
  end: Date;
  label: string;
}

export interface KpiAuditTrail {
  /** Source-record IDs that contributed to the numerator. Used by
   *  drill-down UI (Commit 4) and audit exports. */
  sourceRecordIds: string[];
  /** ManhoursSubmission.ids used in the denominator (may be empty
   *  when falling back to legacy gross hours). */
  manhoursSubmissionIds: string[];
  /** True when no ManhoursSubmission existed for the period and the
   *  engine fell back to legacy Manhours gross-hour rows. */
  fellBackToLegacyGrossHours: boolean;
}

export interface KpiResult {
  kpiCode: KpiCode;
  kpiName: string;
  value: number;
  formattedValue: string;
  numerator: number;
  denominator: number;
  formula: string;
  band: KpiBand | null;
  bandColor: string;
  higherIsBetter: boolean;
  benchmarks?: KpiDefinition["benchmarks"];
  period: KpiPeriodBounds;
  scope: KpiScope;
  computedAt: Date;
  audit: KpiAuditTrail;
}

export interface KpiEngineOptions {
  /** Fiscal year start month (1-12). Default 4 (Indian fiscal — April). */
  fiscalYearStartMonth?: number;
  /** Days charged per fatality per IS 3786. */
  fatalityDaysCharged?: number;
}

// ─── Engine ────────────────────────────────────────────────────────

/** Band palette — same colours regardless of higherIsBetter direction.
 *  The `band` field already encodes whether the score is good or bad,
 *  so we just need a consistent visual mapping. */
const BAND_COLOR: Record<KpiBand, string> = {
  WORLD_CLASS: "#10b981", // emerald
  EXCELLENT: "#84cc16",   // lime
  AVERAGE: "#f59e0b",     // amber
  POOR: "#ef4444"         // rose
};

/** Maps source identifiers to the date column the engine uses for
 *  period filtering. Keeping this in one place avoids per-KPI
 *  configuration. */
const SOURCE_DATE_FIELD: Record<KpiSource, string> = {
  incident: "occurredAt",
  nearMiss: "date",
  observation: "date",
  permit: "createdAt",
  trainingRecord: "date",
  inspection: "scheduledDate",
  manhoursSubmission: "reportingPeriodStart"
};

/** Some sources don't always populate the preferred date column. Engine
 *  uses these fallbacks before giving up. */
const SOURCE_DATE_FALLBACK: Partial<Record<KpiSource, string>> = {
  incident: "date" // legacy rows pre-refactor only have `date`
};

/** Column used for ORDER BY in DAYS_SINCE queries. Must be always-
 *  populated (no nulls) for correct ordering. For Incident we use
 *  `date` (required column) rather than `occurredAt` (nullable). */
const SOURCE_ORDER_FIELD: Record<KpiSource, string> = {
  incident: "date",
  nearMiss: "date",
  observation: "date",
  permit: "createdAt",
  trainingRecord: "date",
  inspection: "scheduledDate",
  manhoursSubmission: "reportingPeriodStart"
};

/** Sources whose schema has a direct `departmentId` column. The engine
 *  uses this to gate department-scope queries — sources marked false
 *  cause applyScope to throw. */
const SOURCE_SUPPORTS_DEPARTMENT: Record<KpiSource, boolean> = {
  incident: true,
  nearMiss: true,
  observation: false,
  permit: true,
  trainingRecord: false,
  inspection: false,
  manhoursSubmission: false
};

export class KpiEngine {
  private readonly fyStartMonth: number;
  private readonly fatalityDaysCharged: number;

  constructor(
    private readonly prisma: PrismaClient,
    options: KpiEngineOptions = {}
  ) {
    this.fyStartMonth = options.fiscalYearStartMonth ?? 4;
    this.fatalityDaysCharged = options.fatalityDaysCharged ?? 6000;
  }

  // ── Public entry points ─────────────────────────────────────────

  async computeKpi(code: KpiCode, scope: KpiScope, period: KpiPeriod): Promise<KpiResult> {
    const def = KPI_REGISTRY[code];
    if (!def) throw new Error(`Unknown KPI code: ${code}`);

    const bounds = this.resolvePeriodBounds(period);

    // Derived KPIs short-circuit and don't compute a denominator
    if (def.numerator.kind === "DERIVED") {
      const value = await this.computeDerived(def, scope, period);
      return this.buildResult(def, scope, bounds, value, value, 0, {
        sourceRecordIds: [],
        manhoursSubmissionIds: [],
        fellBackToLegacyGrossHours: false
      });
    }

    const { numerator, sourceRecordIds } = await this.computeNumerator(def, scope, bounds);

    let denominator = 0;
    let manhoursSubmissionIds: string[] = [];
    let fellBackToLegacyGrossHours = false;
    if (def.denominator.kind === "EXPOSURE_HOURS") {
      const d = await this.computeExposureHours(scope, bounds);
      denominator = d.value;
      manhoursSubmissionIds = d.submissionIds;
      fellBackToLegacyGrossHours = d.fellBackToLegacy;
    }

    let value: number;
    if (def.denominator.kind === "EXPOSURE_HOURS") {
      value = denominator > 0 ? (numerator * def.multiplier) / denominator : 0;
    } else {
      // Streak / percentage / cost KPIs — numerator IS the value.
      value = numerator * def.multiplier;
    }

    return this.buildResult(def, scope, bounds, value, numerator, denominator, {
      sourceRecordIds,
      manhoursSubmissionIds,
      fellBackToLegacyGrossHours
    });
  }

  /** Compute many KPIs for the same scope+period. Runs them in
   *  parallel — be mindful of Prisma connection_limit=1 in production;
   *  the queries will serialise inside the single connection. */
  async computeKpiBatch(
    codes: readonly KpiCode[],
    scope: KpiScope,
    period: KpiPeriod
  ): Promise<Record<string, KpiResult>> {
    const results = await Promise.all(codes.map((c) => this.computeKpi(c, scope, period)));
    const out: Record<string, KpiResult> = {};
    for (let i = 0; i < codes.length; i++) out[codes[i]] = results[i];
    return out;
  }

  /** Compute the prior-period KPI value and return it as a trend tuple
   *  the UI can render directly. Supports monthly + rolling-12 periods
   *  (the two common dashboard shapes); other period kinds throw —
   *  caller catches and skips the trend chip. */
  async computeTrend(
    code: KpiCode,
    currentValue: number,
    scope: KpiScope,
    period: KpiPeriod
  ): Promise<{
    direction: "UP" | "DOWN" | "FLAT";
    percentChange: number | null;
    priorValue: number | null;
    priorPeriodLabel: string;
  }> {
    const priorPeriod = this.shiftPeriodBackward(period);
    if (!priorPeriod) {
      throw new Error("Trend supports monthly and rolling-12 periods only.");
    }
    const prior = await this.computeKpi(code, scope, priorPeriod);
    const priorValue = prior.value;
    const def = KPI_REGISTRY[code];
    const flatThresholdPct = def.isPercentage ? 0.5 : 5; // 0.5pp / 5% relative

    let direction: "UP" | "DOWN" | "FLAT" = "FLAT";
    let pct: number | null = null;
    if (priorValue === 0 && currentValue === 0) {
      direction = "FLAT";
    } else if (priorValue === 0) {
      direction = currentValue > 0 ? "UP" : "DOWN";
      pct = null;
    } else {
      pct = ((currentValue - priorValue) / Math.abs(priorValue)) * 100;
      if (Math.abs(pct) < flatThresholdPct) direction = "FLAT";
      else direction = pct > 0 ? "UP" : "DOWN";
    }

    return { direction, percentChange: pct, priorValue, priorPeriodLabel: prior.period.label };
  }

  /** Shift a period backward by one unit. Returns null for shapes
   *  the engine doesn't trend (custom range, quarter, year, YTD). */
  private shiftPeriodBackward(period: KpiPeriod): KpiPeriod | null {
    if (period.isRolling12) {
      const anchor = period.month
        ? new Date(period.year, period.month - 1, 1)
        : new Date();
      const prevAnchor = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
      return {
        year: prevAnchor.getFullYear(),
        month: prevAnchor.getMonth() + 1,
        isRolling12: true
      };
    }
    if (period.month && !period.quarter && !period.isYTD && !period.customStart) {
      const prev = new Date(period.year, period.month - 2, 1);
      return { year: prev.getFullYear(), month: prev.getMonth() + 1 };
    }
    return null;
  }

  /** Return the cached KPI value from a LOCKED submission's snapshot.
   *  Returns null when no LOCKED snapshot exists for the
   *  (plantId, year, month) tuple. The drill-down API uses this to
   *  serve the immutable audit trail for historical periods —
   *  re-computation would silently shift numbers if source incidents
   *  were reclassified after lock. */
  async findKpiSnapshot(opts: {
    code: KpiCode;
    plantId: string;
    year: number;
    month: number;
  }): Promise<KpiResult | null> {
    const sub = await this.prisma.manhoursSubmission.findUnique({
      where: {
        plantId_reportingYear_reportingMonth: {
          plantId: opts.plantId,
          reportingYear: opts.year,
          reportingMonth: opts.month
        }
      },
      select: { status: true, kpiSnapshot: true }
    });
    if (!sub || sub.status !== "LOCKED" || !sub.kpiSnapshot) return null;
    const snap = sub.kpiSnapshot as { kpis?: Record<string, KpiResult> };
    return snap.kpis?.[opts.code] ?? null;
  }

  // ── Period resolution ──────────────────────────────────────────

  resolvePeriodBounds(period: KpiPeriod): KpiPeriodBounds {
    if (period.customStart && period.customEnd) {
      return {
        start: period.customStart,
        end: period.customEnd,
        label: `${this.fmtDate(period.customStart)} – ${this.fmtDate(period.customEnd)}`
      };
    }

    if (period.isRolling12) {
      // Anchor at end of given month (exclusive) or now.
      const anchor = period.month
        ? new Date(period.year, period.month, 1)
        : new Date();
      const start = new Date(anchor.getFullYear(), anchor.getMonth() - 12, 1);
      return {
        start,
        end: anchor,
        label: `Rolling 12 (${this.fmtMonth(start)} – ${this.fmtMonth(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))})`
      };
    }

    if (period.isYTD) {
      const start = new Date(period.year, 0, 1);
      const end = period.month ? new Date(period.year, period.month, 1) : new Date();
      return { start, end, label: `YTD ${period.year}` };
    }

    if (period.quarter) {
      // Indian fiscal Q1 = Apr-Jun, Q2 = Jul-Sep, Q3 = Oct-Dec, Q4 = Jan-Mar
      // (configurable via constructor — default fyStartMonth = 4).
      const fyStart0 = this.fyStartMonth - 1; // 0-indexed
      const qStart0 = (fyStart0 + (period.quarter - 1) * 3) % 12;
      // Q4 of FY26 starts Jan 2027 in absolute terms.
      const qYear = qStart0 < fyStart0 ? period.year + 1 : period.year;
      const start = new Date(qYear, qStart0, 1);
      const end = new Date(qYear, qStart0 + 3, 1);
      return { start, end, label: `FY${String(period.year).slice(2)} Q${period.quarter}` };
    }

    if (period.month) {
      const start = new Date(period.year, period.month - 1, 1);
      const end = new Date(period.year, period.month, 1);
      return { start, end, label: this.fmtMonth(start) };
    }

    // Full calendar year
    return {
      start: new Date(period.year, 0, 1),
      end: new Date(period.year + 1, 0, 1),
      label: String(period.year)
    };
  }

  private fmtMonth(d: Date): string {
    return d.toLocaleString("en-IN", { month: "short", year: "numeric" });
  }
  private fmtDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  // ── Numerator dispatch ─────────────────────────────────────────

  private async computeNumerator(
    def: KpiDefinition,
    scope: KpiScope,
    bounds: KpiPeriodBounds
  ): Promise<{ numerator: number; sourceRecordIds: string[] }> {
    const n = def.numerator;

    if (n.kind === "MODULE_COUNT") {
      const where = this.buildWhere(n.source, scope, bounds, n.where);
      const rows = await this.findIds(n.source, where);
      return { numerator: rows.length, sourceRecordIds: rows };
    }

    if (n.kind === "MODULE_SUM") {
      const where = this.buildWhere(n.source, scope, bounds, n.where);
      const rows = await (this.prisma as any)[n.source].findMany({
        where,
        select: { id: true, [n.sumField]: true }
      });
      const sum = rows.reduce(
        (s: number, r: Record<string, unknown>) => s + (Number(r[n.sumField]) || 0),
        0
      );
      return { numerator: sum, sourceRecordIds: rows.map((r: { id: string }) => r.id) };
    }

    if (n.kind === "DAYS_SINCE") {
      // No period filter — we want the latest qualifying record across
      // all time, then days since it. Scope still applies (plant filter).
      const baseWhere = { ...(n.where ?? {}) };
      const where = this.applyScope(n.source, scope, baseWhere);

      // Order by the always-populated column so nulls in the preferred
      // (more-precise) column don't push real records out of the way.
      const orderField = SOURCE_ORDER_FIELD[n.source];
      const preferredField = SOURCE_DATE_FIELD[n.source];

      const latest = await (this.prisma as any)[n.source].findFirst({
        where,
        orderBy: { [orderField]: "desc" },
        // Select both fields if they differ — engine uses the preferred
        // one when set (more precise), falls back to order field.
        select:
          orderField === preferredField
            ? { id: true, [orderField]: true }
            : { id: true, [orderField]: true, [preferredField]: true }
      });

      if (!latest) {
        // Sentinel — no qualifying record in history. UI shows ∞.
        // Returning a large number keeps the engine numerical.
        return { numerator: 9999, sourceRecordIds: [] };
      }

      const ref: Date | null = latest[preferredField] ?? latest[orderField] ?? null;
      if (!ref) return { numerator: 9999, sourceRecordIds: [] };
      const days = Math.floor((Date.now() - ref.getTime()) / 86_400_000);
      return { numerator: Math.max(0, days), sourceRecordIds: [latest.id] };
    }

    if (n.kind === "CUSTOM") {
      return this.computeCustomNumerator(n.tag, scope, bounds);
    }

    // DERIVED is handled at the top of computeKpi — should never reach here
    return { numerator: 0, sourceRecordIds: [] };
  }

  // ── CUSTOM numerator handlers ──────────────────────────────────

  private async computeCustomNumerator(
    tag: string,
    scope: KpiScope,
    bounds: KpiPeriodBounds
  ): Promise<{ numerator: number; sourceRecordIds: string[] }> {
    switch (tag) {
      case "SEVERITY_NUMERATOR":
        return this.computeSeverityNumerator(scope, bounds);
      case "CAPA_CLOSURE":
        return this.computeCapaClosure(scope, bounds);
      case "TRAINING_COMPLIANCE":
        return this.computeTrainingCompliance(scope, bounds);
      case "INSPECTION_COMPLIANCE":
        return this.computeInspectionCompliance(scope, bounds);
      case "PTW_FLRA_COMPLIANCE":
        return this.computePtwFlraCompliance(scope, bounds);
      case "COST_OF_INCIDENTS":
        return this.computeCostOfIncidents(scope, bounds);
      default:
        throw new Error(`Unknown CUSTOM numerator tag: ${tag}`);
    }
  }

  /** IS 3786 severity: SUM(lostDays for LTI) + 6000 × FATALITY count. */
  private async computeSeverityNumerator(scope: KpiScope, bounds: KpiPeriodBounds) {
    const where = this.buildWhere("incident", scope, bounds, {
      type: { in: ["LTI", "FATALITY"] }
    });
    const incs = await this.prisma.incident.findMany({
      where,
      select: { id: true, type: true, lostDays: true }
    });
    let days = 0;
    for (const i of incs) {
      if (i.type === "FATALITY") days += this.fatalityDaysCharged;
      else days += i.lostDays ?? 0;
    }
    return { numerator: days, sourceRecordIds: incs.map((i) => i.id) };
  }

  /** CAPA on-time closure across NearMissCapa + IncidentCapa +
   *  InspectionFindingCapa. Numerator is the percentage directly;
   *  denominator is NONE in the registry. */
  private async computeCapaClosure(scope: KpiScope, bounds: KpiPeriodBounds) {
    // CAPAs from all three modules. Filter on targetDate within bounds
    // (i.e. CAPAs that were DUE in the period — the right denominator
    // for "closure rate of CAPAs due in this window").
    const dueRange = { gte: bounds.start, lt: bounds.end };

    // Plant scope is filtered on parent record where possible.
    const nmWhere: Record<string, unknown> = { targetDate: dueRange };
    const inWhere: Record<string, unknown> = { targetDate: dueRange };
    const fnWhere: Record<string, unknown> = { dueDate: dueRange };
    if (scope.plantId) {
      nmWhere.nearMiss = { plantId: scope.plantId };
      inWhere.incident = { plantId: scope.plantId };
      fnWhere.finding = { inspection: { plantId: scope.plantId } };
    }

    const [nm, inc, fn] = await Promise.all([
      this.prisma.nearMissCapa.findMany({
        where: nmWhere,
        select: { id: true, status: true, targetDate: true, completedAt: true }
      }),
      this.prisma.incidentCapa.findMany({
        where: inWhere,
        select: { id: true, status: true, targetDate: true, completedAt: true }
      }),
      this.prisma.inspectionFindingCapa.findMany({
        where: fnWhere,
        select: { id: true, status: true, dueDate: true, completedAt: true }
      })
    ]);

    const all = [
      ...nm.map((r) => ({ id: r.id, due: r.targetDate, done: r.completedAt })),
      ...inc.map((r) => ({ id: r.id, due: r.targetDate, done: r.completedAt })),
      ...fn.map((r) => ({ id: r.id, due: r.dueDate, done: r.completedAt }))
    ];
    if (all.length === 0) return { numerator: 0, sourceRecordIds: [] };
    const onTime = all.filter((c) => c.done && c.due && c.done <= c.due).length;
    return {
      numerator: (onTime / all.length) * 100,
      sourceRecordIds: all.map((r) => r.id)
    };
  }

  /** % of unique (employee, program) pairs whose LATEST record is
   *  valid + passed. Collapses retakes to the most recent attempt
   *  before counting (mirrors the dashboard's existing logic). */
  private async computeTrainingCompliance(scope: KpiScope, _bounds: KpiPeriodBounds) {
    // Compliance is "as of now", not period-bounded — `validUntil > now`
    // already captures currency. _bounds is accepted for signature
    // uniformity but intentionally unused.
    const where = scope.plantId
      ? { employee: { plantId: scope.plantId } }
      : {};
    const rows = await this.prisma.trainingRecord.findMany({
      where,
      select: { id: true, employeeId: true, programId: true, date: true, passed: true, validUntil: true }
    });
    if (rows.length === 0) return { numerator: 0, sourceRecordIds: [] };

    type Row = (typeof rows)[number];
    const latestByPair = new Map<string, Row>();
    for (const r of rows) {
      const key = `${r.employeeId}::${r.programId}`;
      const prev = latestByPair.get(key);
      if (!prev || r.date > prev.date) latestByPair.set(key, r);
    }
    const now = new Date();
    let valid = 0;
    const contributing: string[] = [];
    for (const r of latestByPair.values()) {
      contributing.push(r.id);
      if (r.passed && r.validUntil > now) valid++;
    }
    return {
      numerator: (valid / latestByPair.size) * 100,
      sourceRecordIds: contributing
    };
  }

  /** % of inspections in the period that completed on time. */
  private async computeInspectionCompliance(scope: KpiScope, bounds: KpiPeriodBounds) {
    const where: Record<string, unknown> = { scheduledDate: { gte: bounds.start, lt: bounds.end } };
    if (scope.plantId) where.plantId = scope.plantId;
    const rows = await this.prisma.inspection.findMany({
      where,
      select: { id: true, status: true }
    });
    if (rows.length === 0) return { numerator: 0, sourceRecordIds: [] };
    const completed = rows.filter((r) => r.status === "COMPLETED").length;
    return {
      numerator: (completed / rows.length) * 100,
      sourceRecordIds: rows.map((r) => r.id)
    };
  }

  /** % of permits in the period that have a linked FLRA. Should be
   *  100% for any plant with discipline. Anything else is a process
   *  failure that should escalate. */
  private async computePtwFlraCompliance(scope: KpiScope, bounds: KpiPeriodBounds) {
    const permitWhere: Record<string, unknown> = {
      createdAt: { gte: bounds.start, lt: bounds.end }
    };
    if (scope.plantId) permitWhere.plantId = scope.plantId;
    const permits = await this.prisma.permit.findMany({
      where: permitWhere,
      select: { id: true }
    });
    if (permits.length === 0) return { numerator: 0, sourceRecordIds: [] };
    const permitIds = permits.map((p) => p.id);
    const flrasWithPermits = await this.prisma.fLRA.findMany({
      where: { permitId: { in: permitIds } },
      select: { permitId: true }
    });
    const linkedPermitIds = new Set(flrasWithPermits.map((f) => f.permitId).filter(Boolean) as string[]);
    return {
      numerator: (linkedPermitIds.size / permits.length) * 100,
      sourceRecordIds: permitIds
    };
  }

  /** Sum of Incident.costTotal across the period. */
  private async computeCostOfIncidents(scope: KpiScope, bounds: KpiPeriodBounds) {
    const where = this.buildWhere("incident", scope, bounds, { costTotal: { not: null } });
    const rows = await this.prisma.incident.findMany({
      where,
      select: { id: true, costTotal: true }
    });
    const sum = rows.reduce((s, r) => s + Number(r.costTotal ?? 0), 0);
    return { numerator: sum, sourceRecordIds: rows.map((r) => r.id) };
  }

  // ── Derived KPIs ───────────────────────────────────────────────

  private async computeDerived(
    def: KpiDefinition,
    scope: KpiScope,
    period: KpiPeriod
  ): Promise<number> {
    if (def.numerator.kind !== "DERIVED") return 0;

    if (def.numerator.tag === "FSI") {
      // √((LTIFR × Severity Rate) ÷ 1000) per IS 3786
      const [ltifr, sev] = await Promise.all([
        this.computeKpi("LTIFR", scope, period),
        this.computeKpi("SEVERITY_RATE", scope, period)
      ]);
      const product = ltifr.value * sev.value;
      return product > 0 ? Math.sqrt(product / 1000) : 0;
    }

    if (def.numerator.tag === "HEINRICH_RATIO") {
      // Near Miss : Recordable Incident — uses absolute counts, not
      // rates (rates would cancel out the manhours denominator and
      // give a clean ratio anyway, but counts read better in drill-
      // down so we use them).
      const bounds = this.resolvePeriodBounds(period);
      const nmWhere = this.buildWhere("nearMiss", scope, bounds, {});
      const incWhere = this.buildWhere("incident", scope, bounds, {
        type: { in: ["MTC", "RWC", "LTI", "FATALITY"] }
      });
      const [nmCount, incCount] = await Promise.all([
        this.prisma.nearMiss.count({ where: nmWhere }),
        this.prisma.incident.count({ where: incWhere })
      ]);
      return incCount > 0 ? nmCount / incCount : nmCount; // unbounded when no incidents
    }

    return 0;
  }

  // ── Denominator: exposure hours ────────────────────────────────

  /**
   * Prefers ManhoursSubmission.netExposureHours; falls back to legacy
   * Manhours gross when no submission exists for the period. This
   * bridge exists ONLY until C6 backfills submissions for every month.
   *
   * Sub-plant scope (department / contractor) sums matching
   * ManhoursEmployeeCategory rows directly. Deductions are tracked
   * at submission level (plant-wide), so sub-plant denominators are
   * GROSS hours — the formula display surfaces this so the user
   * knows the LTIFR they're looking at uses gross-by-category, not
   * net.
   */
  private async computeExposureHours(
    scope: KpiScope,
    bounds: KpiPeriodBounds
  ): Promise<{ value: number; submissionIds: string[]; fellBackToLegacy: boolean }> {
    // Sub-plant scope path — query the categories table directly.
    if (scope.departmentId || scope.contractorCompanyId) {
      const categoryWhere: Record<string, unknown> = {
        submission: {
          reportingPeriodStart: { gte: bounds.start, lt: bounds.end },
          ...(scope.plantId ? { plantId: scope.plantId } : {})
        },
        ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
        ...(scope.contractorCompanyId ? { contractorCompanyId: scope.contractorCompanyId } : {})
      };
      const cats = await this.prisma.manhoursEmployeeCategory.findMany({
        where: categoryWhere,
        select: { totalHours: true, submissionId: true }
      });
      const value = cats.reduce((s, r) => s + (r.totalHours || 0), 0);
      const submissionIds = Array.from(new Set(cats.map((c) => c.submissionId)));
      return { value, submissionIds, fellBackToLegacy: false };
    }

    // Plant-wide / company-wide path — net exposure hours from submissions.
    const submissionWhere: Record<string, unknown> = {
      reportingPeriodStart: { gte: bounds.start, lt: bounds.end }
    };
    if (scope.plantId) submissionWhere.plantId = scope.plantId;

    const submissions = await this.prisma.manhoursSubmission.findMany({
      where: submissionWhere,
      select: { id: true, netExposureHours: true, plantId: true, reportingYear: true, reportingMonth: true }
    });

    if (submissions.length > 0) {
      const value = submissions.reduce((s, r) => s + (r.netExposureHours || 0), 0);
      return { value, submissionIds: submissions.map((s) => s.id), fellBackToLegacy: false };
    }

    // Fallback to legacy `Manhours` (gross hours). Iterate every month
    // intersecting the bounds — Manhours is keyed by (plantId, year, month).
    const legacyWhere: Record<string, unknown> = this.legacyMonthBoundsWhere(bounds);
    if (scope.plantId) legacyWhere.plantId = scope.plantId;
    const legacy = await this.prisma.manhours.findMany({
      where: legacyWhere,
      select: { employeeHours: true, contractorHours: true }
    });
    const value = legacy.reduce((s, r) => s + r.employeeHours + r.contractorHours, 0);
    return { value, submissionIds: [], fellBackToLegacy: legacy.length > 0 };
  }

  /** Build a Prisma where clause that picks legacy Manhours rows
   *  intersecting the date bounds, expressed as a year/month OR list. */
  private legacyMonthBoundsWhere(bounds: KpiPeriodBounds): Record<string, unknown> {
    const months: { year: number; month: number }[] = [];
    const cursor = new Date(bounds.start.getFullYear(), bounds.start.getMonth(), 1);
    while (cursor < bounds.end) {
      months.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    if (months.length === 0) return { id: "__none__" }; // empty match
    return { OR: months };
  }

  // ── Where-clause builders ──────────────────────────────────────

  /** Compose scope + period filters on top of the registry's base
   *  where clause. */
  private buildWhere(
    source: KpiSource,
    scope: KpiScope,
    bounds: KpiPeriodBounds,
    baseWhere?: Record<string, unknown>
  ): Record<string, unknown> {
    const dateField = SOURCE_DATE_FIELD[source];
    const fallbackDate = SOURCE_DATE_FALLBACK[source];

    const periodFilter: Record<string, unknown> = fallbackDate
      ? {
          OR: [
            { [dateField]: { gte: bounds.start, lt: bounds.end } },
            // Legacy rows: dateField is null, only fallback populated
            { AND: [{ [dateField]: null }, { [fallbackDate]: { gte: bounds.start, lt: bounds.end } }] }
          ]
        }
      : { [dateField]: { gte: bounds.start, lt: bounds.end } };

    const where: Record<string, unknown> = { ...periodFilter, ...(baseWhere ?? {}) };
    return this.applyScope(source, scope, where);
  }

  /** Layer scope (plantId / departmentId / contractorCompanyId) onto
   *  a where clause. Throws when a scope dimension isn't applicable
   *  to the source — UI gates the dropdown so this surfaces only on
   *  programmer error. */
  private applyScope(
    source: KpiSource,
    scope: KpiScope,
    where: Record<string, unknown>
  ): Record<string, unknown> {
    const out: Record<string, unknown> = { ...where };

    if (scope.plantId) {
      // Every source that goes through the standard buildWhere has a
      // direct plantId column.
      out.plantId = scope.plantId;
    }

    if (scope.departmentId) {
      const supports = SOURCE_SUPPORTS_DEPARTMENT[source];
      if (!supports) {
        throw new Error(
          `Department scope is not supported for source "${source}". ` +
            `Models without a departmentId column: observation, inspection, manhoursSubmission.`
        );
      }
      out.departmentId = scope.departmentId;
    }

    if (scope.contractorCompanyId) {
      // Only Incident-driven KPIs filter cleanly via the persons
      // relation. Other sources don't have contractor associations
      // we can layer onto a where clause.
      if (source !== "incident") {
        throw new Error(
          `Contractor scope is supported only for Incident-driven KPIs (LTIFR, TRIFR, TRIR, DART, Severity). ` +
            `Source "${source}" has no per-contractor breakdown.`
        );
      }
      out.persons = {
        some: { contractorCompanyId: scope.contractorCompanyId }
      };
    }

    return out;
  }

  /** Run a typed-where findMany and return only the IDs. */
  private async findIds(source: KpiSource, where: Record<string, unknown>): Promise<string[]> {
    const rows = await (this.prisma as any)[source].findMany({
      where,
      select: { id: true }
    });
    return rows.map((r: { id: string }) => r.id);
  }

  // ── Result assembly + formatting ───────────────────────────────

  private buildResult(
    def: KpiDefinition,
    scope: KpiScope,
    bounds: KpiPeriodBounds,
    value: number,
    numerator: number,
    denominator: number,
    audit: KpiAuditTrail
  ): KpiResult {
    const band = this.determineBand(value, def);
    return {
      kpiCode: def.code,
      kpiName: def.name,
      value,
      formattedValue: this.formatValue(value, def),
      numerator,
      denominator,
      formula: def.formula,
      band,
      bandColor: band ? BAND_COLOR[band] : "#94a3b8", // slate-400 for unbanded KPIs
      higherIsBetter: def.higherIsBetter,
      benchmarks: def.benchmarks,
      period: bounds,
      scope,
      computedAt: new Date(),
      audit
    };
  }

  private determineBand(value: number, def: KpiDefinition): KpiBand | null {
    if (!def.benchmarks) return null;
    const b = def.benchmarks;

    if (def.higherIsBetter) {
      if (value >= b.worldClass) return "WORLD_CLASS";
      if (value >= b.excellent) return "EXCELLENT";
      if (value >= b.average) return "AVERAGE";
      return "POOR";
    } else {
      // Lower is better — invert thresholds.
      if (value <= b.worldClass) return "WORLD_CLASS";
      if (value <= b.excellent) return "EXCELLENT";
      if (value <= b.average) return "AVERAGE";
      return "POOR";
    }
  }

  private formatValue(value: number, def: KpiDefinition): string {
    switch (def.displayFormat) {
      case "integer":
        return Math.round(value).toLocaleString("en-IN");
      case "percent":
        return `${value.toFixed(1)}%`;
      case "currency_indian":
        // ₹ with Indian grouping. No decimals — costs at this scale
        // are usually 6+ figures.
        return `₹${Math.round(value).toLocaleString("en-IN")}`;
      case "decimal_2_places":
      default:
        return value.toFixed(2);
    }
  }
}
