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

// MOC (Management of Change) analytics strip — Prisma-direct (the moc page uses
// backendFetch). ChangeRequest carries plantId so we scope with the shared
// stripPlantWhere resolver. Status is the 18-state lowercase lifecycle string;
// closed states contain "closed", approval-pending is "under_approval".

export async function MocAnalyticsStrip() {
  try {
    const scope = await stripPlantWhere();
    const { now } = monthBounds();
    const buckets = last12Months(now);
    const twelveMonthsAgo = buckets[0].start;
    const in30Days = new Date(now.getTime() + 30 * 86_400_000);

    const [statusRows, trendRows] = await Promise.all([
      // Status + timeline snapshot — drives every KPI and alert in JS.
      prisma.changeRequest.findMany({
        where: { ...scope },
        select: { status: true, isTemporary: true, temporaryExpiryDate: true, targetCompletionDate: true },
        take: 10000,
      }),
      // 12-month initiated volume (initiatedAt) → sparkline.
      prisma.changeRequest.findMany({
        where: { ...scope, initiatedAt: { gte: twelveMonthsAgo } },
        select: { initiatedAt: true },
        take: 10000,
      }),
    ]);

    // ── Derive metrics ──────────────────────────────────────────────
    // "open" = not in any closed* state and not a draft.
    const isClosed = (s: string) => s.includes("closed");
    const isOpen = (s: string) => !isClosed(s) && s !== "draft";

    const activeMocs = statusRows.filter((r) => isOpen(r.status)).length;
    const awaitingApproval = statusRows.filter((r) => r.status.includes("approval")).length;
    const overdue = statusRows.filter(
      (r) => isOpen(r.status) && r.targetCompletionDate && r.targetCompletionDate < now
    ).length;
    const tempExpiring = statusRows.filter(
      (r) =>
        r.isTemporary &&
        r.temporaryExpiryDate &&
        r.temporaryExpiryDate > now &&
        r.temporaryExpiryDate <= in30Days
    ).length;

    const trendCounts = bucketCounts(trendRows.map((r) => r.initiatedAt), buckets);

    const data: AnalyticsStripData = {
      tiles: [
        {
          label: "Active MOCs",
          value: activeMocs,
          emphasis: true,
          href: "/moc",
        },
        {
          label: "Awaiting Approval",
          value: awaitingApproval,
          href: "/moc",
        },
        {
          label: "Overdue",
          value: overdue,
          href: "/moc",
          delta: null,
        },
      ],
      sparkline: {
        points: buckets.map((b, i) => ({ label: b.label, value: trendCounts[i] })),
        color: "#6366f1",
        label: "MOCs · 12 mo",
      },
      alerts: [
        { label: "Temp expiring 30d", count: tempExpiring, tone: "warn", href: "/moc" },
        { label: "Overdue", count: overdue, tone: "bad", href: "/moc" },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[moc-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
