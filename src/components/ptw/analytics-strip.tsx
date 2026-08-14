import {
  AnalyticsStrip,
  AnalyticsStripError,
  type AnalyticsStripData,
} from "@/components/dashboard/analytics-strip";
import { fetchStrip, sparkPoints, type StripBase } from "@/lib/dashboard/strip-data";
import { netDelta, percentDelta } from "@/lib/dashboard/strip";

// Permit to Work analytics strip.
//
// The sparkline is WEEKLY (12 × 7-day buckets by createdAt) rather than
// monthly, because permit volume is read operationally week-over-week — the
// backend returns `bucketKind: "week"` and the labels follow.

interface PtwStrip extends StripBase {
  /** ACTIVE / SAFETY_APPROVED / PLANT_HEAD_APPROVED. */
  activeCount: number;
  closedMTD: number;
  closedLastMonth: number;
  activatedThisMonth: number;
  /** Share of MTD closures where closedAt <= validTo. */
  onTimePct: number | null;
  /** Mean createdAt → activatedAt, in hours, for permits activated MTD. */
  avgCycleHours: number | null;
  /** Still live (non-terminal) but past validTo. */
  overdue: number;
  /** No competency-gate-block model exists yet — always 0 for now. */
  competencyBlocks: number;
}

export async function PtwAnalyticsStrip() {
  try {
    const m = await fetchStrip<PtwStrip>("ptw");

    const data: AnalyticsStripData = {
      tiles: [
        {
          label: "Active Permits",
          value: m.activeCount,
          emphasis: true,
          href: "/ptw?status=ACTIVE",
          // Net flow this month: activated − closed. Neither rise nor fall is
          // intrinsically good for a live-work count → neutral framing.
          delta: netDelta(m.activatedThisMonth - m.closedMTD, false),
        },
        {
          label: "Closed This Month",
          value: m.closedMTD,
          href: "/ptw?status=CLOSED",
          delta: percentDelta(m.closedMTD, m.closedLastMonth, true),
          badge:
            m.onTimePct === null
              ? null
              : {
                  text: `${m.onTimePct}% on-time`,
                  tone: m.onTimePct > 90 ? "good" : m.onTimePct >= 70 ? "neutral" : "bad",
                },
        },
        {
          label: "Avg Cycle Time",
          value: m.avgCycleHours === null ? "—" : `${m.avgCycleHours}h`,
        },
      ],
      sparkline: {
        points: sparkPoints(m.bucketStarts, m.trendCounts, m.bucketKind ?? "week"),
        color: "#3b82f6",
        label: "Permits · 12 wk",
      },
      alerts: [
        { label: "Overdue", count: m.overdue, tone: "bad", href: "/ptw" },
        { label: "Competency blocks", count: m.competencyBlocks, tone: "warn", href: "/ptw" },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[ptw-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
