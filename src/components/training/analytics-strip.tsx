import {
  AnalyticsStrip,
  AnalyticsStripError,
  type AnalyticsStripData,
} from "@/components/dashboard/analytics-strip";
import { fetchStrip, sparkPoints, type StripBase } from "@/lib/dashboard/strip-data";

// Training & Competency analytics strip.
//
// Compliance is measured on the LATEST record per (employee, programme) pair,
// so someone who re-sat a lapsed course counts once, on the new result. That
// collapse now happens backend-side, against the same rule the training page
// uses — the two used to implement it separately.

interface TrainingStrip extends StripBase {
  compliancePct: number;
  /** Numerator and denominator behind the percentage, for the badge. */
  validPairs: number;
  applicablePairs: number;
  validCerts: number;
  expiredCerts: number;
  /** EXPIRING_SOON, or a validTo inside 30 days. */
  expiringCerts: number;
}

export async function TrainingAnalyticsStrip() {
  try {
    const m = await fetchStrip<TrainingStrip>("training");

    const data: AnalyticsStripData = {
      tiles: [
        {
          label: "Compliance %",
          value: `${m.compliancePct}%`,
          emphasis: true,
          href: "/training",
          badge: {
            text: `${m.validPairs}/${m.applicablePairs} valid`,
            tone: m.compliancePct >= 90 ? "good" : m.compliancePct >= 70 ? "neutral" : "bad",
          },
        },
        {
          label: "Valid Certifications",
          value: m.validCerts,
          href: "/training/certificates",
        },
        {
          label: "Expired",
          value: m.expiredCerts,
          href: "/training?filter=expired",
        },
      ],
      sparkline: {
        points: sparkPoints(m.bucketStarts, m.trendCounts),
        color: "#10b981",
        label: "Trainings · 12 mo",
      },
      alerts: [
        {
          label: "Expiring 30d",
          count: m.expiringCerts,
          tone: "warn",
          href: "/training?filter=expired",
        },
        { label: "Expired", count: m.expiredCerts, tone: "bad", href: "/training?filter=expired" },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[training-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
