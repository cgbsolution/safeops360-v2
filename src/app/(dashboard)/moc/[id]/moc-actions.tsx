"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

// Next logical state for each lifecycle step (the "advance" button).
const NEXT: Record<string, { to: string; label: string }> = {
  draft: { to: "submitted", label: "Submit" },
  submitted: { to: "under_impact_assessment", label: "Begin impact assessment" },
  under_classification_review: { to: "under_impact_assessment", label: "Begin impact assessment" },
  under_impact_assessment: { to: "under_technical_review", label: "Send to technical review" },
  under_technical_review: { to: "under_approval", label: "Send for approval" },
  approved_pending_implementation: { to: "implementation_in_progress", label: "Start implementation" },
  pre_startup_review: { to: "implementation_in_progress", label: "PSSR passed — start implementation" },
  implementation_in_progress: {
    to: "implementation_complete_pending_verification",
    label: "Mark implementation complete"
  },
  implementation_complete_pending_verification: {
    to: "under_post_implementation_review",
    label: "Begin post-implementation review"
  }
};

const CLOSED = new Set([
  "closed_successful",
  "closed_aborted",
  "closed_rejected",
  "withdrawn",
  "expired",
  "rolled_back"
]);

// States from which an emergency change may fast-track straight into
// implementation (before full approval). Retroactive approval then becomes due.
const EMERGENCY_STARTABLE = new Set([
  "submitted",
  "under_classification_review",
  "under_impact_assessment",
  "under_technical_review",
  "under_approval"
]);

export function MocActions({ crId, status, urgency }: { crId: string; status: string; urgency?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function call(path: string, body: unknown, okMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(path, {
        method: path.endsWith("/transition") || path.endsWith("/approve") ? "POST" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: "error", title: "Action blocked", description: j.error });
        setBusy(false);
        return;
      }
      toast({ variant: "success", title: okMsg });
      router.refresh();
      setBusy(false);
    } catch {
      toast({ variant: "error", title: "Network error", description: "Please try again." });
      setBusy(false);
    }
  }

  const transition = (to: string, rationale?: string) =>
    call(`/api/moc/change-requests/${crId}/transition`, { toStatus: to, rationale }, "Status updated");

  function approve(decision: "approved" | "rejected") {
    const rationale = window.prompt(
      decision === "approved" ? "Approval rationale (required):" : "Rejection rationale (required):"
    );
    if (rationale === null) return;
    call(
      `/api/moc/change-requests/${crId}/approve`,
      { decision, rationale: rationale || decision },
      decision === "approved" ? "Approval recorded" : "Rejected"
    );
  }

  if (CLOSED.has(status)) {
    return (
      <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-500">
        This change request is closed — read-only.
      </div>
    );
  }

  const next = NEXT[status];

  return (
    <div className="rounded-xl border bg-white p-3 flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-slate-500 mr-1">Actions</span>

      {status === "under_approval" ? (
        <>
          <Button size="sm" disabled={busy} onClick={() => approve("approved")}>Approve</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => approve("rejected")}>Reject</Button>
        </>
      ) : next ? (
        <Button size="sm" disabled={busy} onClick={() => transition(next.to)}>{next.label}</Button>
      ) : null}

      {urgency === "emergency" && EMERGENCY_STARTABLE.has(status) && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Start implementation now under emergency fast-track? Retroactive approval will be required within 72 hours."))
              transition("implementation_in_progress", "Emergency fast-track — implementation started pre-approval");
          }}
        >
          Start implementation (emergency)
        </Button>
      )}

      {status === "under_post_implementation_review" && (
        <Button size="sm" disabled={busy} onClick={() => transition("closed_successful")}>
          Close (successful)
        </Button>
      )}

      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => {
          if (window.confirm("Withdraw this change request?")) transition("withdrawn", "Withdrawn by initiator");
        }}
      >
        Withdraw
      </Button>
    </div>
  );
}
