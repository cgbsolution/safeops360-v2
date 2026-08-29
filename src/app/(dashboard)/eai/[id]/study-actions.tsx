"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/auth/can";

type Props = { studyId: string; status: string };

const SUBMIT_STATUSES = ["DRAFT", "IN_PROGRESS", "TEAM_REVIEW"];
const TERMINAL_STATUSES = ["ACTIVE", "SUPERSEDED", "ARCHIVED"];

export function StudyActions({ studyId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (TERMINAL_STATUSES.includes(status)) return null;

  let endpoint: string;
  let label: string;
  // Each hop needs a different permission — submitting is an author action,
  // approval is the Plant Head's, activation is the Environment/HSE Manager's.
  // Offering all three to everyone just produced a 403 on click.
  let permission: string;

  if (SUBMIT_STATUSES.includes(status)) {
    endpoint = "submit";
    label = status === "DRAFT" ? "Start assessment" : status === "IN_PROGRESS" ? "Submit for team review" : "Send for approval";
    permission = "EAI.UPDATE";
  } else if (status === "APPROVAL_PENDING") {
    endpoint = "approve";
    label = "Approve register";
    permission = "EAI.APPROVE";
  } else if (status === "APPROVED") {
    endpoint = "activate";
    label = "Activate register";
    permission = "EAI.EXECUTE";
  } else {
    return null;
  }

  function handleAction() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/eai/studies/${studyId}/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(
            (data as { error?: string; detail?: string }).error ??
              (data as { detail?: string }).detail ??
              `Action failed (${res.status})`
          );
          return;
        }
        router.refresh();
      } catch {
        setError("Network error — please try again.");
      }
    });
  }

  return (
    <Can permission={permission}>
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          onClick={handleAction}
          disabled={pending}
          variant={endpoint === "submit" ? "default" : "success"}
          data-testid="eai-study-action"
        >
          {pending ? "Working…" : label}
        </Button>
        {error && <span className="max-w-xs text-right text-xs text-rose-600">{error}</span>}
      </div>
    </Can>
  );
}
