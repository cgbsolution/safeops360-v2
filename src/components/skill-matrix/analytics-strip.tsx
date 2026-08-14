import {
  AnalyticsStrip,
  AnalyticsStripError,
  type AnalyticsStripData,
} from "@/components/dashboard/analytics-strip";
import { fetchStrip, sparkPoints, type StripBase } from "@/lib/dashboard/strip-data";

// Skill Matrix analytics strip.
//
// The competency state groupings (which states count as valid / expiring /
// expired / in-progress) live backend-side and are shared with the matrix grid,
// so the strip's totals and the grid beneath it cannot drift apart. They were
// previously restated here as literal arrays that had to be kept in step by
// hand with the page's STATE_META.

interface SkillMatrixStrip extends StripBase {
  validityPct: number;
  valid: number;
  /** Total minus not-yet-attempted — see the note on the tile below. */
  applicable: number;
  suspended: number;
  inProgress: number;
  expiring: number;
  expired: number;
}

export async function SkillMatrixAnalyticsStrip() {
  try {
    const m = await fetchStrip<SkillMatrixStrip>("skill-matrix");

    const data: AnalyticsStripData = {
      tiles: [
        {
          label: "Overall Validity",
          value: `${m.validityPct}%`,
          emphasis: true,
          href: "/skill-matrix",
          badge: {
            // Denominator excludes not-yet-attempted competencies: someone
            // unassessed isn't non-compliant, and counting them would make
            // every new hire drag the figure down.
            text: `${m.valid}/${m.applicable} valid`,
            tone: m.validityPct >= 75 ? "good" : m.validityPct >= 50 ? "neutral" : "bad",
          },
        },
        { label: "Suspended", value: m.suspended, href: "/skill-matrix" },
        { label: "In Progress", value: m.inProgress, href: "/skill-matrix" },
      ],
      sparkline: {
        points: sparkPoints(m.bucketStarts, m.trendCounts),
        color: "#3b82f6",
        label: "Competencies · 12 mo",
      },
      alerts: [
        { label: "Expiring 30d", count: m.expiring, tone: "warn", href: "/skill-matrix" },
        { label: "Expired", count: m.expired, tone: "bad", href: "/skill-matrix" },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[skill-matrix-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
