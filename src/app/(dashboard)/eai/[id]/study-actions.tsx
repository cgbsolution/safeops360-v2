"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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

  if (SUBMIT_STATUSES.includes(status)) {
    endpoint = "submit";
    label = "Submit";
  } else if (status === "APPROVAL_PENDING") {
    endpoint = "approve";
    label = "Approve";
  } else if (status === "APPROVED") {
    endpoint = "activate";
    label = "Activate";
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

  const PENDING_LABEL: Record<string, string> = {
    Submit: "Submitting…",
    Approve: "Approving…",
    Activate: "Activating…",
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        onClick={handleAction}
        disabled={pending}
        variant="default"
      >
        {pending ? PENDING_LABEL[label] ?? `${label}ing…` : label}
      </Button>
      {error && (
        <span className="text-xs text-rose-600 max-w-xs text-right">{error}</span>
      )}
    </div>
  );
}
