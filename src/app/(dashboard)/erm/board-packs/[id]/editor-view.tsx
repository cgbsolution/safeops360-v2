"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Printer, Save, CheckCircle2, Settings2 } from "lucide-react";
import { HeatMap, KpiTile, BandBadge, TrendArrow } from "@/components/erm/shared";
import { fmtDate } from "@/app/(dashboard)/erm/lib";
import type { BoardPackRender, BoardPackPhase2, BoardPackPhase3 } from "./page";
import type { Tier3Summary } from "@/app/(dashboard)/erm/lib-t3";

const READINESS_HEX: Record<string, string> = { NO_PLAN: "#C0392B", PLAN_EXISTS: "#E6A817", PLAN_TESTED: "#2E8B57" };
const SIGNAL_HEX: Record<string, string> = { STRONG: "#C0392B", EMERGING: "#E6A817", WEAK: "#94a3b8" };
const PROB_LBL: Record<string, string> = { REMOTE: "Remote", POSSIBLE: "Possible", PLAUSIBLE: "Plausible", LIKELY: "Likely" };

const P2_HEX: Record<string, string> = { GREEN: "#2E8B57", AMBER: "#E6A817", RED: "#C0392B", NO_DATA: "#94a3b8" };
function inrL(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)} Cr`;
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(1)} L`;
  return `₹${v.toLocaleString("en-IN")}`;
}

// Section key → label. Order matters: this drives both the toggle list and
// the rendered preview order.
const SECTION_DEFS: { key: string; label: string }[] = [
  { key: "executiveSummary", label: "Executive Summary" },
  { key: "heatMap", label: "Heat Map (Inherent vs Residual)" },
  { key: "top10", label: "Top 10 Risks" },
  { key: "movement", label: "Band Movement" },
  { key: "treatmentStatus", label: "Treatment Status" },
  { key: "newRisks", label: "New Risks This Quarter" },
  { key: "escalations", label: "Escalations & Acceptances" },
  { key: "kriStatus", label: "KRI Status Summary" },
  { key: "appetiteCompliance", label: "Appetite Compliance" },
  { key: "lossSummary", label: "Loss Summary" },
  { key: "complianceStatus", label: "Compliance Status" },
  { key: "bcmReadiness", label: "Business Continuity Readiness" },
  { key: "scenarioResilience", label: "Scenario Resilience" },
  { key: "horizonScan", label: "Horizon Scan" },
  { key: "controlsStatus", label: "Internal Controls Status" },
  { key: "insuranceTransfer", label: "Insurance & Risk Transfer" },
  { key: "valueChainEsg", label: "Value-Chain ESG" },
];

function inrCr(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(2)} Cr`;
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)} L`;
  return `₹${v.toLocaleString("en-IN")}`;
}

const FOOTER_TEXT = "Confidential — Board & Risk Management Committee";

