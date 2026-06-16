"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Save, X } from "lucide-react";
import {
  DIMENSION_LABEL,
  IMPACT_DIMENSIONS,
  type ScoringMatrix,
} from "@/app/(dashboard)/erm/lib";

type Likelihood = ScoringMatrix["likelihoodLevels"][number];
type Impact = ScoringMatrix["impactLevels"][number];
type RatingBand = ScoringMatrix["ratingBands"][number];

const LEVELS = [1, 2, 3, 4, 5];
const BAND_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function MatrixEditor({ matrix }: { matrix: ScoringMatrix }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [name] = useState(matrix.name);

  const [likelihood, setLikelihood] = useState<Likelihood[]>(() =>
    [...matrix.likelihoodLevels].sort((a, b) => a.level - b.level),
  );
  const [impact, setImpact] = useState<Impact[]>(() => [...matrix.impactLevels]);
  const [bands, setBands] = useState<RatingBand[]>(() =>
    [...matrix.ratingBands].sort((a, b) => BAND_ORDER.indexOf(a.name) - BAND_ORDER.indexOf(b.name)),
  );

  const [confirm, setConfirm] = useState<null | { message: string; affected: number }>(null);

  // ── Band-threshold change detection (triggers re-band preview) ──────────────
  const bandsChanged = useMemo(() => {
    const orig = new Map(matrix.ratingBands.map((b) => [b.name, b]));
    return bands.some((b) => {
      const o = orig.get(b.name);
      return !o || o.minScore !== b.minScore || o.maxScore !== b.maxScore;
    });
  }, [bands, matrix.ratingBands]);

  function setImpactDescriptor(dimension: string, level: number, value: string) {
    setImpact((prev) => {
      const idx = prev.findIndex((x) => x.dimension === dimension && x.level === level);
      if (idx === -1) return [...prev, { level, dimension, label: "", descriptor: value }];
      const next = [...prev];
      next[idx] = { ...next[idx], descriptor: value };
      return next;
    });
  }

  function descriptorFor(dimension: string, level: number) {
    return impact.find((x) => x.dimension === dimension && x.level === level)?.descriptor ?? "";
  }

  function setLikelihoodField(level: number, field: "label" | "probabilityGuide" | "frequencyGuide", value: string) {
    setLikelihood((prev) => prev.map((l) => (l.level === level ? { ...l, [field]: value } : l)));
  }

  function setBandField(idx: number, patch: Partial<RatingBand>) {
    setBands((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  }

  async function persist() {
    setBusy(true);
    try {
      const res = await fetch(`/api/erm/matrix/${matrix.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          likelihoodLevels: likelihood,
          impactLevels: impact,
          ratingBands: bands,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.detail || j.error || `Failed (${res.status})`);
        return;
      }
      setConfirm(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    // If band thresholds changed, fetch the re-band preview and confirm first.
    if (bandsChanged) {
      setBusy(true);
      try {
        const res = await fetch(`/api/erm/matrix/${matrix.id}/reband-preview`);
        if (res.ok) {
          const j = (await res.json()) as { affectedAssessments: number; message: string };
          setConfirm({ message: j.message, affected: j.affectedAssessments });
          return;
        }
        // Preview failed — fall through to a generic confirm.
        setConfirm({
          message: "Band thresholds changed. Existing assessments will be re-banded; scores are unchanged.",
          affected: 0,
        });
      } finally {
        setBusy(false);
      }
      return;
    }
    await persist();
  }

  return (
    <div className="space-y-5">
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-900">{matrix.name}</h2>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              v{matrix.version}
            </span>
            {matrix.isDefault && (
              <span className="rounded border border-primary-200 bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
                Default
              </span>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            <Info size={13} /> Overall impact = MAX across scored dimensions (conservative by design). Version bumps when
            band thresholds change.
          </p>
        </div>
        <button
          onClick={onSave}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
        >
          <Save size={16} /> {busy ? "Working…" : "Save matrix"}
        </button>
      </div>

      {/* 1. Likelihood */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">1 · Likelihood scale</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-2 py-1.5 w-14">Level</th>
                <th className="px-2 py-1.5">Label</th>
                <th className="px-2 py-1.5">Probability guide</th>
                <th className="px-2 py-1.5">Frequency guide</th>
              </tr>
            </thead>
            <tbody>
              {likelihood.map((l) => (
                <tr key={l.level} className="border-t border-slate-100">
                  <td className="px-2 py-1.5 text-center text-base font-bold tabular-nums text-slate-700">{l.level}</td>
                  <td className="px-2 py-1.5">
                    <input
                      value={l.label}
                      onChange={(e) => setLikelihoodField(l.level, "label", e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-1.5 text-sm"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      value={l.probabilityGuide}
                      onChange={(e) => setLikelihoodField(l.level, "probabilityGuide", e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-1.5 text-sm"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      value={l.frequencyGuide}
                      onChange={(e) => setLikelihoodField(l.level, "frequencyGuide", e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-1.5 text-sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Impact descriptors */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">2 · Impact descriptors</h3>
        <p className="mb-3 text-xs text-slate-500">
          One descriptor per dimension × level. Edit the Financial row to set the ₹ bands.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-2 py-1.5 w-44">Dimension</th>
                {LEVELS.map((lvl) => (
                  <th key={lvl} className="px-2 py-1.5 text-center">
                    Level {lvl}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {IMPACT_DIMENSIONS.map((dim) => (
                <tr key={dim} className="border-t border-slate-100 align-top">
                  <td className="px-2 py-2 text-xs font-medium text-slate-700">{DIMENSION_LABEL[dim]}</td>
                  {LEVELS.map((lvl) => (
                    <td key={lvl} className="px-1 py-2">
                      <textarea
                        rows={2}
                        value={descriptorFor(dim, lvl)}
                        onChange={(e) => setImpactDescriptor(dim, lvl, e.target.value)}
                        className="w-full min-w-[120px] resize-y rounded-lg border border-slate-300 p-1.5 text-xs"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Rating bands */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">3 · Rating bands</h3>
        <p className="mb-3 flex items-center gap-1 text-xs text-amber-600">
          <Info size={13} /> Changing min/max thresholds re-bands existing assessments (scores stay the same) and bumps
          the matrix version.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-2 py-1.5">Band</th>
                <th className="px-2 py-1.5 w-28">Min score</th>
                <th className="px-2 py-1.5 w-28">Max score</th>
                <th className="px-2 py-1.5">Colour</th>
              </tr>
            </thead>
            <tbody>
              {bands.map((b, i) => (
                <tr key={b.name} className="border-t border-slate-100">
                  <td className="px-2 py-1.5">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 rounded ring-1 ring-inset ring-slate-200" style={{ backgroundColor: b.colorHex }} />
                      <span className="font-semibold text-slate-700">{b.name}</span>
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min={1}
                      max={25}
                      value={b.minScore}
                      onChange={(e) => setBandField(i, { minScore: Number(e.target.value) })}
                      className="w-20 rounded-lg border border-slate-300 p-1.5 text-sm tabular-nums"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min={1}
                      max={25}
                      value={b.maxScore}
                      onChange={(e) => setBandField(i, { maxScore: Number(e.target.value) })}
                      className="w-20 rounded-lg border border-slate-300 p-1.5 text-sm tabular-nums"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={b.colorHex}
                        onChange={(e) => setBandField(i, { colorHex: e.target.value })}
                        className="h-8 w-12 cursor-pointer rounded border border-slate-300"
                      />
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono text-slate-600">
                        {b.colorHex}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Confirm re-band</h2>
              <button onClick={() => setConfirm(null)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-700">{confirm.message}</p>
            <p className="mt-2 text-xs text-slate-500">
              Scores are unchanged; only bands recalculate. The matrix version will increment.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={persist}
                disabled={busy}
                className="rounded-lg bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
              >
                {busy ? "Saving…" : `Re-band & save${confirm.affected ? ` (${confirm.affected})` : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
