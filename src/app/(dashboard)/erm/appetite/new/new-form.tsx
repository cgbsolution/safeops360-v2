"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { APPETITE_LEVEL_CHIP, GAUGE_CHIP, type AppetiteDashRow } from "@/app/(dashboard)/erm/lib-p2";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

const APPETITE_LEVELS = ["AVERSE", "MINIMAL", "CAUTIOUS", "OPEN", "SEEKING"] as const;

const BAND_TYPES = [
  "MAX_RESIDUAL_SCORE",
  "MAX_CRITICAL_COUNT",
  "MAX_HIGH_PLUS_COUNT",
  "MAX_RED_KRI_COUNT",
] as const;

const BAND_LABEL: Record<string, string> = {
  MAX_RESIDUAL_SCORE: "Max residual score",
  MAX_CRITICAL_COUNT: "Max critical risks",
  MAX_HIGH_PLUS_COUNT: "Max high+ risks",
  MAX_RED_KRI_COUNT: "Max red KRIs",
};

type BandRow = { bandType: string; thresholdValue: number };

export function NewStatementForm({ row }: { row: AppetiteDashRow }) {
  const router = useRouter();
  const [statementText, setStatementText] = useState("");
  const [appetiteLevel, setAppetiteLevel] = useState<string>("CAUTIOUS");
  const [bands, setBands] = useState<BandRow[]>([{ bandType: "MAX_RESIDUAL_SCORE", thresholdValue: 0 }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function observedFor(bandType: string): number | null {
    const g = row.gauges.find((x) => x.bandType === bandType);
    return g ? g.observedValue : null;
  }
  function stateFor(bandType: string): string | null {
    const g = row.gauges.find((x) => x.bandType === bandType);
    return g ? g.state : null;
  }

  function addBand() {
    const used = new Set(bands.map((b) => b.bandType));
    const next = BAND_TYPES.find((t) => !used.has(t)) ?? BAND_TYPES[0];
    setBands((p) => [...p, { bandType: next, thresholdValue: 0 }]);
  }
  function removeBand(i: number) {
    setBands((p) => p.filter((_, idx) => idx !== i));
  }
  function updateBand(i: number, patch: Partial<BandRow>) {
    setBands((p) => p.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  async function create() {
    if (!statementText.trim()) {
      setErr("Enter the appetite statement text.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/erm/appetite/statements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          categoryId: row.categoryId,
          statementText,
          appetiteLevel,
          toleranceBands: bands.map((b) => ({
            bandType: b.bandType,
            thresholdValue: Number(b.thresholdValue),
          })),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j.detail || j.error || `Failed (${res.status})`);
        return;
      }
      if (j?.id) router.push(`/erm/appetite/${j.id}`);
      else router.push("/erm/appetite");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-none">
      <div className="flex items-center gap-2">
        <span className="h-4 w-4 rounded" style={{ backgroundColor: row.categoryColor ?? "#64748b" }} />
        <h2 className="text-base font-semibold text-slate-900">{row.categoryName ?? row.categoryCode}</h2>
      </div>

      {err && (
        <Alert variant="destructive" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{err}</Alert>
      )}

      <div>
        <Label className="mb-1 block text-xs font-medium text-slate-600">Statement text</Label>
        <Textarea
          value={statementText}
          onChange={(e) => setStatementText(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          placeholder="The board accepts a CAUTIOUS appetite for…" />
      </div>

      <div>
        <Label className="mb-1 block text-xs font-medium text-slate-600">Appetite level</Label>
        <div className="flex flex-wrap gap-1.5">
          {APPETITE_LEVELS.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setAppetiteLevel(lvl)}
              className={
                "rounded border px-2.5 py-1 text-[11px] font-semibold transition-all " +
                (appetiteLevel === lvl
                  ? (APPETITE_LEVEL_CHIP[lvl] ?? "bg-slate-100 text-slate-700 border-slate-300") +
                    " ring-2 ring-offset-1 ring-slate-900/20"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-400")
              }
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs font-medium text-slate-600">Tolerance bands</Label>
          <Button variant="outline"
            type="button"
            onClick={addBand} className="gap-1 rounded-lg px-2 py-1 text-[11px]">
            <Plus size={12} /> Add band
          </Button>
        </div>
        {bands.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400">
            No tolerance bands.
          </p>
        ) : (
          <div className="space-y-2">
            {bands.map((b, i) => {
              const observed = observedFor(b.bandType);
              const state = stateFor(b.bandType);
              return (
                <Card
                  key={i}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 shadow-none">
                  <SelectField
                    value={b.bandType}
                    onChange={(value) => updateBand(i, { bandType: value })}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    options={BAND_TYPES.map((t) => ({ value: t, label: `${BAND_LABEL[t]}` }))}
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-500">≤</span>
                    <Input
                      type="number"
                      value={b.thresholdValue}
                      onChange={(e) => updateBand(i, { thresholdValue: Number(e.target.value) })}
                      className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-xs tabular-nums" />
                  </div>
                  <div className="ml-auto flex items-center gap-2 text-[11px]">
                    <span className="text-slate-400">live observed</span>
                    <span className="font-semibold tabular-nums text-slate-700">
                      {observed != null ? observed : "—"}
                    </span>
                    {state && (
                      <span
                        className={
                          "rounded border px-1.5 py-0.5 text-[10px] font-semibold " +
                          (GAUGE_CHIP[state] ?? "bg-slate-100 text-slate-600 border-slate-200")
                        }
                      >
                        {state}
                      </span>
                    )}
                  </div>
                  <Button variant="ghost"
                    type="button"
                    onClick={() => removeBand(i)}
                    title="Remove band">
                    <Trash2 size={14} />
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t border-slate-100 pt-4">
        <button
          onClick={create}
          disabled={busy}
          className="rounded-lg bg-primary-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create draft statement"}
        </button>
      </div>
    </Card>
  );
}
