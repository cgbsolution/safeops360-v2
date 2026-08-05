"use client";

/**
 * Target Closure Date — provenance + full change trail.
 *
 * Spec §2.7: both audit trails must be *visible*, not merely stored. This
 * renders the SLA policy the record was held to, any override and its reason,
 * and every subsequent change, as a read-only expandable panel.
 */

import * as React from "react";
import { ChevronDown, CalendarClock } from "lucide-react";
import { APP_TIME_ZONE, cn } from "@/lib/utils";

export type TargetDateHistoryRow = {
  id: string;
  targetDate: string | Date | null;
  source: string;
  reason: string | null;
  slaConfigApplied: any;
  changedById: string | null;
  changedAt: string | Date;
};

const SOURCE_LABELS: Record<string, string> = {
  auto_sla: "Auto-set from SLA policy",
  manual_override: "Manual override",
  section_head_reassigned: "Reassigned at Section Head review",
  manual_no_policy: "Set manually — no SLA policy configured",
  legacy: "Set before the SLA policy existed",
};

// Site wall-clock, not the runtime's zone — see APP_TIME_ZONE in lib/utils.
function fmtDate(v: string | Date | null | undefined) {
  if (!v) return "not set";
  return new Date(v).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  });
}

function fmtStamp(v: string | Date) {
  return new Date(v).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  });
}

export function TargetDateHistory({
  targetDate,
  source,
  slaConfig,
  overrideReason,
  history,
}: {
  targetDate: string | Date | null;
  source: string | null;
  slaConfig: any;
  overrideReason: string | null;
  history: TargetDateHistoryRow[];
}) {
  const [open, setOpen] = React.useState(false);

  // Nothing to explain on a record written before the SLA layer existed.
  if (!source && history.length === 0) return null;

  const policy = slaConfig as
    | { severity?: string; categoryGroup?: string; slaDays?: number; scope?: string }
    | null;

  return (
    <div className="mt-2 space-y-1.5">
      <p className="flex items-start gap-1.5 text-xs text-slate-500">
        <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {SOURCE_LABELS[source ?? ""] ?? "Closure date set"}
          {policy?.slaDays != null && (
            <>
              {" "}
              ({policy.severity?.toLowerCase()} / {policy.categoryGroup?.toLowerCase()} →{" "}
              {policy.slaDays} days
              {policy.scope === "PLANT" ? ", plant policy" : ""})
            </>
          )}
        </span>
      </p>

      {overrideReason && (
        <p className="rounded bg-amber-50 p-2 text-xs text-amber-900">
          <span className="font-medium">Override reason: </span>
          {overrideReason}
        </p>
      )}

      {history.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
            Closure-date history ({history.length})
          </button>
          {open && (
            <ol className="space-y-2 border-l-2 border-slate-200 pl-2.5">
              {history.map((h) => (
                <li key={h.id} className="text-xs">
                  <div className="font-medium text-slate-800">
                    {fmtDate(h.targetDate)}
                    <span className="font-normal text-slate-500">
                      {" "}
                      · {SOURCE_LABELS[h.source] ?? h.source.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="text-slate-500">{fmtStamp(h.changedAt)}</div>
                  {h.reason && <div className="mt-0.5 text-slate-600">{h.reason}</div>}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
