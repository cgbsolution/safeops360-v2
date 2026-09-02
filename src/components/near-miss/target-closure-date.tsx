"use client";

// Record-level target closure date for a near miss (NearMiss.targetDate) —
// the single date the whole record is expected to be closed by, as opposed to
// the per-CAPA target dates in <CapaPlanSection>.
//
// The field, its validation ("cannot be in the past") and its RBAC guard
// (NEAR_MISS.UPDATE + not-CLOSED) already live in the backend PATCH handler;
// this is the UI for it. Deliberately does NOT touch the transitional
// rootCause / correctiveActions / actionOwner columns the old CapaEditPanel
// also wrote — those are owned by the parallel-CAPA flow now.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import {
  overdueDays,
  toDateInputValue,
  todayInAppZone,
  toTargetIso,
} from "@/lib/near-miss/target-date";

export function TargetClosureDate({
  nearMissId,
  targetDate,
  closedAt,
  canEdit,
}: {
  nearMissId: string;
  targetDate: string | Date | null;
  closedAt: string | Date | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(toDateInputValue(targetDate));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const late = overdueDays(targetDate, closedAt);

  async function save() {
    setBusy(true);
    setError("");
    const r = await fetch(`/api/near-miss/${nearMissId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetDate: toTargetIso(draft) }),
    });
    setBusy(false);
    if (r.ok) {
      setEditing(false);
      router.refresh();
      return;
    }
    const j = await r.json().catch(() => ({}));
    setError(j.detail ?? j.error ?? "Could not save the target closure date.");
  }

  return (
    <div className="rounded-lg border bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <CalendarClock size={13} /> Target closure date
        </div>

        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={draft}
              min={todayInAppZone()}
              onChange={(e) => setDraft(e.target.value)}
              className="h-8 w-[10.5rem]"
            />
            {/* The backend PATCH ignores a null targetDate, so an empty save
                would silently no-op — require a date rather than fake it. */}
            <Button size="sm" onClick={save} disabled={busy || !draft}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setDraft(toDateInputValue(targetDate));
                setError("");
                setEditing(false);
              }}
            >
              <X size={13} /> Cancel
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-900">
              {targetDate ? formatDate(targetDate) : "Not set"}
            </span>
            {late !== null && (
              <Badge className="bg-rose-100 text-rose-700 border-rose-200">
                Overdue by {late} day{late === 1 ? "" : "s"}
              </Badge>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs text-primary-700 underline underline-offset-2 hover:text-primary-900"
              >
                {targetDate ? "Change" : "Set date"}
              </button>
            )}
          </div>
        )}
      </div>

      {error && <div className="mt-1.5 text-xs text-rose-700">{error}</div>}
      {!targetDate && !canEdit && (
        <div className="mt-1 text-xs text-slate-500">
          Set by the HSE Manager at the review &amp; CAPA definition step.
        </div>
      )}
    </div>
  );
}
