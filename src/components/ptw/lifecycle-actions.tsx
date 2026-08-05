"use client";

// PTW closed-loop header actions: Cancel (operational pull, distinct from an
// approver rejection), Archive (retention flag on CLOSED), and the close-out
// report download. Rendered in the permit detail header.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Ban, CheckCircle2, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { readApiError } from "@/lib/client-errors";
import {
  EvidenceCapture,
  evidenceComplete,
  evidencePayload,
  useEvidenceCapture,
} from "@/components/ptw/evidence-capture";

const CANCELLABLE_PRE = ["DRAFT", "SUBMITTED", "APPROVED", "ISSUED"];
const CANCELLABLE_MID = ["ACTIVE", "SUSPENDED"];

export function PtwLifecycleActions({
  permitId,
  status,
  isArchived,
  canCancel,
  canArchive,
}: {
  permitId: string;
  status: string;
  isArchived: boolean;
  canCancel: boolean;
  canArchive: boolean;
}) {
  const router = useRouter();
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const evidenceState = useEvidenceCapture();

  const cancellable =
    canCancel && (CANCELLABLE_PRE.includes(status) || CANCELLABLE_MID.includes(status));
  const archivable = canArchive && status === "CLOSED" && !isArchived;
  const evidenceReady = evidenceComplete(evidenceState, {
    requirePhoto: false,
    requireDeclaration: false,
  });

  async function cancel() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/ptw/${permitId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, evidence: evidencePayload(evidenceState) }),
      });
      if (r.ok) {
        setShowCancel(false);
        router.refresh();
        return;
      }
      setError(await readApiError(r, "Cancellation failed"));
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/ptw/${permitId}/archive`, { method: "POST" });
      if (r.ok) {
        router.refresh();
        return;
      }
      setError(await readApiError(r, "Archive failed"));
    } finally {
      setBusy(false);
    }
  }

  if (!cancellable && !archivable && status !== "CLOSED" && status !== "CANCELLED") return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(status === "CLOSED" || status === "CANCELLED") && (
          <Button asChild size="sm" variant="outline">
            <a href={`/api/ptw/${permitId}/report`} target="_blank" rel="noreferrer">
              <FileDown size={14} /> Close-out Report
            </a>
          </Button>
        )}
        {archivable && (
          <Button size="sm" variant="outline" onClick={archive} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
            Archive
          </Button>
        )}
        {isArchived && (
          <span className="text-[11px] rounded border border-slate-300 bg-slate-100 px-2 py-1 text-slate-600">
            Archived
          </span>
        )}
        {cancellable && !showCancel && (
          <Button
            size="sm"
            variant="outline"
            className="text-rose-700 border-rose-300 hover:bg-rose-50"
            onClick={() => setShowCancel(true)}
          >
            <Ban size={14} /> Cancel Permit
          </Button>
        )}
      </div>

      {error && !showCancel && <div className="text-xs text-rose-700">{error}</div>}

      {showCancel && (
        <Card className="border-rose-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-rose-800 flex items-center gap-1.5">
              <Ban size={14} /> Cancel this permit
            </CardTitle>
            <CardDescription className="text-xs">
              Cancellation withdraws the permit for operational reasons — it is
              NOT an approver rejection. Work under this permit must stop.
              {CANCELLABLE_MID.includes(status) &&
                " This permit has work in progress — only HSE/Admin may cancel it."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label className="text-[11px]">
                Reason <span className="text-rose-600">*</span>
              </Label>
              <Textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this permit being withdrawn? (min 5 characters)"
              />
            </div>
            <EvidenceCapture permitId={permitId} requirePhoto={false} state={evidenceState} />
            {error && <div className="text-xs text-rose-700 whitespace-pre-wrap">{error}</div>}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={cancel}
                disabled={busy || reason.trim().length < 5 || !evidenceReady}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Confirm Cancellation
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCancel(false)} disabled={busy}>
                Keep Permit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
