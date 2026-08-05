"use client";

// PTW closed-loop close-out flow:
//   Phase 1 — Work Completed declaration (receiver): structured OUTCOME +
//             restoration confirmations + narrative + field evidence
//             (GPS / onsite photo / signature) → POST /api/ptw/{id}/complete
//   Phase 2 — Handback Inspection (issuer / safety officer / plant head):
//             5-point checklist + notes + field evidence
//             → POST /api/ptw/{id}/handback
//   Phase 3 — Closure summary + close-out report download (once CLOSED)
//
// Replaces the legacy Return / Site-Verify pair (which sent photos: null
// into a table that never existed).

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ClipboardCheck,
  FileDown,
  Hammer,
  Loader2,
  PackageCheck,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { readApiError } from "@/lib/client-errors";
import { formatDateTime } from "@/lib/utils";
import {
  EvidenceCapture,
  evidenceComplete,
  evidencePayload,
  useEvidenceCapture,
} from "@/components/ptw/evidence-capture";

const VERIFICATION_CHECKLIST: { code: string; label: string }[] = [
  { code: "AREA_CLEAN", label: "Work area is clean — no debris, scrap or tools left behind" },
  { code: "ISOLATIONS_CLEARED", label: "All isolations restored & LOTO tags removed" },
  { code: "EQUIPMENT_INTACT", label: "Equipment / scaffolding / barricades restored to normal" },
  { code: "NO_DAMAGE", label: "No damage observed to surrounding plant" },
  { code: "AREA_HANDED_BACK", label: "Area handed back to operations" },
];

const OUTCOMES: { value: string; label: string; hint: string }[] = [
  { value: "COMPLETED", label: "Completed", hint: "All planned work finished" },
  { value: "PARTIALLY_COMPLETED", label: "Partially completed", hint: "Some scope remains — a follow-up permit is needed" },
  { value: "STOPPED_INCIDENT", label: "Stopped — incident", hint: "Work stopped due to an incident / unsafe condition" },
  { value: "CANCELLED", label: "Not started / abandoned", hint: "Work never started under this permit" },
];

const COMPLETE_DECLARATION =
  "I declare the work under this permit is finished as stated, isolations are restored, " +
  "and the area has been left in a safe condition.";

const HANDBACK_DECLARATION =
  "I have physically walked the worksite after the completion declaration and confirm " +
  "the checklist above reflects its true condition.";

export function ClosurePanel({
  permitId,
  status,
  receiverId,
  currentUserId,
  canVerify,
  workCompletedAt,
  outcome,
  returnedAt,
  returnNotes,
  siteVerifiedAt,
  siteVerificationChecklist,
  closingRemark,
  closedAt,
}: {
  permitId: string;
  status: string;
  receiverId: string | null;
  currentUserId: string;
  canVerify: boolean;
  workCompletedAt: string | Date | null;
  outcome: string | null;
  returnedAt: string | Date | null;
  returnNotes: string | null;
  siteVerifiedAt: string | Date | null;
  siteVerificationChecklist: any;
  closingRemark: string | null;
  closedAt: string | Date | null;
}) {
  const router = useRouter();
  const isReceiver = receiverId === currentUserId;
  const declared = !!(workCompletedAt ?? returnedAt);

  // Hidden until the permit is at least issued/accepted.
  if (
    ["DRAFT", "SUBMITTED", "APPROVED", "ISSUED", "ISSUER_APPROVED", "SAFETY_APPROVED", "PLANT_HEAD_APPROVED", "REJECTED", "CANCELLED"].includes(status)
  ) {
    return null;
  }

  return (
    <div className="space-y-4">
      <WorkCompletedSection
        permitId={permitId}
        status={status}
        canDeclare={isReceiver || canVerify}
        declared={declared}
        declaredAt={workCompletedAt ?? returnedAt}
        outcome={outcome}
        notes={returnNotes}
        onChanged={() => router.refresh()}
      />

      <HandbackSection
        permitId={permitId}
        canVerify={canVerify}
        declared={declared}
        siteVerifiedAt={siteVerifiedAt}
        checklist={siteVerificationChecklist}
        onChanged={() => router.refresh()}
      />

      {status === "CLOSED" && (
        <ClosureSummary
          permitId={permitId}
          closedAt={closedAt}
          closingRemark={closingRemark}
          outcome={outcome}
        />
      )}
    </div>
  );
}

// ─── Phase 1: Work Completed declaration ──────────────────────────────

