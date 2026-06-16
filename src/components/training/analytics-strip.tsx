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

// Training Management analytics strip — Prisma-direct. The training page has no
// {userId} list-scope helper, so we use the shared stripPlantWhere resolver.
// Neither TrainingRecord nor TrainingCertificate carries plantId directly, so
// we scope through the related user (employee / certificate holder).

export async function TrainingAnalyticsStrip() {
  try {
    const { plantId } = await stripPlantWhere();
    const { now } = monthBounds();
    const buckets = last12Months(now);
    const twelveMonthsAgo = buckets[0].start;
    const in30Days = new Date(now.getTime() + 30 * 86_400_000);

    // Relation filters — only applied when a plant scope is active.
    const recordScope = plantId ? { employee: { plantId } } : {};
    const certScope = plantId ? { user: { plantId } } : {};

    const [latestRecords, trendRows, certs] = await Promise.all([
      // Latest-per-(employee,program) compliance basis — mirror the page's logic.
      prisma.trainingRecord.findMany({
        where: { ...recordScope },
        select: { employeeId: true, programId: true, date: true, passed: true, validUntil: true },
        take: 10000,
      }),
      // 12-month training volume (date) → sparkline.
      prisma.trainingRecord.findMany({
        where: { ...recordScope, date: { gte: twelveMonthsAgo } },
        select: { date: true },
        take: 10000,
      }),
      // Certificate status snapshot — valid / expiring / expired counts.
      prisma.trainingCertificate.findMany({
        where: { ...certScope },
        select: { status: true, validTo: true },
        take: 10000,
      }),
    ]);

    // ── Compliance % — collapse to latest record per (employee,program) pair. ──
    const latestByPair = new Map<string, (typeof latestRecords)[number]>();
    for (const r of latestRecords) {
      const key = `${r.employeeId}::${r.programId}`;
      const prev = latestByPair.get(key);
      if (!prev || r.date > prev.date) latestByPair.set(key, r);
    }
    const latest = Array.from(latestByPair.values());
    const validPairs = latest.filter((r) => r.passed && r.validUntil > now).length;
    const compliancePct = latest.length ? Math.round((validPairs / latest.length) * 100) : 0;

    // ── Certificate counts ──
    const validCerts = certs.filter((c) => c.status === "ACTIVE").length;
    const expiredCerts = certs.filter((c) => c.status === "EXPIRED" || c.status === "LAPSED").length;
    const expiringCerts = certs.filter(
      (c) =>
        c.status === "EXPIRING_SOON" ||
        (c.validTo && c.validTo > now && c.validTo <= in30Days)
    ).length;

    const trendCounts = bucketCounts(trendRows.map((r) => r.date), buckets);

    const data: AnalyticsStripData = {
      tiles: [
        {
          label: "Compliance %",
          value: `${compliancePct}%`,
          emphasis: true,
          href: "/training",
          badge: {
            text: `${validPairs}/${latest.length} valid`,
            tone: compliancePct >= 90 ? "good" : compliancePct >= 70 ? "neutral" : "bad",
          },
        },
        {
          label: "Valid Certifications",
          value: validCerts,
          href: "/training/certificates",
        },
        {
          label: "Expired",
          value: expiredCerts,
          href: "/training?filter=expired",
        },
      ],
      sparkline: {
        points: buckets.map((b, i) => ({ label: b.label, value: trendCounts[i] })),
        color: "#10b981",
        label: "Trainings · 12 mo",
      },
      alerts: [
        { label: "Expiring 30d", count: expiringCerts, tone: "warn", href: "/training?filter=expired" },
        { label: "Expired", count: expiredCerts, tone: "bad", href: "/training?filter=expired" },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[training-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
