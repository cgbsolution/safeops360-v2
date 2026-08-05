import { prisma } from "@/lib/prisma";
import { buildObservationListWhere } from "@/lib/auth/list-filters";
import {
  AnalyticsStrip,
  AnalyticsStripError,
  type AnalyticsStripData,
} from "@/components/dashboard/analytics-strip";
import {
  last12Months,
  bucketCounts,
  monthBounds,
  netDelta,
  percentDelta,
  avgDaysBetween,
} from "@/lib/dashboard/strip";

// Safety Observation analytics strip — Prisma-direct module.
//
// Self-fetching async server component. It re-derives the SAME RBAC scope
// the list uses (buildObservationListWhere is React.cache'd, so this costs
// no extra DB round-trip) — the strip's numbers therefore always match the
// list the user is allowed to see. Lives in its own <Suspense> boundary on
// the page, so it streams independently of the list and never blocks it.

export async function ObservationAnalyticsStrip({ userId }: { userId: string }) {
  try {
    const scope = await buildObservationListWhere(userId);
    const { now, startOfMonth, startOfLastMonth } = monthBounds();
    const buckets = last12Months(now);
    const twelveMonthsAgo = buckets[0].start;
    // Cycle-time windows: trailing 90 days for the avg, the 90d before that for
    // its trend, and a like-for-like "same point last month" window for the
    // Closed-MTD delta. One fetch (floor = 180d back) covers all three.
    const startOf90 = new Date(now.getTime() - 90 * 86_400_000);
    const startOf180 = new Date(now.getTime() - 180 * 86_400_000);
    const samePointLastMonthEnd = new Date(
      startOfLastMonth.getTime() + (now.getTime() - startOfMonth.getTime())
    );

    const [openRows, trendRows, closedRecent] = await Promise.all([
      // Open backlog (any non-closed status). Drives the headline count
      // plus the overdue / high-severity alert chips — all derived in JS
      // from one fetch instead of three separate count queries.
      prisma.observation.findMany({
        where: { AND: [scope, { status: { not: "CLOSED" } }] },
        select: { severity: true, targetDate: true },
        take: 5000,
      }),
      // 12-month occurrence dates → sparkline + opened-this/last-month.
      prisma.observation.findMany({
        where: { AND: [scope, { date: { gte: twelveMonthsAgo } }] },
        select: { date: true },
        take: 5000,
      }),
      // Records closed in the last 180 days — powers Closed-MTD + avg-to-close.
      // `closedAt` is set on workflow closure, but seed-closed rows can have it
      // null; fall back to `updatedAt` so the metrics don't silently under-count
      // (that null was the "Closed MTD = 0" bug on the demo tenant).
      prisma.observation.findMany({
        where: {
          AND: [
            scope,
            { status: "CLOSED" },
            {
              OR: [
                { closedAt: { gte: startOf180 } },
                { AND: [{ closedAt: null }, { updatedAt: { gte: startOf180 } }] },
              ],
            },
          ],
        },
        select: { date: true, closedAt: true, updatedAt: true, targetDate: true },
        take: 5000,
      }),
    ]);

    // ── Derive metrics ──────────────────────────────────────────────
    const open = openRows.length;
    const overdue = openRows.filter((r) => r.targetDate && r.targetDate < now).length;
    const highSeverity = openRows.filter((r) => r.severity === "HIGH" || r.severity === "CRITICAL").length;

    const trendCounts = bucketCounts(trendRows.map((r) => r.date), buckets);
    const openedThisMonth = trendCounts[11];

    // Effective closure date: closedAt when set, else updatedAt (see fetch note).
    const closedEff = closedRecent.map((r) => ({
      date: r.date,
      closed: (r.closedAt ?? r.updatedAt) as Date,
      targetDate: r.targetDate,
    }));

    const closedMTD = closedEff.filter((r) => r.closed >= startOfMonth).length;
    // Compare to the SAME elapsed slice of last month, not the whole month — a
    // mid-month MTD vs a full prior month always reads as a false ↓100%.
    const closedPrevSamePoint = closedEff.filter(
      (r) => r.closed >= startOfLastMonth && r.closed < samePointLastMonthEnd
    ).length;

    // Avg days to close over the trailing 90 days (+ prior 90d for the trend).
    const closedLast90 = closedEff.filter((r) => r.closed >= startOf90);
    const closedPrev90 = closedEff.filter((r) => r.closed >= startOf180 && r.closed < startOf90);
    const avg90 = avgDaysBetween(closedLast90.map((r) => ({ from: r.date, to: r.closed })));
    const avgPrev90 = avgDaysBetween(closedPrev90.map((r) => ({ from: r.date, to: r.closed })));

    // On-time closure rate (closed within target date) for the MTD tile chip.
    const mtdClosed = closedEff.filter((r) => r.closed >= startOfMonth);
    const withTarget = mtdClosed.filter((r) => r.targetDate);
    const onTime = withTarget.filter((r) => r.targetDate && r.closed <= (r.targetDate as Date)).length;
    const onTimePct = withTarget.length ? Math.round((onTime / withTarget.length) * 100) : null;

    const data: AnalyticsStripData = {
      tiles: [
        {
          label: "Open Observations",
          value: open,
          emphasis: true,
          href: "/observations",
          // Net backlog change this month: opened − closed. Growth is bad.
          delta: netDelta(openedThisMonth - closedMTD, false),
        },
        {
          label: "Closed MTD",
          value: closedMTD,
          href: "/observations?status=CLOSED",
          // Like-for-like vs the same day-range of last month; the delta text +
          // tooltip name the window so the comparison can't be misread.
          delta: percentDelta(closedMTD, closedPrevSamePoint, true, "vs same pt last mo"),
          badge:
            onTimePct === null
              ? null
              : {
                  text: `${onTimePct}% on-time`,
                  tone: onTimePct > 90 ? "good" : onTimePct >= 70 ? "neutral" : "bad",
                },
        },
        {
          label: "Avg Days to Close",
          // Trailing-90d cycle time; explicit "None" no-data state, never a bare
          // dash. The 90d badge names the window.
          value: avg90 !== null ? avg90 : "None",
          badge: { text: "90d", tone: "neutral" },
          delta:
            avg90 !== null && avgPrev90 !== null
              ? percentDelta(avg90, avgPrev90, false, "vs prior 90d")
              : null,
        },
      ],
      sparkline: {
        points: buckets.map((b, i) => ({ label: b.label, value: trendCounts[i] })),
        color: "#7c3aed",
        label: "Observations · 12 mo",
      },
      alerts: [
        { label: "Overdue", count: overdue, tone: "bad", href: "/observations" },
        { label: "High severity", count: highSeverity, tone: "warn", href: "/observations" },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[observation-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
