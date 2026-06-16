// GET /api/manhours/kpi
//
// Single-KPI drill-down. Returns the KpiResult, hydrated source
// records, optional trend, and a flag indicating whether the value
// came from a LOCKED submission's frozen snapshot or live compute.
//
// Query params:
//   code                   — KPI code (required, must be in registry)
//   plantId?               — single plant scope; omit for company-wide
//   departmentId?          — sub-plant scope (Incident / NearMiss / Permit only)
//   contractorCompanyId?   — Incident-driven KPIs only
//   year                   — required
//   month?                 — single calendar month (1-12)
//   quarter?               — 1-4 (Indian fiscal)
//   isYTD?                 — "true" to compute year-to-date
//   isRolling12?           — "true" for rolling 12 months ending at month
//   includeTrend?          — "true" to also compute prior-period delta
//   preferSnapshot?        — "true" (default) to return cached snapshot
//                            when the period+scope match a LOCKED row
//
// The snapshot path is the audit-defensible one: re-renders never
// shift historical numbers even when source incidents get reclassified
// after lock.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import { KpiEngine, type KpiPeriod, type KpiScope, type KpiResult } from "@/lib/manhours/kpi-engine";
import { KPI_REGISTRY, KPI_CODES, type KpiCode } from "@/lib/manhours/kpi-registry";
import { hydrateRecords, inferDrillSourceForKpi } from "@/lib/manhours/drill-down";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code || !(KPI_CODES as readonly string[]).includes(code)) {
    return NextResponse.json(
      { error: `code is required and must be one of: ${KPI_CODES.join(", ")}` },
      { status: 400 }
    );
  }
  const kpiCode = code as KpiCode;

  const plantId = url.searchParams.get("plantId") ?? undefined;
  const departmentId = url.searchParams.get("departmentId") ?? undefined;
  const contractorCompanyId = url.searchParams.get("contractorCompanyId") ?? undefined;
  const yearRaw = url.searchParams.get("year");
  const year = yearRaw ? parseInt(yearRaw, 10) : new Date().getFullYear();
  if (isNaN(year)) {
    return NextResponse.json({ error: "year must be a valid integer" }, { status: 400 });
  }
  const monthRaw = url.searchParams.get("month");
  const month = monthRaw ? parseInt(monthRaw, 10) : undefined;
  if (month != null && (isNaN(month) || month < 1 || month > 12)) {
    return NextResponse.json({ error: "month must be 1-12" }, { status: 400 });
  }
  const quarterRaw = url.searchParams.get("quarter");
  const quarter = quarterRaw ? (parseInt(quarterRaw, 10) as 1 | 2 | 3 | 4) : undefined;
  const isYTD = url.searchParams.get("isYTD") === "true";
  const isRolling12 = url.searchParams.get("isRolling12") === "true";
  const includeTrend = url.searchParams.get("includeTrend") === "true";
  const preferSnapshot = url.searchParams.get("preferSnapshot") !== "false"; // default true

  // RBAC — MANHOURS.READ at the relevant plant. When plantId is
  // omitted (company-wide), require ALL_PLANTS by passing no plant
  // context — the can() helper then enforces ALL_PLANTS scope.
  const allowed = await can(userId, "MANHOURS.READ", plantId ? { plantId } : {});
  if (!allowed.allowed) {
    return NextResponse.json({ error: allowed.reason ?? "Forbidden" }, { status: 403 });
  }

  const scope: KpiScope = { plantId, departmentId, contractorCompanyId };
  const period: KpiPeriod = { year, month, quarter, isYTD, isRolling12 };
  const engine = new KpiEngine(prisma);

  let result: KpiResult;
  let fromSnapshot = false;
  let snapshotCapturedAt: string | null = null;

  // Snapshot path — only when the request matches a single LOCKED
  // submission (single plant + single month + no sub-plant scope).
  const snapshotEligible =
    preferSnapshot &&
    plantId &&
    month != null &&
    !departmentId &&
    !contractorCompanyId &&
    !quarter &&
    !isYTD &&
    !isRolling12;

  if (snapshotEligible && plantId && month != null) {
    const cached = await engine.findKpiSnapshot({ code: kpiCode, plantId, year, month });
    if (cached) {
      result = cached;
      fromSnapshot = true;
      // Pull capturedAt from the parent snapshot envelope.
      const sub = await prisma.manhoursSubmission.findUnique({
        where: {
          plantId_reportingYear_reportingMonth: { plantId, reportingYear: year, reportingMonth: month }
        },
        select: { kpiSnapshot: true }
      });
      const env = sub?.kpiSnapshot as { capturedAt?: string } | null;
      snapshotCapturedAt = env?.capturedAt ?? null;
    } else {
      try {
        result = await engine.computeKpi(kpiCode, scope, period);
      } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Compute failed" }, { status: 400 });
      }
    }
  } else {
    try {
      result = await engine.computeKpi(kpiCode, scope, period);
    } catch (e: any) {
      return NextResponse.json({ error: e?.message ?? "Compute failed" }, { status: 400 });
    }
  }

  // Hydrate contributing source records for the audit trail.
  const drillSource = inferDrillSourceForKpi(kpiCode);
  const records = drillSource
    ? await hydrateRecords(prisma, drillSource, result.audit.sourceRecordIds.slice(0, 200))
    : [];

  // Trend — only when the period shape supports it.
  let trend: Awaited<ReturnType<typeof engine.computeTrend>> | null = null;
  if (includeTrend && !fromSnapshot) {
    try {
      trend = await engine.computeTrend(kpiCode, result.value, scope, period);
    } catch {
      // Period shape doesn't support trend (quarter/year/YTD/custom)
      // — UI just hides the trend chip.
      trend = null;
    }
  }

  return NextResponse.json({
    result,
    records,
    trend,
    fromSnapshot,
    snapshotCapturedAt,
    definition: {
      code: KPI_REGISTRY[kpiCode].code,
      name: KPI_REGISTRY[kpiCode].name,
      formula: KPI_REGISTRY[kpiCode].formula,
      statutoryReference: KPI_REGISTRY[kpiCode].statutoryReference,
      exclusionRules: KPI_REGISTRY[kpiCode].exclusionRules,
      benchmarks: KPI_REGISTRY[kpiCode].benchmarks,
      higherIsBetter: KPI_REGISTRY[kpiCode].higherIsBetter,
      isPercentage: KPI_REGISTRY[kpiCode].isPercentage,
      isStreakMetric: KPI_REGISTRY[kpiCode].isStreakMetric
    }
  });
}
