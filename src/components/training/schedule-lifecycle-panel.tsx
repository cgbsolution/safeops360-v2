"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, PauseCircle, PlayCircle, Send, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { readApiError } from "@/lib/client-errors";

const SCHEDULER_ROLES = ["LD_MANAGER", "HSE_MANAGER", "ADMIN"];

export function ScheduleLifecyclePanel({
  scheduleId,
  status,
  currentRole,
}: {
  scheduleId: string;
  status: string;
  currentRole: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const canAct = SCHEDULER_ROLES.includes(currentRole);

  async function call(path: string, body: any, op: string) {
    setBusy(op);
    setError("");
    try {
      const r = await fetch(`/api/training/schedules/${scheduleId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setShowCancel(false);
        setCancelReason("");
        router.refresh();
        return;
      }
      setError(await readApiError(r, "Action failed"));
    } finally {
      setBusy(null);
    }
  }

  if (!canAct) return null;

  if (status === "DRAFT") {
    return (
      <Card className="border-slate-300 bg-slate-50/50">
        <CardContent className="p-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium flex items-center gap-1.5">
              <PauseCircle size={14} /> Schedule is DRAFT
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Publish to make it visible to nominees and managers.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => call("publish", {}, "publish")} disabled={busy !== null}>
              {busy === "publish" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Publish
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCancel(true)} disabled={busy !== null}>
              Cancel
            </Button>
          </div>
        </CardContent>
        {showCancel && <CancelInline reason={cancelReason} setReason={setCancelReason} onConfirm={() => call("cancel", { reason: cancelReason }, "cancel")} onClose={() => setShowCancel(false)} busy={busy === "cancel"} />}
        {error && <div className="px-4 pb-3 text-xs text-rose-700">{error}</div>}
      </Card>
    );
  }

  if (status === "PUBLISHED") {
    return (
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-blue-900 flex items-center gap-1.5">
              <CheckCircle2 size={14} /> Published
            </div>
            <p className="text-xs text-blue-700 mt-1">
              Open nominations to allow self/manager-nominate, or skip straight to start.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => call("open-nominations", {}, "open")} disabled={busy !== null}>
              Open Nominations
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCancel(true)} disabled={busy !== null}>
              Cancel
            </Button>
          </div>
        </CardContent>
        {showCancel && <CancelInline reason={cancelReason} setReason={setCancelReason} onConfirm={() => call("cancel", { reason: cancelReason }, "cancel")} onClose={() => setShowCancel(false)} busy={busy === "cancel"} />}
        {error && <div className="px-4 pb-3 text-xs text-rose-700">{error}</div>}
      </Card>
    );
  }

  if (status === "NOMINATIONS_OPEN") {
    return (
      <Card className="border-violet-200 bg-violet-50/50">
        <CardContent className="p-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-violet-900 flex items-center gap-1.5">
              <PlayCircle size={14} /> Nominations open
            </div>
            <p className="text-xs text-violet-700 mt-1">
              Workers can self-nominate. Start the schedule when ready to capture attendance.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => call("start", {}, "start")} disabled={busy !== null}>
              <PlayCircle size={14} /> Start
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCancel(true)} disabled={busy !== null}>
              Cancel
            </Button>
          </div>
        </CardContent>
        {showCancel && <CancelInline reason={cancelReason} setReason={setCancelReason} onConfirm={() => call("cancel", { reason: cancelReason }, "cancel")} onClose={() => setShowCancel(false)} busy={busy === "cancel"} />}
        {error && <div className="px-4 pb-3 text-xs text-rose-700">{error}</div>}
      </Card>
    );
  }

  if (status === "IN_PROGRESS") {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-amber-900 flex items-center gap-1.5">
              <PlayCircle size={14} /> In progress
            </div>
            <p className="text-xs text-amber-700 mt-1">
              Capture attendance per session. Mark complete when all sessions are done + assessments graded.
            </p>
          </div>
          <Button size="sm" onClick={() => call("complete", {}, "complete")} disabled={busy !== null}>
            {busy === "complete" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Mark Complete
          </Button>
        </CardContent>
        {error && <div className="px-4 pb-3 text-xs text-rose-700">{error}</div>}
      </Card>
    );
  }

  if (status === "COMPLETED") {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardContent className="p-4">
          <div className="text-sm font-medium text-emerald-900 flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Schedule completed
          </div>
          <p className="text-xs text-emerald-700 mt-1">
            Certificates auto-issue for passing registrations (Commit 4).
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === "CANCELLED") {
    return (
      <Card className="border-rose-200 bg-rose-50/50">
        <CardContent className="p-4">
          <div className="text-sm font-medium text-rose-900 flex items-center gap-1.5">
            <XCircle size={14} /> Cancelled
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

function CancelInline({
  reason,
  setReason,
  onConfirm,
  onClose,
  busy,
}: {
  reason: string;
  setReason: (s: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  busy: boolean;
}) {
  return (
    <CardContent className="p-4 pt-0 space-y-2">
      <Textarea
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Cancellation reason"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={onConfirm} disabled={busy || !reason.trim()}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          Confirm Cancel
        </Button>
        <Button size="sm" variant="outline" onClick={onClose} disabled={busy}>
          Keep schedule
        </Button>
      </div>
    </CardContent>
  );
}
