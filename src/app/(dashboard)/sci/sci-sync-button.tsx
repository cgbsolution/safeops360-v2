"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function SciSyncButton({ plantId }: { plantId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function sync() {
    setMsg(null);
    start(async () => {
      const res = await fetch(`/api/sci/sync?plantId=${encodeURIComponent(plantId)}`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg((j as { error?: string }).error ?? "Sync failed");
        return;
      }
      const c = (j as { created?: number }).created ?? 0;
      setMsg(c === 0 ? "Up to date" : `${c} points awarded`);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
      <Button type="button" variant="outline" size="sm" onClick={sync} disabled={pending} title="Recompute the index from verified events">
        <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
        {pending ? "Scoring…" : "Recompute"}
      </Button>
    </div>
  );
}
