import { backendFetch } from "@/lib/backend/fetch";
import {
  AnalyticsStrip,
  AnalyticsStripError,
  type AnalyticsStripData,
} from "@/components/dashboard/analytics-strip";
import { last12Months, bucketCounts } from "@/lib/dashboard/strip";

// HIRA — Risk Register analytics strip — pure 3-tier (FastAPI) module.
//
// Validates the backend data path for the strip pattern. RBAC is enforced
// server-side by the backend against the per-request JWT, so the strip
// shows exactly the studies this user may see. Self-fetching + Suspense-
// isolated like the Prisma strips.
//
// NOTE: every tile/chip here is derived from data the existing
// /api/hira/studies endpoint already returns. Two richer signals the brief
// asks for — an entries-by-residual 12-month sparkline and an
// "above acceptable threshold" chip — need a dedicated backend aggregate
// endpoint; tracked as a fast-follow. Until then the sparkline plots
// studies-started/month (real) and the second chip is reviews-due-30d.

type StudyItem = {
  status: string;
  initiatedAt: string;
  nextScheduledReviewDate: string | null;
  aggregateMetrics: { risk_distribution_residual?: { high?: number; critical?: number } } | null;
  entryCount: number;
};
type StudyListResponse = { items: StudyItem[]; total: number; statusCounts: Record<string, number> };

export async function HiraAnalyticsStrip() {
  try {
    const res = await backendFetch<StudyListResponse>("/api/hira/studies");
    const items = res.items ?? [];
    const statusCounts = res.statusCounts ?? {};

    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86_400_000);
    const buckets = last12Months(now);

    const activeStudies = statusCounts.ACTIVE ?? 0;
    const totalEntries = items.reduce((s, it) => s + (it.entryCount ?? 0), 0);
    const criticalResidual = items.reduce(
      (s, it) => s + (it.aggregateMetrics?.risk_distribution_residual?.critical ?? 0),
      0
    );

    const reviewDates = items
      .map((it) => (it.nextScheduledReviewDate ? new Date(it.nextScheduledReviewDate) : null))
      .filter((d): d is Date => d !== null);
    const reviewsOverdue = reviewDates.filter((d) => d < now).length;
    const reviewsDue30 = reviewDates.filter((d) => d >= now && d <= in30).length;

    const initiatedCounts = bucketCounts(
      items.map((it) => new Date(it.initiatedAt)),
      buckets
    );
    const startedThisMonth = initiatedCounts[11];

    const data: AnalyticsStripData = {
      tiles: [
        {
          label: "Active Studies",
          value: activeStudies,
          emphasis: true,
          href: "/hira?status=ACTIVE",
          badge: startedThisMonth > 0 ? { text: `+${startedThisMonth} new`, tone: "neutral" } : null,
        },
        {
          label: "Active Entries",
          value: totalEntries,
          href: "/hira",
        },
        {
          label: "Critical Residual",
          value: criticalResidual,
          href: "/hira",
        },
      ],
      sparkline: {
        points: buckets.map((b, i) => ({ label: b.label, value: initiatedCounts[i] })),
        color: "#7c3aed",
        label: "Studies started · 12 mo",
      },
      alerts: [
        { label: "Reviews overdue", count: reviewsOverdue, tone: "bad", href: "/hira" },
        { label: "Due 30d", count: reviewsDue30, tone: "warn", href: "/hira" },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[hira-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
