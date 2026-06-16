// ────────────────────────────────────────────────────────────────────────
// Report composition layer.
//
// Pulls KPI results (snapshot when available, live otherwise) +
// cross-module summary data (incidents, near misses, top findings)
// + generates the executive narrative, then hands the assembled
// shape to the report page for rendering.
//
// Three report shapes share most of the loader logic; only the
// period bounds + scope vary:
//
//   Monthly   — single plant, single month, snapshot-preferred
//   Quarterly — all plants, fiscal quarter, live compute
//   Annual    — all plants, full year, live compute + YoY comparison
//
// All three return a `ReportData` the page renders to HTML. Browser's
// print-to-PDF works directly on the page; no PDF library needed.
// ────────────────────────────────────────────────────────────────────────

import type { PrismaClient } from "@prisma/client";
import { KpiEngine, type KpiResult, type KpiPeriod, type KpiScope } from "./kpi-engine";
import { KPI_CODES, type KpiCode } from "./kpi-registry";
import { generateMonthlyNarrative, type NarrativeResult } from "./narrative";
import { buildScorecard } from "./scorecard";
import type { ScorecardRow } from "@/components/manhours/widgets/performance-scorecard";

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type ReportKind = "monthly" | "quarterly" | "annual";

export interface ReportPlantHeader {
  id: string;
  name: string;
  code: string;
  unitType: string;
}

export interface ReportIncidentSummary {
  id: string;
  number: string | null;
  date: string;
  type: string;
  severity: string | null;
  description: string;
  lostDays: number;
  href: string;
}

export interface ReportFindingSummary {
  id: string;
  title: string;
  status: string;
  daysOpen: number;
  href: string;
}

export interface ReportData {
  kind: ReportKind;
  /** Single plant for monthly; null for quarterly/annual (group-wide). */
  plant: ReportPlantHeader | null;
  periodLabel: string;
  /** YYYY-MM-DD bounds — UI shows as the printed report's coverage. */
  periodStart: string;
  periodEnd: string;
  generatedAt: string;

  /** All 15 KPIs computed for the report's scope. */
  kpis: Record<string, KpiResult>;
  /** Prior-period KPIs for YoY / MoM comparison — null when not applicable. */
  priorKpis: Record<string, KpiResult> | null;
  priorPeriodLabel: string | null;

  /** True when KPIs came from a LOCKED submission's kpiSnapshot.
   *  Reports for LOCKED periods are reproducible — re-running the
   *  report a year later returns the same numbers. */
  fromSnapshot: boolean;
  snapshotCapturedAt: string | null;

  /** Plant-vs-plant ranking for quarterly + annual reports;
   *  null for monthly (single plant). */
  scorecard: ScorecardRow[] | null;

  /** Recordable incidents in the period. */
  incidents: ReportIncidentSummary[];
  /** Aged open findings — surfaces what's outstanding. */
  openFindings: ReportFindingSummary[];

  /** Executive narrative. */
  narrative: NarrativeResult;
}

// ─── Period helpers ──────────────────────────────────────────────

function monthlyPeriod(year: number, month: number): { period: KpiPeriod; label: string; start: Date; end: Date } {
  return {
    period: { year, month },
    label: `${MONTHS[month]} ${year}`,
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 1)
  };
}

function quarterlyPeriod(year: number, quarter: 1 | 2 | 3 | 4): { period: KpiPeriod; label: string; start: Date; end: Date } {
  // Indian fiscal Q1 = Apr-Jun, Q2 = Jul-Sep, Q3 = Oct-Dec, Q4 = Jan-Mar.
  // Mirrors KpiEngine.resolvePeriodBounds for consistency.
  const fyStart0 = 3; // April, 0-indexed
  const qStart0 = (fyStart0 + (quarter - 1) * 3) % 12;
  const qYear = qStart0 < fyStart0 ? year + 1 : year;
  const start = new Date(qYear, qStart0, 1);
  const end = new Date(qYear, qStart0 + 3, 1);
  return {
    period: { year, quarter },
    label: `FY${String(year).slice(2)} Q${quarter}`,
    start,
    end
  };
}

function annualPeriod(year: number): { period: KpiPeriod; label: string; start: Date; end: Date } {
  return {
    period: { year },
    label: String(year),
    start: new Date(year, 0, 1),
    end: new Date(year + 1, 0, 1)
  };
}

// ─── Monthly report ──────────────────────────────────────────────

