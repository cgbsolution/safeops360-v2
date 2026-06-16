"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

const DEFAULT_SECTIONS: Record<string, boolean> = {
  executiveSummary: true,
  heatMap: true,
  top10: true,
  movement: true,
  treatmentStatus: true,
  newRisks: true,
  escalations: true,
};

function defaultQuarter(): string {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `Q${q} FY${now.getFullYear()}`;
}

export function NewPackButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [quarterLabel, setQuarterLabel] = useState(defaultQuarter());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/erm/board-packs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || `Risk Board Pack — ${quarterLabel}`,
          quarterLabel: quarterLabel.trim() || defaultQuarter(),
          sections: DEFAULT_SECTIONS,
          commentary: {},
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.detail || j.error || `Failed to create pack (${res.status}).`);
        setBusy(false);
        return;
      }
      const created = j as { id?: string };
      if (created?.id) {
        router.push("/erm/board-packs/" + created.id);
      } else {
        setError("Pack created but no id returned.");
        setBusy(false);
      }
    } catch (e: any) {
      setError(e?.message ?? "Network error creating board pack.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-800"
      >
        <Plus size={16} /> New Pack
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">New Board Pack</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`Risk Board Pack — ${quarterLabel}`}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Quarter
                </label>
                <input
                  value={quarterLabel}
                  onChange={(e) => setQuarterLabel(e.target.value)}
                  placeholder="Q2 FY2026"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                All standard sections (executive summary, heat map, top-10, movement, treatment status, new
                risks, escalations) are enabled by default. You can toggle them in the editor.
              </p>
              {error && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {error}
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={create}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-800 disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create Pack"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