export function BoardPackEditor({ packId, initial, phase2, phase3, tier3 }: { packId: string; initial: BoardPackRender; phase2?: BoardPackPhase2 | null; phase3?: BoardPackPhase3 | null; tier3?: Tier3Summary | null }) {
  const router = useRouter();
  const { summary, topRisks, movement, newRisks, escalations, acceptanceLog, tenantName } = initial;

  const [title] = useState(initial.pack.title);
  const [quarterLabel] = useState(initial.pack.quarterLabel);
  const [status, setStatus] = useState(initial.pack.status);
  const [sections, setSections] = useState<Record<string, boolean>>(() => {
    const base: Record<string, boolean> = {};
    for (const s of SECTION_DEFS) base[s.key] = initial.pack.sections?.[s.key] ?? true;
    return base;
  });
  const [commentary, setCommentary] = useState<Record<string, string>>(
    () => ({ ...(initial.pack.commentary ?? {}) }),
  );

  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const top10 = useMemo(() => topRisks.slice(0, 10), [topRisks]);

  function toggleSection(key: string) {
    setSections((s) => ({ ...s, [key]: !s[key] }));
    setSaved(false);
  }

  function setComment(riskId: string, html: string) {
    setCommentary((c) => ({ ...c, [riskId]: html }));
    setSaved(false);
  }

  async function persist() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/erm/board-packs/${packId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, quarterLabel, sections, commentary }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.detail || j.error || `Failed to save (${res.status}).`);
        setBusy(false);
        return;
      }
      setSaved(true);
      setBusy(false);
    } catch (e: any) {
      setError(e?.message ?? "Network error saving pack.");
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      // Persist latest config first so the published snapshot reflects edits.
      await fetch(`/api/erm/board-packs/${packId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, quarterLabel, sections, commentary }),
      });
      const res = await fetch(`/api/erm/board-packs/${packId}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.detail || j.error || `Failed to publish (${res.status}).`);
        setBusy(false);
        return;
      }
      setStatus((j as { status?: string })?.status ?? "PUBLISHED");
      setBusy(false);
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Network error publishing pack.");
      setBusy(false);
    }
  }

  const openTreatments = summary.openTreatments;

  return (
    <div className="flex flex-col gap-5 lg:flex-row print:block">
      {/* ── Config panel (screen only) ───────────────────────────────── */}
      <aside className="w-full shrink-0 space-y-4 lg:w-80 print:hidden">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <Settings2 size={16} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">Pack Sections</h2>
          </div>
          <div className="space-y-2">
            {SECTION_DEFS.map((s) => (
              <label key={s.key} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={!!sections[s.key]}
                  onChange={() => toggleSection(s.key)}
                  className="h-4 w-4 rounded border-slate-300 text-primary-700 focus:ring-primary-500"
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Top-10 Commentary</h2>
          <p className="mb-3 text-xs text-slate-500">
            Board narrative shown beneath each top risk in the printed pack.
          </p>
          <div className="space-y-3">
            {top10.map((r) => (
              <div key={r.id}>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                  {r.riskCode} — {r.title}
                </label>
                <textarea
                  value={commentary[r.id] ?? ""}
                  onChange={(e) => setComment(r.id, e.target.value)}
                  rows={2}
                  placeholder="Add board commentary…"
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>
            ))}
            {top10.length === 0 && (
              <p className="text-xs text-slate-400">No top risks to annotate.</p>
            )}
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-5">
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {error}
            </div>
          )}
          {saved && !error && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Saved.
            </div>
          )}
          <button
            onClick={persist}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Save size={16} /> {busy ? "Saving…" : "Save Config"}
          </button>
          <button
            onClick={publish}
            disabled={busy || status === "PUBLISHED"}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckCircle2 size={16} /> {status === "PUBLISHED" ? "Published" : "Publish Pack"}
          </button>
          <button
            onClick={() => window.print()}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-800"
          >
            <Printer size={16} /> Print / Save as PDF
          </button>
          <div className="pt-1 text-center text-[11px] text-slate-400">
            {quarterLabel} · Status:{" "}
            <span className={status === "PUBLISHED" ? "font-semibold text-emerald-600" : "text-slate-500"}>
              {status}
            </span>
          </div>
        </div>
      </aside>

      {/* ── Print-optimised preview pane ──────────────────────────────── */}
      <main className="min-w-0 flex-1">
        <PrintStyles />
        <div className="board-pack mx-auto max-w-[1100px] rounded-xl border border-slate-200 bg-white p-0 shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none">
          {/* Cover page */}
          <section className="bp-page bp-cover">
            <div className="flex h-full flex-col items-center justify-center gap-6 px-12 py-16 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-700 text-2xl font-bold text-white">
                S360
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                  {tenantName}
                </p>
                <h1 className="mt-3 text-3xl font-bold text-slate-900">{title}</h1>
                <p className="mt-2 text-lg font-medium text-primary-700">{quarterLabel}</p>
              </div>
              <p className="text-xs text-slate-400">
                Generated {fmtDate(initial.generatedAt)} ·{" "}
                {new Date(initial.generatedAt).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="mt-8 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                {FOOTER_TEXT}
              </p>
            </div>
          </section>

          {/* Body sections */}
          <div className="bp-body">
            {sections.executiveSummary && (
              <Section title="Executive Summary">
                <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
                  <KpiTile label="Active Risks" value={summary.totalActiveRisks} />
                  <KpiTile label="Critical (residual)" value={summary.criticalResidual} tone="critical" />
                  <KpiTile label="High (residual)" value={summary.highResidual} tone="high" />
                  <KpiTile label="Open Treatments" value={openTreatments} />
                  <KpiTile label="Escalated (qtr)" value={summary.escalatedThisQuarter} tone="critical" />
                  <KpiTile label="Overdue Reviews" value={summary.overdueReviews} tone="warn" />
                </div>
              </Section>
            )}

            {sections.heatMap && (
              <Section title="Enterprise Heat Map">
                <div className="flex flex-wrap items-start justify-around gap-8">
                  <div className="text-center">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Inherent — before controls
                    </h3>
                    <HeatMap cells={summary.inherentHeatMap} />
                  </div>
                  <div className="text-center">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Residual — after controls
                    </h3>
                    <HeatMap cells={summary.residualHeatMap} />
                  </div>
                </div>
              </Section>
            )}

            {sections.top10 && (
              <Section title="Top 10 Risks (by residual score)">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="px-2 py-2">#</th>
                      <th className="px-2 py-2">Code</th>
                      <th className="px-2 py-2">Title</th>
                      <th className="px-2 py-2">Residual</th>
                      <th className="px-2 py-2">Trend</th>
                      <th className="px-2 py-2">Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100 align-top">
                        <td className="px-2 py-2 font-semibold tabular-nums text-slate-400">{r.rank}</td>
                        <td className="px-2 py-2 font-medium text-slate-800">{r.riskCode}</td>
                        <td className="px-2 py-2 text-slate-700">
                          {r.title}
                          {commentary[r.id]?.trim() && (
                            <p className="mt-1 whitespace-pre-wrap border-l-2 border-primary-200 pl-2 text-[11px] italic text-slate-500">
                              {commentary[r.id]}
                            </p>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <BandBadge band={r.residualBand} score={r.residualScore} />
                        </td>
                        <td className="px-2 py-2">
                          <TrendArrow trend={r.trend} delta={r.trendDelta} />
                        </td>
                        <td className="px-2 py-2 text-xs text-slate-600">{r.riskOwnerName ?? "—"}</td>
                      </tr>
                    ))}
                    {top10.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-2 py-4 text-center text-xs text-slate-400">
                          No risks.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Section>
            )}

            {sections.movement && (
              <Section title="Band Movement This Quarter">
                {movement.length === 0 ? (
                  <p className="text-xs text-slate-400">No band changes this quarter.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                        <th className="px-2 py-2">Code</th>
                        <th className="px-2 py-2">Title</th>
                        <th className="px-2 py-2">From</th>
                        <th className="px-2 py-2">To</th>
                        <th className="px-2 py-2">Direction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movement.map((m) => (
                        <tr key={m.id} className="border-b border-slate-100">
                          <td className="px-2 py-2 font-medium text-slate-800">{m.riskCode}</td>
                          <td className="px-2 py-2 text-slate-700">{m.title}</td>
                          <td className="px-2 py-2">
                            <BandBadge band={m.fromBand} />
                          </td>
                          <td className="px-2 py-2">
                            <BandBadge band={m.toBand} />
                          </td>
                          <td
                            className={
                              "px-2 py-2 text-xs font-semibold " +
                              (m.direction === "UP" ? "text-rose-600" : "text-emerald-600")
                            }
                          >
                            {m.direction === "UP" ? "▲ Worsened" : "▼ Improved"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Section>
            )}

            {sections.treatmentStatus && (
              <Section title="Treatment Status Summary">
                <div className="flex items-center gap-4">
                  <KpiTile label="Open Treatments" value={openTreatments} />
                  <p className="text-sm text-slate-600">
                    {openTreatments === 0
                      ? "All risk treatments are closed — residual positions reflect current control effectiveness."
                      : `${openTreatments} treatment${openTreatments === 1 ? " is" : "s are"} in progress across the register, working to reduce residual exposure toward appetite.`}
                  </p>
                </div>
              </Section>
            )}

            {sections.newRisks && (
              <Section title="New Risks This Quarter">
                {newRisks.length === 0 ? (
                  <p className="text-xs text-slate-400">No new risks identified this quarter.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {newRisks.map((r) => (
                      <li key={r.riskCode} className="flex items-center gap-3 text-sm">
                        <span className="font-medium text-slate-800">{r.riskCode}</span>
                        <span className="flex-1 text-slate-700">{r.title}</span>
                        <BandBadge band={r.residualBand} />
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            )}

            {sections.escalations && (
              <Section title="Escalations & Acceptances">
                <div className="space-y-5">
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Escalations
                    </h3>
                    {escalations.length === 0 ? (
                      <p className="text-xs text-slate-400">No escalations this quarter.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {escalations.map((e) => (
                          <li key={e.riskCode} className="flex items-center gap-3 text-sm">
                            <span className="font-medium text-slate-800">{e.riskCode}</span>
                            <span className="flex-1 text-slate-700">{e.title}</span>
                            <BandBadge band={e.residualBand} />
                            <span className="text-xs text-slate-400">{fmtDate(e.escalatedAt)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Acceptance Log
                    </h3>
                    {acceptanceLog.length === 0 ? (
                      <p className="text-xs text-slate-400">No formally accepted risks this period.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                            <th className="px-2 py-2">Code</th>
                            <th className="px-2 py-2">Justification</th>
                            <th className="px-2 py-2">Accepted By</th>
                            <th className="px-2 py-2">Accepted At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {acceptanceLog.map((a) => (
                            <tr key={a.riskCode} className="border-b border-slate-100 align-top">
                              <td className="px-2 py-2 font-medium text-slate-800">{a.riskCode}</td>
                              <td className="px-2 py-2 text-slate-700">{a.justification ?? "—"}</td>
                              <td className="px-2 py-2 text-slate-600">{a.acceptedBy ?? "—"}</td>
                              <td className="px-2 py-2 text-xs text-slate-500">{fmtDate(a.acceptedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </Section>
            )}

            {/* ── Phase 2 sections ── */}
            {sections.kriStatus && phase2 && (
              <Section title="KRI Status Summary">
                {phase2.kriStatus.length === 0 ? (
                  <p className="text-xs text-slate-400">All KRIs within tolerance (no RED/AMBER).</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500"><th className="px-2 py-2">KRI</th><th className="px-2 py-2">Value</th><th className="px-2 py-2">Status</th></tr></thead>
                    <tbody>
                      {phase2.kriStatus.map((k) => (
                        <tr key={k.kriCode} className="border-b border-slate-100">
                          <td className="px-2 py-2"><span className="font-medium text-slate-800">{k.kriCode}</span> {k.name}</td>
                          <td className="px-2 py-2 tabular-nums">{k.value ?? "—"} {k.unit}</td>
                          <td className="px-2 py-2"><span className="rounded px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: P2_HEX[k.status] ?? "#64748b" }}>{k.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Section>
            )}

            {sections.appetiteCompliance && phase2 && (
              <Section title="Appetite Compliance">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500"><th className="px-2 py-2">Category</th><th className="px-2 py-2">Appetite</th><th className="px-2 py-2">Open Breaches</th></tr></thead>
                  <tbody>
                    {phase2.appetiteCompliance.map((a: any) => (
                      <tr key={a.categoryId} className="border-b border-slate-100">
                        <td className="px-2 py-2 text-slate-800">{a.categoryName}</td>
                        <td className="px-2 py-2 text-slate-600">{a.appetiteLevel ?? "—"}</td>
                        <td className="px-2 py-2 tabular-nums">{a.openBreaches > 0 ? <span className="font-semibold text-rose-600">{a.openBreaches}</span> : "0"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {phase2.appetiteBreaches.length > 0 && (
                  <div className="mt-3">
                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Open breaches &amp; committee decisions</h3>
                    <ul className="space-y-1 text-sm">
                      {phase2.appetiteBreaches.map((b: any) => (
                        <li key={b.id} className="text-slate-700"><b>{b.categoryCode}</b> {b.bandType.replace(/_/g, " ")} — observed {b.observedValue} vs {b.thresholdValue} · <span className="italic text-slate-500">{b.status.replace(/_/g, " ")}{b.committeeDecision ? `: ${b.committeeDecision}` : ""}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </Section>
            )}

            {sections.lossSummary && phase2 && (
              <Section title="Loss Summary">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Net loss by category (12m)</h3>
                    <ul className="space-y-1 text-sm">
                      {phase2.lossSummary.netLossByCategory.map((c) => (
                        <li key={c.categoryCode} className="flex justify-between"><span style={{ color: c.colorHex }}>{c.categoryName}</span><span className="tabular-nums font-medium">{inrL(c.netLoss)}</span></li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Top 5 events</h3>
                    <ul className="space-y-1 text-sm">
                      {phase2.lossSummary.topLosses.map((t) => (
                        <li key={t.eventCode} className="flex justify-between gap-2"><span className="truncate text-slate-700">{t.eventCode} {t.title}</span><span className="tabular-nums font-medium">{inrL(t.netLoss)}</span></li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Section>
            )}

            {sections.complianceStatus && phase2 && (
              <Section title="Compliance Status">
                <div className="flex gap-6 text-sm">
                  <div><span className="text-2xl font-bold text-emerald-600">{phase2.complianceStatus.compliantPct}%</span><div className="text-xs text-slate-500">compliant</div></div>
                  <div><span className="text-2xl font-bold text-rose-600">{phase2.complianceStatus.overdue}</span><div className="text-xs text-slate-500">overdue</div></div>
                  <div><span className="text-2xl font-bold text-amber-600">{phase2.complianceStatus.dueSoon}</span><div className="text-xs text-slate-500">due soon</div></div>
                </div>
                {phase2.complianceStatus.expiring.length > 0 && (
                  <div className="mt-3">
                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Expiring licences / consents</h3>
                    <ul className="space-y-1 text-sm">
                      {phase2.complianceStatus.expiring.map((e) => (
                        <li key={e.obligationCode} className="flex justify-between"><span className="text-slate-700">{e.obligationCode} {e.title}</span><span className="tabular-nums text-slate-500">{e.daysToExpiry}d</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </Section>
            )}

            {/* ── Phase 3 sections (BCM + Scenario + Horizon) ── */}
            {sections.bcmReadiness && phase3 && (
              <Section title="Business Continuity Readiness">
                <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
                  <div><span className={"text-2xl font-bold " + (phase3.bcmReadiness.coveragePct >= 90 ? "text-emerald-600" : phase3.bcmReadiness.coveragePct >= 75 ? "text-amber-600" : "text-rose-600")}>{phase3.bcmReadiness.coveragePct}%</span><div className="text-xs text-slate-500">critical coverage</div></div>
                  <div><span className="text-2xl font-bold text-slate-800">{phase3.bcmReadiness.coveredCritical}/{phase3.bcmReadiness.totalCritical}</span><div className="text-xs text-slate-500">covered</div></div>
                  <div><span className="text-2xl font-bold text-orange-600">{phase3.bcmReadiness.unmitigatedSpofs}</span><div className="text-xs text-slate-500">SPOFs</div></div>
                  <div><span className="text-2xl font-bold text-amber-600">{phase3.bcmReadiness.plansReviewDue}</span><div className="text-xs text-slate-500">plans due</div></div>
                  <div><span className="text-2xl font-bold text-amber-600">{phase3.bcmReadiness.exercisesOverdue}</span><div className="text-xs text-slate-500">exercises overdue</div></div>
                  <div><span className={"text-2xl font-bold " + (phase3.bcmReadiness.activeCrises > 0 ? "text-rose-600" : "text-emerald-600")}>{phase3.bcmReadiness.activeCrises}</span><div className="text-xs text-slate-500">active crises</div></div>
                </div>
                {phase3.bcmReadiness.coverageGaps.length > 0 && (
                  <div className="mt-3">
                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Coverage gaps (critical processes without an approved plan)</h3>
                    <ul className="space-y-1 text-sm">
                      {phase3.bcmReadiness.coverageGaps.map((g) => (
                        <li key={g.processCode} className="flex justify-between"><span className="text-slate-700">{g.processCode} {g.name}</span><span className="text-rose-600">{g.criticality}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </Section>
            )}

            {sections.scenarioResilience && phase3 && phase3.scenarios.length > 0 && (
              <Section title="Scenario Resilience">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500"><th className="py-1.5 pr-3">Scenario</th><th className="py-1.5 pr-3">Category</th><th className="py-1.5 pr-3">Likelihood</th><th className="py-1.5 pr-3">Top impact</th><th className="py-1.5">Readiness</th></tr></thead>
                  <tbody>
                    {phase3.scenarios.map((s) => (
                      <tr key={s.scenarioCode} className="border-b border-slate-100 last:border-0">
                        <td className="py-1.5 pr-3 text-slate-700">{s.scenarioCode} {s.title}</td>
                        <td className="py-1.5 pr-3 text-xs text-slate-500">{s.category.replace(/_/g, " ")}</td>
                        <td className="py-1.5 pr-3 text-xs text-slate-600">{PROB_LBL[s.probabilityQualitative] ?? s.probabilityQualitative}</td>
                        <td className="py-1.5 pr-3 tabular-nums text-slate-600">{s.topImpactLevel || "—"}</td>
                        <td className="py-1.5"><span className="rounded px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: READINESS_HEX[s.mitigationReadiness] ?? "#94a3b8" }}>{s.mitigationReadiness.replace(/_/g, " ")}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}

            {sections.horizonScan && phase3 && phase3.horizon.length > 0 && (
              <Section title="Horizon Scan">
                <ul className="space-y-1.5 text-sm">
                  {phase3.horizon.map((h, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: SIGNAL_HEX[h.signalStrength] ?? "#94a3b8" }} title={h.signalStrength} />
                      <span className="flex-1 text-slate-700">{h.title}</span>
                      <span className="text-xs text-slate-400">{h.category.replace(/_/g, " ")}</span>
                      {h.disposition && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{h.disposition.replace(/_/g, " ")}</span>}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
            {/* ── Tier 3 sections (Controls · Insurance · Value-Chain ESG) ── */}
            {sections.controlsStatus && tier3?.controls && (
              <Section title="Internal Controls Status">
                <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
                  <div><span className="text-2xl font-bold text-slate-800">{tier3.controls.keyControls}</span><div className="text-xs text-slate-500">key controls</div></div>
                  <div><span className="text-2xl font-bold text-emerald-600">{tier3.controls.effectivePct}%</span><div className="text-xs text-slate-500">effective</div></div>
                  <div><span className="text-2xl font-bold text-slate-800">{tier3.controls.testedThisCyclePct}%</span><div className="text-xs text-slate-500">tested this cycle</div></div>
                  <div><span className="text-2xl font-bold text-amber-600">{tier3.controls.openDeficiencies}</span><div className="text-xs text-slate-500">open deficiencies</div></div>
                  <div><span className={"text-2xl font-bold " + (tier3.controls.materialWeaknesses > 0 ? "text-rose-600" : "text-emerald-600")}>{tier3.controls.materialWeaknesses}</span><div className="text-xs text-slate-500">material weaknesses</div></div>
                </div>
                {tier3.controls.unreportedMaterialWeaknesses.length > 0 && (
                  <div className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    <span className="font-semibold">Unreported to audit committee:</span>
                    <ul className="mt-1 space-y-0.5">{tier3.controls.unreportedMaterialWeaknesses.map((m) => <li key={m.deficiencyCode}>{m.deficiencyCode} ({m.controlCode}) — {m.description}</li>)}</ul>
                  </div>
                )}
              </Section>
            )}
            {sections.insuranceTransfer && tier3?.insurance && (
              <Section title="Insurance & Risk Transfer">
                <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
                  <div><span className="text-2xl font-bold text-slate-800">{tier3.insurance.activePolicies}</span><div className="text-xs text-slate-500">active policies</div></div>
                  <div><span className="text-2xl font-bold text-slate-800">{inrCr(tier3.insurance.totalSumInsured)}</span><div className="text-xs text-slate-500">sum insured</div></div>
                  <div><span className="text-2xl font-bold text-slate-800">{inrCr(tier3.insurance.annualPremium)}</span><div className="text-xs text-slate-500">annual premium</div></div>
                  <div><span className="text-2xl font-bold text-amber-600">{inrCr(tier3.insurance.openClaimsValue)}</span><div className="text-xs text-slate-500">open claims</div></div>
                  <div><span className={"text-2xl font-bold " + (tier3.insurance.uncoveredCriticalRisks > 0 ? "text-rose-600" : "text-emerald-600")}>{tier3.insurance.uncoveredCriticalRisks}</span><div className="text-xs text-slate-500">uncovered critical risks</div></div>
                </div>
                {tier3.insurance.expiringSoon > 0 && <p className="mt-2 text-xs text-amber-700">{tier3.insurance.expiringSoon} policy/policies expiring within the renewal window.</p>}
              </Section>
            )}
            {sections.valueChainEsg && tier3?.vendor && (
              <Section title="Value-Chain ESG">
                <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
                  <div><span className="text-2xl font-bold text-slate-800">{tier3.vendor.activeVendors}</span><div className="text-xs text-slate-500">active vendors</div></div>
                  <div><span className={"text-2xl font-bold " + (tier3.vendor.spendWeightedLaggingPct > 5 ? "text-rose-600" : "text-amber-600")}>{tier3.vendor.spendWeightedLaggingPct}%</span><div className="text-xs text-slate-500">spend w/ LAGGING ESG</div></div>
                  <div><span className="text-2xl font-bold text-rose-600">{tier3.vendor.laggingEsg}</span><div className="text-xs text-slate-500">LAGGING vendors</div></div>
                  <div><span className="text-2xl font-bold text-orange-600">{tier3.vendor.highCriticalRisk}</span><div className="text-xs text-slate-500">HIGH/CRITICAL risk vendors</div></div>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">Qualitative supplier ESG posture for the BRSR value-chain narrative — not Scope-3 carbon accounting.</p>
              </Section>
            )}
          </div>

          {/* Screen-visible footer (print footer handled by CSS) */}
          <div className="border-t border-slate-200 px-8 py-4 text-center text-[11px] text-slate-400 print:hidden">
            {FOOTER_TEXT}
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bp-section border-b border-slate-100 px-8 py-6 last:border-0">
      <h2 className="mb-4 text-base font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Print CSS: A4 landscape, running footer (text + page numbers via CSS
 * counters), and page breaks so the cover prints alone and sections avoid
 * splitting mid-block. Scoped so it only affects the board-pack document.
 */
function PrintStyles() {
  return (
    <style jsx global>{`
      @media print {
        @page {
          size: A4 landscape;
          margin: 12mm;
        }
        body {
          counter-reset: bp-page;
        }
        /* Hide everything except the board pack while printing. */
        body * {
          visibility: hidden;
        }
        .board-pack,
        .board-pack * {
          visibility: visible;
        }
        .board-pack {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        .bp-cover {
          height: 180mm;
          page-break-after: always;
        }
        .bp-section {
          page-break-inside: avoid;
        }
        /* Running footer with page numbers on every printed page. */
        .bp-body {
          counter-reset: bp-page;
        }
        .board-pack::after {
          content: "${FOOTER_TEXT}";
          position: fixed;
          bottom: 4mm;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 9px;
          color: #94a3b8;
        }
        .bp-section::after {
          counter-increment: bp-page;
          content: "Page " counter(bp-page);
          position: fixed;
          bottom: 4mm;
          right: 6mm;
          font-size: 9px;
          color: #94a3b8;
        }
      }
    `}</style>
  );
}
