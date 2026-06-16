"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import {
  ASSESS_METHODS,
  RISK_BAND_CHIP,
  ESG_BAND_CHIP,
  VENDOR_FINDING_CHIP,
  type ScoringConfig,
} from "@/app/(dashboard)/erm/lib-t3";

const METHOD_LABEL: Record<string, string> = {
  SELF_ASSESSMENT: "Self-Assessment",
  DESK_REVIEW: "Desk Review",
  ONSITE_AUDIT: "Onsite Audit",
  THIRD_PARTY_RATING: "Third-Party Rating",
};

const SEVERITIES = ["OBSERVATION", "CONCERN", "CRITICAL_GAP"] as const;

type FindingDraft = { severity: string; description: string; targetCloseDate: string };

/** Weighted score = sum(raw × weightPct) / 5, then mapped to a band by config thresholds. */
function computeBand(
  config: ScoringConfig | undefined,
  scores: Record<string, number>,
): { score: number; band: string | null; colorHex: string | null } {
  if (!config) return { score: 0, band: null, colorHex: null };
  let weighted = 0;
  for (const d of config.domains) {
    const raw = scores[d.domainKey] ?? 0;
    weighted += raw * (d.weightPct ?? 0);
  }
  // raw 1-5, weightPct sums to ~100 → divide by 5 to land on a 0-100 scale
  const score = Math.round((weighted / 5) * 10) / 10;
  let band: string | null = null;
  let colorHex: string | null = null;
  for (const t of config.bandThresholds ?? []) {
    if (score >= t.minScore && score <= t.maxScore) {
      band = t.band;
      colorHex = t.colorHex;
      break;
    }
  }
  return { score, band, colorHex };
}