export async function buildMonthlyReport(opts: {
  prisma: PrismaClient;
  plantId: string;
  year: number;
  month: number;
}): Promise<ReportData> {
  const { prisma, plantId, year, month } = opts;
  const period = monthlyPeriod(year, month);
  const priorPeriod = monthlyPeriod(
    month === 1 ? year - 1 : year,
    month === 1 ? 12 : month - 1
  );

  const [plant, submission] = await Promise.all([
    prisma.plant.findUniqueOrThrow({
      where: { id: plantId },
      select: { id: true, name: true, code: true, unitType: true }
    }),
    prisma.manhoursSubmission.findUnique({
      where: { plantId_reportingYear_reportingMonth: { plantId, reportingYear: year, reportingMonth: month } },
      select: { id: true, status: true, kpiSnapshot: true }
    })
  ]);

  // Snapshot-vs-live — same logic as the drill-down page.
  let kpis: Record<string, KpiResult>;
  let fromSnapshot = false;
  let snapshotCapturedAt: string | null = null;
  if (submission?.status === "LOCKED" && submission.kpiSnapshot) {
    const env = submission.kpiSnapshot as { capturedAt?: string; kpis?: Record<string, KpiResult> };
    if (env.kpis) {
      kpis = env.kpis;
      fromSnapshot = true;
      snapshotCapturedAt = env.capturedAt ?? null;
    } else {
      kpis = await liveKpis(prisma, { plantId }, period.period);
    }
  } else {
    kpis = await liveKpis(prisma, { plantId }, period.period);
  }

  // Comparison KPIs are always live (we don't snapshot prior periods
  // from the current report's vantage point).
  const priorKpis = await liveKpis(prisma, { plantId }, priorPeriod.period);

  const [incidents, openFindings] = await Promise.all([
    loadPeriodIncidents(prisma, { plantId }, period.start, period.end),
    loadOpenFindings(prisma, { plantId }, 5)
  ]);

  // Context for the narrative — surfaces things the KPI table alone
  // doesn't tell. Keep it concise; the model writes the actual prose.
  const contextNotes = buildContextNotes(incidents, fromSnapshot);

  const narrative = await generateMonthlyNarrative({
    plantName: plant.name,
    plantCode: plant.code,
    reportingPeriodLabel: period.label,
    kpis,
    priorKpis,
    priorPeriodLabel: priorPeriod.label,
    contextNotes
  });

  return {
    kind: "monthly",
    plant,
    periodLabel: period.label,
    periodStart: period.start.toISOString().slice(0, 10),
    periodEnd: new Date(period.end.getTime() - 1).toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    kpis,
    priorKpis,
    priorPeriodLabel: priorPeriod.label,
    fromSnapshot,
    snapshotCapturedAt,
    scorecard: null,
    incidents,
    openFindings,
    narrative
  };
}

// ─── Quarterly + annual reports ──────────────────────────────────

export async function buildQuarterlyReport(opts: {
  prisma: PrismaClient;
  year: number;
  quarter: 1 | 2 | 3 | 4;
}): Promise<ReportData> {
  const { prisma, year, quarter } = opts;
  const period = quarterlyPeriod(year, quarter);

  const plants = await prisma.plant.findMany({
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, unitType: true }
  });

  const [kpis, scorecard, incidents] = await Promise.all([
    liveKpis(prisma, {}, period.period),
    buildScorecard({ prisma, plants, period: period.period }),
    loadPeriodIncidents(prisma, {}, period.start, period.end)
  ]);

  const narrative = await generateMonthlyNarrative({
    plantName: "Group",
    plantCode: "GROUP",
    reportingPeriodLabel: period.label,
    kpis,
    contextNotes: buildGroupContextNotes(scorecard, incidents)
  });

  return {
    kind: "quarterly",
    plant: null,
    periodLabel: period.label,
    periodStart: period.start.toISOString().slice(0, 10),
    periodEnd: new Date(period.end.getTime() - 1).toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    kpis,
    priorKpis: null,
    priorPeriodLabel: null,
    fromSnapshot: false,
    snapshotCapturedAt: null,
    scorecard,
    incidents,
    openFindings: [],
    narrative
  };
}

export async function buildAnnualReport(opts: {
  prisma: PrismaClient;
  year: number;
}): Promise<ReportData> {
  const { prisma, year } = opts;
  const period = annualPeriod(year);
  const priorPeriod = annualPeriod(year - 1);

  const plants = await prisma.plant.findMany({
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, unitType: true }
  });

  const [kpis, priorKpis, scorecard, incidents] = await Promise.all([
    liveKpis(prisma, {}, period.period),
    liveKpis(prisma, {}, priorPeriod.period),
    buildScorecard({ prisma, plants, period: period.period }),
    loadPeriodIncidents(prisma, {}, period.start, period.end)
  ]);

  const narrative = await generateMonthlyNarrative({
    plantName: "Group",
    plantCode: "GROUP",
    reportingPeriodLabel: period.label,
    kpis,
    priorKpis,
    priorPeriodLabel: priorPeriod.label,
    contextNotes: buildGroupContextNotes(scorecard, incidents)
  });

  return {
    kind: "annual",
    plant: null,
    periodLabel: period.label,
    periodStart: period.start.toISOString().slice(0, 10),
    periodEnd: new Date(period.end.getTime() - 1).toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    kpis,
    priorKpis,
    priorPeriodLabel: priorPeriod.label,
    fromSnapshot: false,
    snapshotCapturedAt: null,
    scorecard,
    incidents,
    openFindings: [],
    narrative
  };
}

