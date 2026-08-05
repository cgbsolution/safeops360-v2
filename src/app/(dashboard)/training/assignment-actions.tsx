"use client";

// Action buttons for a single training assignment. Shared by the assignment
// detail page and the "My Training" card list. All mutations go through the
// catch-all proxy (/api/training-engine/...) and refresh the route on success.
//
// Rules:
//   - Start        → status in_progress (only while "assigned")
//   - Mark complete → dialog (evidenceType + note) → POST /complete
//   - Escalate     → status escalated
//   - Decline      → status cancelled — ONLY when dismissible && !mandatory.
//     A mandatory assignment shows no decline control; the backend also
//     enforces this and returns 403 with a `detail` we surface as a toast.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, CheckCircle2, ArrowUpCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { AssignmentStatus, EvidenceType } from "@/lib/training-engine";

const EVIDENCE_OPTIONS: { value: EvidenceType; label: string }[] = [
  { value: "training_completion", label: "Training completion" },
  { value: "assessment", label: "Assessment passed" },
  { value: "manual_signoff", label: "Manual sign-off" }
];

export function AssignmentActions({
  assignmentId,
  status,
  isMandatory,
  dismissible,
  size = "default"
}: {
  assignmentId: string;
  status: AssignmentStatus;
  isMandatory: boolean;
  dismissible: boolean;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("training_completion");
  const [note, setNote] = useState("");

  const isTerminal = status === "completed" || status === "cancelled";

  async function postStatus(next: "in_progress" | "escalated" | "cancelled", noteText?: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/training-engine/assignments/${assignmentId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, note: noteText || undefined })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast({
          variant: "error",
          title: "Couldn't update assignment",
          description: j.detail || j.error || "Please try again."
        });
        return;
      }
      const labels: Record<string, string> = {
        in_progress: "Marked in progress",
        escalated: "Escalated",
        cancelled: "Assignment declined"
      };
      toast({ variant: "success", title: labels[next] ?? "Updated" });
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/training-engine/assignments/${assignmentId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidenceType, note: note || undefined })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast({
          variant: "error",
          title: "Couldn't complete training",
          description: j.detail || j.error || "Please try again."
        });
        return;
      }
      const j = await res.json().catch(() => ({}));
      toast({
        variant: "success",
        title: "Training completed",
        description: j.correlationLogged
          ? "Competency record updated · correlation logged."
          : "Competency record updated."
      });
      setCompleteOpen(false);
      setNote("");
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  function confirmDecline() {
    if (!window.confirm("Decline this assignment? This cannot be undone.")) return;
    void postStatus("cancelled");
  }

  if (isTerminal) {
    return (
      <span className="text-xs font-medium text-slate-400">
        {status === "completed" ? "Completed — no actions" : "Cancelled"}
      </span>
    );
  }

  const canDecline = dismissible && !isMandatory;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "assigned" && (
        <Button size={size} onClick={() => postStatus("in_progress")} disabled={busy}>
          <Play size={size === "sm" ? 14 : 16} /> Start
        </Button>
      )}

      <Button
        size={size}
        variant="success"
        onClick={() => setCompleteOpen(true)}
        disabled={busy}
      >
        <CheckCircle2 size={size === "sm" ? 14 : 16} /> Mark complete
      </Button>

      {status !== "escalated" && (
        <Button
          size={size}
          variant="outline"
          onClick={() => postStatus("escalated")}
          disabled={busy}
        >
          <ArrowUpCircle size={size === "sm" ? 14 : 16} /> Escalate
        </Button>
      )}

      {canDecline && (
        <Button
          size={size}
          variant="outline"
          className="text-rose-700 hover:bg-rose-50"
          onClick={confirmDecline}
          disabled={busy}
        >
          <XCircle size={size === "sm" ? 14 : 16} /> Decline
        </Button>
      )}

      <Dialog open={completeOpen} onOpenChange={(o) => !busy && setCompleteOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark training complete</DialogTitle>
            <DialogDescription>
              Record the evidence for this completion. This updates the person&apos;s competency
              record and logs a training-to-outcome correlation point.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Evidence type</Label>
              <Select
                value={evidenceType}
                onChange={(e) => setEvidenceType(e.target.value as EvidenceType)}
              >
                {EVIDENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Note (optional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Attended toolbox refresher, scored 92%."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCompleteOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="success" size="sm" onClick={complete} disabled={busy}>
              {busy ? "Saving…" : "Complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
