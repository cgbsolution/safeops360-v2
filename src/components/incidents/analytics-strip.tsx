import {
  AnalyticsStrip,
  AnalyticsStripError,
  type AnalyticsStripData,
} from "@/components/dashboard/analytics-strip";
import { fetchStrip, sparkPoints, type StripBase } from "@/lib/dashboard/strip-data";
import { netDelta, percentDelta } from "@/lib/dashboard/strip";

// Incident Investigation analytics strip.
//
// Scope is resolved backend-side through INCIDENT.READ — the same gate the
// list uses — so the strip can never show a count the list would hide. A
// caller with no grant gets a zeroed strip (denied: true) rather than an
// error, since the page itself was reached legally.

interface IncidentStrip extends StripBase {
  open: number;
  /** Open with an occurrence date older than 30 days. */
  stalled: number;
  /** Open LTI/FATALITY older than 10 days. */
  ltiOpen: number;
  openedThisMonth: number;
  closedMTD: number;
  closedPrevCount: number;
  avgDays: number | null;
  /** Share of the trailing 12 months' closures that have a CAPA attached. */
  linkagePct: number | null;
}

export async function IncidentAnalyticsStrip({ userId }: { userId: string }) {
  void userId; // scope is resolved backend-side from the bearer token
  try {
    const m = await fetchStrip<IncidentStrip>("incidents");

    const data: AnalyticsStripData = {
      tiles: [
        {
          label: "Open Investigations",
          value: m.open,
          emphasis: true,
          href: "/incidents",
          delta: netDelta(m.openedThisMonth - m.closedMTD, false),
        },
        {
          label: "Closed MTD",
          value: m.closedMTD,
          href: "/incidents?status=CLOSED",
          delta: percentDelta(m.closedMTD, m.closedPrevCount, true),
          badge: m.avgDays !== null ? { text: `~${m.avgDays}d to close`, tone: "neutral" } : null,
        },
        {
          label: "CAPA Linkage",
          value: m.linkagePct === null ? "—" : `${m.linkagePct}%`,
          href: "/incidents?status=CLOSED",
        },
      ],
      sparkline: {
        points: sparkPoints(m.bucketStarts, m.trendCounts),
        color: "#ea580c",
        label: "Incidents · 12 mo",
      },
      alerts: [
        { label: "Stalled >30d", count: m.stalled, tone: "bad", href: "/incidents" },
        { label: "LTI open >10d", count: m.ltiOpen, tone: "bad", href: "/incidents?type=LTI" },
      ],
    };

    return <AnalyticsStrip data={data} />;
  } catch (err) {
    console.error("[incident-strip] failed", err);
    return <AnalyticsStripError />;
  }
}
