// ────────────────────────────────────────────────────────────────────────
// Server-side data loaders for MIS dashboard widgets.
//
// Each widget kind has one loader that takes (scope, period) and
// returns the shape the corresponding widget component expects. Page
// composition reads the persona layout, dispatches to the right
// loader per widget, then renders. Loaders are isolated so adding a
// new widget is one file change here + one render branch.
// ────────────────────────────────────────────────────────────────────────

import type { PrismaClient } from "@prisma/client";
import { KpiEngine, type KpiResult, type KpiScope, type KpiPeriod } from "./kpi-engine";
import { KPI_REGISTRY, type KpiCode } from "./kpi-registry";
import type { TrendPoint } from "@/components/manhours/widgets/trend-charts";
import type { OpenItem } from "@/components/manhours/widgets/open-items-counter";
import type { MiniCell } from "@/components/manhours/widgets/submission-status-mini";

export interface ResolvedScope extends KpiScope {
  /** Human-readable label for the scope, used in widget subtitles. */
  label: string;
}

const MONTH_SHORT = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Build a 12-month axis ending at the most-recently-completed month
 *  (submissions are post-period — current month is in progress). */
export function buildMonthAxis(monthCount = 12, anchor = new Date()): { year: number; month: number; label: string }[] {
  const end = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const axis: { year: number; month: number; label: string }[] = [];
  for (let i = monthCount; i >= 1; i--) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    axis.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${MONTH_SHORT[d.getMonth() + 1]} ${String(d.getFullYear()).slice(2)}`
    });
  }
  return axis;
}

// ─── KPI tile / gauge — single value + optional trend ─────────────

export async function loadKpiSingle(opts: {
  prisma: PrismaClient;
  code: KpiCode;
  scope: KpiScope;
  period: KpiPeriod;
  withTrend: boolean;
}): Promise<{ result: KpiResult; trend: Awaited<ReturnType<KpiEngine["computeTrend"]>> | null }> {
  const engine = new KpiEngine(opts.prisma);
  const result = await engine.computeKpi(opts.code, opts.scope, opts.period);
  let trend = null;
  if (opts.withTrend) {
    try {
      trend = await engine.computeTrend(opts.code, result.value, opts.scope, opts.period);
    } catch {
      // Period shape doesn't support trend — UI hides chip.
    }
  }
  return { result, trend };
}

// ─── Trend line / multi-line — N months × M KPIs ──────────────────

export async function loadTrendHistory(opts: {
  prisma: PrismaClient;
  codes: KpiCode[];
  scope: KpiScope;
  months: number;
}): Promise<TrendPoint[]> {
  const axis = buildMonthAxis(opts.months);
  const engine = new KpiEngine(opts.prisma);

  // Sequential per-month batches. Prisma's connection_limit=1
  // serialises anyway; this is friendlier to the pool than spraying
  // 12 parallel batches at it.
  const points: TrendPoint[] = [];
  for (const m of axis) {
    const period: KpiPeriod = { year: m.year, month: m.month };
    const batch = await engine.computeKpiBatch(opts.codes, opts.scope, period);
    const values: Record<string, number | null> = {};
    for (const code of opts.codes) {
      const r = batch[code];
      // 0/0 produces 0; we keep that to show "no events this month"
      // explicitly. Null would create a gap in the line.
      values[code] = r ? r.value : null;
    }
    points.push({ month: m.label, values });
  }
  return points;
}

// ─── Plant comparison bar — single KPI across all plants ──────────

export async function loadPlantComparison(opts: {
  prisma: PrismaClient;
  code: KpiCode;
  period: KpiPeriod;
  plants: { id: string; code: string; name: string }[];
}): Promise<{ plantCode: string; plantName: string; value: number; bandColor: string }[]> {
  const engine = new KpiEngine(opts.prisma);
  const rows = await Promise.all(
    opts.plants.map(async (p) => {
      const r = await engine.computeKpi(opts.code, { plantId: p.id }, opts.period);
      return {
        plantCode: p.code,
        plantName: p.name,
        value: r.value,
        bandColor: r.bandColor
      };
    })
  );
  return rows;
}

// ─── Open items counter — actionable list of overdue work ─────────

export async function loadOpenItems(opts: {
  prisma: PrismaClient;
  scope: KpiScope;
  userId: string;
}): Promise<OpenItem[]> {
  // Pending Manhours submissions in user's scope (or company-wide).
  const subWhere: Record<string, unknown> = { status: { in: ["DRAFT", "UNDER_REVIEW", "APPROVED"] } };
  if (opts.scope.plantId) subWhere.plantId = opts.scope.plantId;

  // CAPAs overdue across modules. Counting overdue (status PENDING/IN_PROGRESS
  // with targetDate in the past) gives the action-needed number.
  const now = new Date();
  const overdueCapaWhere = {
    targetDate: { lt: now },
    status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] }
  };

  // Findings open across inspections — high-aging surfaces here.
  const findingWhere: Record<string, unknown> = { status: { in: ["OPEN", "IN_PROGRESS"] } };
  if (opts.scope.plantId) {
    findingWhere.inspection = { plantId: opts.scope.plantId };
  }

  // Workflow tasks the current user owns (always personal, not scope-driven).
  const myTaskWhere = { assignedToId: opts.userId, status: { in: ["PENDING", "OVERDUE", "ESCALATED"] } };

  const [pendingSubmissions, overdueCapasNm, overdueCapasInc, overdueCapasFind, openFindings, myTasks] = await Promise.all([
    opts.prisma.manhoursSubmission.count({ where: subWhere }),
    opts.prisma.nearMissCapa.count({ where: overdueCapaWhere }),
    opts.prisma.incidentCapa.count({ where: overdueCapaWhere }),
    opts.prisma.inspectionFindingCapa.count({
      where: { dueDate: { lt: now }, status: { in: ["OPEN", "IN_PROGRESS"] } }
    }),
    opts.prisma.inspectionFinding.count({ where: findingWhere }),
    opts.prisma.workflowTask.count({ where: myTaskWhere })
  ]);

  const overdueCapasTotal = overdueCapasNm + overdueCapasInc + overdueCapasFind;

  return [
    {
      label: "My tasks",
      count: myTasks,
      tone: myTasks > 0 ? "warning" : "neutral",
      href: "/inbox",
      icon: "tasks"
    },
    {
      label: "Overdue CAPAs",
      count: overdueCapasTotal,
      tone: overdueCapasTotal > 5 ? "alert" : overdueCapasTotal > 0 ? "warning" : "neutral",
      href: "/inbox?tab=overdue",
      icon: "capas"
    },
    {
      label: "Open findings",
      count: openFindings,
      tone: openFindings > 10 ? "warning" : "neutral",
      href: "/inspections?status=OPEN",
      icon: "findings"
    },
    {
      label: "Pending submissions",
      count: pendingSubmissions,
      tone: pendingSubmissions > 0 ? "warning" : "neutral",
      href: "/manhours",
      icon: "submissions"
    }
  ];
}

// ─── Submission status mini-grid ─────────────────────────────────

export async function loadSubmissionGrid(opts: {
  prisma: PrismaClient;
  scope: KpiScope;
  monthCount?: number;
}): Promise<{
  plants: { id: string; code: string; name: string }[];
  monthsAxis: { year: number; month: number; label: string }[];
  cells: MiniCell[];
}> {
  const monthsAxis = buildMonthAxis(opts.monthCount ?? 12);
  const periodStart = new Date(monthsAxis[0].year, monthsAxis[0].month - 1, 1);
  const periodEnd = new Date(
    monthsAxis[monthsAxis.length - 1].year,
    monthsAxis[monthsAxis.length - 1].month,
    1
  );

  const plantWhere = opts.scope.plantId ? { id: opts.scope.plantId } : {};
  const plants = await opts.prisma.plant.findMany({
    where: plantWhere,
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true }
  });
  const plantIds = plants.map((p) => p.id);

  const submissions = await opts.prisma.manhoursSubmission.findMany({
    where: {
      plantId: { in: plantIds },
      reportingPeriodStart: { gte: periodStart, lt: periodEnd }
    },
    select: { plantId: true, reportingYear: true, reportingMonth: true, status: true }
  });
  const legacy = await opts.prisma.manhours.findMany({
    where: {
      plantId: { in: plantIds },
      OR: monthsAxis.map((m) => ({ year: m.year, month: m.month }))
    },
    select: { plantId: true, year: true, month: true }
  });

  const subMap = new Map<string, string>();
  for (const s of submissions) {
    subMap.set(`${s.plantId}::${s.reportingYear}-${s.reportingMonth}`, s.status);
  }
  const legacySet = new Set<string>();
  for (const l of legacy) legacySet.add(`${l.plantId}::${l.year}-${l.month}`);

  const plantMap = new Map(plants.map((p) => [p.id, p]));
  const cells: MiniCell[] = [];
  for (const p of plants) {
    for (const m of monthsAxis) {
      const key = `${p.id}::${m.year}-${m.month}`;
      const status = subMap.get(key) ?? (legacySet.has(key) ? "LEGACY" : "NOT_STARTED");
      cells.push({
        plantId: p.id,
        plantCode: p.code,
        plantName: p.name,
        year: m.year,
        month: m.month,
        status
      });
    }
  }

  return { plants, monthsAxis, cells };
}

// ─── Heinrich pyramid — counts across last 12 months ─────────────

export async function loadHeinrichPyramid(opts: {
  prisma: PrismaClient;
  scope: KpiScope;
}): Promise<{ level: string; count: number; color: string }[]> {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - 12, 1);
  const incWhere: Record<string, unknown> = { date: { gte: start, lt: end } };
  const nmWhere: Record<string, unknown> = { date: { gte: start, lt: end } };
  const obsWhere: Record<string, unknown> = { date: { gte: start, lt: end } };
  if (opts.scope.plantId) {
    incWhere.plantId = opts.scope.plantId;
    nmWhere.plantId = opts.scope.plantId;
    obsWhere.plantId = opts.scope.plantId;
  }

  const [incidents, nm, obs] = await Promise.all([
    opts.prisma.incident.findMany({ where: incWhere, select: { type: true } }),
    opts.prisma.nearMiss.count({ where: nmWhere }),
    opts.prisma.observation.count({
      where: {
        ...obsWhere,
        type: { in: ["UNSAFE_ACT", "UNSAFE_CONDITION"] }
      }
    })
  ]);

  return [
    { level: "Fatality", count: incidents.filter((i) => i.type === "FATALITY").length, color: "#7f1d1d" },
    { level: "LTI", count: incidents.filter((i) => i.type === "LTI").length, color: "#dc2626" },
    { level: "RWC + MTC", count: incidents.filter((i) => i.type === "RWC" || i.type === "MTC").length, color: "#ea580c" },
    { level: "First Aid", count: incidents.filter((i) => i.type === "FIRST_AID").length, color: "#f59e0b" },
    { level: "Near Miss", count: nm, color: "#3b82f6" },
    { level: "Unsafe Acts/Conds", count: obs, color: "#7c3aed" }
  ];
}

// ─── Build a drill-down href for a KPI tile ──────────────────────

export function kpiDrillHref(opts: {
  code: KpiCode;
  scope: KpiScope;
  period: KpiPeriod;
}): string {
  const p = new URLSearchParams({ code: opts.code });
  if (opts.scope.plantId) p.set("plantId", opts.scope.plantId);
  if (opts.scope.departmentId) p.set("departmentId", opts.scope.departmentId);
  if (opts.scope.contractorCompanyId) p.set("contractorCompanyId", opts.scope.contractorCompanyId);
  p.set("year", String(opts.period.year));
  if (opts.period.month != null) p.set("month", String(opts.period.month));
  if (opts.period.quarter != null) p.set("quarter", String(opts.period.quarter));
  if (opts.period.isYTD) p.set("isYTD", "true");
  if (opts.period.isRolling12) p.set("isRolling12", "true");
  p.set("includeTrend", "true");
  return `/manhours/kpi?${p.toString()}`;
}
