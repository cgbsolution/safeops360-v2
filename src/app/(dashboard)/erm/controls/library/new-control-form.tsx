"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { UserPicker } from "@/components/ui/user-picker";
import {
  CONTROL_TYPES,
  CONTROL_NATURES,
  CONTROL_FREQUENCIES,
  CONTROL_CATEGORIES,
  CONTROL_TYPE_LABEL,
  NATURE_LABEL,
  CONTROL_CATEGORY_LABEL,
} from "@/app/(dashboard)/erm/lib-t3";

// SOX financial-reporting assertions — picked as chips when category is FINANCIAL_REPORTING.
const ASSERTION_OPTIONS = [
  "EXISTENCE",
  "COMPLETENESS",
  "ACCURACY",
  "VALUATION",
  "RIGHTS_OBLIGATIONS",
  "PRESENTATION_DISCLOSURE",
  "CUTOFF",
];

function freqLabel(f: string) {
  return f.charAt(0) + f.slice(1).toLowerCase().replace(/_/g, " ");
}

export function NewControlButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-800"
      >
        <Plus size={16} /> New Control
      </button>
      {open && <NewControlModal onClose={() => setOpen(false)} />}
    </>
  );
}

function NewControlModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [controlType, setControlType] = useState<string>("PREVENTIVE");
  const [nature, setNature] = useState<string>("MANUAL");
  const [frequency, setFrequency] = useState<string>("MONTHLY");
  const [category, setCategory] = useState<string>("OPERATIONAL");
  const [controlOwnerId, setControlOwnerId] = useState<string | null>(null);
  const [processName, setProcessName] = useState("");
  const [isKeyControl, setIsKeyControl] = useState(false);
  const [assertions, setAssertions] = useState<string[]>([]);
  const [controlDesignNotes, setControlDesignNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAssertion(a: string) {
    setAssertions((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/erm/controls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          controlType,
          nature,
          frequency,
          category,
          controlOwnerId,
          processName: processName.trim() || null,
          siteId: null,
          isKeyControl,
          assertions,
          controlDesignNotes: controlDesignNotes.trim(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.detail || j.error || `Failed to create control (${res.status}).`);
        setBusy(false);
        return;
      }
      if (j?.id) {
        router.push(`/erm/controls/${j.id}`);
      } else {
        router.refresh();
        onClose();
      }
    } catch (e: any) {
      setError(e?.message ?? "Network error creating control.");
      setBusy(false);
    }
  }

  const valid = name.trim().length >= 3 && controlOwnerId && description.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">New Control</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Control name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Monthly bank reconciliation review"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What the control does and how it operates."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Type</label>
              <select value={controlType} onChange={(e) => setControlType(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                {CONTROL_TYPES.map((t) => <option key={t} value={t}>{CONTROL_TYPE_LABEL[t] ?? t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Nature</label>
              <select value={nature} onChange={(e) => setNature(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                {CONTROL_NATURES.map((t) => <option key={t} value={t}>{NATURE_LABEL[t] ?? t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Frequency</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                {CONTROL_FREQUENCIES.map((t) => <option key={t} value={t}>{freqLabel(t)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                {CONTROL_CATEGORIES.map((t) => <option key={t} value={t}>{CONTROL_CATEGORY_LABEL[t] ?? t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Control owner</label>
              <UserPicker value={controlOwnerId} onChange={(id) => setControlOwnerId(id)} placeholder="Select owner" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Process (optional)</label>
              <input value={processName} onChange={(e) => setProcessName(e.target.value)} placeholder="e.g. Order-to-Cash"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isKeyControl} onChange={(e) => setIsKeyControl(e.target.checked)} className="rounded border-slate-300" />
            Key control (in scope for assurance / SOX)
          </label>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Financial assertions (optional)</label>
            <div className="flex flex-wrap gap-1.5">
              {ASSERTION_OPTIONS.map((a) => {
                const on = assertions.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAssertion(a)}
                    className={
                      "rounded border px-2 py-0.5 text-[11px] transition-colors " +
                      (on ? "border-primary-300 bg-primary-100 text-primary-800 font-semibold" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")
                    }
                  >
                    {a.replace(/_/g, " ")}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Control design notes</label>
            <textarea
              value={controlDesignNotes}
              onChange={(e) => setControlDesignNotes(e.target.value)}
              rows={2}
              placeholder="Design rationale, evidence retained, who performs the control."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={submit} disabled={busy || !valid}
            className="inline-flex items-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-800 disabled:opacity-50">
            {busy ? "Creating…" : "Create control"}
          </button>
        </div>
      </div>
    </div>
  );
}
