"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { HAZARD_LABEL, PSSR_OUTCOMES, PSSR_OUTCOME_LABEL } from "../_meta";

type Verdict = "pass" | "fail" | "partial" | "na";
type PssrItem = { label: string; verdict: Verdict | ""; note?: string };
// Incoming shape from the server (verdict widened to string).
type PssrChecklist = { items: { label: string; verdict: string; note?: string }[]; outcome: string; completedAt: string | null; completedBy?: string | null } | null;
type EffReview = { effective: boolean; newRisks: boolean; notes: string | null; cadenceDays: number | null; reviewedAt: string | null } | null;

const VERDICTS: Verdict[] = ["pass", "fail", "partial", "na"];
const VERDICT_STYLE: Record<Verdict, string> = {
  pass: "border-emerald-300 bg-emerald-600 text-white",
  fail: "border-rose-300 bg-rose-600 text-white",
  partial: "border-amber-300 bg-amber-500 text-white",
  na: "border-slate-300 bg-slate-500 text-white"
};

const BASE_PSSR_ITEMS = [
  "Equipment installed / modified per approved design",
  "Safety & protective systems functional and tested",
  "Operating procedures updated and available",
  "Affected personnel trained and briefed",
  "Housekeeping complete; area safe for start-up"
];

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

// ── PSSR checklist gate ──────────────────────────────────────────────────────
export function PssrPanel({
  crId,
  pssrRequired,
  pssrChecklist,
  hazardCategories,
  readOnly
}: {
  crId: string;
  pssrRequired: boolean;
  pssrChecklist: PssrChecklist;
  hazardCategories: string[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const initialItems: PssrItem[] =
    pssrChecklist?.items?.length
      ? pssrChecklist.items.map((it) => ({ label: it.label, verdict: (it.verdict as Verdict) || "", note: it.note }))
      : [
          ...BASE_PSSR_ITEMS,
          ...hazardCategories.map((h) => `Controls for ${HAZARD_LABEL[h] ?? h} verified`)
        ].map((label) => ({ label, verdict: "" as const }));

  const [items, setItems] = useState<PssrItem[]>(initialItems);
  const [outcome, setOutcome] = useState<string>(pssrChecklist?.outcome ?? "go");

  const completed = !!pssrChecklist?.completedAt;
  const allAnswered = items.every((it) => it.verdict);

  async function submit() {
    if (!allAnswered) {
      toast({ variant: "error", title: "Every checklist item needs a verdict." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/moc/change-requests/${crId}/pssr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, outcome })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: "error", title: "Couldn't save PSSR", description: j.error || j.detail });
        setBusy(false);
        return;
      }
      toast({ variant: "success", title: "PSSR recorded", description: PSSR_OUTCOME_LABEL[outcome] });
      router.refresh();
      setBusy(false);
    } catch {
      toast({ variant: "error", title: "Network error" });
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {pssrRequired ? "Required before closure." : "Optional for this classification."}
        </span>
        {completed && (
          <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 size={12} /> {PSSR_OUTCOME_LABEL[pssrChecklist?.outcome ?? ""] ?? "Completed"} · {fmt(pssrChecklist?.completedAt ?? null)}
          </span>
        )}
      </div>

      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="rounded-lg border border-slate-200 p-2.5">
            <div className="mb-2 text-sm text-slate-800">{it.label}</div>
            <div className="flex items-center gap-1.5">
              {VERDICTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  disabled={readOnly || completed}
                  onClick={() => setItems(items.map((x, j) => (j === i ? { ...x, verdict: v } : x)))}
                  className={cn(
                    "rounded border px-2.5 py-1 text-xs font-medium capitalize disabled:opacity-60",
                    it.verdict === v ? VERDICT_STYLE[v] : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {!completed && !readOnly && (
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="rounded-lg border border-slate-300 p-2 text-sm">
            {PSSR_OUTCOMES.map((o) => (
              <option key={o} value={o}>{PSSR_OUTCOME_LABEL[o]}</option>
            ))}
          </select>
          <Button size="sm" disabled={busy || !allAnswered} onClick={submit}>
            {busy ? "Saving…" : "Record PSSR"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Post-implementation effectiveness review ─────────────────────────────────
export function EffectivenessPanel({
  crId,
  effectivenessReview,
  readOnly
}: {
  crId: string;
  effectivenessReview: EffReview;
  readOnly: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [effective, setEffective] = useState(effectivenessReview?.effective ?? true);
  const [newRisks, setNewRisks] = useState(effectivenessReview?.newRisks ?? false);
  const [notes, setNotes] = useState(effectivenessReview?.notes ?? "");
  const [cadenceDays, setCadenceDays] = useState(String(effectivenessReview?.cadenceDays ?? 30));

  const reviewed = !!effectivenessReview?.reviewedAt;

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch(`/api/moc/change-requests/${crId}/effectiveness-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ effective, newRisks, notes: notes.trim() || null, cadenceDays: Number(cadenceDays) })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: "error", title: "Couldn't save review", description: j.error || j.detail });
        setBusy(false);
        return;
      }
      toast({ variant: "success", title: "Effectiveness review recorded" });
      router.refresh();
      setBusy(false);
    } catch {
      toast({ variant: "error", title: "Network error" });
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {reviewed && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Last reviewed {fmt(effectivenessReview?.reviewedAt ?? null)} — {effective ? "effective" : "not effective"}
          {newRisks ? ", new risks noted" : ""}.
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm text-slate-700">
          <span className="mb-1 block text-xs font-medium text-slate-500">Was the change effective?</span>
          <select value={effective ? "yes" : "no"} onChange={(e) => setEffective(e.target.value === "yes")} disabled={readOnly} className="w-full rounded-lg border border-slate-300 p-2 text-sm">
            <option value="yes">Yes — objectives met</option>
            <option value="no">No — objectives not met</option>
          </select>
        </label>
        <label className="text-sm text-slate-700">
          <span className="mb-1 block text-xs font-medium text-slate-500">Review cadence</span>
          <select value={cadenceDays} onChange={(e) => setCadenceDays(e.target.value)} disabled={readOnly} className="w-full rounded-lg border border-slate-300 p-2 text-sm">
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={newRisks} onChange={(e) => setNewRisks(e.target.checked)} disabled={readOnly} className="h-4 w-4" />
        New risks or side-effects observed since implementation
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-slate-500">Notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={readOnly} rows={3} className="w-full rounded-lg border border-slate-300 p-2 text-sm" placeholder="Observations, follow-ups, residual concerns…" />
      </label>
      {!readOnly && (
        <Button size="sm" disabled={busy} onClick={submit}>
          {busy ? "Saving…" : reviewed ? "Update review" : "Record review"}
        </Button>
      )}
    </div>
  );
}
