// ────────────────────────────────────────────────────────────────────────
// Composite plant performance score.
//
// Maps each weighted KPI's raw value onto a 0-100 scale (linear
// interpolation across the registry's benchmark bands), then takes
// the weighted average. KPIs without benchmarks (FSI, DAYS_SINCE_LTI,
// COST_OF_INCIDENTS) are skipped — their weights would distort the
// scale and they're already captured by their constituent KPIs.
//
// Lives in its own module so the scorecard widget + the comparison
// page + future export jobs share one canonical computation.
// ────────────────────────────────────────────────────────────────────────

import { KpiEngine, type KpiResult } from "./kpi-engine";
import { KPI_REGISTRY, type KpiCode } from "./kpi-registry";
import { SCORECARD_WEIGHTS } from "./personas";
import { scoreBand, type ScorecardRow } from "@/components/manhours/widgets/performance-scorecard";
import type { PrismaClient } from "@prisma/client";

interface Contribution {
  code: KpiCode;
  weight: number;
  rawValue: number;
  /** 0-100 after benchmark interpolation. */
  normalised: number;
}

/** Normalise a single KPI value to the 0-100 scale used in the
 *  scorecard. Returns null when benchmarks aren't defined (caller
 *  skips the KPI). */
export function normaliseKpiValue(value: number, code: KpiCode): number | null {
  const def = KPI_REGISTRY[code];
  if (!def.benchmarks) return null;
  const b = def.benchmarks;

  // Higher-is-better: world-class = 100, poor = 0. Lower-is-better
  // inverts. Linear interpolation between adjacent band thresholds
  // keeps the score continuous (no cliffs) while preserving the
  // band-aware shape.
  if (def.higherIsBetter) {
    if (value >= b.worldClass) return 100;
    if (value >= b.excellent) return lerp(value, b.excellent, b.worldClass, 85, 100);
    if (value >= b.average) return lerp(value, b.average, b.excellent, 70, 85);
    if (value >= b.poor) return lerp(value, b.poor, b.average, 50, 70);
    return Math.max(0, lerp(value, 0, b.poor, 0, 50));
  }
  // Lower is better
  if (value <= b.worldClass) return 100;
  if (value <= b.excellent) return lerp(value, b.worldClass, b.excellent, 100, 85);
  if (value <= b.average) return lerp(value, b.excellent, b.average, 85, 70);
  if (value <= b.poor) return lerp(value, b.average, b.poor, 70, 50);
  // Beyond poor — clamp at 0. Cap at 2× poor to avoid extreme
  // outliers dominating the floor.
  return Math.max(0, lerp(Math.min(value, b.poor * 2), b.poor, b.poor * 2, 50, 0));
}

function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return y0;
  const t = (x - x0) / (x1 - x0);
  return y0 + t * (y1 - y0);
}

/** Compute a single plant's composite score from a pre-computed batch
 *  of KPI results. Returns null if no scorecard KPIs have benchmarks
 *  (very unlikely; defensive). */
export function computePlantScore(
  results: Record<string, KpiResult>
): { score: number; contributions: Contribution[] } | null {
  let weightedSum = 0;
  let totalWeight = 0;
  const contributions: Contribution[] = [];

  for (const w of SCORECARD_WEIGHTS) {
    const r = results[w.code];
    if (!r) continue;
    const normalised = normaliseKpiValue(r.value, w.code);
    if (normalised == null) continue; // KPI has no benchmarks — skip
    contributions.push({ code: w.code, weight: w.weight, rawValue: r.value, normalised });
    weightedSum += normalised * w.weight;
    totalWeight += w.weight;
  }
  if (totalWeight === 0) return null;
  return { score: weightedSum / totalWeight, contributions };
}

/** Compute scorecard rows for every plant. Runs the engine in
 *  parallel — each plant's KPI batch is one Promise. */
export async function buildScorecard(opts: {
  prisma: PrismaClient;
  plants: { id: string; code: string; name: string }[];
  period: { year: number; month?: number; isRolling12?: boolean };
}): Promise<ScorecardRow[]> {
  const engine = new KpiEngine(opts.prisma);
  const codes: KpiCode[] = SCORECARD_WEIGHTS.map((w) => w.code);

  const rows = await Promise.all(
    opts.plants.map(async (plant) => {
      const results = await engine.computeKpiBatch(codes, { plantId: plant.id }, opts.period);
      const computed = computePlantScore(results);
      if (!computed) return null;
      return {
        plantId: plant.id,
        plantCode: plant.code,
        plantName: plant.name,
        score: computed.score,
        band: scoreBand(computed.score),
        contributions: computed.contributions
      } as ScorecardRow;
    })
  );
  return rows.filter((r): r is ScorecardRow => r != null);
}
