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
  netDelta,
  percentDelta,
} from "@/lib/dashboard/strip";

// CAPA analytics strip — Prisma-direct (the capa page itself uses backendFetch,
// but the strip reads Prisma so it streams in its own <Suspense> boundary and
// never blocks the list). Plant scope comes from the shared stripPlantWhere
// resolver since CAPA exposes no {userId} list-scope helper.

// "Open" = state not in any terminal/rejected state.
const CLOSED_STATES = ["CLOSED", "CLOSED_RECURRED", "REJECTED", "CANCELLED"];

export async function CapaAnalyticsStrip() {
  try {
    const scope = await stripPlantWhere();
    const { now, startOfMonth, startOfLastMonth } = monthBounds();
    const buckets = last12Months(now);
    const twelveMonthsAgo = buckets[0].start;
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000);

    const [openRows, trendRows, closedThisMonth, closedLastMonth, effRows] =
      await Promise.all([
        // Open backlog — drives the headline count plus overdue / critical-overdue chips.
        prisma.capa.findMany({
          where: { ...scope, state: { notIn: CLOSED_STATES } },
          select: { severity: true, closureTargetDate: true },
          take: 5000,
        }),
        // 12-month opened dates (createdAt) → sparkline + opened-this-month.
        prisma.capa.findMany({
          where: { ...scope, createdAt: { gte: twelveMonthsAgo } },
          select: { createdAt: true },
          take: 5000,
        }),
        // Closed this month (closedAt) — count + closed-volume delta.
        prisma.capa.count({
          where: { ...scope, closedAt: { gte: startOfMonth } },
        }),
        // Closed last month — for the closed-volume % delta.
        prisma.capa.count({
          where: { ...scope, closedAt: { gte: startOfLastMonth, lt: startOfMonth } },
        }),
        // Effectiveness — verifications completed in the last 90 days.
        prisma.capa.findMany({
          where: { ...scope, verificationCompletedAt: { gte: ninetyDaysAgo } },
          select: { verificationResult: true },
          take: 5000,
        }),
      ]);

    // ── Derive metrics ──────────────────────────────────────────────
    const open = openRows.length;
    const overdue = openRows.filter((r) => r.closureTargetDate && r.closureTargetDate < now).length;
    const criticalOverdue = openRows.filter(
      (r) =>
        (r.severity === "HIGH" || r.severity === "CRITICAL") &&
        r.closureTargetDate &&
        r.closureTargetDate < now
    ).length;

    const trendCounts = bucketCounts(trendRows.map((r) => r.createdAt), buckets);
    const openedThisMonth = trendCounts[11];

    const closedMTD = closedThisMonth;
    const closedPrev = closedLastMonth;

    // Effectiveness rate among recent (90d) completed verifications.
    const effPct = effRows.length
      ? Math.round((effRows.filter((r) => r.verificationResult === "EFFECTIVE").length / effRows.length) * 100)
      : null;

    const data: AnalyticsStripData = {
      tiles: [
        {
          label: "Open CAPAs",
          value: open,
          emphasis: true,
          href: "/capa",
          // Net backlog change this month: opened − closed. Growth is bad.
          delta: netDelta(openedThisMonth - closedMTD, false),
        },
        {
          label: "Overdue",
          value: overdue,
          href: "/capa",
          delta: null,
        },
        {
          label: "Closed MTD",
          value: closedMTD,
          href: "/capa",
          delta: percentDelta(closedMTD, closedPrev, true),
          badge:
            effPct === null
              ? null
              : {
                  text: `${effPct}% effective`,
                  tone: effPct > 90 ? "good" : effPct >= 70 ? "neutral" : "bad",
                },
        },
      ],
      sparkline: {
        points: buckets.map((b, i) => ({ label: b.label, value: trendCounts[i] })),
        color: "#7c3aed",
        label: "CAPAs opened · 12 mo",
      },
      alerts: [
        { label: "Critical overdue", count: criticalOverdue, tone: "bad", href: "/capa" },
        { label: "Overdue", count: overdue, tone: "warn", href: "/capa" },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[capa-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