function WorkCompletedSection({
  permitId,
  status,
  canDeclare,
  declared,
  declaredAt,
  outcome,
  notes,
  onChanged,
}: {
  permitId: string;
  status: string;
  canDeclare: boolean;
  declared: boolean;
  declaredAt: string | Date | null;
  outcome: string | null;
  notes: string | null;
  onChanged: () => void;
}) {
  const [show, setShow] = useState(false);
  const [iso, setIso] = useState(false);
  const [clean, setClean] = useState(false);
  const [chosenOutcome, setChosenOutcome] = useState("");
  const [narrative, setNarrative] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const evidenceState = useEvidenceCapture();

  const evidenceReady = evidenceComplete(evidenceState, {
    requirePhoto: true,
    requireDeclaration: true,
  });

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/ptw/${permitId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: chosenOutcome,
          isolationsRestored: iso,
          workAreaClean: clean,
          notes: narrative || null,
          evidence: evidencePayload(evidenceState, COMPLETE_DECLARATION),
        }),
      });
      if (r.ok) {
        setShow(false);
        onChanged();
        return;
      }
      setError(await readApiError(r, "Failed to declare work completed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={declared ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200"}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <PackageCheck size={16} className={declared ? "text-emerald-600" : "text-slate-500"} />
          Work Completed
          {declared && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
              Declared
            </Badge>
          )}
          {outcome && (
            <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">
              {OUTCOMES.find((o) => o.value === outcome)?.label ?? outcome}
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          Receiver declares the outcome at end of work — with GPS, onsite
          photo and signature captured for the close-out report.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {declared ? (
          <div className="text-sm space-y-1">
            <div className="text-slate-700">
              Declared at <span className="font-medium">{formatDateTime(new Date(declaredAt!))}</span>
            </div>
            {notes && <div className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{notes}</div>}
          </div>
        ) : !show ? (
          canDeclare && (status === "ACTIVE" || status === "SUSPENDED") ? (
            <Button size="sm" onClick={() => setShow(true)}>
              <Hammer size={14} /> Declare Work Completed
            </Button>
          ) : (
            <div className="text-xs text-slate-500">
              Pending — only the named receiver (or HSE/Admin) can declare completion.
            </div>
          )
        ) : (
          <div className="space-y-3">
            {/* Outcome */}
            <div className="space-y-1.5">
              <Label className="text-[11px]">
                Outcome <span className="text-rose-600">*</span>
              </Label>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {OUTCOMES.map((o) => (
                  <label
                    key={o.value}
                    className={`flex items-start gap-2 p-2 rounded-md border text-xs cursor-pointer ${
                      chosenOutcome === o.value
                        ? "border-primary-400 bg-primary-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="ptw-outcome"
                      value={o.value}
                      checked={chosenOutcome === o.value}
                      onChange={() => setChosenOutcome(o.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-medium">{o.label}</div>
                      <div className="text-slate-500">{o.hint}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Restoration confirmations (carried over from the old Return step) */}
            <label className="flex items-start gap-2 p-2 rounded-md border border-slate-200 bg-white text-xs">
              <input type="checkbox" checked={iso} onChange={(e) => setIso(e.target.checked)} className="mt-0.5" />
              <div>
                <div className="font-medium">All isolations restored</div>
                <div className="text-slate-600">LOTO removed, valves reopened, energy sources re-engaged.</div>
              </div>
            </label>
            <label className="flex items-start gap-2 p-2 rounded-md border border-slate-200 bg-white text-xs">
              <input type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)} className="mt-0.5" />
              <div>
                <div className="font-medium">Work area is clean</div>
                <div className="text-slate-600">No tools, scrap, debris or barricades left behind.</div>
              </div>
            </label>

            <div>
              <Label className="text-[11px]">
                Close-out narrative — what was done, anything outstanding
              </Label>
              <Textarea
                rows={3}
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                placeholder="Summary of the work performed and site condition at handback"
              />
            </div>

            <EvidenceCapture
              permitId={permitId}
              requirePhoto
              declaration={COMPLETE_DECLARATION}
              state={evidenceState}
            />

            {error && <div className="text-xs text-rose-700 whitespace-pre-wrap">{error}</div>}
            <div className="flex gap-2">
              <Button size="sm" onClick={submit} disabled={busy || !iso || !clean || !chosenOutcome || !evidenceReady}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Confirm Work Completed
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShow(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Phase 2: Handback inspection ─────────────────────────────────────

function HandbackSection({
  permitId,
  canVerify,
  declared,
  siteVerifiedAt,
  checklist,
  onChanged,
}: {
  permitId: string;
  canVerify: boolean;
  declared: boolean;
  siteVerifiedAt: string | Date | null;
  checklist: any;
  onChanged: () => void;
}) {
  const [show, setShow] = useState(false);
  const [vals, setVals] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const evidenceState = useEvidenceCapture();

  const verified = !!siteVerifiedAt;
  const allChecked = VERIFICATION_CHECKLIST.every((c) => vals[c.code]);
  const evidenceReady = evidenceComplete(evidenceState, {
    requirePhoto: true,
    requireDeclaration: true,
  });

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/ptw/${permitId}/handback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklist: vals,
          notes: notes || null,
          evidence: evidencePayload(evidenceState, HANDBACK_DECLARATION),
        }),
      });
      if (r.ok) {
        setShow(false);
        onChanged();
        return;
      }
      setError(await readApiError(r, "Failed to record handback inspection"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      className={
        verified
          ? "border-emerald-200 bg-emerald-50/40"
          : declared
          ? "border-amber-200 bg-amber-50/40"
          : "border-slate-200"
      }
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardCheck size={16} className={verified ? "text-emerald-600" : "text-slate-500"} />
          Handback Inspection
          {verified && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
              Inspected
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          Issuer / Safety Officer / Plant Head walks the area after the
          completion declaration. Closure approval needs this on record.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {!declared && (
          <div className="text-xs text-slate-500">
            Receiver must declare Work Completed before the handback inspection can begin.
          </div>
        )}
        {declared && verified && (
          <div className="text-sm">
            Inspected at <span className="font-medium">{formatDateTime(new Date(siteVerifiedAt!))}</span>
            {checklist && typeof checklist === "object" && (
              <ul className="mt-2 space-y-0.5">
                {Object.entries(checklist as Record<string, boolean>).map(([k, v]) => (
                  <li key={k} className="text-xs flex items-center gap-1.5">
                    {v ? (
                      <CheckCircle2 size={12} className="text-emerald-600" />
                    ) : (
                      <XCircle size={12} className="text-rose-600" />
                    )}
                    <span className={v ? "text-slate-700" : "text-rose-600"}>
                      {VERIFICATION_CHECKLIST.find((c) => c.code === k)?.label ?? k}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {declared && !verified && !show && canVerify && (
          <Button size="sm" onClick={() => setShow(true)}>
            <ClipboardCheck size={14} /> Start Handback Inspection
          </Button>
        )}
        {declared && !verified && !show && !canVerify && (
          <div className="text-xs text-slate-500">
            Awaiting Issuer / Safety / Plant Head walk-through.
          </div>
        )}
        {show && (
          <div className="space-y-2">
            {VERIFICATION_CHECKLIST.map((c) => (
              <label
                key={c.code}
                className="flex items-start gap-2 p-2 rounded-md border border-slate-200 bg-white text-xs"
              >
                <input
                  type="checkbox"
                  checked={!!vals[c.code]}
                  onChange={(e) => setVals((v) => ({ ...v, [c.code]: e.target.checked }))}
                  className="mt-0.5"
                />
                <span>{c.label}</span>
              </label>
            ))}
            <div>
              <Label className="text-[11px]">Notes</Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything noteworthy from the walk"
              />
            </div>

            <EvidenceCapture
              permitId={permitId}
              requirePhoto
              declaration={HANDBACK_DECLARATION}
              state={evidenceState}
            />

            {error && <div className="text-xs text-rose-700 whitespace-pre-wrap">{error}</div>}
            <div className="flex gap-2">
              <Button size="sm" onClick={submit} disabled={busy || !allChecked || !evidenceReady}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Record Inspection
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShow(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
            {!allChecked && (
              <div className="text-[11px] text-amber-700">
                All boxes must be ticked. If anything fails, escalate to HSE — do not bypass.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Phase 3: Closure summary + report ────────────────────────────────

function ClosureSummary({
  permitId,
  closedAt,
  closingRemark,
  outcome,
}: {
  permitId: string;
  closedAt: string | Date | null;
  closingRemark: string | null;
  outcome: string | null;
}) {
  return (
    <Card className="border-slate-300 bg-slate-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600" /> Permit Closed
          {outcome && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
              {OUTCOMES.find((o) => o.value === outcome)?.label ?? outcome}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {closedAt && (
          <div className="text-sm">
            Closed at <span className="font-medium">{formatDateTime(new Date(closedAt))}</span>
          </div>
        )}
        {closingRemark && (
          <div className="rounded-md border border-slate-200 bg-white p-2 text-sm whitespace-pre-wrap">
            {closingRemark}
          </div>
        )}
        <Button asChild size="sm" variant="outline">
          <a href={`/api/ptw/${permitId}/report`} target="_blank" rel="noreferrer">
            <FileDown size={14} /> Download Close-out Report (PDF)
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
