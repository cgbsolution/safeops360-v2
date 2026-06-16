import { prisma } from "@/lib/prisma";
import { stripPlantWhere } from "@/lib/dashboard/scope";
import {
  AnalyticsStrip,
  AnalyticsStripError,
  type AnalyticsStripData,
} from "@/components/dashboard/analytics-strip";
import { monthBounds, netDelta, percentDelta } from "@/lib/dashboard/strip";

// Permit to Work analytics strip — Prisma-direct module.
//
// The PTW list page has no list-scope helper, so this strip uses the shared
// stripPlantWhere() plant scope. The sparkline is WEEKLY (12 × 7-day buckets
// by createdAt) rather than monthly because permit volume is operationally
// read week-over-week. There is no competency-gate-block model yet, so that
// alert chip is a graceful 0. Self-fetching + Suspense-isolated.

const ACTIVE_STATUSES = ["ACTIVE", "SAFETY_APPROVED", "PLANT_HEAD_APPROVED"] as const;
const TERMINAL_STATUSES = ["CLOSED", "EXPIRED", "REJECTED"] as const;

export async function PtwAnalyticsStrip() {
  try {
    const plant = await stripPlantWhere();
    const { now, startOfMonth, startOfLastMonth } = monthBounds();
    // 12 weekly buckets (each 7 days), oldest → newest, last ending now.
    const weekBuckets: { label: string; start: Date; end: Date }[] = [];
    for (let i = 11; i >= 0; i--) {
      const end = new Date(now.getTime() - i * 7 * 86_400_000);
      const start = new Date(end.getTime() - 7 * 86_400_000);
      weekBuckets.push({
        label: start.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        start,
        end,
      });
    }
    const twelveWeeksAgo = weekBuckets[0].start;

    const [activeCount, closedThisMonth, closedLastMonthCount, activatedThisMonth, overdueCount, weeklyRows] =
      await Promise.all([
        // Active permits (issued / approved-and-running).
        prisma.permit.count({
          where: { ...plant, status: { in: [...ACTIVE_STATUSES] } },
        }),
        // Closed this month — count + on-time% (closedAt <= validTo).
        prisma.permit.findMany({
          where: { ...plant, closedAt: { gte: startOfMonth } },
          select: { closedAt: true, validTo: true },
          take: 5000,
        }),
        // Closed last month — for the closed-volume delta.
        prisma.permit.count({
          where: { ...plant, closedAt: { gte: startOfLastMonth, lt: startOfMonth } },
        }),
        // Activated this month — for cycle-time + net-flow delta.
        prisma.permit.findMany({
          where: { ...plant, activatedAt: { gte: startOfMonth } },
          select: { createdAt: true, activatedAt: true },
          take: 5000,
        }),
        // Overdue: still live (not terminal) but validTo has passed.
        prisma.permit.count({
          where: { ...plant, status: { notIn: [...TERMINAL_STATUSES] }, validTo: { lt: now } },
        }),
        // 12-week createdAt dates → weekly sparkline.
        prisma.permit.findMany({
          where: { ...plant, createdAt: { gte: twelveWeeksAgo } },
          select: { createdAt: true },
          take: 5000,
        }),
      ]);

    // Weekly sparkline counts.
    const weekCounts = new Array(weekBuckets.length).fill(0);
    for (const r of weeklyRows) {
      const t = r.createdAt.getTime();
      for (let i = 0; i < weekBuckets.length; i++) {
        if (t >= weekBuckets[i].start.getTime() && t < weekBuckets[i].end.getTime()) {
          weekCounts[i]++;
          break;
        }
      }
    }

    const closedMTD = closedThisMonth.length;
    const onTime = closedThisMonth.filter((r) => r.closedAt && r.validTo && r.closedAt <= r.validTo).length;
    const onTimePct = closedMTD ? Math.round((onTime / closedMTD) * 100) : null;

    // Avg cycle time (createdAt → activatedAt) in hours, for permits activated MTD.
    const cycleHours = activatedThisMonth
      .filter((r) => r.activatedAt)
      .map((r) => ((r.activatedAt as Date).getTime() - r.createdAt.getTime()) / 3_600_000);
    const avgCycleHours = cycleHours.length
      ? Math.round(cycleHours.reduce((a, b) => a + b, 0) / cycleHours.length)
      : null;

    const data: AnalyticsStripData = {
      tiles: [
        {
          label: "Active Permits",
          value: activeCount,
          emphasis: true,
          href: "/ptw?status=ACTIVE",
          // Net flow this month: activated − closed. Neither rise nor fall is
          // intrinsically good for a live-work count → neutral framing.
          delta: netDelta(activatedThisMonth.length - closedMTD, false),
        },
        {
          label: "Closed This Month",
          value: closedMTD,
          href: "/ptw?status=CLOSED",
          delta: percentDelta(closedMTD, closedLastMonthCount, true),
          badge:
            onTimePct === null
              ? null
              : {
                  text: `${onTimePct}% on-time`,
                  tone: onTimePct > 90 ? "good" : onTimePct >= 70 ? "neutral" : "bad",
                },
        },
        {
          label: "Avg Cycle Time",
          value: avgCycleHours === null ? "—" : `${avgCycleHours}h`,
        },
      ],
      sparkline: {
        points: weekBuckets.map((b, i) => ({ label: b.label, value: weekCounts[i] })),
        color: "#3b82f6",
        label: "Permits · 12 wk",
      },
      alerts: [
        { label: "Overdue", count: overdueCount, tone: "bad", href: "/ptw" },
        // No competency-gate-block model exists yet — graceful 0.
        { label: "Competency blocks", count: 0, tone: "warn", href: "/ptw" },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[ptw-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
