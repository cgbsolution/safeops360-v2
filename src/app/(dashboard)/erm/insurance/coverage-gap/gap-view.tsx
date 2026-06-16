"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Printer, ShieldCheck, X } from "lucide-react";
import {
  CLAIM_STATUS_CHIP,
  GAP_TYPE_CHIP,
  inrCompact,
  type CoverageGap,
  type InsuranceDashboard,
} from "@/app/(dashboard)/erm/lib-t3";
import { fmtDate } from "@/app/(dashboard)/erm/lib";

const GAP_TYPES = ["FULLY_COVERED", "PARTIALLY_COVERED", "UNCOVERED", "UNINSURABLE_ACCEPTED"] as const;
const GAP_LABEL: Record<string, string> = {
  FULLY_COVERED: "Fully covered",
  PARTIALLY_COVERED: "Partially covered",
  UNCOVERED: "Uncovered",
  UNINSURABLE_ACCEPTED: "Uninsurable — accepted",
};

type Sub = "assessment" | "claims";
type OpenClaim = InsuranceDashboard["openClaims"][number];

function gapChip(t: string) {
  return (
    <span className={"inline-block rounded border px-2 py-0.5 text-[11px] " + (GAP_TYPE_CHIP[t] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
      {GAP_LABEL[t] ?? t.replace(/_/g, " ")}
    </span>
  );
}

export function GapView({ gaps, openClaims }: { gaps: CoverageGap[]; openClaims: OpenClaim[] }) {
  const router = useRouter();
  const [sub, setSub] = useState<Sub>("assessment");
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [raising, setRaising] = useState<string | null>(null);

  // Latest assessment = first by reviewDate desc.
  const latest = [...gaps].sort((a, b) => (b.reviewDate ?? "").localeCompare(a.reviewDate ?? ""))[0] ?? null;
  const lines = latest?.lines ?? [];
  const uncoveredCount = latest?.uncoveredCount ?? 0;
  const totalCritical = latest?.totalCriticalRisks ?? 0;

  async function raiseTransfer(riskId: string) {
    setRaising(riskId);
    setBanner(null);
    try {
      const res = await fetch(`/api/erm/insurance/coverage-gap/raise-transfer?riskId=${encodeURIComponent(riskId)}`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setBanner({ kind: "err", msg: j.detail || j.error || `Failed (${res.status}).` }); setRaising(null); return; }
      setBanner({ kind: "ok", msg: "Transfer-strategy treatment (CAPA) raised for the uncovered risk." });
      setRaising(null);
      router.refresh();
    } catch (e: any) { setBanner({ kind: "err", msg: e?.message ?? "Network error." }); setRaising(null); }
  }

  return (
    <div className="space-y-5">
      {banner && (
        <div className={"rounded-lg border px-4 py-2.5 text-sm " + (banner.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800")}>
          {banner.msg}
        </div>
      )}

      {/* Headline + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <p className="text-2xl font-bold text-slate-900">
            <span className={uncoveredCount > 0 ? "text-rose-600" : "text-emerald-600"}>{uncoveredCount}</span> of {totalCritical} critical risks not fully transferred
          </p>
          {latest ? (
            <p className="mt-1 text-xs text-slate-500">
              Latest assessment: <span className="font-medium text-slate-700">{latest.assessmentCycleLabel}</span> · reviewed {fmtDate(latest.reviewDate)}
              {latest.reviewedByName ? ` by ${latest.reviewedByName}` : ""}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">No coverage-gap assessment recorded yet.</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Printer size={15} /> Export
          </button>
          <button onClick={() => setNewOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800">
            <Plus size={16} /> New assessment
          </button>
        </div>
      </div>

      {/* Sub tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        <button
          onClick={() => setSub("assessment")}
          className={"-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors " + (sub === "assessment" ? "border-primary-700 text-primary-700" : "border-transparent text-slate-500 hover:text-slate-700")}
        >
          Coverage assessment
        </button>
        <button
          onClick={() => setSub("claims")}
          className={"-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors " + (sub === "claims" ? "border-primary-700 text-primary-700" : "border-transparent text-slate-500 hover:text-slate-700")}
        >
          Claims log
          {openClaims.length > 0 && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-600">{openClaims.length}</span>}
        </button>
      </div>

      {sub === "assessment" && (
        <>
          {latest?.summaryNotes && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              <span className="font-medium text-slate-700">Summary: </span>{latest.summaryNotes}
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[940px] text-sm">
              <thead className="bg-slate-50/95">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Risk</th>
                  <th className="px-3 py-2.5">Gap type</th>
                  <th className="px-3 py-2.5 text-right">Covered by</th>
                  <th className="px-3 py-2.5">Notes</th>
                  <th className="px-3 py-2.5">Recommended action</th>
                  <th className="px-3 py-2.5 text-right">Transfer</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-400">
                      No lines in the latest assessment. Use “New assessment” to map critical risks against cover.
                    </td>
                  </tr>
                ) : (
                  lines.map((ln) => {
                    const highlight = ln.gapType === "UNCOVERED" || ln.gapType === "PARTIALLY_COVERED";
                    return (
                      <tr key={ln.riskId} className={"border-t border-slate-100 align-top " + (highlight ? "bg-rose-50/60" : "hover:bg-slate-50/70")}>
                        <td className="px-3 py-2.5">
                          <span className="font-medium text-slate-800">{ln.riskCode ?? ln.riskId.slice(0, 8)}</span>
                          {ln.title && <span className="block max-w-[220px] truncate text-xs text-slate-500">{ln.title}</span>}
                          {ln.residualBand && (
                            <span className="mt-0.5 inline-block rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">{ln.residualBand}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">{gapChip(ln.gapType)}</td>
                        <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">{ln.coveredByPolicyIds.length}</td>
                        <td className="max-w-[240px] px-3 py-2.5 text-xs text-slate-600">{ln.gapNotes || "—"}</td>
                        <td className="max-w-[200px] px-3 py-2.5 text-xs text-slate-600">{ln.recommendedAction || "—"}</td>
                        <td className="px-3 py-2.5 text-right">
                          {highlight ? (
                            <button
                              onClick={() => raiseTransfer(ln.riskId)}
                              disabled={raising === ln.riskId}
                              className="inline-flex items-center gap-1 rounded-md bg-primary-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-primary-800 disabled:opacity-50"
                            >
                              <ShieldCheck size={12} /> {raising === ln.riskId ? "Raising…" : "Raise transfer"}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {sub === "claims" && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Open claims log</h2>
          <p className="mb-3 text-xs text-slate-500">Aggregate of open claims across the portfolio. Individual claims are managed on each policy&rsquo;s detail page.</p>
          {openClaims.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No open claims.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-slate-50/95">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2">Claim</th>
                    <th className="px-3 py-2">Policy</th>
                    <th className="px-3 py-2 text-right">Claimed</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {openClaims.map((c) => (
                    <tr key={c.claimCode} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="px-3 py-2 font-medium text-slate-800">{c.claimCode}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{c.policyCode ?? "—"}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-700">{inrCompact(c.claimedAmountInr)}</td>
                      <td className="px-3 py-2">
                        <span className={"inline-block rounded border px-2 py-0.5 text-[11px] " + (CLAIM_STATUS_CHIP[c.status] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
                          {c.status.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {newOpen && (
        <NewAssessmentModal
          onClose={() => setNewOpen(false)}
          onDone={() => { setNewOpen(false); setBanner({ kind: "ok", msg: "Coverage-gap assessment recorded." }); router.refresh(); }}
        />
      )}
    </div>
  );
}

// ── New assessment modal — a line per critical risk ───────────────────────────
type RiskRow = { riskId: string; riskCode: string; title: string; residualBand: string | null };
type LineState = { isInsurable: boolean; gapType: string; gapNotes: string; recommendedAction: string };

function NewAssessmentModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [risks, setRisks] = useState<RiskRow[]>([]);
  const [risksError, setRisksError] = useState<string | null>(null);
  const [assessmentCycleLabel, setAssessmentCycleLabel] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [summaryNotes, setSummaryNotes] = useState("");
  const [lines, setLines] = useState<Record<string, LineState>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/erm/insurance/coverage-gap/risks")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        if (cancelled) return;
        const rows: RiskRow[] = (d ?? []).map((x: any) => ({ riskId: x.riskId, riskCode: x.riskCode, title: x.title, residualBand: x.residualBand ?? null }));
        setRisks(rows);
        const init: Record<string, LineState> = {};
        rows.forEach((r) => { init[r.riskId] = { isInsurable: true, gapType: "UNCOVERED", gapNotes: "", recommendedAction: "" }; });
        setLines(init);
      })
      .catch((e: Error) => { if (!cancelled) setRisksError(e.message); });
    return () => { cancelled = true; };
  }, []);

  function update(riskId: string, patch: Partial<LineState>) {
    setLines((prev) => ({ ...prev, [riskId]: { ...prev[riskId], ...patch } }));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    // UNINSURABLE_ACCEPTED lines need a note.
    const missingNote = risks.find((r) => lines[r.riskId]?.gapType === "UNINSURABLE_ACCEPTED" && !lines[r.riskId]?.gapNotes.trim());
    if (missingNote) {
      setError(`Risk ${missingNote.riskCode} is marked uninsurable-accepted — a justification note is required.`);
      setBusy(false);
      return;
    }
    const payloadLines = risks.map((r) => {
      const ls = lines[r.riskId];
      return {
        riskId: r.riskId,
        isInsurable: ls.gapType === "UNINSURABLE_ACCEPTED" ? false : ls.isInsurable,
        coveredByPolicyIds: [] as string[],
        gapType: ls.gapType,
        gapNotes: ls.gapNotes.trim(),
        recommendedAction: ls.recommendedAction.trim() || null,
      };
    });
    try {
      const res = await fetch("/api/erm/insurance/coverage-gap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assessmentCycleLabel: assessmentCycleLabel.trim(),
          reviewDate,
          lines: payloadLines,
          summaryNotes: summaryNotes.trim(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.detail || j.error || `Failed (${res.status}).`); setBusy(false); return; }
      onDone();
    } catch (e: any) { setError(e?.message ?? "Network error."); setBusy(false); }
  }

  const valid = assessmentCycleLabel.trim() && reviewDate && risks.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">New coverage-gap assessment</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Assessment cycle label</label>
              <input value={assessmentCycleLabel} onChange={(e) => setAssessmentCycleLabel(e.target.value)} placeholder="e.g. FY2026-27 Annual" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Review date</label>
              <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Risk lines</label>
            {risksError ? (
              <p className="text-xs text-rose-600">Failed to load critical risks: {risksError}</p>
            ) : risks.length === 0 ? (
              <p className="text-xs text-slate-400">No critical risks returned.</p>
            ) : (
              <div className="max-h-[40vh] space-y-2 overflow-y-auto rounded-md border border-slate-200 p-2">
                {risks.map((r) => {
                  const ls = lines[r.riskId];
                  if (!ls) return null;
                  const needsNote = ls.gapType === "UNINSURABLE_ACCEPTED";
                  return (
                    <div key={r.riskId} className="rounded-md border border-slate-200 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-800">
                          {r.riskCode} <span className="text-xs font-normal text-slate-500">{r.title}</span>
                        </span>
                        {r.residualBand && <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">{r.residualBand}</span>}
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <select value={ls.gapType} onChange={(e) => update(r.riskId, { gapType: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-primary-500">
                          {GAP_TYPES.map((g) => (
                            <option key={g} value={g}>{GAP_LABEL[g]}</option>
                          ))}
                        </select>
                        <input value={ls.recommendedAction} onChange={(e) => update(r.riskId, { recommendedAction: e.target.value })} placeholder="Recommended action (optional)" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-primary-500" />
                      </div>
                      <input
                        value={ls.gapNotes}
                        onChange={(e) => update(r.riskId, { gapNotes: e.target.value })}
                        placeholder={needsNote ? "Justification (required for uninsurable-accepted)" : "Gap notes"}
                        className={"mt-2 w-full rounded-md border px-2 py-1.5 text-sm outline-none focus:border-primary-500 " + (needsNote && !ls.gapNotes.trim() ? "border-rose-300" : "border-slate-300")}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Summary notes</label>
            <textarea value={summaryNotes} onChange={(e) => setSummaryNotes(e.target.value)} rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
          </div>

          {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={busy || !valid} className="inline-flex items-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50">
            {busy ? "Saving…" : "Save assessment"}
          </button>
        </div>
      </div>
    </div>
  );
}
