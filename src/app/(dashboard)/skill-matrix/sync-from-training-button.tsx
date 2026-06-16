"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

// Triggers the training-receiver recompute for the current plant: every
// training-fed competency cell is re-derived from the person's current
// training certificates ("training feeds competency"). Idempotent.
export function SyncFromTrainingButton({ plantId }: { plantId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function sync() {
    setMsg(null);
    start(async () => {
      const res = await fetch(
        `/api/skill-matrix/sync-from-training?plantId=${encodeURIComponent(plantId)}`,
        { method: "POST" }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg((j as { error?: string }).error ?? "Sync failed");
        return;
      }
      const changed = (j as { recordsChanged?: number }).recordsChanged ?? 0;
      setMsg(changed === 0 ? "Already up to date with training" : `${changed} cell(s) updated`);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
      <Button type="button" variant="outline" size="sm" onClick={sync} disabled={pending} title="Re-derive every training-fed competency cell from current training certificates">
        <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
        {pending ? "Syncing…" : "Sync from training"}
      </Button>
    </div>
  );
}
