"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PauseCircle, PlayCircle, AlertOctagon, Loader2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import {
  EvidenceCapture,
  evidenceComplete,
  evidencePayload,
  useEvidenceCapture,
} from "@/components/ptw/evidence-capture";

// Visible to HSE Manager / Admin only.
// - When permit is ACTIVE: shows a Suspend button (requires reason)
// - When permit is SUSPENDED: shows a Resume button (optional comments) +
//   the suspension reason captured at suspend time.
export function SuspendResumePanel({
  permitId,
  status,
  suspendedAt,
  suspendedReason,
  canAct
}: {
  permitId: string;
  status: string;
  suspendedAt: Date | string | null;
  suspendedReason: string | null;
  canAct: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "suspend" | "resume">("idle");
  const [reason, setReason] = useState("");
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Closed-loop rebuild: suspension/resumption are lifecycle actions —
  // GPS + signature evidence is required (photo optional).
  const evidenceState = useEvidenceCapture();
  const evidenceReady = evidenceComplete(evidenceState, {
    requirePhoto: false,
    requireDeclaration: false,
  });

  if (status !== "ACTIVE" && status !== "SUSPENDED") return null;

  async function suspend() {
    if (!reason.trim()) {
      setError("Reason is required");
      return;
    }
    setBusy(true);
    setError("");
    const r = await fetch(`/api/ptw/${permitId}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, evidence: evidencePayload(evidenceState) })
    });
    setBusy(false);
    if (r.ok) {
      setMode("idle");
      setReason("");
      router.refresh();
    } else {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? j.detail ?? "Suspend failed");
    }
  }

  async function resume() {
    setBusy(true);
    setError("");
    const r = await fetch(`/api/ptw/${permitId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: comments || undefined, evidence: evidencePayload(evidenceState) })
    });
    setBusy(false);
    if (r.ok) {
      setMode("idle");
      setComments("");
      router.refresh();
    } else {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? j.detail ?? "Resume failed");
    }
  }

  if (status === "SUSPENDED") {
    return (
      <Card className="border-amber-300 ring-2 ring-amber-100">
        <CardHeader className="bg-amber-50 rounded-t-xl">
          <CardTitle className="text-amber-900 flex items-center gap-2">
            <AlertOctagon size={18} /> Permit Suspended
          </CardTitle>
          <CardDescription className="text-amber-800">
            Work must stop until the permit is resumed.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          {suspendedReason && (
            <Card className="rounded-md border-amber-200 p-3 shadow-none">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700">Reason</div>
              <p className="whitespace-pre-wrap text-sm text-slate-800">{suspendedReason}</p>
              {suspendedAt && (
                <div className="mt-2 text-[11px] text-slate-500">Suspended at {formatDateTime(suspendedAt)}</div>
              )}
            </Card>
          )}
          {!canAct ? (
            <p className="text-xs text-slate-500">Only HSE Manager / Admin can resume.</p>
          ) : mode === "resume" ? (
            <>
              <div className="space-y-2">
                <Label>Comments (site re-validated, etc.)</Label>
                <Textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Notes on resumption..." />
              </div>
              <EvidenceCapture permitId={permitId} requirePhoto={false} state={evidenceState} />
              {error && <Alert variant="destructive" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</Alert>}
              <div className="flex gap-2">
                <Button onClick={resume} disabled={busy || !evidenceReady} variant="success">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />} Confirm Resume
                </Button>
                <Button onClick={() => { setMode("idle"); setError(""); }} variant="outline">Cancel</Button>
              </div>
            </>
          ) : (
            <Button onClick={() => setMode("resume")} variant="success">
              <PlayCircle size={14} /> Resume Permit
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // status === "ACTIVE"
  if (!canAct) return null;

  return (
    <Card className="border-amber-200">
      <CardContent className="p-4">
        {mode === "idle" ? (
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              Need to pause this permit (gas test failed, weather change, scope deviation)?
            </div>
            <Button onClick={() => setMode("suspend")} variant="outline" size="sm" className="text-amber-700 border-amber-300 hover:bg-amber-50">
              <PauseCircle size={14} /> Suspend Permit
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Suspension Reason<span className="text-rose-600">*</span></Label>
              <Textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Required. Why is work being stopped right now?"
              />
            </div>
            <EvidenceCapture permitId={permitId} requirePhoto={false} state={evidenceState} />
            {error && <Alert variant="destructive" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</Alert>}
            <div className="flex gap-2">
              <Button onClick={suspend} disabled={busy || !reason.trim() || !evidenceReady} variant="destructive">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <PauseCircle size={14} />} Confirm Suspend
              </Button>
              <Button onClick={() => { setMode("idle"); setError(""); }} variant="outline">Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
