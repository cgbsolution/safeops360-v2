"use client";

// Admin control that re-runs the person-risk analysis on demand — re-scores
// every worker's recent incident / near-miss / observation involvement,
// (re)raises flags, and auto-assigns the mapped training without waiting for
// the scheduler. Gated by SKILL_MATRIX.COMPETENCY_CONFIGURE.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Can } from "@/components/auth/can";
import type { ScanResponse } from "@/lib/training-intelligence";

export function RunAnalysisButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/training-engine/person-risk/scan", { method: "POST" });
      const j: Partial<ScanResponse> & { detail?: string; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok) {
        toast({
          variant: "error",
          title: "Analysis failed",
          description: j.detail || j.error || "Please try again."
        });
        return;
      }
      toast({
        variant: "success",
        title: "Analysis complete",
        description: `${j.flagged ?? 0} flagged, ${j.assigned ?? 0} assigned.`
      });
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Can permission="SKILL_MATRIX.COMPETENCY_CONFIGURE">
      <Button variant="outline" size="sm" onClick={run} disabled={busy}>
        <Radar size={14} className={busy ? "animate-pulse" : ""} />
        {busy ? "Analysing…" : "Run analysis now"}
      </Button>
    </Can>
  );
}