export function AssessmentModal({
  vendorId,
  scoringConfig,
  onClose,
}: {
  vendorId: string;
  scoringConfig: ScoringConfig[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [lens, setLens] = useState<"RISK" | "ESG">("RISK");
  const [assessmentDate, setAssessmentDate] = useState("");
  const [method, setMethod] = useState<string>("DESK_REVIEW");
  const [validUntil, setValidUntil] = useState("");
  const [summaryNotes, setSummaryNotes] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [findings, setFindings] = useState<FindingDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = useMemo(() => scoringConfig.find((c) => c.lens === lens), [scoringConfig, lens]);

  // Reset domain scores when lens changes (different domain set per lens).
  useEffect(() => {
    setScores({});
    setEvidence({});
  }, [lens]);

  const preview = useMemo(() => computeBand(config, scores), [config, scores]);
  const bandChip = lens === "RISK" ? RISK_BAND_CHIP : ESG_BAND_CHIP;

  function setScore(key: string, raw: number) {
    setScores((prev) => ({ ...prev, [key]: raw }));
  }

  function addFinding() {
    setFindings((prev) => [...prev, { severity: "OBSERVATION", description: "", targetCloseDate: "" }]);
  }
  function updateFinding(i: number, patch: Partial<FindingDraft>) {
    setFindings((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  function removeFinding(i: number) {
    setFindings((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    if (!config) return;
    setBusy(true);
    setError(null);
    const domainScores = config.domains.map((d) => ({
      domainKey: d.domainKey,
      rawScore: scores[d.domainKey] ?? 1,
      weightPct: d.weightPct,
      evidenceNotes: evidence[d.domainKey]?.trim() || undefined,
    }));
    try {
      const res = await fetch(`/api/erm/vendors/${vendorId}/assessments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lens,
          assessmentDate,
          method,
          domainScores,
          summaryNotes: summaryNotes.trim(),
          validUntil,
          findings: findings
            .filter((f) => f.description.trim())
            .map((f) => ({
              severity: f.severity,
              description: f.description.trim(),
              targetCloseDate: f.targetCloseDate || undefined,
            })),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.detail || j.error || `Failed to create assessment (${res.status}).`);
        setBusy(false);
        return;
      }
      onClose();
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Network error creating assessment.");
      setBusy(false);
    }
  }

  const weightTotal = config?.domains.reduce((a, d) => a + (d.weightPct ?? 0), 0) ?? 0;
  const allScored = config ? config.domains.every((d) => scores[d.domainKey] != null) : false;
  const valid = !!config && assessmentDate && validUntil && allScored;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">New Vendor Assessment</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Lens selector */}
        <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
          {(["RISK", "ESG"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLens(l)}
              className={
                "rounded-md px-4 py-1.5 transition-all " +
                (lens === l ? "bg-white text-primary-700 shadow-sm" : "text-slate-500 hover:text-slate-700")
              }
            >
              {l === "RISK" ? "Third-Party Risk" : "ESG Posture"}
            </button>
          ))}
        </div>

        {!config ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            No scoring configuration found for the {lens} lens. Ensure the Tier 3 seed has been run.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Domain rows + live preview */}
            <div className="rounded-lg border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Domains ({lens === "RISK" ? "higher = worse" : "higher = better"})
                </span>
                <span className="text-[11px] text-slate-400">Weights total {weightTotal}%</span>
              </div>
              <div className="divide-y divide-slate-100">
                {config.domains.map((d) => (
                  <div key={d.domainKey} className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-800">{d.label}</div>
                        {d.guidance && <div className="truncate text-[11px] text-slate-400">{d.guidance}</div>}
                      </div>
                      <span className="w-12 flex-shrink-0 text-right text-[11px] tabular-nums text-slate-500">{d.weightPct}%</span>
                      <select
                        value={scores[d.domainKey] ?? ""}
                        onChange={(e) => setScore(d.domainKey, Number(e.target.value))}
                        className="w-20 flex-shrink-0 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      >
                        <option value="" disabled>
                          1–5
                        </option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      value={evidence[d.domainKey] ?? ""}
                      onChange={(e) => setEvidence((prev) => ({ ...prev, [d.domainKey]: e.target.value }))}
                      placeholder="Evidence notes (optional)"
                      className="mt-1.5 w-full rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-primary-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Live weighted-score + band preview */}
            <div className="flex items-center justify-between rounded-lg border border-primary-200 bg-primary-50 px-4 py-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Live weighted score</div>
                <div className="text-2xl font-bold tabular-nums text-slate-900">{preview.score}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Predicted band</div>
                {preview.band ? (
                  <span
                    className={
                      "mt-1 inline-block rounded border px-2.5 py-1 text-xs font-semibold " +
                      (bandChip[preview.band] ?? "border-slate-200 bg-slate-100 text-slate-600")
                    }
                  >
                    {preview.band}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">— score all domains —</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Assessment date</label>
                <input
                  type="date"
                  value={assessmentDate}
                  onChange={(e) => setAssessmentDate(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                >
                  {ASSESS_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {METHOD_LABEL[m] ?? m.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Valid until</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Summary notes</label>
              <textarea
                value={summaryNotes}
                onChange={(e) => setSummaryNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* Findings capture */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-slate-600">Findings</label>
                <button
                  type="button"
                  onClick={addFinding}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                >
                  <Plus size={13} /> Add finding
                </button>
              </div>
              {findings.length === 0 ? (
                <p className="text-[11px] text-slate-400">No findings captured.</p>
              ) : (
                <div className="space-y-2">
                  {findings.map((f, i) => (
                    <div key={i} className="rounded-md border border-slate-200 p-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={f.severity}
                          onChange={(e) => updateFinding(i, { severity: e.target.value })}
                          className={
                            "rounded border px-2 py-1 text-[11px] font-semibold outline-none " +
                            (VENDOR_FINDING_CHIP[f.severity] ?? "border-slate-200 bg-slate-100 text-slate-600")
                          }
                        >
                          {SEVERITIES.map((s) => (
                            <option key={s} value={s}>
                              {s.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={f.targetCloseDate}
                          onChange={(e) => updateFinding(i, { targetCloseDate: e.target.value })}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-primary-500"
                          title="Target close date"
                        />
                        <button
                          type="button"
                          onClick={() => removeFinding(i)}
                          className="ml-auto text-slate-400 hover:text-rose-600"
                          aria-label="Remove finding"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <textarea
                        value={f.description}
                        onChange={(e) => updateFinding(i, { description: e.target.value })}
                        rows={2}
                        placeholder="Describe the finding…"
                        className="mt-1.5 w-full rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-primary-500"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !valid}
            className="inline-flex items-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-800 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Create assessment"}
          </button>
        </div>
      </div>
    </div>
  );
}
