import { prisma } from "@/lib/prisma";
import { incidentReadScopeWhere } from "@/lib/auth/incident-access";
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

// Incident Investigation analytics strip — Prisma-direct module.
//
// Reuses incidentReadScopeWhere (the same RBAC gate the list uses); when a
// user can read no incidents it returns `false` and we render a zeroed
// strip rather than querying. Self-fetching + Suspense-isolated like the
// observation strip.

export async function IncidentAnalyticsStrip({ userId }: { userId: string }) {
  try {
    const scope = await incidentReadScopeWhere(userId);
    const { now, startOfMonth, startOfLastMonth } = monthBounds();
    const buckets = last12Months(now);
    const twelveMonthsAgo = buckets[0].start;
    const stalledBefore = new Date(now.getTime() - 30 * 86_400_000);
    const ltiOpenBefore = new Date(now.getTime() - 10 * 86_400_000);

    let data: AnalyticsStripData;

    if (scope === false) {
      // No read access → honest empty strip, no DB hit.
      data = {
        tiles: [
          { label: "Open Investigations", value: 0, emphasis: true },
          { label: "Closed MTD", value: 0 },
          { label: "CAPA Linkage", value: "—" },
        ],
        sparkline: null,
        alerts: [
          { label: "Stalled", count: 0, tone: "bad", href: "/incidents" },
          { label: "LTI open", count: 0, tone: "bad", href: "/incidents?type=LTI" },
        ],
      };
      return <AnalyticsStrip data={data} />;
    }

    const [openRows, trendRows, closedThisMonth, closedPrevCount, closedTotal, closedWithCapa] =
      await Promise.all([
        prisma.incident.findMany({
          where: { AND: [scope, { status: { not: "CLOSED" } }] },
          select: { date: true, type: true },
          take: 5000,
        }),
        prisma.incident.findMany({
          where: { AND: [scope, { date: { gte: twelveMonthsAgo } }] },
          select: { date: true },
          take: 5000,
        }),
        prisma.incident.findMany({
          where: { AND: [scope, { status: "CLOSED", closedAt: { gte: startOfMonth } }] },
          select: { date: true, closedAt: true },
          take: 5000,
        }),
        prisma.incident.count({
          where: { AND: [scope, { status: "CLOSED", closedAt: { gte: startOfLastMonth, lt: startOfMonth } }] },
        }),
        // CAPA-linkage rate over the trailing 12 months of closures.
        prisma.incident.count({
          where: { AND: [scope, { status: "CLOSED", closedAt: { gte: twelveMonthsAgo } }] },
        }),
        prisma.incident.count({
          where: { AND: [scope, { status: "CLOSED", closedAt: { gte: twelveMonthsAgo }, capas: { some: {} } }] },
        }),
      ]);

    const open = openRows.length;
    const stalled = openRows.filter((r) => r.date < stalledBefore).length;
    const ltiOpen = openRows.filter(
      (r) => (r.type === "LTI" || r.type === "FATALITY") && r.date < ltiOpenBefore
    ).length;

    const trendCounts = bucketCounts(trendRows.map((r) => r.date), buckets);
    const openedThisMonth = trendCounts[11];

    const closedMTD = closedThisMonth.length;
    const avgDays = avgDaysBetween(
      closedThisMonth.filter((r) => r.closedAt).map((r) => ({ from: r.date, to: r.closedAt as Date }))
    );

    const linkagePct = closedTotal ? Math.round((closedWithCapa / closedTotal) * 100) : null;

    data = {
      tiles: [
        {
          label: "Open Investigations",
          value: open,
          emphasis: true,
          href: "/incidents",
          delta: netDelta(openedThisMonth - closedMTD, false),
        },
        {
          label: "Closed MTD",
          value: closedMTD,
          href: "/incidents?status=CLOSED",
          delta: percentDelta(closedMTD, closedPrevCount, true),
          badge: avgDays !== null ? { text: `~${avgDays}d to close`, tone: "neutral" } : null,
        },
        {
          label: "CAPA Linkage",
          value: linkagePct === null ? "—" : `${linkagePct}%`,
          href: "/incidents?status=CLOSED",
        },
      ],
      sparkline: {
        points: buckets.map((b, i) => ({ label: b.label, value: trendCounts[i] })),
        color: "#ea580c",
        label: "Incidents · 12 mo",
      },
      alerts: [
        { label: "Stalled >30d", count: stalled, tone: "bad", href: "/incidents" },
        { label: "LTI open >10d", count: ltiOpen, tone: "bad", href: "/incidents?type=LTI" },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[incident-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
