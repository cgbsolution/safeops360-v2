"use client";

// Move a slot through its state machine (docs/cams/08 §3.2).
//
// The rule this dialog exists to make visible:
//
//     no slot leaves PLANNED without either a materialised engagement
//     or an amendment explaining why it did not happen
//
// So DEFER / CANCEL / WAIVE force a reason and a named approver — not as
// validation the user fights, but because that record IS the answer when a
// certification body asks why a planned audit never ran.
//
// **SCHEDULED is deliberately not reachable from here.** It used to be, via a
// free-text "engagement id" box hard-coded to AUDIT; that was the manual-paste
// flow, and it could produce a slot pointing at a stranger's engagement.
// Becoming SCHEDULED now means one thing — an engagement was created from this
// plan — so this dialog hands off to Materialise instead of imitating it.
//
// `allowedTransitions` comes from the server, so the state machine lives in one
// place (`lifecycle.SLOT_TRANSITIONS`) and this list cannot drift from it.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { UserPicker } from "@/components/ui/user-picker";
import { readApiError } from "@/lib/client-errors";
import type { SlotRow } from "@/app/(dashboard)/cams/programme/lib-programme";
import { Alert } from "@/components/ui/alert";

// Transitions that require reason + approver and write an amendment.
const NEEDS_AMENDMENT = ["DEFERRED", "CANCELLED", "WAIVED"];

export function SlotTransitionDialog({
  slot, onClose, onMaterialise, onDone,
}: {
  slot: SlotRow;
  onClose: () => void;
  /** SCHEDULED is reached by materialising, never by pasting an id. */
  onMaterialise?: () => void;
  onDone?: () => void;
}) {
  const router = useRouter();
  // Offer everything the server says is legal, but default to a move this
  // dialog can actually complete.
  const targets = slot.allowedTransitions;
  const [target, setTarget] = useState<string>(
    targets.find((t) => t !== "SCHEDULED") ?? targets[0] ?? "",
  );
  const [reason, setReason] = useState("");
  const [approver, setApprover] = useState("");
  const [newStart, setNewStart] = useState(slot.windowStart.slice(0, 10));
  const [newEnd, setNewEnd] = useState(slot.windowEnd.slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const needsAmendment = NEEDS_AMENDMENT.includes(target);
  const isDefer = target === "DEFERRED";
  // Only a slot that already carries an engagement can be moved to SCHEDULED
  // here; an unlinked one has to be materialised.
  const needsMaterialise = target === "SCHEDULED" && !slot.engagementId;
  const windowInvalid = isDefer && new Date(newEnd) < new Date(newStart);

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/programme/slots/${slot.id}/transition`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target,
        reason: needsAmendment ? reason.trim() : null,
        approvedByUserId: needsAmendment ? approver : null,
        newWindowStart: isDefer ? newStart : null,
        newWindowEnd: isDefer ? newEnd : null,
        engagementKind: slot.engagementKind,
        engagementId: slot.engagementId,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(await readApiError(res, "Could not move the slot"));
      return;
    }
    onClose();
    onDone?.();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl">
        <h3 className="text-sm font-semibold text-slate-900">Move {slot.slotCode}</h3>

        <div className="mt-3 space-y-3">
          <div>
            <Label htmlFor="target" className="text-xs">Move to</Label>
            <SelectField id="target" value={target} onChange={setTarget} className="mt-1"
              options={targets.map((t) => ({ value: t, label: t.replace(/_/g, " ").toLowerCase() }))}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Only transitions legal from <strong>{slot.status.toLowerCase()}</strong> are offered.
            </p>
          </div>

          {needsMaterialise && (
            <Alert variant="brand" className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-[11px] text-violet-900">
              <p>
                A slot becomes <strong>scheduled</strong> by producing an engagement, not by being
                told it has one. Materialise creates the engagement from this slot&rsquo;s scope,
                standards and window, and links it back automatically.
              </p>
              {onMaterialise && (
                <Button type="button" size="sm" className="mt-2" onClick={onMaterialise}>
                  <Zap size={13} /> Materialise instead
                </Button>
              )}
            </Alert>
          )}

          {isDefer && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="nw-start" className="text-xs">New window opens</Label>
                <Input id="nw-start" type="date" value={newStart}
                  onChange={(e) => setNewStart(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="nw-end" className="text-xs">New window closes</Label>
                <Input id="nw-end" type="date" value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)} className="mt-1" />
              </div>
              <p className="col-span-2 text-[11px] text-slate-500">
                A deferral needs a new window — a deferred slot is not a deleted one.
              </p>
            </div>
          )}

          {needsAmendment && (
            <>
              <Alert variant="warning" className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900">
                This writes a <strong>programme amendment</strong>. A certification body asks why a
                planned audit did not happen; this record is the answer, so both fields are required.
              </Alert>
              <div>
                <Label htmlFor="reason" className="text-xs">
                  Reason <span className="text-rose-600">*</span>
                </Label>
                <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this slot being moved…" className="mt-1" />
                <p className="mt-1 text-[11px] text-slate-400">
                  {reason.trim().length}/10 characters minimum.
                </p>
              </div>
              <div>
                <Label className="text-xs">
                  Approver <span className="text-rose-600">*</span>
                </Label>
                <div className="mt-1">
                  <UserPicker value={approver || null} onChange={(id) => setApprover(id ?? "")}
                    placeholder="Who approved this change?" />
                </div>
              </div>
            </>
          )}
        </div>

        {err && (
          <Alert variant="destructive" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {err}
          </Alert>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={submit}
            disabled={
              busy || !target || needsMaterialise || windowInvalid ||
              (needsAmendment && (reason.trim().length < 10 || !approver))
            }>
            {busy && <Loader2 size={14} className="animate-spin" />} Move slot
          </Button>
        </div>
      </div>
    </div>
  );
}
