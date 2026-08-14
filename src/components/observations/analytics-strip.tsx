import {
  AnalyticsStrip,
  AnalyticsStripError,
  type AnalyticsStripData,
} from "@/components/dashboard/analytics-strip";
import { fetchStrip, sparkPoints, type StripBase } from "@/lib/dashboard/strip-data";
import { netDelta, percentDelta } from "@/lib/dashboard/strip";

// Safety Observation analytics strip.
//
// Self-fetching async server component in its own <Suspense> boundary, so it
// streams independently of the list and never blocks it. All metrics come from
// FastAPI, which scopes them through the same OBSERVATION.READ path the list
// endpoint uses — the strip's numbers therefore always match the list the user
// is allowed to see.

interface ObservationStrip extends StripBase {
  open: number;
  overdue: number;
  highSeverity: number;
  openedThisMonth: number;
  closedMTD: number;
  /** Closures up to the same elapsed point of last month — a like-for-like
   *  comparison. A mid-month MTD measured against a whole prior month always
   *  reads as a false ↓100%. */
  closedPrevSamePoint: number;
  avg90: number | null;
  avgPrev90: number | null;
  onTimePct: number | null;
}

export async function ObservationAnalyticsStrip({ userId }: { userId: string }) {
  void userId; // scope is resolved backend-side from the bearer token
  try {
    const m = await fetchStrip<ObservationStrip>("observations");

    const data: AnalyticsStripData = {
      tiles: [
        {
          label: "Open Observations",
          value: m.open,
          emphasis: true,
          href: "/observations",
          // Net backlog change this month: opened − closed. Growth is bad.
          delta: netDelta(m.openedThisMonth - m.closedMTD, false),
        },
        {
          label: "Closed MTD",
          value: m.closedMTD,
          href: "/observations?status=CLOSED",
          delta: percentDelta(m.closedMTD, m.closedPrevSamePoint, true, "vs same pt last mo"),
          badge:
            m.onTimePct === null
              ? null
              : {
                  text: `${m.onTimePct}% on-time`,
                  tone: m.onTimePct > 90 ? "good" : m.onTimePct >= 70 ? "neutral" : "bad",
                },
        },
        {
          label: "Avg Days to Close",
          // Trailing-90d cycle time; explicit "None" no-data state, never a
          // bare dash. The 90d badge names the window.
          value: m.avg90 !== null ? m.avg90 : "None",
          badge: { text: "90d", tone: "neutral" },
          delta:
            m.avg90 !== null && m.avgPrev90 !== null
              ? percentDelta(m.avg90, m.avgPrev90, false, "vs prior 90d")
              : null,
        },
      ],
      sparkline: {
        points: sparkPoints(m.bucketStarts, m.trendCounts),
        color: "#7c3aed",
        label: "Observations · 12 mo",
      },
      alerts: [
        { label: "Overdue", count: m.overdue, tone: "bad", href: "/observations" },
        { label: "High severity", count: m.highSeverity, tone: "warn", href: "/observations" },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[observation-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
