// InsightEmptyState — the "This week's focus" slot when nothing scores above the
// surfacing floor (spec §8). A stated non-finding, not a blank box: it shows the
// arithmetic (clusters watched, top score, floor) so a user can tell "engine ran,
// found nothing" from "engine is broken". No big number, no rail, no alarm colour.

import type { WeeklyEmpty } from "@/lib/weekly-insights";

const NAVY_BG = "linear-gradient(150deg,#0B1F4D,#0E2A5E)";
const GEORGIA = "Georgia, 'Times New Roman', serif";

export function InsightEmptyState({ empty }: { empty: WeeklyEmpty }) {
  return (
    <div className="mb-4 rounded-2xl p-6 shadow-lg sm:p-7" style={{ background: NAVY_BG, color: "#E8EEF7" }}>
      <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#8FA3C4" }}>
        This week&apos;s focus
      </div>
      <p style={{ fontFamily: GEORGIA }} className="mt-2 text-xl font-semibold text-balance">
        Nothing crossed the surfacing bar this week.
      </p>
      <p className="mt-2 max-w-[70ch] text-[13.5px] leading-relaxed" style={{ color: "#AFC0DA" }}>
        The engine ran and watched <b style={{ color: "#E8EEF7" }}>{empty.clustersWatched}</b> clusters — the strongest
        scored <b style={{ color: "#E8EEF7" }}>{empty.topScore}</b>, below the{" "}
        <b style={{ color: "#E8EEF7" }}>{empty.floor}</b> surfacing floor. No card is promoted rather than manufacturing
        urgency.
      </p>
    </div>
  );
}
