"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Check, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

const TEXTAREA =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600";

const OUTCOMES = [
  {
    code: "NO_CHANGE_REQUIRED",
    label: "No change required",
    description:
      "The entry remains accurate. Updates review dates.",
  },
  {
    code: "MINOR_REVISION",
    label: "Minor revision",
    description:
      "Small updates that don't change significance determination. Creates a new version.",
  },
  {
    code: "MAJOR_REVISION",
    label: "Major revision",
    description:
      "Significant changes affecting impact scores or significance. Routes entry back for re-approval.",
  },
  {
    code: "NEW_ENTRY_CREATED",
    label: "New entry created",
    description:
      "A new environmental aspect/activity emerged; this entry is unchanged.",
  },
  {
    code: "ENTRY_ARCHIVED",
    label: "Entry archived",
    description:
      "This activity no longer occurs or has been eliminated. Archive with justification.",
  },
];

export function EaiReviewForm({
  cycle,
}: {
  cycle: {
    id: string;
    entryId: string;
    status: string;
    triggeredBy: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [changesMade, setChangesMade] = useState<Record<string, unknown>[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Prevent re-submission of completed/skipped cycles
  if (cycle.status === "COMPLETED" || cycle.status === "SKIPPED") {
    return (
      <Card className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-slate-600 text-sm shadow-none">
        <p className="font-medium">
          This review cycle has already been {cycle.status.toLowerCase()}.
        </p>
        <p className="mt-1">No further action is required.</p>
      </Card>
    );
  }

  function handleSubmitClick() {
    setError(null);
    if (!outcome) {
      setError("Pick an outcome before submitting.");
      return;
    }
    if (!notes.trim()) {
      setError("Review notes are required.");
      return;
    }

    if (outcome === "ENTRY_ARCHIVED" || outcome === "MAJOR_REVISION") {
      setConfirmOpen(true);
      return;
    }

    doSubmit();
  }

  function doSubmit() {
    setConfirmOpen(false);
    startTransition(async () => {
      const res = await fetch(`/api/eai/review-cycles/${cycle.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, outcomeNotes: notes, changesMade }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Submit failed (${res.status})`);
        return;
      }
      if (outcome === "ENTRY_ARCHIVED") {
        router.push("/eai");
      } else {
        router.push(`/eai/entry/${cycle.entryId}`);
      }
    });
  }

  const selectedOutcome = OUTCOMES.find((o) => o.code === outcome);

  return (
    <Card className="rounded-xl border bg-white p-5 space-y-4 shadow-none">
      {error && (
        <Alert variant="destructive" className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm text-rose-900 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          {error}
        </Alert>
      )}

      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
        Review Outcome
      </h2>

      <div className="space-y-2">
        {OUTCOMES.map((o) => (
          <Label
            key={o.code}
            className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition ${
              outcome === o.code
                ? "border-emerald-500 bg-emerald-50"
                : "border-slate-300 bg-white hover:border-slate-400"
            }`}>
            <Input
              type="radio"
              name="outcome"
              value={o.code}
              checked={outcome === o.code}
              onChange={(e) => setOutcome(e.target.value)}
              className="mt-0.5" />
            <div>
              <div className="font-medium text-sm text-slate-900">{o.label}</div>
              <div className="text-xs text-slate-600 mt-0.5">{o.description}</div>
            </div>
          </Label>
        ))}
      </div>

      <div>
        <Label className="block text-xs font-medium text-slate-600 mb-1">
          Review notes <span className="text-rose-600">*</span>
        </Label>
        <Textarea
          className={TEXTAREA}
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What did the review find? What changed (or didn't)? Reference the regulatory change, incident, audit finding, or MOC that triggered this review where relevant." />
      </div>

      {selectedOutcome?.code === "MAJOR_REVISION" && (
        <Alert variant="warning" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          A major-revision outcome routes the affected entry back for re-approval. The entry&apos;s
          status moves to FLAGGED_FOR_REVIEW and the next workflow round picks it up.
        </Alert>
      )}

      <div className="flex gap-2 items-center pt-2 border-t">
        <Button onClick={handleSubmitClick} disabled={pending || confirmOpen}>
          <Check size={14} className="mr-1" />
          {pending ? "Submitting…" : "Submit Review"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.push("/eai/reviews")}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {outcome === "ENTRY_ARCHIVED"
                ? "Archive this entry?"
                : "Flag for major revision?"}
            </DialogTitle>
            <DialogDescription>
              {outcome === "ENTRY_ARCHIVED"
                ? "This action permanently archives the EAI entry. The action cannot be undone from the review interface."
                : "This will mark the entry as requiring significant changes and return it for team re-review and re-approval."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={outcome === "ENTRY_ARCHIVED" ? "destructive" : "default"}
              onClick={doSubmit}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
