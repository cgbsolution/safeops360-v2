"use client";

// Accept / Modify / Reject controls + 1-5 star rating + optional
// detailed feedback. Submitted as a single call to
// POST /api/agent-invocations/{id}/decision via the parent.
//
// Validation rules (mirroring the Python service):
//   • REJECT requires a rejection reason
//   • ACCEPT_WITH_MODIFICATION is meaningful only when the user has
//     edited the editor; we don't block on that (the parent decides
//     whether to disable the button) but we name the intent clearly
//
// The rating + feedback are optional. Encouraging but not required —
// calibration improves faster the more feedback the user gives, but
// gating decisions on rating would frustrate the workflow.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, Edit3, X, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export type DecisionPayload = {
  decision: "ACCEPT_AS_IS" | "ACCEPT_WITH_MODIFICATION" | "REJECT";
  rejectionReason?: string;
  rating?: number;
  feedback?: string;
};

export function DecisionPanel({
  onSubmit
}: {
  onSubmit: (payload: DecisionPayload) => Promise<void> | void;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [pendingDecision, setPendingDecision] =
    useState<DecisionPayload["decision"] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(decision: DecisionPayload["decision"]) {
    setError(null);
    if (decision === "REJECT" && !rejectionReason.trim()) {
      setPendingDecision("REJECT");
      setError("A rejection reason is required.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        decision,
        rejectionReason:
          decision === "REJECT" ? rejectionReason.trim() : undefined,
        rating: rating ?? undefined,
        feedback: feedback.trim() || undefined
      });
    } catch (e: any) {
      setError(e?.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
      setPendingDecision(null);
    }
  }

  return (
    <div className="rounded-md border border-violet-200 bg-white p-3 space-y-3">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-violet-800">
        Your Decision
      </div>

      {/* Rating */}
      <div>
        <Label className="text-xs">How useful was this analysis?</Label>
        <div className="flex items-center gap-1 mt-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(rating === n ? null : n)}
              className={cn(
                "p-1 rounded hover:bg-violet-100 transition",
                rating != null && n <= rating
                  ? "text-amber-500"
                  : "text-slate-300"
              )}
              aria-label={`Rate ${n} out of 5`}
            >
              <Star size={16} fill={rating != null && n <= rating ? "currentColor" : "none"} />
            </button>
          ))}
          {rating != null && (
            <button
              type="button"
              className="ml-2 text-[10px] text-slate-500 hover:text-slate-700"
              onClick={() => setRating(null)}
            >
              clear
            </button>
          )}
        </div>
      </div>

      {/* Feedback (optional) */}
      <div>
        <Label className="text-xs">Detailed feedback (optional)</Label>
        <Textarea
          rows={2}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="What was useful? What was off? Helps tune the prompt for future invocations."
          className="text-xs"
        />
      </div>

      {/* Rejection-specific reason field — appears only when the
          user clicks Reject. We don't take up space until needed. */}
      {pendingDecision === "REJECT" && (
        <div>
          <Label className="text-xs text-rose-700">
            Reason for rejection (required)
          </Label>
          <Textarea
            rows={2}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="What was wrong with the suggestion? (e.g. wrong methodology, off-base root causes, missed the obvious cause…)"
            className="text-xs"
          />
        </div>
      )}

      {error && (
        <div className="text-xs text-rose-700">{error}</div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          variant="success"
          onClick={() => submit("ACCEPT_AS_IS")}
          disabled={submitting}
        >
          <Check size={12} /> Accept
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => submit("ACCEPT_WITH_MODIFICATION")}
          disabled={submitting}
          title="Records what you kept vs changed against the agent's suggestion. Click after editing the analysis."
        >
          <Edit3 size={12} /> Accept with Modifications
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            // First click: reveal the reason field; second click: submit.
            if (pendingDecision !== "REJECT") {
              setPendingDecision("REJECT");
              return;
            }
            submit("REJECT");
          }}
          disabled={submitting}
          className="text-rose-700 hover:bg-rose-50 border-rose-200"
        >
          <X size={12} />
          {pendingDecision === "REJECT" ? "Confirm Reject" : "Reject"}
        </Button>
      </div>
    </div>
  );
}
