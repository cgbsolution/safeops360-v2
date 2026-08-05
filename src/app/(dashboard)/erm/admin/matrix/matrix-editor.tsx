"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
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
        <Button type="button" onClick={onSave} disabled={busy} className="gap-1.5">
          <Save size={16} /> {busy ? "Working…" : "Save matrix"}
        </Button>
      </div>

      {/* 1. Likelihood */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">1 · Likelihood scale</h3>
        <div className="overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 text-slate-500">Level</TableHead>
                <TableHead className="text-slate-500">Label</TableHead>
                <TableHead className="text-slate-500">Probability guide</TableHead>
                <TableHead className="text-slate-500">Frequency guide</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {likelihood.map((l) => (
                <TableRow key={l.level}>
                  <TableCell className="text-center text-base font-bold tabular-nums">{l.level}</TableCell>
                  <TableCell>
                    <Input
                      value={l.label}
                      onChange={(e) => setLikelihoodField(l.level, "label", e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={l.probabilityGuide}
                      onChange={(e) => setLikelihoodField(l.level, "probabilityGuide", e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={l.frequencyGuide}
                      onChange={(e) => setLikelihoodField(l.level, "frequencyGuide", e.target.value)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* 2. Impact descriptors */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">2 · Impact descriptors</h3>
        <p className="mb-3 text-xs text-slate-500">
          One descriptor per dimension × level. Edit the Financial row to set the ₹ bands.
        </p>
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-44 text-slate-500">Dimension</TableHead>
                {LEVELS.map((lvl) => (
                  <TableHead key={lvl} className="text-center text-slate-500">
                    Level {lvl}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {IMPACT_DIMENSIONS.map((dim) => (
                <TableRow key={dim}>
                  <TableCell className="text-xs font-medium">{DIMENSION_LABEL[dim]}</TableCell>
                  {LEVELS.map((lvl) => (
                    <TableCell key={lvl}>
                      <Textarea
                        rows={2}
                        value={descriptorFor(dim, lvl)}
                        onChange={(e) => setImpactDescriptor(dim, lvl, e.target.value)}
                        className="min-w-[120px] resize-y text-xs"
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
          <Table className="min-w-[520px]">
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-500">Band</TableHead>
                <TableHead className="w-28 text-slate-500">Min score</TableHead>
                <TableHead className="w-28 text-slate-500">Max score</TableHead>
                <TableHead className="text-slate-500">Colour</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bands.map((b, i) => (
                <TableRow key={b.name}>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 rounded ring-1 ring-inset ring-slate-200" style={{ backgroundColor: b.colorHex }} />
                      <span className="font-semibold text-slate-700">{b.name}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      max={25}
                      value={b.minScore}
                      onChange={(e) => setBandField(i, { minScore: Number(e.target.value) })}
                      className="w-20 tabular-nums"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      max={25}
                      value={b.maxScore}
                      onChange={(e) => setBandField(i, { maxScore: Number(e.target.value) })}
                      className="w-20 tabular-nums"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {/* type=color has no Input equivalent — native swatch control, left raw */}
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Confirm re-band</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setConfirm(null)}
                aria-label="Close"
                className="h-8 w-8 text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </Button>
            </div>
            <p className="text-sm text-slate-700">{confirm.message}</p>
            <p className="mt-2 text-xs text-slate-500">
              Scores are unchanged; only bands recalculate. The matrix version will increment.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={persist} disabled={busy}>
                {busy ? "Saving…" : `Re-band & save${confirm.affected ? ` (${confirm.affected})` : ""}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
