"use client";

// Manual trigger for the calibration job. Lives in the page header so
// it's reachable without scrolling past metrics. Sends a single POST
// to /api/agents/calibration/run; the backend recomputes rates +
// updates the Agent rolling-metric columns + per-prompt-version rates.
//
// Why a manual button when there's a cron entry point: in pilot mode,
// running the cron daily is slow feedback; clicking the button after
// a few invocations updates the dashboard immediately.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { RefreshCcw, Loader2 } from "lucide-react";

type CalibrationResultItem = {
  agentCode: string;
  totalInvocations: number;
  decidedTotal: number;
  calibrationScore: number | null;
  promptVersionsUpdated: number;
};

type CalibrationResponse = {
  ranAt: string;
  durationMs: number;
  results: CalibrationResultItem[];
};

export function CalibrationButton({ agentCode }: { agentCode: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    try {
      const res = await fetch("/api/agents/calibration/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail ?? err?.error ?? `Failed (${res.status})`);
      }
      const data = (await res.json()) as CalibrationResponse;
      const target = data.results.find((r) => r.agentCode === agentCode);
      toast({
        variant: "success",
        title: "Calibration complete",
        description: target
          ? `${target.agentCode}: ${target.decidedTotal} decided · score ${
              target.calibrationScore != null
                ? target.calibrationScore.toFixed(2)
                : "—"
            } · ${target.promptVersionsUpdated} prompt version(s) updated.`
          : `Ran in ${data.durationMs}ms across ${data.results.length} agent(s).`
      });
      router.refresh();
    } catch (e: any) {
      toast({
        variant: "error",
        title: "Calibration failed",
        description: e?.message ?? "Try again"
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={run} disabled={running}>
      {running ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <RefreshCcw size={12} />
      )}
      {running ? "Running calibration…" : "Run calibration"}
    </Button>
  );
}
