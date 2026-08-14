import {
  AnalyticsStrip,
  AnalyticsStripError,
  type AnalyticsStripData,
} from "@/components/dashboard/analytics-strip";
import { fetchStrip, sparkPoints, type StripBase } from "@/lib/dashboard/strip-data";
import { netDelta, percentDelta } from "@/lib/dashboard/strip";

// CAPA analytics strip.
//
// "Open" means a state outside the terminal/rejected set — that rule now lives
// once, in the backend (CAPA_CLOSED_STATES), instead of being restated here.
// Streams in its own <Suspense> boundary so it never blocks the list.

interface CapaStrip extends StripBase {
  open: number;
  overdue: number;
  /** HIGH/CRITICAL severity AND past its closure target. */
  criticalOverdue: number;
  openedThisMonth: number;
  closedMTD: number;
  closedPrev: number;
  /** Share of verifications completed in the last 90 days rated EFFECTIVE. */
  effPct: number | null;
}

export async function CapaAnalyticsStrip() {
  try {
    const m = await fetchStrip<CapaStrip>("capa");

    const data: AnalyticsStripData = {
      tiles: [
        {
          label: "Open CAPAs",
          value: m.open,
          emphasis: true,
          href: "/capa",
          // Net backlog change this month: opened − closed. Growth is bad.
          delta: netDelta(m.openedThisMonth - m.closedMTD, false),
        },
        {
          label: "Overdue",
          value: m.overdue,
          href: "/capa",
          delta: null,
        },
        {
          label: "Closed MTD",
          value: m.closedMTD,
          href: "/capa",
          delta: percentDelta(m.closedMTD, m.closedPrev, true),
          badge:
            m.effPct === null
              ? null
              : {
                  text: `${m.effPct}% effective`,
                  tone: m.effPct > 90 ? "good" : m.effPct >= 70 ? "neutral" : "bad",
                },
        },
      ],
      sparkline: {
        points: sparkPoints(m.bucketStarts, m.trendCounts),
        color: "#7c3aed",
        label: "CAPAs opened · 12 mo",
      },
      alerts: [
        { label: "Critical overdue", count: m.criticalOverdue, tone: "bad", href: "/capa" },
        { label: "Overdue", count: m.overdue, tone: "warn", href: "/capa" },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[capa-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
