"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Inline % completion editor for the Treatment Tracker rows. Lets a user set
 * mitigation progress (0–100) directly from the tracker page (previously only
 * possible from the risk-detail Treatments tab). Reaching 100% triggers the
 * backend post-mitigation residual recalculation + state advance.
 */
export function TreatmentProgressCell({
  id,
  completionPercent,
}: {
  id: string;
  completionPercent?: number | null;
}) {
  const router = useRouter();
  const initial = Math.min(Math.max(completionPercent ?? 0, 0), 100);
  const [pct, setPct] = useState(initial);
  const [busy, setBusy] = useState(false);
  const dirty = pct !== initial;

  async function save() {
    setBusy(true);
    const res = await fetch(`/api/erm/treatments/${id}/progress`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completionPercent: pct }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      const d = (j as any).detail;
      alert((d && typeof d === "object" ? d.message : d) || (j as any).error || "Failed to update progress");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-slate-100">
        <div
          className={"h-full rounded-full " + (pct >= 100 ? "bg-emerald-500" : "bg-primary-500")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <input
        type="number"
        min={0}
        max={100}
        step={5}
        value={pct}
        onChange={(e) => setPct(Math.min(Math.max(Number(e.target.value) || 0, 0), 100))}
        className="w-14 rounded border border-slate-300 px-1 py-0.5 text-xs tabular-nums"
        aria-label="Completion percent"
      />
      <span className="text-[11px] text-slate-400">%</span>
      {dirty && (
        <button
          disabled={busy}
          onClick={save}
          className="rounded bg-primary-700 px-2 py-0.5 text-[11px] font-medium text-white disabled:opacity-50"
        >
          {busy ? "…" : "Save"}
        </button>
      )}
    </div>
  );
}
