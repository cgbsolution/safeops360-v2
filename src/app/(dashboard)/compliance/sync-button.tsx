"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function ScrSyncButton({ plantId }: { plantId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function sync() {
    setMsg(null);
    start(async () => {
      const res = await fetch(`/api/scr/sync?plantId=${encodeURIComponent(plantId)}`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg((j as { error?: string }).error ?? "Sync failed");
        return;
      }
      const r = (j as { results?: { created?: number; updated?: number }[] }).results?.[0];
      const c = r?.created ?? 0;
      const u = r?.updated ?? 0;
      setMsg(c + u === 0 ? "Up to date" : `${c} new · ${u} updated`);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
      <Button type="button" variant="outline" size="sm" onClick={sync} disabled={pending} title="Auto-populate registers from source modules">
        <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
        {pending ? "Syncing…" : "Sync from sources"}
      </Button>
    </div>
  );
}
