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

    const [openRows, trendRows, closedThisMonth, closedLastMonth] = await Promise.all([
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
      // Closed this month — count + on-time% + avg-days-to-close.
      prisma.observation.findMany({
        where: { AND: [scope, { status: "CLOSED", closedAt: { gte: startOfMonth } }] },
        select: { date: true, closedAt: true, targetDate: true },
        take: 5000,
      }),
      // Closed last month — for the closed-volume + cycle-time deltas.
      prisma.observation.findMany({
        where: { AND: [scope, { status: "CLOSED", closedAt: { gte: startOfLastMonth, lt: startOfMonth } }] },
        select: { date: true, closedAt: true },
        take: 5000,
      }),
    ]);

    // ── Derive metrics ──────────────────────────────────────────────
    const open = openRows.length;
    const overdue = openRows.filter((r) => r.targetDate && r.targetDate < now).length;
    const highSeverity = openRows.filter((r) => r.severity === "HIGH" || r.severity === "CRITICAL").length;

    const trendCounts = bucketCounts(trendRows.map((r) => r.date), buckets);
    const openedThisMonth = trendCounts[11];

    const closedMTD = closedThisMonth.length;
    const closedPrev = closedLastMonth.length;

    const avgThisMonth = avgDaysBetween(
      closedThisMonth.filter((r) => r.closedAt).map((r) => ({ from: r.date, to: r.closedAt as Date }))
    );
    const avgLastMonth = avgDaysBetween(
      closedLastMonth.filter((r) => r.closedAt).map((r) => ({ from: r.date, to: r.closedAt as Date }))
    );

    // On-time closure rate (closed within target date) for the MTD tile chip.
    const withTarget = closedThisMonth.filter((r) => r.targetDate);
    const onTime = withTarget.filter((r) => r.closedAt && r.targetDate && r.closedAt <= r.targetDate).length;
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
          delta: percentDelta(closedMTD, closedPrev, true),
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
          value: avgThisMonth ?? "—",
          delta:
            avgThisMonth !== null && avgLastMonth !== null
              ? percentDelta(avgThisMonth, avgLastMonth, false)
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
