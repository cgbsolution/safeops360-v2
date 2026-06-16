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

// Skill Matrix analytics strip — Prisma-direct. CompetencyRecord carries plantId
// so we scope with the shared stripPlantWhere resolver. State literals below
// mirror EXACTLY the skill-matrix page's STATE_META state-grouping so the
// strip's numbers line up with the matrix grid.

// ── State groupings — kept identical to skill-matrix/page.tsx (STATE_META). ──
const VALID_STATE = "validated_active";
const EXPIRING_STATE = "expiring_soon";
const EXPIRED_STATES = ["expired_in_grace", "expired_revoked", "lapsed_requires_full_redo"];
const IN_PROGRESS_STATES = ["in_training", "training_complete_pending_assessment", "under_assessment"];
const NOT_STARTED_STATES = ["not_yet_attempted"];
const SUSPENDED_STATE = "suspended";

export async function SkillMatrixAnalyticsStrip() {
  try {
    const scope = await stripPlantWhere();
    const { now } = monthBounds();
    const buckets = last12Months(now);
    const twelveMonthsAgo = buckets[0].start;
    const in30Days = new Date(now.getTime() + 30 * 86_400_000);

    const [stateRows, trendRows] = await Promise.all([
      // State + validUntil snapshot — drives every KPI and alert in JS.
      prisma.competencyRecord.findMany({
        where: { ...scope },
        select: { state: true, validUntil: true },
        take: 20000,
      }),
      // 12-month created volume → sparkline.
      prisma.competencyRecord.findMany({
        where: { ...scope, createdAt: { gte: twelveMonthsAgo } },
        select: { createdAt: true },
        take: 20000,
      }),
    ]);

    // ── Tally by state group ──────────────────────────────────────────
    const valid = stateRows.filter((r) => r.state === VALID_STATE).length;
    const suspended = stateRows.filter((r) => r.state === SUSPENDED_STATE).length;
    const inProgress = stateRows.filter((r) => IN_PROGRESS_STATES.includes(r.state)).length;
    const notStarted = stateRows.filter((r) => NOT_STARTED_STATES.includes(r.state)).length;
    const expired = stateRows.filter((r) => EXPIRED_STATES.includes(r.state)).length;
    const expiring = stateRows.filter(
      (r) =>
        r.state === EXPIRING_STATE ||
        (r.validUntil && r.validUntil > now && r.validUntil <= in30Days)
    ).length;

    // Overall validity = valid / applicable (exclude not-started competencies).
    const applicable = stateRows.length - notStarted;
    const validityPct = applicable > 0 ? Math.round((valid / applicable) * 100) : 0;

    const trendCounts = bucketCounts(trendRows.map((r) => r.createdAt), buckets);

    const data: AnalyticsStripData = {
      tiles: [
        {
          label: "Overall Validity",
          value: `${validityPct}%`,
          emphasis: true,
          href: "/skill-matrix",
          badge: {
            text: `${valid}/${applicable} valid`,
            tone: validityPct >= 75 ? "good" : validityPct >= 50 ? "neutral" : "bad",
          },
        },
        {
          label: "Suspended",
          value: suspended,
          href: "/skill-matrix",
        },
        {
          label: "In Progress",
          value: inProgress,
          href: "/skill-matrix",
        },
      ],
      sparkline: {
        points: buckets.map((b, i) => ({ label: b.label, value: trendCounts[i] })),
        color: "#3b82f6",
        label: "Competencies · 12 mo",
      },
      alerts: [
        { label: "Expiring 30d", count: expiring, tone: "warn", href: "/skill-matrix" },
        { label: "Expired", count: expired, tone: "bad", href: "/skill-matrix" },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[skill-matrix-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
