import {
  AnalyticsStrip,
  AnalyticsStripError,
  type AnalyticsStripData,
} from "@/components/dashboard/analytics-strip";
import { fetchStrip, sparkPoints, type StripBase } from "@/lib/dashboard/strip-data";

// PPE Management analytics strip.
//
// The PPE module page resolves a single plantId before rendering (it shows a
// "select a plant" gate otherwise), so the strip is scoped to that plant. The
// backend still narrows that plantId by the caller's accessible plants, so
// passing another tenant's plant here yields an empty strip, not their data.
//
// "People Compliance" is a serviceability proxy: the share of issued (held)
// items that are neither inspection-overdue nor past service life. The full
// person-vs-required-PPE matrix lives behind the PPE requirement profiles.

interface PpeStrip extends StripBase {
  itemsInService: number;
  inspectionOverdue: number;
  compliancePct: number | null;
  recallsActive: number;
  /** In-service items whose service life ends within 90 days. */
  serviceLifeEnding: number;
}

export async function PpeAnalyticsStrip({ plantId }: { plantId: string }) {
  try {
    const m = await fetchStrip<PpeStrip>("ppe", { plantId });

    const data: AnalyticsStripData = {
      tiles: [
        { label: "Items In Service", value: m.itemsInService, emphasis: true },
        {
          label: "Inspection Overdue",
          value: m.inspectionOverdue,
          badge: m.inspectionOverdue > 0 ? { text: "needs action", tone: "bad" } : null,
        },
        {
          label: "People Compliance",
          value: m.compliancePct === null ? "—" : `${m.compliancePct}%`,
          badge:
            m.compliancePct === null
              ? null
              : {
                  text: "serviceable",
                  tone:
                    m.compliancePct >= 90 ? "good" : m.compliancePct >= 70 ? "neutral" : "bad",
                },
        },
      ],
      sparkline: {
        points: sparkPoints(m.bucketStarts, m.trendCounts),
        color: "#0ea5e9",
        label: "Items added · 12 mo",
      },
      alerts: [
        { label: "Recalls active", count: m.recallsActive, tone: "bad", href: "/ppe" },
        {
          label: "Service life ending 90d",
          count: m.serviceLifeEnding,
          tone: "warn",
          href: "/ppe",
        },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[ppe-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
