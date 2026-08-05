"use client";

// Client actions for a worker's person-risk detail:
//   - AssignTrainingButton → POST /person-risk/{userId}/assign (assigns the
//     mapped training the worker's events point to; toasts the count).
//   - WorkerRiskActions    → Acknowledge + Clear (with a reason dialog).
//
// All mutations go through the catch-all proxy (/api/training-engine/...) and
// refresh the route on success. Acknowledge/Clear are gated at the call site
// with <Can permission="SKILL_MATRIX.ASSESS">.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import type {
  AssignResponse,
  FlagActionResponse,
  PersonRiskStatus
} from "@/lib/training-intelligence";

export function AssignTrainingButton({
  userId,
  disabled
}: {
  userId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function assign() {
    setBusy(true);
    try {
      const res = await fetch(`/api/training-engine/person-risk/${userId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const j: Partial<AssignResponse> & { detail?: string; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok) {
        toast({
          variant: "error",
          title: "Couldn't assign training",
          description: j.detail || j.error || "Please try again."
        });
        return;
      }
      const n = j.assigned ?? 0;
      toast({
        variant: "success",
        title: n > 0 ? "Training assigned" : "Nothing to assign",
        description:
          n > 0
            ? `${n} training assignment(s) created from this worker's events.`
            : "This worker already has the recommended training assigned."
      });
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" onClick={assign} disabled={busy || disabled}>
      <GraduationCap size={14} />
      {busy ? "Assigning…" : "Assign training"}
    </Button>
  );
}

export function WorkerRiskActions({
  userId,
  status
}: {
  userId: string;
  status: PersonRiskStatus;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function acknowledge() {
    setBusy(true);
    try {
      const res = await fetch(`/api/training-engine/person-risk/${userId}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const j: Partial<FlagActionResponse> & { detail?: string; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok) {
        toast({
          variant: "error",
          title: "Couldn't acknowledge",
          description: j.detail || j.error || "Please try again."
        });
        return;
      }
      toast({ variant: "success", title: "Flag acknowledged" });
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (!reason.trim()) {
      toast({ variant: "error", title: "A reason is required to clear this flag." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/training-engine/person-risk/${userId}/clear?reason=${encodeURIComponent(reason.trim())}`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      const j: Partial<FlagActionResponse> & { detail?: string; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok) {
        toast({
          variant: "error",
          title: "Couldn't clear flag",
          description: j.detail || j.error || "Please try again."
        });
        return;
      }
      toast({ variant: "success", title: "Flag cleared" });
      setClearOpen(false);
      setReason("");
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  if (status === "cleared") {
    return <span className="text-xs font-medium text-emerald-700">Flag cleared — no actions</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "flagged" && (
        <Button size="sm" variant="outline" onClick={acknowledge} disabled={busy}>
          <CheckCircle2 size={14} /> Acknowledge
        </Button>
      )}

      <Button
        size="sm"
        variant="outline"
        className="text-rose-700 hover:bg-rose-50"
        onClick={() => setClearOpen(true)}
        disabled={busy}
      >
        <XCircle size={14} /> Clear flag
      </Button>

      <Dialog open={clearOpen} onOpenChange={(o) => !busy && setClearOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Clear person-risk flag</DialogTitle>
            <DialogDescription>
              Record why this worker is being cleared — e.g. training completed, events reviewed
              and not attributable, or transferred out. This is kept on the flag&apos;s audit trail.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1">
            <Label className="text-xs">Clear reason</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Completed hot-work refresher + supervisor sign-off; no repeat in 90 days."
            />
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setClearOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={clear} disabled={busy}>
              {busy ? "Clearing…" : "Clear flag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
