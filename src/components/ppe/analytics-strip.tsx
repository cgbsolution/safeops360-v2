import { prisma } from "@/lib/prisma";
import {
  AnalyticsStrip,
  AnalyticsStripError,
  type AnalyticsStripData,
} from "@/components/dashboard/analytics-strip";
import { last12Months, monthBounds } from "@/lib/dashboard/strip";

// PPE Management analytics strip — Prisma-direct.
//
// The PPE module page resolves a single plantId before rendering (it shows a
// "select a plant" gate otherwise), so the strip is scoped by that plantId —
// every Ppe* model carries a plantId column. PpeItem.status drives the
// in-service / serviceable counts; nextInspectionDueDate the overdue alert;
// serviceLifeEndDate the service-life-ending alert; batchUnderRecall recalls.
//
// "People Compliance" here is a serviceability proxy: the share of issued
// (held) items that are NOT inspection-overdue or past service life. The full
// person-vs-required-PPE matrix lives behind the PPE backend's
// people-compliance endpoint (JSON requirement profiles); deriving it from
// Prisma is deferred to the next PPE pass. Labelled accordingly.

// In-service = items that physically count as fielded equipment (not retired,
// lost, stolen, or recalled out of use).
const IN_SERVICE_STATUSES = ["in_stock", "issued", "under_inspection", "under_repair", "quarantined"];

export async function PpeAnalyticsStrip({ plantId }: { plantId: string }) {
  try {
    const { now } = monthBounds();
    const buckets = last12Months(now);
    const twelveMonthsAgo = buckets[0].start;
    const in90Days = new Date(now.getTime() + 90 * 86_400_000);

    const [inServiceRows, inspectionOverdue, issuedRows, recallsActive, serviceLifeEnding, commissionedTrend] =
      await Promise.all([
        // KPI-1: items in service.
        prisma.ppeItem.findMany({
          where: { plantId, status: { in: IN_SERVICE_STATUSES } },
          select: { id: true, nextInspectionDueDate: true, serviceLifeEndDate: true, status: true },
          take: 10000,
        }),
        // KPI-2: inspection overdue (next due date in the past, still in service).
        prisma.ppeItem.count({
          where: {
            plantId,
            status: { in: IN_SERVICE_STATUSES },
            nextInspectionDueDate: { lt: now },
          },
        }),
        // KPI-3 basis: items currently issued (held by a person).
        prisma.ppeItem.findMany({
          where: { plantId, status: "issued" },
          select: { nextInspectionDueDate: true, serviceLifeEndDate: true },
          take: 10000,
        }),
        // Alert: items flagged under an active batch recall.
        prisma.ppeItem.count({
          where: { plantId, batchUnderRecall: true },
        }),
        // Alert: in-service items whose service life ends within 90 days.
        prisma.ppeItem.count({
          where: {
            plantId,
            status: { in: IN_SERVICE_STATUSES },
            serviceLifeEndDate: { gte: now, lte: in90Days },
          },
        }),
        // Sparkline: items commissioned per month over the last 12 months.
        prisma.ppeItem.findMany({
          where: { plantId, commissionedAt: { gte: twelveMonthsAgo } },
          select: { commissionedAt: true },
          take: 10000,
        }),
      ]);

    const itemsInService = inServiceRows.length;

    // Serviceability of held items: valid = not inspection-overdue AND not past
    // service life. Used as the "people compliance" proxy tile.
    const held = issuedRows.length;
    const validHeld = issuedRows.filter(
      (r: { nextInspectionDueDate: Date | null; serviceLifeEndDate: Date | null }) =>
        (!r.nextInspectionDueDate || r.nextInspectionDueDate >= now) &&
        (!r.serviceLifeEndDate || r.serviceLifeEndDate >= now)
    ).length;
    const compliancePct = held > 0 ? Math.round((validHeld / held) * 100) : null;

    // Monthly commissioned-item counts → sparkline.
    const trendCounts = buckets.map(
      (bkt) =>
        commissionedTrend.filter(
          (r: { commissionedAt: Date }) =>
            r.commissionedAt &&
            r.commissionedAt >= bkt.start &&
            r.commissionedAt < bkt.end
        ).length
    );

    const data: AnalyticsStripData = {
      tiles: [
        {
          label: "Items In Service",
          value: itemsInService,
          emphasis: true,
        },
        {
          label: "Inspection Overdue",
          value: inspectionOverdue,
          badge: inspectionOverdue > 0 ? { text: "needs action", tone: "bad" } : null,
        },
        {
          label: "People Compliance",
          value: compliancePct === null ? "—" : `${compliancePct}%`,
          badge:
            compliancePct === null
              ? null
              : { text: "serviceable", tone: compliancePct >= 90 ? "good" : compliancePct >= 70 ? "neutral" : "bad" },
        },
      ],
      sparkline: {
        points: buckets.map((b, i) => ({ label: b.label, value: trendCounts[i] })),
        color: "#0ea5e9",
        label: "Items added · 12 mo",
      },
      alerts: [
        { label: "Recalls active", count: recallsActive, tone: "bad", href: "/ppe" },
        { label: "Service life ending 90d", count: serviceLifeEnding, tone: "warn", href: "/ppe" },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[ppe-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
