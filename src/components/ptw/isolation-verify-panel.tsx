"use client";

// PTW closed-loop: isolation lock-out verification. The activation gate
// requires EVERY isolation row to be verified before the permit can go
// ACTIVE — this panel is what sets it (previously nothing wrote
// isolationVerifiedAt: a functional dead end). Each verification is a
// safety-critical confirmation and carries field evidence.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { readApiError } from "@/lib/client-errors";
import { formatDateTime } from "@/lib/utils";
import {
  EvidenceCapture,
  evidenceComplete,
  evidencePayload,
  useEvidenceCapture,
} from "@/components/ptw/evidence-capture";

type Isolation = {
  id: string;
  isolationType: string;
  description: string;
  isolationPointTag: string;
  lotoTagNumber: string | null;
  isolationVerifiedAt: string | Date | null;
  restoredAt: string | Date | null;
};

const VERIFY_DECLARATION =
  "I confirm this isolation point is physically locked out, tagged, and tested de-energised.";

export function IsolationVerifyPanel({
  permitId,
  isolations,
  canVerify,
}: {
  permitId: string;
  isolations: Isolation[];
  canVerify: boolean;
}) {
  const router = useRouter();
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const evidenceState = useEvidenceCapture();

  const pending = isolations.filter((i) => !i.isolationVerifiedAt);
  if (isolations.length === 0 || pending.length === 0) return null;

  const evidenceReady = evidenceComplete(evidenceState, {
    requirePhoto: false,
    requireDeclaration: true,
  });

  async function verify(isolationId: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/ptw/${permitId}/isolations/${isolationId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidence: evidencePayload(evidenceState, VERIFY_DECLARATION) }),
      });
      if (r.ok) {
        setVerifyingId(null);
        router.refresh();
        return;
      }
      setError(await readApiError(r, "Verification failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-amber-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Lock size={16} className="text-amber-600" /> Isolation Verification
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
            {pending.length} pending
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Every isolation must be physically locked out, tagged and verified
          before the permit can be accepted and go ACTIVE.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {pending.map((i) => (
          <div key={i.id} className="rounded-md border border-slate-200 bg-white p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div>
                <div className="font-medium text-slate-800">
                  {i.isolationPointTag} — {i.isolationType}
                  {i.lotoTagNumber && (
                    <span className="ml-1 text-slate-500">(LOTO {i.lotoTagNumber})</span>
                  )}
                </div>
                <div className="text-slate-600">{i.description}</div>
              </div>
              {canVerify && verifyingId !== i.id && (
                <Button size="sm" variant="outline" onClick={() => setVerifyingId(i.id)} disabled={busy}>
                  <ShieldCheck size={13} /> Verify
                </Button>
              )}
            </div>
            {verifyingId === i.id && (
              <div className="space-y-2 border-t pt-2">
                <EvidenceCapture
                  permitId={permitId}
                  requirePhoto={false}
                  declaration={VERIFY_DECLARATION}
                  state={evidenceState}
                />
                {error && <div className="text-xs text-rose-700">{error}</div>}
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => verify(i.id)} disabled={busy || !evidenceReady}>
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    Confirm Lock-out Verified
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setVerifyingId(null)} disabled={busy}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {!canVerify && (
          <div className="text-[11px] text-slate-500">
            Verification is done by the receiver, issuer, safety officer or HSE.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Evidence timeline (read-only) ─────────────────────────────────────

export function EvidenceTimelineCard({
  items,
}: {
  items: {
    id: string;
    action: string;
    actorName: string | null;
    capturedAt: string | Date;
    gpsLatitude: number | null;
    gpsLongitude: number | null;
    gpsAccuracyMeters: number | null;
    declarationText: string | null;
    hasSignature: boolean;
    photoCount: number;
  }[];
}) {
  if (items.length === 0) return null;
  const label: Record<string, string> = {
    APPROVE_ISSUER: "Issuer Approval",
    APPROVE_SAFETY: "Safety Officer Approval",
    APPROVE_PLANT_HEAD: "Plant Head Approval",
    APPROVE: "Approval",
    ISSUE: "Permit Issued",
    ACCEPT: "Receiver Acceptance",
    ISOLATION_VERIFY: "Isolation Verified",
    SUSPEND: "Suspended",
    RESUME: "Resumed",
    EXTEND: "Extension",
    WORK_COMPLETED_DECLARE: "Work Completed Declared",
    HANDBACK_INSPECT: "Handback Inspection",
    CLOSE: "Closure Approval",
    CANCEL: "Cancelled",
    REJECT: "Rejected",
  };
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary-700" /> Field Evidence Timeline
        </CardTitle>
        <CardDescription className="text-xs">
          GPS + photo + signature recorded at every lifecycle action — the
          closed loop rendered in the close-out report.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {items.map((ev) => (
            <li key={ev.id} className="rounded-md border border-slate-200 bg-white p-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-800">{label[ev.action] ?? ev.action}</span>
                <span className="text-slate-500">{formatDateTime(new Date(ev.capturedAt))}</span>
              </div>
              <div className="mt-1 text-slate-600">
                {ev.actorName ?? "—"}
                {" · "}
                {ev.gpsLatitude != null && ev.gpsLongitude != null ? (
                  <a
                    className="underline underline-offset-2"
                    href={`https://maps.google.com/?q=${ev.gpsLatitude},${ev.gpsLongitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {ev.gpsLatitude.toFixed(5)}, {ev.gpsLongitude.toFixed(5)}
                    {ev.gpsAccuracyMeters ? ` ±${Math.round(ev.gpsAccuracyMeters)}m` : ""}
                  </a>
                ) : (
                  <span className="text-amber-700">no GPS fix</span>
                )}
                {" · "}
                {ev.hasSignature ? "signed" : "no signature"}
                {ev.photoCount > 0 && ` · ${ev.photoCount} photo${ev.photoCount === 1 ? "" : "s"}`}
              </div>
              {ev.declarationText && (
                <div className="mt-1 italic text-slate-500">“{ev.declarationText}”</div>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
