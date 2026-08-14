import {
  AnalyticsStrip,
  AnalyticsStripError,
  type AnalyticsStripData,
} from "@/components/dashboard/analytics-strip";
import { fetchStrip, sparkPoints, type StripBase } from "@/lib/dashboard/strip-data";
import { percentDelta } from "@/lib/dashboard/strip";

// Near Miss analytics strip.
//
// Near-miss reporting is a LEADING indicator: more near misses is GOOD (hence
// higherIsBetter on both volume deltas), and the NM:LTI ratio is the classic
// safety-pyramid health metric. The LTI half of that ratio is scoped by
// INCIDENT.READ backend-side, so a user who can see near misses but not
// incidents can't infer the LTI count from the ratio.

interface NearMissStrip extends StripBase {
  /** Near misses in the trailing 12 months. */
  nm12: number;
  thisMonth: number;
  /** The 12 months before that, for the year-over-year volume delta. */
  prevWindowCount: number;
  sameMonthLastYear: number;
  /** Still REPORTED, unowned, older than 7 days. */
  uninvestigated: number;
  lti12: number;
}

export async function NearMissAnalyticsStrip() {
  try {
    const m = await fetchStrip<NearMissStrip>("near-miss");
    const ratio = m.lti12 > 0 ? Math.round(m.nm12 / m.lti12) : 0;

    const data: AnalyticsStripData = {
      tiles: [
        {
          label: "Near Misses",
          value: m.nm12,
          emphasis: true,
          href: "/near-miss",
          delta: percentDelta(m.nm12, m.prevWindowCount, true, "vs prior yr"),
        },
        {
          label: "This Month",
          value: m.thisMonth,
          href: "/near-miss",
          delta: percentDelta(m.thisMonth, m.sameMonthLastYear, true, "vs last yr"),
        },
        {
          label: "NM:LTI Ratio",
          value: m.lti12 > 0 ? `${ratio}:1` : "—",
          // Target >100:1 — more near misses per LTI is a healthier pyramid.
          badge:
            m.lti12 > 0
              ? {
                  text: ratio >= 100 ? "on target" : "below target",
                  tone: ratio >= 100 ? "good" : ratio < 20 ? "bad" : "neutral",
                }
              : null,
        },
      ],
      sparkline: {
        points: sparkPoints(m.bucketStarts, m.trendCounts),
        color: "#f59e0b",
        label: "Near misses · 12 mo",
      },
      alerts: [
        {
          label: "Uninvestigated >7d",
          count: m.uninvestigated,
          tone: "bad",
          href: "/near-miss?status=REPORTED",
        },
        {
          label: "Ratio",
          count: m.lti12 > 0 ? ratio : 0,
          tone: m.lti12 > 0 && ratio < 20 ? "bad" : "neutral",
          href: "/near-miss",
        },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[near-miss-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
