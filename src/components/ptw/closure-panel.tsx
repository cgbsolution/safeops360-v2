"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ClipboardCheck,
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

const VERIFICATION_CHECKLIST: { code: string; label: string }[] = [
  { code: "AREA_CLEAN", label: "Work area is clean — no debris, scrap or tools left behind" },
  { code: "ISOLATIONS_CLEARED", label: "All isolations restored & LOTO tags removed" },
  { code: "EQUIPMENT_INTACT", label: "Equipment / scaffolding / barricades restored to normal" },
  { code: "NO_DAMAGE", label: "No damage observed to surrounding plant" },
  { code: "AREA_HANDED_BACK", label: "Area handed back to operations" },
];

export function ClosurePanel({
  permitId,
  status,
  receiverId,
  currentUserId,
  canVerify,
  returnedAt,
  returnedById,
  returnNotes,
  siteVerifiedAt,
  siteVerifiedById,
  siteVerificationChecklist,
  closingRemark,
  closedById,
  closedAt,
}: {
  permitId: string;
  status: string;
  receiverId: string | null;
  currentUserId: string;
  canVerify: boolean;
  returnedAt: string | Date | null;
  returnedById: string | null;
  returnNotes: string | null;
  siteVerifiedAt: string | Date | null;
  siteVerifiedById: string | null;
  siteVerificationChecklist: any;
  closingRemark: string | null;
  closedById: string | null;
  closedAt: string | Date | null;
}) {
  const router = useRouter();
  const isReceiver = receiverId === currentUserId;

  // Don't render if the permit hasn't reached the active phase or is already
  // fully closed and the audit panel below should show instead.
  if (status === "DRAFT" || status === "SUBMITTED" || status === "ISSUER_APPROVED" || status === "SAFETY_APPROVED" || status === "PLANT_HEAD_APPROVED" || status === "REJECTED") {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Phase 1: Return */}
      <ReturnSection
        permitId={permitId}
        status={status}
        canReturn={isReceiver || canVerify}
        returnedAt={returnedAt}
        returnedById={returnedById}
        returnNotes={returnNotes}
        onChanged={() => router.refresh()}
      />

      {/* Phase 2: Site verification */}
      <SiteVerifySection
        permitId={permitId}
        canVerify={canVerify}
        returnedAt={returnedAt}
        siteVerifiedAt={siteVerifiedAt}
        siteVerifiedById={siteVerifiedById}
        checklist={siteVerificationChecklist}
        onChanged={() => router.refresh()}
      />

      {/* Phase 3: Closure summary (when closed) */}
      {status === "CLOSED" && (
        <ClosureSummary
          closedAt={closedAt}
          closedById={closedById}
          closingRemark={closingRemark}
        />
      )}
    </div>
  );
}

// ─── Return ───────────────────────────────────────────────────────────

