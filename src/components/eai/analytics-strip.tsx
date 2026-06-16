import { prisma } from "@/lib/prisma";
import { stripPlantWhere } from "@/lib/dashboard/scope";
import {
  AnalyticsStrip,
  AnalyticsStripError,
  type AnalyticsStripData,
} from "@/components/dashboard/analytics-strip";
import { last12Months, bucketCounts } from "@/lib/dashboard/strip";

// EAI (Environmental Register) analytics strip — Prisma-direct module.
//
// The eai page itself reads via backendFetch, but the strip queries Prisma
// directly (the brief's directive) using the shared stripPlantWhere() plant
// scope. EaiEntry / EaiComplianceObligation reach plant scope through their
// study relation (`study: { plantId }` / `entry: { study: { plantId } }`).
// Self-fetching + Suspense-isolated.

export async function EaiAnalyticsStrip() {
  try {
    const plant = await stripPlantWhere();
    // Relation-scope fragments: spread the plant filter onto the study.
    const studyScope = plant.plantId ? { plantId: plant.plantId } : {};
    const now = new Date();
    const buckets = last12Months(now);
    const twelveMonthsAgo = buckets[0].start;
    const in30Days = new Date(now.getTime() + 30 * 86_400_000);
    const in7Days = new Date(now.getTime() + 7 * 86_400_000);

    const [activeAspects, significantAspects, obligationsDue30, trendRows, reviewsOverdue, obligations7] =
      await Promise.all([
        // Active aspects = ACTIVE entries in plant-scoped studies.
        prisma.eaiEntry.count({
          where: { status: "ACTIVE", study: studyScope },
        }),
        // Significant aspects = ACTIVE entries flagged residualSignificant.
        prisma.eaiEntry.count({
          where: { status: "ACTIVE", residualSignificant: true, study: studyScope },
        }),
        // Obligations due within 30 days (ACTIVE).
        prisma.eaiComplianceObligation.count({
          where: {
            status: "ACTIVE",
            nextMonitoringDue: { gte: now, lte: in30Days },
            entry: { study: studyScope },
          },
        }),
        // 12-month entry-creation dates → sparkline.
        prisma.eaiEntry.findMany({
          where: { createdAt: { gte: twelveMonthsAgo }, study: studyScope },
          select: { createdAt: true },
          take: 5000,
        }),
        // Reviews overdue: ACTIVE entries whose nextReviewDue has passed.
        prisma.eaiEntry.count({
          where: { status: "ACTIVE", nextReviewDue: { lt: now }, study: studyScope },
        }),
        // Obligations due within 7 days (ACTIVE).
        prisma.eaiComplianceObligation.count({
          where: {
            status: "ACTIVE",
            nextMonitoringDue: { gte: now, lte: in7Days },
            entry: { study: studyScope },
          },
        }),
      ]);

    const trendCounts = bucketCounts(trendRows.map((r) => r.createdAt), buckets);

    const data: AnalyticsStripData = {
      tiles: [
        {
          label: "Active Aspects",
          value: activeAspects,
          emphasis: true,
          href: "/eai",
        },
        {
          label: "Significant Aspects",
          value: significantAspects,
          href: "/eai",
        },
        {
          label: "Obligations Due (30d)",
          value: obligationsDue30,
          href: "/eai",
        },
      ],
      sparkline: {
        points: buckets.map((b, i) => ({ label: b.label, value: trendCounts[i] })),
        color: "#14b8a6",
        label: "Aspects · 12 mo",
      },
      alerts: [
        { label: "Reviews overdue", count: reviewsOverdue, tone: "bad", href: "/eai" },
        { label: "Obligations 7d", count: obligations7, tone: "warn", href: "/eai" },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[eai-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
