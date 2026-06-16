import { prisma } from "@/lib/prisma";
import { stripPlantWhere } from "@/lib/dashboard/scope";
import {
  AnalyticsStrip,
  AnalyticsStripError,
  type AnalyticsStripData,
} from "@/components/dashboard/analytics-strip";
import {
  last12Months,
  bucketCounts,
  monthBounds,
  percentDelta,
} from "@/lib/dashboard/strip";

// Near Miss analytics strip — Prisma-direct module.
//
// The near-miss list page has no list-scope helper, so this strip uses the
// shared stripPlantWhere() plant scope. Near-miss reporting is a leading
// indicator: MORE near misses is GOOD (higherIsBetter where it counts), and
// the NM:LTI ratio is a classic safety-pyramid health metric. Self-fetching
// + Suspense-isolated like the observation / incident strips.

export async function NearMissAnalyticsStrip() {
  try {
    const plant = await stripPlantWhere();
    const { now, startOfMonth } = monthBounds();
    const buckets = last12Months(now);
    const twelveMonthsAgo = buckets[0].start;
    // 24-month window start for the prior-12-month comparison.
    const twentyFourMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 23, 1);
    // Same calendar month, one year ago (for the MTD year-over-year delta).
    const startOfMonthLastYear = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const startOfNextMonthLastYear = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

    const [trendRows, prevWindowCount, sameMonthLastYear, uninvestigated, nm12Count, lti12Count] =
      await Promise.all([
        // Last-12-month occurrence dates → sparkline + this-window + this-month.
        prisma.nearMiss.findMany({
          where: { ...plant, date: { gte: twelveMonthsAgo } },
          select: { date: true },
          take: 5000,
        }),
        // Prior window (24..12 months ago) for the 12-mo reporting delta.
        prisma.nearMiss.count({
          where: { ...plant, date: { gte: twentyFourMonthsAgo, lt: twelveMonthsAgo } },
        }),
        // Same calendar month last year — MTD year-over-year delta.
        prisma.nearMiss.count({
          where: { ...plant, date: { gte: startOfMonthLastYear, lt: startOfNextMonthLastYear } },
        }),
        // Uninvestigated: still REPORTED, no owner assigned, older than 7 days.
        prisma.nearMiss.count({
          where: { ...plant, status: "REPORTED", actionOwnerId: null, date: { lt: sevenDaysAgo } },
        }),
        // Near-miss count over the trailing 12 months (for the NM:LTI ratio).
        prisma.nearMiss.count({
          where: { ...plant, date: { gte: twelveMonthsAgo } },
        }),
        // LTI incidents over the same 12 months / same plant scope.
        prisma.incident.count({
          where: { ...plant, type: "LTI", date: { gte: twelveMonthsAgo } },
        }),
      ]);

    const trendCounts = bucketCounts(trendRows.map((r) => r.date), buckets);
    const nm12 = nm12Count;
    const thisMonth = trendRows.filter((r) => r.date >= startOfMonth).length;
    const lti12 = lti12Count;
    const ratio = lti12 > 0 ? Math.round(nm12 / lti12) : 0;

    const data: AnalyticsStripData = {
      tiles: [
        {
          label: "Near Misses",
          value: nm12,
          emphasis: true,
          href: "/near-miss",
          // More near-miss reporting is good → higherIsBetter.
          delta: percentDelta(nm12, prevWindowCount, true, "vs prior yr"),
        },
        {
          label: "This Month",
          value: thisMonth,
          href: "/near-miss",
          delta: percentDelta(thisMonth, sameMonthLastYear, true, "vs last yr"),
        },
        {
          label: "NM:LTI Ratio",
          value: lti12 > 0 ? `${ratio}:1` : "—",
          // Target >100:1 — more near misses per LTI is a healthier pyramid.
          badge:
            lti12 > 0
              ? { text: ratio >= 100 ? "on target" : "below target", tone: ratio >= 100 ? "good" : ratio < 20 ? "bad" : "neutral" }
              : null,
        },
      ],
      sparkline: {
        points: buckets.map((b, i) => ({ label: b.label, value: trendCounts[i] })),
        color: "#f59e0b",
        label: "Near misses · 12 mo",
      },
      alerts: [
        { label: "Uninvestigated >7d", count: uninvestigated, tone: "bad", href: "/near-miss?status=REPORTED" },
        {
          label: "Ratio",
          count: lti12 > 0 ? ratio : 0,
          tone: lti12 > 0 && nm12 / lti12 < 20 ? "bad" : "neutral",
          href: "/near-miss",
        },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[near-miss-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
