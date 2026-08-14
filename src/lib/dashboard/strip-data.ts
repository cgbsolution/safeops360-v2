// ─────────────────────────────────────────────────────────────────────
// Analytics-strip data access.
//
// The strips used to query Prisma directly from the Next.js server. They no
// longer do: every number now comes from FastAPI's /api/analytics-strip/*,
// which owns the scoping and the module rules. This file is the only thing
// between a strip component and that endpoint.
//
// The split of responsibility is deliberate:
//   • Python returns RAW METRICS — counts, bucket totals, percentages.
//   • The frontend keeps PRESENTATION — tile labels, colours, hrefs, badge
//     tone, delta wording — using the pure helpers in ./strip.
//
// So the sparkline arrives as `trendCounts` + `bucketStarts` (ISO), never as
// pre-formatted labels: month names are rendered here, in the viewer's
// locale, instead of being baked in by whatever locale the API server runs.
// ─────────────────────────────────────────────────────────────────────

import { cookies } from "next/headers";
import { backendFetch } from "@/lib/backend/fetch";
import type { SparkPoint } from "@/components/dashboard/sparkline";

/** Fields every strip endpoint returns. Modules add their own on top. */
export interface StripBase {
  /** True when the caller holds no read grant on the module. The strip
   *  renders a zeroed band rather than an error — the page itself was
   *  reached legally, so it must still show something truthful. */
  denied: boolean;
  trendCounts: number[];
  /** ISO start of each sparkline bucket, oldest → newest. */
  bucketStarts: string[];
  /** Present and "week" only on PTW, which reads week-over-week. */
  bucketKind?: "month" | "week";
}

/**
 * Fetch one module's strip metrics.
 *
 * Forwards the active-plant cookie as `x-active-plant` so the backend applies
 * the same per-factory module entitlement the browser-facing proxy does —
 * without it a factory with the module switched off would still get numbers.
 */
export async function fetchStrip<T extends StripBase>(
  module: string,
  query?: Record<string, string | number | undefined>
): Promise<T> {
  const activePlant = (await cookies()).get("safeops_active_plant")?.value;
  return backendFetch<T>(`/api/analytics-strip/${module}`, {
    query,
    headers: activePlant ? { "x-active-plant": activePlant } : undefined,
  });
}

/**
 * Turn `bucketStarts` + `trendCounts` into sparkline points.
 *
 * Monthly buckets label as "May 25"; weekly buckets (PTW) as "12 May" — the
 * same two formats the Prisma-era strips produced, so the sparkline reads
 * identically after the cutover.
 */
export function sparkPoints(
  bucketStarts: string[],
  counts: number[],
  kind: "month" | "week" = "month"
): SparkPoint[] {
  const fmt: Intl.DateTimeFormatOptions =
    kind === "week"
      ? { day: "2-digit", month: "short" }
      : { month: "short", year: "2-digit" };
  return bucketStarts.map((iso, i) => ({
    label: new Date(iso).toLocaleDateString("en-IN", fmt),
    value: counts[i] ?? 0,
  }));
}
