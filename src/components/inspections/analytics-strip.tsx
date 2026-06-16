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
} from "@/lib/dashboard/strip";

// Inspection Schedule analytics strip — Prisma-direct module.
//
// inspections/page.tsx is Prisma-direct with no dedicated list-scope helper,
// so we scope with stripPlantWhere() (Inspection has plantId). Self-fetching
// async server component, isolated in its own <Suspense> boundary on the page
// so it streams independently of the inspections table and never blocks it.

export async function InspectionAnalyticsStrip() {
  try {
    const plantWhere = await stripPlantWhere();
    const { now } = monthBounds();
    const buckets = last12Months(now);
    const twelveMonthsAgo = buckets[0].start;
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 86_400_000);
    const in30Days = new Date(now.getTime() + 30 * 86_400_000);
    const in7Days = new Date(now.getTime() + 7 * 86_400_000);

    const [completed60d, completedTrend, overdueCount, statutoryDue30d, statutoryDue7d] =
      await Promise.all([
        // KPI-1: completed in the last 60 days.
        prisma.inspection.count({
          where: { ...plantWhere, status: "COMPLETED", completedDate: { gte: sixtyDaysAgo } },
        }),
        // Sparkline: monthly COMPLETED count over the last 12 months.
        prisma.inspection.findMany({
          where: { ...plantWhere, status: "COMPLETED", completedDate: { gte: twelveMonthsAgo } },
          select: { completedDate: true },
          take: 5000,
        }),
        // KPI-2 + alert: currently overdue.
        prisma.inspection.count({
          where: { ...plantWhere, status: "OVERDUE" },
        }),
        // KPI-3: statutory inspections due (SCHEDULED/DUE) within the next 30 days.
        prisma.inspection.count({
          where: {
            ...plantWhere,
            isStatutory: true,
            status: { in: ["SCHEDULED", "DUE"] },
            scheduledDate: { gte: now, lte: in30Days },
          },
        }),
        // Alert: statutory due within the next 7 days.
        prisma.inspection.count({
          where: {
            ...plantWhere,
            isStatutory: true,
            status: { in: ["SCHEDULED", "DUE"] },
            scheduledDate: { gte: now, lte: in7Days },
          },
        }),
      ]);

    const trendCounts = bucketCounts(
      completedTrend.filter((r) => r.completedDate).map((r) => r.completedDate as Date),
      buckets
    );

    const data: AnalyticsStripData = {
      tiles: [
        {
          label: "Completed (60d)",
          value: completed60d,
          emphasis: true,
          href: "/inspections?status=COMPLETED",
        },
        {
          label: "Overdue",
          value: overdueCount,
          href: "/inspections?status=OVERDUE",
          badge: overdueCount > 0 ? { text: "needs action", tone: "bad" } : null,
        },
        {
          label: "Statutory Due (30d)",
          value: statutoryDue30d,
          href: "/inspections",
        },
      ],
      sparkline: {
        points: buckets.map((b, i) => ({ label: b.label, value: trendCounts[i] })),
        color: "#10b981",
        label: "Completed · 12 mo",
      },
      alerts: [
        { label: "Critical overdue", count: overdueCount, tone: "bad", href: "/inspections?status=OVERDUE" },
        { label: "Statutory due 7d", count: statutoryDue7d, tone: "warn", href: "/inspections" },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[inspection-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
