// ─────────────────────────────────────────────────────────────────────
// Shared helpers for AnalyticsStrip data loaders.
//
// Every module's strip loader needs the same three things:
//   1. a set of 12 monthly buckets to build the sparkline,
//   2. a way to drop a list of dates into those buckets, and
//   3. direction-aware delta computation (a rise in compliance is good;
//      a rise in overdue backlog is bad — the loader knows which, the
//      component does not).
//
// Pure functions only — no Prisma, no fetch, no React. Trivially testable
// and identical across modules, so deltas/sparklines behave the same on
// every landing page.
// ─────────────────────────────────────────────────────────────────────

import type { SparkPoint } from "@/components/dashboard/sparkline";
import type { StripDelta } from "@/components/dashboard/analytics-strip";

export interface MonthBucket {
  /** Short label for the sparkline tooltip, e.g. "May 25". */
  label: string;
  /** Inclusive start of the month. */
  start: Date;
  /** Exclusive end (start of the next month). */
  end: Date;
}

/** Monthly buckets spanning [from, to]. Caps at 24 months; falls back to
 *  last12Months when the range is empty (e.g. from > to). */
export function monthsInRange(from: Date, to: Date): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  let cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const ceiling = new Date(to.getFullYear(), to.getMonth() + 1, 1);
  while (cur < ceiling && buckets.length < 24) {
    const start = new Date(cur);
    const end = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    buckets.push({ label: start.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), start, end });
    cur = end;
  }
  return buckets.length > 0 ? buckets : last12Months(to);
}

/** 12 monthly buckets, oldest → newest, the last being the current month.
 *  `now` is injectable for deterministic tests. */
export function last12Months(now: Date = new Date()): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    buckets.push({
      label: start.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      start,
      end,
    });
  }
  return buckets;
}

/** Count how many of `dates` fall into each bucket. */
export function bucketCounts(dates: Date[], buckets: MonthBucket[]): number[] {
  const counts = new Array(buckets.length).fill(0);
  for (const d of dates) {
    const t = d.getTime();
    for (let i = 0; i < buckets.length; i++) {
      if (t >= buckets[i].start.getTime() && t < buckets[i].end.getTime()) {
        counts[i]++;
        break;
      }
    }
  }
  return counts;
}

/** Build sparkline points directly from a date list over the last 12
 *  months. The convenience path most loaders use. */
export function monthlySparkline(dates: Date[], now: Date = new Date()): SparkPoint[] {
  const buckets = last12Months(now);
  const counts = bucketCounts(dates, buckets);
  return buckets.map((b, i) => ({ label: b.label, value: counts[i] }));
}

/** Start of the current month and the previous month, for MTD comparisons. */
export function monthBounds(now: Date = new Date()) {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { now, startOfMonth, startOfLastMonth };
}

/**
 * Net-change delta for a count metric, e.g. "+3 this month".
 * `net` is the signed change (added − removed). `higherIsBetter` decides
 * colour: for an open-backlog count it's false (growth is bad); for a
 * "closed this month" count, more is better → pass true.
 */
export function netDelta(
  net: number,
  higherIsBetter: boolean,
  suffix = "this month"
): StripDelta {
  const direction = net > 0 ? "up" : net < 0 ? "down" : "flat";
  const tone: StripDelta["tone"] =
    net === 0 ? "neutral" : (higherIsBetter ? net > 0 : net < 0) ? "good" : "bad";
  const sign = net > 0 ? "+" : net < 0 ? "−" : "±";
  return { text: `${sign}${Math.abs(net)} ${suffix}`, direction, tone };
}

/**
 * Percentage delta vs a prior-period value, e.g. "12% vs last mo".
 * Returns null when the prior value is 0 (percentage is undefined —
 * the component shows no delta, which the brief treats as "insufficient
 * data → neutral"). A move under 0.5% is rendered as flat.
 */
export function percentDelta(
  current: number,
  prior: number,
  higherIsBetter: boolean,
  label = "vs last mo"
): StripDelta | null {
  if (!prior) return null;
  const pct = ((current - prior) / prior) * 100;
  const direction = pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat";
  const tone: StripDelta["tone"] =
    direction === "flat" ? "neutral" : (higherIsBetter ? pct > 0 : pct < 0) ? "good" : "bad";
  return {
    text: `${Math.abs(pct).toFixed(0)}% ${label}`,
    direction,
    tone,
    tooltip: `${fmt(current)} now vs ${fmt(prior)} prior`,
  };
}

/** Average whole-day gap between two dates across a set of records. */
export function avgDaysBetween(pairs: { from: Date; to: Date }[]): number | null {
  if (pairs.length === 0) return null;
  const totalDays = pairs.reduce((s, p) => s + (p.to.getTime() - p.from.getTime()) / 86_400_000, 0);
  return Math.round(totalDays / pairs.length);
}

function fmt(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString("en-IN") : n.toFixed(1);
}
