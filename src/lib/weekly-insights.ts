// Weekly Insight Engine — frontend contract + tolerant server fetch.
//
// Mirrors the backend GET /api/insights/{module}/weekly view. The engine is
// deterministic and airgap-safe; this helper only fetches + degrades. Any failure
// (backend down, table not applied) returns an empty view so the screen renders.

import { backendFetch } from "@/lib/backend/fetch";

export interface RailBar {
  label: string;
  value: number;
  emphasis?: boolean;
}
export interface RailStat {
  value: string;
  label: string;
  tone?: string; // neutral | bad | up_bad | down_good | caution
}
export interface HeroDisplay {
  number: number;
  numberLabel: string;
  headline: string;
  delta: string | null;
  deltaTone: "up_bad" | "down_good" | "neutral" | string;
  qualifier: string | null;
  actionLabel: string;
  actionHref: string;
}
export interface HeroRail {
  kind: string;
  railTitle: string;
  bars: RailBar[];
  stats: RailStat[];
  closing: string;
}
export type Lifecycle = "new" | "escalating" | "persistent" | "resolving" | "meta" | string;

export interface WeeklyInsight {
  identityKey: string;
  type: string;
  lifecycleState: Lifecycle;
  score: number;
  weeksRunning: number;
  display: HeroDisplay;
  rail: HeroRail;
}

export interface WeeklyEmpty {
  topScore: number;
  floor: number;
  clustersWatched: number;
}

export interface WeeklyView {
  module: string;
  weekOf: string | null;
  hero: WeeklyInsight | null;
  row: WeeklyInsight[];
  moreCount: number;
  empty: WeeklyEmpty | null;
}

const EMPTY: WeeklyView = { module: "", weekOf: null, hero: null, row: [], moreCount: 0, empty: null };

/** Tolerant server-side fetch of the weekly hero + secondary row. Degrades to an
 *  empty view so the observations screen never breaks (e.g. before the
 *  InsightSnapshot table is applied). */
export async function fetchWeeklyInsights(module: string, opts: { plant?: string } = {}): Promise<WeeklyView> {
  try {
    const res = await backendFetch<WeeklyView>(`/api/insights/${module}/weekly`, {
      query: { plant: opts.plant },
    });
    return {
      module: res.module ?? module,
      weekOf: res.weekOf ?? null,
      hero: res.hero ?? null,
      row: res.row ?? [],
      moreCount: res.moreCount ?? 0,
      empty: res.empty ?? null,
    };
  } catch {
    return EMPTY;
  }
}
