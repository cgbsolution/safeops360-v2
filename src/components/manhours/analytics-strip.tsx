import { prisma } from "@/lib/prisma";
import { stripPlantWhere } from "@/lib/dashboard/scope";
import {
  AnalyticsStrip,
  AnalyticsStripError,
  type AnalyticsStripData,
} from "@/components/dashboard/analytics-strip";
import { last12Months, monthBounds, percentDelta } from "@/lib/dashboard/strip";

// Manhours & Safety KPIs analytics strip — Prisma-direct module.
//
// manhours/page.tsx has no list-scope helper, so we scope with
// stripPlantWhere() (Manhours has plantId). Manhours rows are monthly per
// plant; we fetch a generous window ordered by period desc and aggregate in
// JS, keyed `${year}-${month}`. KPI formulas mirror the page exactly:
//   LTIFR = ltiCount * 1_000_000 / totalHours
//   TRIR  = (lti + rwc + mtc) * 200_000 / totalHours
//   totalHours = employeeHours + contractorHours
// Lower is better for LTIFR/TRIR, so deltas pass higherIsBetter=false.

const KEY = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

/** Year-month key offset `back` whole months from the (year, month) anchor. */
function monthKeyBack(year: number, month: number, back: number): string {
  const d = new Date(year, month - 1 - back, 1);
  return KEY(d.getFullYear(), d.getMonth() + 1);
}

export async function ManhoursAnalyticsStrip() {
  try {
    const plantWhere = await stripPlantWhere();
    const { now } = monthBounds();
    const buckets = last12Months(now);

    // Last ~200 monthly rows across scope, newest first — covers 24+ months
    // even across several plants. Aggregate the raw counts/hours in JS so the
    // rolling windows use the sum-of-numerators / sum-of-hours formula (NOT an
    // average of per-row ratios), matching the page's roll-up.
    const rows = await prisma.manhours.findMany({
      where: { ...plantWhere },
      select: {
        year: true,
        month: true,
        employeeHours: true,
        contractorHours: true,
        ltiCount: true,
        rwcCount: true,
        mtcCount: true,
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 200,
    });

    // Aggregate per month-key across plants.
    type Agg = { hours: number; lti: number; recordable: number };
    const byMonth = new Map<string, Agg>();
    for (const r of rows) {
      const k = KEY(r.year, r.month);
      const a = byMonth.get(k) ?? { hours: 0, lti: 0, recordable: 0 };
      a.hours += r.employeeHours + r.contractorHours;
      a.lti += r.ltiCount;
      a.recordable += r.ltiCount + r.rwcCount + r.mtcCount;
      byMonth.set(k, a);
    }

    // Anchor on the most recent month present in the data (rows are sorted
    // desc); fall back to the current calendar month when there are no rows.
    const anchorYear = rows[0]?.year ?? now.getFullYear();
    const anchorMonth = rows[0]?.month ?? now.getMonth() + 1;

    // Rolling-12 (months 1-12 back) vs prior-12 (months 13-24 back).
    const roll = (fromBack: number, toBack: number): Agg => {
      const acc: Agg = { hours: 0, lti: 0, recordable: 0 };
      for (let b = fromBack; b < toBack; b++) {
        const a = byMonth.get(monthKeyBack(anchorYear, anchorMonth, b));
        if (!a) continue;
        acc.hours += a.hours;
        acc.lti += a.lti;
        acc.recordable += a.recordable;
      }
      return acc;
    };
    const ltifrOf = (a: Agg) => (a.hours > 0 ? (a.lti * 1_000_000) / a.hours : 0);
    const trirOf = (a: Agg) => (a.hours > 0 ? (a.recordable * 200_000) / a.hours : 0);

    const cur12 = roll(0, 12);
    const prior12 = roll(12, 24);

    const ltifr12 = ltifrOf(cur12);
    const trir12 = trirOf(cur12);
    const ltifrPrior = ltifrOf(prior12);
    const trirPrior = trirOf(prior12);

    // Hours this (most recent) month across scope plants.
    const hoursThisMonth = byMonth.get(KEY(anchorYear, anchorMonth))?.hours ?? 0;

    // Sparkline: 12 monthly LTIFR buckets (sum lti *1e6 / sum hours per month),
    // aligned to the calendar last-12-month axis.
    const sparkPoints = buckets.map((bkt) => {
      const k = KEY(bkt.start.getFullYear(), bkt.start.getMonth() + 1);
      const a = byMonth.get(k);
      const v = a && a.hours > 0 ? (a.lti * 1_000_000) / a.hours : 0;
      return { label: bkt.label, value: Number(v.toFixed(2)) };
    });

    // Alert flag: LTIFR rising by >20% vs prior 12 months.
    const ltifrRising = ltifrPrior > 0 && ltifr12 > ltifrPrior * 1.2 ? 1 : 0;

    const data: AnalyticsStripData = {
      tiles: [
        {
          label: "LTIFR",
          value: ltifr12.toFixed(2),
          emphasis: true,
          href: "/manhours",
          delta: percentDelta(ltifr12, ltifrPrior, false),
        },
        {
          label: "TRIR",
          value: trir12.toFixed(2),
          href: "/manhours",
          delta: percentDelta(trir12, trirPrior, false),
        },
        {
          label: "Hours This Month",
          value: hoursThisMonth.toLocaleString("en-IN"),
          href: "/manhours",
        },
      ],
      sparkline: {
        points: sparkPoints,
        color: "#ef4444",
        label: "LTIFR · 12 mo",
      },
      alerts: [
        { label: "LTIFR rising", count: ltifrRising, tone: "bad", href: "/manhours" },
        { label: "Submission overdue", count: 0, tone: "warn", href: "/manhours" },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[manhours-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
