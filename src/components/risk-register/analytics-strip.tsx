import { prisma } from "@/lib/prisma";
import { stripPlantWhere } from "@/lib/dashboard/scope";
import {
  AnalyticsStrip,
  AnalyticsStripError,
  type AnalyticsStripData,
} from "@/components/dashboard/analytics-strip";
import { last12Months, bucketCounts } from "@/lib/dashboard/strip";

// Combined Risk Register analytics strip — Prisma-direct module.
//
// Unifies HIRA + EAI register entries side by side. The page reads via
// backendFetch, but the strip queries Prisma directly with the shared
// stripPlantWhere() plant scope, reaching plant via each model's study
// relation (`study: { plantId }`). "Critical residual" treats HIRA
// CRITICAL and EAI MAJOR as the top band; "above threshold" is the
// residualAcceptable=false set. Self-fetching + Suspense-isolated.

export async function RiskRegisterAnalyticsStrip() {
  try {
    const plant = await stripPlantWhere();
    const studyScope = plant.plantId ? { plantId: plant.plantId } : {};
    const now = new Date();
    const buckets = last12Months(now);
    const twelveMonthsAgo = buckets[0].start;

    const [
      hiraActive,
      eaiActive,
      hiraCritical,
      eaiCritical,
      hiraAboveThreshold,
      eaiAboveThreshold,
      hiraReviewsOverdue,
      eaiReviewsOverdue,
      hiraTrend,
      eaiTrend,
    ] = await Promise.all([
      prisma.hiraEntry.count({ where: { status: "ACTIVE", study: studyScope } }),
      prisma.eaiEntry.count({ where: { status: "ACTIVE", study: studyScope } }),
      // Critical residual band: HIRA CRITICAL / EAI MAJOR (impact), ACTIVE.
      prisma.hiraEntry.count({
        where: { status: "ACTIVE", residualRiskLevel: "CRITICAL", study: studyScope },
      }),
      prisma.eaiEntry.count({
        where: { status: "ACTIVE", residualImpactLevel: "MAJOR", study: studyScope },
      }),
      // Above threshold: residual risk/impact not acceptable, ACTIVE.
      prisma.hiraEntry.count({
        where: { status: "ACTIVE", residualAcceptable: false, study: studyScope },
      }),
      prisma.eaiEntry.count({
        where: { status: "ACTIVE", residualAcceptable: false, study: studyScope },
      }),
      // Reviews overdue: ACTIVE entries past nextReviewDue.
      prisma.hiraEntry.count({
        where: { status: "ACTIVE", nextReviewDue: { lt: now }, study: studyScope },
      }),
      prisma.eaiEntry.count({
        where: { status: "ACTIVE", nextReviewDue: { lt: now }, study: studyScope },
      }),
      // 12-month creation dates → combined sparkline.
      prisma.hiraEntry.findMany({
        where: { createdAt: { gte: twelveMonthsAgo }, study: studyScope },
        select: { createdAt: true },
        take: 5000,
      }),
      prisma.eaiEntry.findMany({
        where: { createdAt: { gte: twelveMonthsAgo }, study: studyScope },
        select: { createdAt: true },
        take: 5000,
      }),
    ]);

    const totalEntries = hiraActive + eaiActive;
    const criticalResidual = hiraCritical + eaiCritical;
    const aboveThreshold = hiraAboveThreshold + eaiAboveThreshold;
    const reviewsOverdue = hiraReviewsOverdue + eaiReviewsOverdue;

    const combinedDates = [
      ...hiraTrend.map((r) => r.createdAt),
      ...eaiTrend.map((r) => r.createdAt),
    ];
    const trendCounts = bucketCounts(combinedDates, buckets);

    const data: AnalyticsStripData = {
      tiles: [
        {
          label: "Total Entries",
          value: totalEntries,
          emphasis: true,
          href: "/risk-register",
        },
        {
          label: "Critical Residual",
          value: criticalResidual,
          href: "/risk-register?significantOnly=1",
          badge:
            criticalResidual > 0
              ? { text: "review", tone: "bad" }
              : { text: "clear", tone: "good" },
        },
        {
          label: "Above Threshold",
          value: aboveThreshold,
          href: "/risk-register?significantOnly=1",
        },
      ],
      sparkline: {
        points: buckets.map((b, i) => ({ label: b.label, value: trendCounts[i] })),
        color: "#7c3aed",
        label: "Risk entries · 12 mo",
      },
      alerts: [
        { label: "Above threshold", count: aboveThreshold, tone: "bad", href: "/risk-register" },
        { label: "Reviews overdue", count: reviewsOverdue, tone: "warn", href: "/risk-register" },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[risk-register-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
