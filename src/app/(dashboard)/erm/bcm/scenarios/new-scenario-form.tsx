"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { SCENARIO_CATEGORIES } from "@/app/(dashboard)/erm/lib-p3";
import { IMPACT_DIMENSIONS, DIMENSION_LABEL } from "@/app/(dashboard)/erm/lib";

const CATEGORY_LABEL: Record<string, string> = {
  NATURAL_DISASTER: "Natural Disaster",
  CYBER_ATTACK: "Cyber Attack",
  SUPPLY_DISRUPTION: "Supply Disruption",
  UTILITY_FAILURE: "Utility Failure",
  PANDEMIC_WORKFORCE: "Pandemic / Workforce",
  MARKET_SHOCK: "Market Shock",
  REGULATORY_SHOCK: "Regulatory Shock",
  REPUTATIONAL_EVENT: "Reputational Event",
  GEOPOLITICAL: "Geopolitical",
};

const PROBABILITIES = ["REMOTE", "POSSIBLE", "PLAUSIBLE", "LIKELY"] as const;
// Backend ScenarioUpsert.timeHorizon is a fixed enum — must not be free text.
const TIME_HORIZONS: { value: string; label: string }[] = [
  { value: "0_12_MONTHS", label: "0–12 months" },
  { value: "1_3_YEARS", label: "1–3 years" },
  { value: "3_PLUS_YEARS", label: "3+ years" },
];

type ImpactRow = { dimension: string; estimatedLevel: number; estimateBasisNotes: string };

export function NewScenarioButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} /> New Scenario
      </Button>
      {open && <NewScenarioModal onClose={() => setOpen(false)} router={router} />}
    </>
  );
}

function NewScenarioModal({ onClose, router }: { onClose: () => void; router: ReturnType<typeof useRouter> }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("CYBER_ATTACK");
  const [narrative, setNarrative] = useState("");
  const [probabilityQualitative, setProbabilityQualitative] = useState<string>("POSSIBLE");
  const [timeHorizon, setTimeHorizon] = useState("1_3_YEARS");
  const [impacts, setImpacts] = useState<ImpactRow[]>([
    { dimension: "FINANCIAL", estimatedLevel: 3, estimateBasisNotes: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addImpact() {
    const used = new Set(impacts.map((i) => i.dimension));
    const next = IMPACT_DIMENSIONS.find((d) => !used.has(d)) ?? "FINANCIAL";
    setImpacts((prev) => [...prev, { dimension: next, estimatedLevel: 3, estimateBasisNotes: "" }]);
  }
  function updateImpact(idx: number, patch: Partial<ImpactRow>) {
    setImpacts((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function removeImpact(idx: number) {
    setImpacts((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/erm/bcm/scenarios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category,
          narrative: narrative.trim(),
          probabilityQualitative,
          timeHorizon,
          affectedRiskIds: [],
          affectedProcessIds: [],
          impactEstimates: impacts.map((i) => ({
            dimension: i.dimension,
            estimatedLevel: i.estimatedLevel,
            estimateBasisNotes: i.estimateBasisNotes,
          })),
          whatIfAdjustments: [],
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.detail || j.error || `Failed to create scenario (${res.status}).`);
        setBusy(false);
        return;
      }
      const created = j as { id?: string };
      if (created?.id) {
        router.push(`/erm/bcm/scenarios/${created.id}`);
      } else {
        router.refresh();
        onClose();
      }
    } catch (e: any) {
      setError(e?.message ?? "Network error creating scenario.");
      setBusy(false);
    }
  }

  const valid = title.trim() && narrative.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">New Scenario</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 text-slate-400 hover:text-slate-700"
          >
            <X size={18} />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Ransomware encrypts ERP for 72h"
              className="outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Category</label>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              >
                {SCENARIO_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c] ?? c.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Probability</label>
              <Select
                value={probabilityQualitative}
                onChange={(e) => setProbabilityQualitative(e.target.value)}
                className="outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              >
                {PROBABILITIES.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Time horizon</label>
            <Select
              value={timeHorizon}
              onChange={(e) => setTimeHorizon(e.target.value)}
              className="outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            >
              {TIME_HORIZONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Narrative</label>
            <Textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              rows={3}
              className="p-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              placeholder="Describe how the disruption unfolds and what it affects…"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">Impact estimates</label>
              <Button
                variant="outline"
                onClick={addImpact}
                className="gap-1 rounded px-2 py-1 text-[11px] text-slate-600 hover:border-primary-500"
              >
                <Plus size={12} /> Add dimension
              </Button>
            </div>
            <div className="space-y-2">
              {impacts.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Select
                    value={row.dimension}
                    onChange={(e) => updateImpact(idx, { dimension: e.target.value })}
                    className="w-40 shrink-0 px-2 py-1.5 text-xs outline-none focus:border-primary-500"
                  >
                    {IMPACT_DIMENSIONS.map((d) => (
                      <option key={d} value={d}>
                        {DIMENSION_LABEL[d]}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={row.estimatedLevel}
                    onChange={(e) => updateImpact(idx, { estimatedLevel: Number(e.target.value) })}
                    className="w-16 shrink-0 px-2 py-1.5 text-xs outline-none focus:border-primary-500"
                  >
                    {[1, 2, 3, 4, 5].map((l) => (
                      <option key={l} value={l}>
                        L{l}
                      </option>
                    ))}
                  </Select>
                  <Input
                    value={row.estimateBasisNotes}
                    onChange={(e) => updateImpact(idx, { estimateBasisNotes: e.target.value })}
                    placeholder="Basis / notes"
                    className="flex-1 px-2 py-1.5 text-xs outline-none focus:border-primary-500"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeImpact(idx)}
                    aria-label="Remove"
                    className="h-auto w-auto shrink-0 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="text-slate-700">
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !valid}>
            {busy ? "Creating…" : "Create Scenario"}
          </Button>
        </div>
      </div>
    </div>
  );
}