// ─── Shared loaders ──────────────────────────────────────────────

async function liveKpis(
  prisma: PrismaClient,
  scope: KpiScope,
  period: KpiPeriod
): Promise<Record<string, KpiResult>> {
  const engine = new KpiEngine(prisma);
  return engine.computeKpiBatch(KPI_CODES, scope, period);
}

async function loadPeriodIncidents(
  prisma: PrismaClient,
  scope: { plantId?: string },
  start: Date,
  end: Date
): Promise<ReportIncidentSummary[]> {
  const where: Record<string, unknown> = {
    type: { in: ["MTC", "RWC", "LTI", "FATALITY"] },
    OR: [
      { occurredAt: { gte: start, lt: end } },
      { AND: [{ occurredAt: null }, { date: { gte: start, lt: end } }] }
    ]
  };
  if (scope.plantId) where.plantId = scope.plantId;

  const rows = await prisma.incident.findMany({
    where,
    select: {
      id: true,
      number: true,
      date: true,
      occurredAt: true,
      type: true,
      severity: true,
      description: true,
      lostDays: true
    },
    orderBy: [{ occurredAt: "desc" }, { date: "desc" }]
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    date: (r.occurredAt ?? r.date).toISOString().slice(0, 10),
    type: r.type,
    severity: r.severity,
    description: r.description.slice(0, 200),
    lostDays: r.lostDays ?? 0,
    href: `/incidents/${r.id}`
  }));
}

async function loadOpenFindings(
  prisma: PrismaClient,
  scope: { plantId?: string },
  limit: number
): Promise<ReportFindingSummary[]> {
  const where: Record<string, unknown> = { status: { in: ["OPEN", "IN_PROGRESS"] } };
  if (scope.plantId) where.inspection = { plantId: scope.plantId };

  const rows = await prisma.inspectionFinding.findMany({
    where,
    select: { id: true, title: true, description: true, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: limit
  });
  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    title: (r.title || r.description).slice(0, 140),
    status: r.status,
    daysOpen: Math.floor((now - r.createdAt.getTime()) / 86_400_000),
    href: `/inspections?finding=${r.id}`
  }));
}

function buildContextNotes(incidents: ReportIncidentSummary[], fromSnapshot: boolean): string | undefined {
  const parts: string[] = [];
  if (incidents.length > 0) {
    const ltiCount = incidents.filter((i) => i.type === "LTI" || i.type === "FATALITY").length;
    if (ltiCount > 0) {
      parts.push(`${ltiCount} lost-time incident${ltiCount === 1 ? "" : "s"} in the period`);
    }
    const recordable = incidents.length;
    parts.push(`${recordable} recordable incident${recordable === 1 ? "" : "s"} total (MTC/RWC/LTI/FATALITY)`);
  } else {
    parts.push("No recordable incidents in the period");
  }
  if (fromSnapshot) {
    parts.push("KPIs in this report are the immutable snapshot captured at lock");
  }
  return parts.length > 0 ? parts.join(". ") + "." : undefined;
}

function buildGroupContextNotes(
  scorecard: ScorecardRow[],
  incidents: ReportIncidentSummary[]
): string | undefined {
  const parts: string[] = [];
  if (scorecard.length > 0) {
    const top = scorecard.sort((a, b) => b.score - a.score)[0];
    const bottom = scorecard.sort((a, b) => a.score - b.score)[0];
    if (top && bottom && top.plantId !== bottom.plantId) {
      parts.push(
        `Top performer: ${top.plantName} (${top.score.toFixed(1)}/100). Lagging: ${bottom.plantName} (${bottom.score.toFixed(1)}/100)`
      );
    }
  }
  if (incidents.length > 0) {
    const ltiTotal = incidents.filter((i) => i.type === "LTI" || i.type === "FATALITY").length;
    parts.push(
      `${incidents.length} group-wide recordable incidents in the period, of which ${ltiTotal} were LTI or fatality`
    );
  }
  return parts.length > 0 ? parts.join(". ") + "." : undefined;
}
