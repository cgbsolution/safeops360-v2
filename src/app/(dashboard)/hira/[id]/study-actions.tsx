"use client";

// Study lifecycle actions for a HIRA study.
//
// The backend has driven DRAFT → IN_PROGRESS → TEAM_REVIEW → APPROVAL_PENDING
// → APPROVED → ACTIVE since Phase 1 (routers/hira.py: submit / approve /
// activate), but the detail page never rendered a control for any of them, so a
// study created in the UI could not leave DRAFT. This mirrors the EAI
// equivalent, with one addition: the approve/activate hops need HIRA.APPROVE,
// not HIRA.UPDATE, so the button is gated on the right permission rather than
// being offered to everyone and 403-ing.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/auth/can";
import { Send, CheckCircle2, PlayCircle } from "lucide-react";

type Props = { studyId: string; status: string };

const TERMINAL_STATUSES = ["ACTIVE", "SUPERSEDED", "ARCHIVED"];

// status → { endpoint, label, permission, hint }
const STEP: Record<
  string,
  { endpoint: string; label: string; permission: string; hint: string; icon: "send" | "check" | "play" }
> = {
  DRAFT: {
    endpoint: "submit",
    label: "Start assessment",
    permission: "HIRA.UPDATE",
    hint: "Moves the study to In Progress so entries can be assessed.",
    icon: "send"
  },
  IN_PROGRESS: {
    endpoint: "submit",
    label: "Submit for team review",
    permission: "HIRA.UPDATE",
    hint: "Hands the completed entries to the assessment team for review.",
    icon: "send"
  },
  TEAM_REVIEW: {
    endpoint: "submit",
    label: "Send for approval",
    permission: "HIRA.UPDATE",
    hint: "Routes the reviewed study to the approver.",
    icon: "send"
  },
  APPROVAL_PENDING: {
    endpoint: "approve",
    label: "Approve study",
    permission: "HIRA.APPROVE",
    hint: "Records the approval, sign-off date and effective-from date.",
    icon: "check"
  },
  APPROVED: {
    endpoint: "activate",
    label: "Activate study",
    permission: "HIRA.APPROVE",
    hint: "Publishes the study as the live risk register for this scope.",
    icon: "play"
  }
};

export function StudyActions({ studyId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (TERMINAL_STATUSES.includes(status)) return null;
  const step = STEP[status];
  if (!step) return null;

  function handleAction() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/hira/studies/${studyId}/${step.endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
          setError(data.error ?? data.detail ?? `Action failed (${res.status})`);
          return;
        }
        router.refresh();
      } catch {
        setError("Network error — please try again.");
      }
    });
  }

  const Icon = step.icon === "check" ? CheckCircle2 : step.icon === "play" ? PlayCircle : Send;

  return (
    <Can permission={step.permission}>
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          onClick={handleAction}
          disabled={pending}
          variant={step.endpoint === "submit" ? "default" : "success"}
          title={step.hint}
          data-testid="hira-study-action"
        >
          <Icon size={16} /> {pending ? "Working…" : step.label}
        </Button>
        {error && <span className="max-w-xs text-right text-xs text-rose-600">{error}</span>}
      </div>
    </Can>
  );
}
