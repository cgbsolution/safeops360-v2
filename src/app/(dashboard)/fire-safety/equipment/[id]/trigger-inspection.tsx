"use client";

// Raise a CAMS inspection engagement for this asset (sourceModule='FIRE').
//
// The endpoint has existed since P1-4; nothing ever called it, so an asset could
// be registered but never scheduled. One button, because the engagement's
// checklist, scoring and findings all belong to the CAMS engine — this only
// creates the engagement and hands off.

import * as React from "react";
import { useRouter } from "next/navigation";

export function TriggerInspectionButton({ equipmentId, code }: { equipmentId: string; code: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function trigger() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/fire/equipment/${equipmentId}/trigger-inspection`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.detail ?? d.error ?? `Failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[11px] text-rose-700">{error}</span>}
      <button
        onClick={trigger}
        disabled={pending}
        title={`Create a CAMS inspection engagement for ${code}`}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400 disabled:opacity-60"
      >
        {pending ? "Scheduling…" : "Trigger inspection"}
      </button>
    </div>
  );
}
