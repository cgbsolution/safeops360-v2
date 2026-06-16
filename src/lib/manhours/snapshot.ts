// ────────────────────────────────────────────────────────────────────────
// Lock-time KPI snapshot.
//
// At the LOCKED transition we run the KPI engine for the period + plant
// and freeze the result into ManhoursSubmission.kpiSnapshot. Future
// re-renders read THIS snapshot — they never re-run the engine for
// historical periods. This is the audit-defensibility contract: "What
// was our LTIFR in March 2026?" must always return the same answer.
//
// The snapshot stores: every KPI's full result (numerator records,
// denominator, formula, value, band) + the registry version it was
// computed against, so the trail survives later registry changes.
// ────────────────────────────────────────────────────────────────────────

import type { PrismaClient } from "@prisma/client";
import { KpiEngine, type KpiResult } from "./kpi-engine";
import { KPI_CODES, type KpiCode } from "./kpi-registry";

export interface KpiSnapshot {
  capturedAt: string; // ISO
  capturedById: string;
  registryVersion: string; // bump when changing formulas
  scope: { plantId: string };
  period: { year: number; month: number };
  /** Map of KPI code → result. Stored as a plain object so it
   *  round-trips cleanly through Prisma's Json column. */
  kpis: Record<KpiCode, KpiResult>;
}

// Bump this when the registry's formulas / multipliers change. Old
// snapshots keep their stored version; new snapshots get the new
// version. Auditors can tell which formula generation produced any
// given historical KPI.
const REGISTRY_VERSION = "1.0.0";

export async function captureKpiSnapshot(opts: {
  prisma: PrismaClient;
  submissionId: string;
  capturedById: string;
}): Promise<KpiSnapshot> {
  const sub = await opts.prisma.manhoursSubmission.findUniqueOrThrow({
    where: { id: opts.submissionId },
    select: {
      plantId: true,
      reportingYear: true,
      reportingMonth: true
    }
  });

  const engine = new KpiEngine(opts.prisma);
  // Single-month scope. KPIs that compare to prior periods (none in
  // the current registry, but reserved) would need a different scope
  // — handled per-KPI in C4 when drill-downs land.
  const results = await engine.computeKpiBatch(
    KPI_CODES,
    { plantId: sub.plantId },
    { year: sub.reportingYear, month: sub.reportingMonth }
  );

  const snapshot: KpiSnapshot = {
    capturedAt: new Date().toISOString(),
    capturedById: opts.capturedById,
    registryVersion: REGISTRY_VERSION,
    scope: { plantId: sub.plantId },
    period: { year: sub.reportingYear, month: sub.reportingMonth },
    // KpiResult contains Date objects; serialise them so the JSON
    // round-trip is lossless. Casting via JSON.parse(JSON.stringify())
    // is the simplest way to flatten Dates to ISO strings.
    kpis: JSON.parse(JSON.stringify(results)) as Record<KpiCode, KpiResult>
  };

  return snapshot;
}
