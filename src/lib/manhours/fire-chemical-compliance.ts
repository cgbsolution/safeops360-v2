// Fire/Chemical checklist completion, as an EHS Scorecard source.
//
// ─── THE STACK-BOUNDARY DECISION ──────────────────────────────────────────
//
// The Scorecard is frontend TypeScript over Prisma. Fire and Chemical checklist
// data lives in the backend (FastAPI/SQLAlchemy) as CamsEngagement rows. Two
// ways to bridge that:
//
//   A. a backend endpoint the Scorecard calls          ← CHOSEN
//   B. Prisma reading the CAMS tables directly from the frontend
//
// (A), for two reasons that both point the same way:
//
//   1. MIGRATION.md states the architectural goal outright: "the Next.js layer
//      must hold no database access at all. Prisma is removed outright as each
//      file is cut over — no fallback path, because a fallback keeps the
//      duplication the migration exists to delete." Option (B) adds a new
//      Prisma call site to a layer actively being emptied of them, and would
//      have to be removed again by whoever finishes that migration.
//
//   2. It would be a SECOND implementation of completion rate. The completion
//      rate already exists once, in the backend, feeding the CAMS Compliance
//      Snapshot and the Operations panel. A Prisma reimplementation would give
//      the Scorecard its own arithmetic over the same tables — and the whole
//      point of the shared read model is that these numbers cannot disagree.
//      Two queries maintained by two people in two languages is exactly the
//      drift this build exists to prevent.
//
// The cost of (A) is a network hop per plant inside a report build, which is
// why the fetch is per-plant-parallel and failure-tolerant below.
//
// ─── "CANNOT BE COMPUTED" IS NOT ZERO ─────────────────────────────────────
//
// The backend returns `rate: null` when nothing was owed in the window — no
// assets, no applicable checklist, or a period before the register existed.
// This module returns NO KpiResult in that case rather than one with value 0,
// which is what makes the Scorecard skip it: `computePlantScore` already
// ignores absent KPIs. A tenant with zero submitted checklists therefore
// renders as no-data, not as 0% (a site failing) or 100% (a site perfect).
//
// That is the convention the Manhours/LTIFR fix established, and the reason it
// matters here is identical: a fabricated compliance figure on a fire register
// is worse than an absent one, in both directions.

import { backendFetch } from "@/lib/backend/fetch";
import type { KpiResult } from "./kpi-engine";
import { KPI_REGISTRY } from "./kpi-registry";

export const FIRE_CHEMICAL_COMPLIANCE = "FIRE_CHEMICAL_COMPLIANCE" as const;

type CompletionApi = {
  window: { start: string; end: string };
  modules: string[];
  overall: {
    owed: number;
    completed: number;
    inProgress: number;
    missing: number;
    rate: number | null;
    computable: boolean;
  };
};

/** Fetch one plant's completion rate from the backend read model.
 *
 *  Goes through `backendFetch`, the platform's existing Next→FastAPI bridge,
 *  rather than a raw fetch: it already resolves the base URL and mints the
 *  short-lived JWT the backend's `get_current_user` expects. Hand-rolling that
 *  here would be a second auth path to keep in step.
 *
 *  Returns null on any failure — including a 403 from the FIRE licence gate,
 *  which is a legitimate "this tenant does not license this module", not an
 *  error worth failing a whole scorecard build over. */
async function fetchCompletion(plantId: string, months: number): Promise<CompletionApi | null> {
  try {
    return await backendFetch<CompletionApi>("/api/fire/compliance", {
      query: { plantId, months: String(months) },
    });
  } catch {
    return null;
  }
}

/** Build the KPI result for one plant, or null when it cannot be computed.
 *
 *  Exported separately from the fetch so the "null means omit" rule is
 *  unit-testable without a network. */
export function toKpiResult(
  plantId: string,
  data: CompletionApi | null,
  period: { start: Date; end: Date },
): KpiResult | null {
  // No data, no licence, or nothing owed → NO RESULT. Never a zero.
  if (!data || !data.overall.computable || data.overall.rate === null) return null;

  const def = KPI_REGISTRY[FIRE_CHEMICAL_COMPLIANCE as keyof typeof KPI_REGISTRY];
  const { rate, completed, owed } = data.overall;

  return {
    kpiCode: FIRE_CHEMICAL_COMPLIANCE as KpiResult["kpiCode"],
    kpiName: def?.name ?? "Fire & Chemical Checklist Compliance",
    value: rate,
    formattedValue: `${rate.toFixed(1)}%`,
    numerator: completed,
    denominator: owed,
    formula: def?.formula ?? "(Checklists Completed ÷ Checklists Due) × 100",
    band: null,
    bandColor: "#94a3b8",
    higherIsBetter: true,
    benchmarks: def?.benchmarks,
    period: { start: period.start, end: period.end } as KpiResult["period"],
    scope: { plantId } as KpiResult["scope"],
    computedAt: new Date(),
    audit: {
      manhoursSubmissionIds: [],
      fellBackToLegacyGrossHours: false,
    } as unknown as KpiResult["audit"],
  };
}

/** Fetch completion for many plants at once. Returns a sparse map: plants with
 *  no computable rate are ABSENT rather than present-with-zero. */
export async function fetchFireChemicalCompliance(opts: {
  plantIds: string[];
  months?: number;
  period: { start: Date; end: Date };
}): Promise<Record<string, KpiResult>> {
  if (opts.plantIds.length === 0) return {};
  const months = opts.months ?? 3;

  const entries = await Promise.all(
    opts.plantIds.map(async (plantId) => {
      const data = await fetchCompletion(plantId, months);
      const result = toKpiResult(plantId, data, opts.period);
      return result ? ([plantId, result] as const) : null;
    }),
  );

  const out: Record<string, KpiResult> = {};
  for (const e of entries) if (e) out[e[0]] = e[1];
  return out;
}