function ReturnSection({
  permitId,
  status,
  canReturn,
  returnedAt,
  returnedById,
  returnNotes,
  onChanged,
}: {
  permitId: string;
  status: string;
  canReturn: boolean;
  returnedAt: string | Date | null;
  returnedById: string | null;
  returnNotes: string | null;
  onChanged: () => void;
}) {
  const [show, setShow] = useState(false);
  const [iso, setIso] = useState(false);
  const [clean, setClean] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const returned = !!returnedAt;

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/ptw/${permitId}/active/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isolationsRestored: iso,
          workAreaClean: clean,
          notes: notes || null,
          photos: null,
        }),
      });
      if (r.ok) {
        setShow(false);
        onChanged();
        return;
      }
      setError(await readApiError(r, "Failed to return permit"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      className={
        returned
          ? "border-emerald-200 bg-emerald-50/40"
          : "border-slate-200"
      }
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <PackageCheck size={16} className={returned ? "text-emerald-600" : "text-slate-500"} />
          Return Permit
          {returned && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
              Returned
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          Receiver hands the permit back at end of work. Confirms isolations
          restored and area is clean.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {returned ? (
          <div className="text-sm space-y-1">
            <div className="text-slate-700">
              Returned at{" "}
              <span className="font-medium">{formatDateTime(new Date(returnedAt!))}</span>
            </div>
            {returnNotes && (
              <div className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">
                {returnNotes}
              </div>
            )}
          </div>
        ) : !show ? (
          canReturn && (status === "ACTIVE" || status === "SUSPENDED") ? (
            <Button size="sm" onClick={() => setShow(true)}>
              <Hammer size={14} /> Return Permit
            </Button>
          ) : (
            <div className="text-xs text-slate-500">
              Pending — only the named receiver (or HSE/Admin) can return.
            </div>
          )
        ) : (
          <div className="space-y-2">
            <label className="flex items-start gap-2 p-2 rounded-md border border-slate-200 bg-white text-xs">
              <input
                type="checkbox"
                checked={iso}
                onChange={(e) => setIso(e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <div className="font-medium">All isolations restored</div>
                <div className="text-slate-600">
                  LOTO removed, valves reopened, energy sources re-engaged.
                </div>
              </div>
            </label>
            <label className="flex items-start gap-2 p-2 rounded-md border border-slate-200 bg-white text-xs">
              <input
                type="checkbox"
                checked={clean}
                onChange={(e) => setClean(e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <div className="font-medium">Work area is clean</div>
                <div className="text-slate-600">
                  No tools, scrap, debris or barricades left behind.
                </div>
              </div>
            </label>
            <div>
              <Label className="text-[11px]">Notes</Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything the closer should know"
              />
            </div>
            {error && <div className="text-xs text-rose-700">{error}</div>}
            <div className="flex gap-2">
              <Button size="sm" onClick={submit} disabled={busy || !iso || !clean}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Confirm Return
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

// ─── Site verification ────────────────────────────────────────────────

function SiteVerifySection({
  permitId,
  canVerify,
  returnedAt,
  siteVerifiedAt,
  siteVerifiedById,
  checklist,
  onChanged,
}: {
  permitId: string;
  canVerify: boolean;
  returnedAt: string | Date | null;
  siteVerifiedAt: string | Date | null;
  siteVerifiedById: string | null;
  checklist: any;
  onChanged: () => void;
}) {
  const [show, setShow] = useState(false);
  const [vals, setVals] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const verified = !!siteVerifiedAt;
  const allChecked = VERIFICATION_CHECKLIST.every((c) => vals[c.code]);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/ptw/${permitId}/active/site-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklist: vals,
          photos: null,
          notes: notes || null,
        }),
      });
      if (r.ok) {
        setShow(false);
        onChanged();
        return;
      }
      setError(await readApiError(r, "Failed to verify site"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      className={
        verified
          ? "border-emerald-200 bg-emerald-50/40"
          : returnedAt
          ? "border-amber-200 bg-amber-50/40"
          : "border-slate-200"
      }
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardCheck size={16} className={verified ? "text-emerald-600" : "text-slate-500"} />
          Site Verification
          {verified && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
              Verified
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          Issuer / Safety Officer / Plant Head walks the area before closure.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {!returnedAt && (
          <div className="text-xs text-slate-500">
            Receiver must return the permit before site verification can begin.
          </div>
        )}
        {returnedAt && verified && (
          <div className="text-sm">
            Verified at{" "}
            <span className="font-medium">{formatDateTime(new Date(siteVerifiedAt!))}</span>
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
        {returnedAt && !verified && !show && canVerify && (
          <Button size="sm" onClick={() => setShow(true)}>
            <ClipboardCheck size={14} /> Start Site Verification
          </Button>
        )}
        {returnedAt && !verified && !show && !canVerify && (
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
                  onChange={(e) =>
                    setVals((v) => ({ ...v, [c.code]: e.target.checked }))
                  }
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
            {error && <div className="text-xs text-rose-700">{error}</div>}
            <div className="flex gap-2">
              <Button size="sm" onClick={submit} disabled={busy || !allChecked}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Mark Verified
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

// ─── Closure summary ──────────────────────────────────────────────────

function ClosureSummary({
  closedAt,
  closedById,
  closingRemark,
}: {
  closedAt: string | Date | null;
  closedById: string | null;
  closingRemark: string | null;
}) {
  return (
    <Card className="border-slate-300 bg-slate-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600" /> Permit Closed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
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
      </CardContent>
    </Card>
  );
}
