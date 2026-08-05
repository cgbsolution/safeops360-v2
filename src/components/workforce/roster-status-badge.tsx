/**
 * Safety-roster status badge (Observation deroster workflow).
 *
 * Separate from the EPC `overallStatus` badge on purpose — the two are
 * different axes. overallStatus is the contractor coordinator's employment
 * state; this is an HSE-owned safety hold, and a worker can be `active` on one
 * and held on the other.
 *
 * Renders nothing for `active`, so it can be dropped next to any worker name
 * without adding noise to the normal case.
 */

const STYLES: Record<string, string> = {
  pending_safety_review: "bg-amber-100 text-amber-800 border-amber-200",
  derostered: "bg-rose-100 text-rose-800 border-rose-200"
};

// "Pending safety review" is deliberately not the word "derostered": until a
// Section Head or HSE Manager confirms, nothing has been decided about this
// person and the badge must not imply otherwise.
const LABELS: Record<string, string> = {
  pending_safety_review: "Safety review",
  derostered: "Derostered"
};

export function RosterStatusBadge({
  status,
  className = ""
}: {
  status?: string | null;
  className?: string;
}) {
  if (!status || status === "active") return null;
  return (
    <span
      title={
        status === "pending_safety_review"
          ? "Under safety review following a high-severity unsafe act — not available for new work assignment."
          : "Derostered pending completion of the assigned corrective action."
      }
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        STYLES[status] ?? "bg-slate-100 text-slate-600 border-slate-200"
      } ${className}`}
    >
      {LABELS[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}
