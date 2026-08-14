import {
  AnalyticsStrip,
  AnalyticsStripError,
  type AnalyticsStripData,
} from "@/components/dashboard/analytics-strip";
import { fetchStrip, sparkPoints, type StripBase } from "@/lib/dashboard/strip-data";

// MOC (Management of Change) analytics strip.
//
// The 18-state lifecycle is a lowercase string; "open", "awaiting approval"
// and the temporary-change expiry window are all derived backend-side now, so
// this file no longer needs to know that closed states contain "closed".

interface MocStrip extends StripBase {
  activeMocs: number;
  awaitingApproval: number;
  overdue: number;
  /** Temporary changes expiring within 30 days. */
  tempExpiring: number;
}

export async function MocAnalyticsStrip() {
  try {
    const m = await fetchStrip<MocStrip>("moc");

    const data: AnalyticsStripData = {
      tiles: [
        { label: "Active MOCs", value: m.activeMocs, emphasis: true, href: "/moc" },
        { label: "Awaiting Approval", value: m.awaitingApproval, href: "/moc" },
        { label: "Overdue", value: m.overdue, href: "/moc", delta: null },
      ],
      sparkline: {
        points: sparkPoints(m.bucketStarts, m.trendCounts),
        color: "#6366f1",
        label: "MOCs · 12 mo",
      },
      alerts: [
        { label: "Temp expiring 30d", count: m.tempExpiring, tone: "warn", href: "/moc" },
        { label: "Overdue", count: m.overdue, tone: "bad", href: "/moc" },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[moc-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
