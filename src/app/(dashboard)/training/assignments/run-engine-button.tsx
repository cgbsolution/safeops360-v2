"use client";

// Admin control that drains the trigger outbox on demand — turns queued
// incident / near-miss / observation events into fresh training assignments
// without waiting for the scheduler. Gated by SKILL_MATRIX.COMPETENCY_CONFIGURE.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Can } from "@/components/auth/can";

export function RunEngineButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/training-engine/evaluate", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          variant: "error",
          title: "Engine run failed",
          description: j.detail || j.error || "Please try again."
        });
        return;
      }
      const created =
        (j.assignmentsCreated as number | undefined) ??
        (j.created as number | undefined) ??
        (Array.isArray(j.items) ? j.items.length : undefined);
      toast({
        variant: "success",
        title: "Engine run complete",
        description:
          created !== undefined
            ? `${created} assignment(s) created from queued events.`
            : "Trigger outbox drained."
      });
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Can permission="SKILL_MATRIX.COMPETENCY_CONFIGURE">
      <Button variant="outline" size="sm" onClick={run} disabled={busy}>
        <Zap size={14} className={busy ? "animate-pulse" : ""} />
        {busy ? "Running…" : "Run engine now"}
      </Button>
    </Can>
  );
}
