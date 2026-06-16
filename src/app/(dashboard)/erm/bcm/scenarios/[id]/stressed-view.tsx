"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Printer, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BAND_HEX,
  PROB_LABEL,
  READINESS_CHIP,
  type Scenario,
  type StressedCell,
  type StressedHeatMap,
} from "@/app/(dashboard)/erm/lib-p3";
import { DIMENSION_LABEL } from "@/app/(dashboard)/erm/lib";

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

const READINESS_LABEL: Record<string, string> = {
  NO_PLAN: "No plan",
  PLAN_EXISTS: "Plan exists",
  PLAN_TESTED: "Plan tested",
};

const HORIZON_LABEL: Record<string, string> = {
  "0_12_MONTHS": "0–12 months",
  "1_3_YEARS": "1–3 years",
  "3_PLUS_YEARS": "3+ years",
};

const STATUS_CHIP: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ARCHIVED: "bg-slate-200 text-slate-500 border-slate-300",
};

export type RefLabel = { code: string; title: string; href: string };

export function ScenarioDetailView({
  scenario,
  riskLabels = {},
  processLabels = {},
}: {
  scenario: Scenario;
  riskLabels?: Record<string, RefLabel>;
  processLabels?: Record<string, RefLabel>;
}) {
  const router = useRouter();
  const [overlay, setOverlay] = useState(false);
  const [heatmap, setHeatmap] = useState<StressedHeatMap | null>(null);
  const [loadingHm, setLoadingHm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  async function openStressed() {
    setLoadingHm(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/erm/bcm/scenarios/${scenario.id}/stressed-heatmap`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner(j.detail || j.error || `Failed to stress heat map (${res.status}).`);
        return;
      }
      setHeatmap(j as StressedHeatMap);
      setOverlay(true);
    } catch (e: any) {
      setBanner(e?.message ?? "Network error.");
    } finally {
      setLoadingHm(false);
    }
  }

  async function post(path: string, body?: any): Promise<any | null> {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/erm/bcm/scenarios/${scenario.id}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner(j.detail || j.error || `Failed (${res.status}).`);
        return null;
      }
      return j;
    } catch (e: any) {
      setBanner(e?.message ?? "Network error.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function runAsExercise() {
    const j = await post("run-as-exercise");
    if (j?.id) router.push(`/erm/bcm/exercises/${j.id}`);
  }

  async function activate() {
    const j = await post("activate");
    if (j) router.refresh();
  }

  return (
    <div className="space-y-4">
      {banner && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{banner}</div>
      )}

      {/* Header card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">{scenario.title}</h1>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                {CATEGORY_LABEL[scenario.category] ?? scenario.category.replace(/_/g, " ")}
              </span>
              <span
                className={
                  "rounded border px-2 py-0.5 text-[11px] font-medium " +
                  (READINESS_CHIP[scenario.mitigationReadiness] ?? "")
                }
              >
                {READINESS_LABEL[scenario.mitigationReadiness] ?? scenario.mitigationReadiness.replace(/_/g, " ")}
              </span>
              {scenario.status && (
                <span
                  className={
                    "rounded border px-2 py-0.5 text-[11px] font-medium " +
                    (STATUS_CHIP[scenario.status] ?? "bg-slate-100 text-slate-600 border-slate-200")
                  }
                >
                  {scenario.status.replace(/_/g, " ")}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {scenario.scenarioCode} · Probability {PROB_LABEL[scenario.probabilityQualitative] ?? scenario.probabilityQualitative}
              {scenario.timeHorizon && <> · Horizon {HORIZON_LABEL[scenario.timeHorizon] ?? scenario.timeHorizon}</>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openStressed}
              disabled={loadingHm}
              className="rounded-lg bg-primary-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
            >
              {loadingHm ? "Stressing…" : "Stress the Heat Map"}
            </button>
            <button
              onClick={runAsExercise}
              disabled={busy}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-primary-500 disabled:opacity-50"
            >
              Run as Exercise
            </button>
            {scenario.status !== "ACTIVE" && (
              <button
                onClick={activate}
                disabled={busy}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-primary-500 disabled:opacity-50"
              >
                Activate
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Narrative</h3>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{scenario.narrative || "—"}</p>

          <h3 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Impact estimates
          </h3>
          {scenario.impactEstimates.length === 0 ? (
            <p className="text-xs text-slate-400">No impact estimates recorded.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-2 py-1.5">Dimension</th>
                  <th className="px-2 py-1.5">Level</th>
                  <th className="px-2 py-1.5">Basis / notes</th>
                  <th className="px-2 py-1.5">Gross (INR)</th>
                </tr>
              </thead>
              <tbody>
                {scenario.impactEstimates.map((e: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-2 py-1.5 text-slate-700">{DIMENSION_LABEL[e.dimension] ?? e.dimension}</td>
                    <td className="px-2 py-1.5 tabular-nums font-semibold">L{e.estimatedLevel}</td>
                    <td className="max-w-[280px] px-2 py-1.5 text-xs text-slate-500">{e.estimateBasisNotes ?? "—"}</td>
                    <td className="px-2 py-1.5 tabular-nums text-xs text-slate-600">
                      {e.estimatedGrossInr != null ? `₹${Number(e.estimatedGrossInr).toLocaleString("en-IN")}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Affected risks</h3>
            {scenario.affectedRiskIds.length === 0 ? (
              <p className="text-xs text-slate-400">None linked.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {scenario.affectedRiskIds.map((rid) => {
                  const l = riskLabels[rid];
                  return (
                    <li key={rid} className="truncate">
                      {l ? (
                        <Link href={l.href} className="text-primary-700 hover:underline"><span className="font-medium">{l.code}</span> · {l.title}</Link>
                      ) : (
                        <span className="text-slate-400">{rid}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Affected processes</h3>
            {scenario.affectedProcessIds.length === 0 ? (
              <p className="text-xs text-slate-400">None linked.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {scenario.affectedProcessIds.map((pid) => {
                  const l = processLabels[pid];
                  return (
                    <li key={pid} className="truncate">
                      {l ? (
                        <Link href={l.href} className="text-primary-700 hover:underline"><span className="font-medium">{l.code}</span> · {l.title}</Link>
                      ) : (
                        <span className="text-slate-400">{pid}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {scenario.whatIfAdjustments.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                What-if stressors
              </h3>
              <p className="text-xs text-slate-500">{scenario.whatIfAdjustments.length} risk adjustment(s) defined.</p>
            </div>
          )}
        </div>
      </div>

      {overlay && heatmap && <StressedOverlay heatmap={heatmap} onClose={() => setOverlay(false)} />}
    </div>
  );
}

// ── Stressed heat-map overlay ────────────────────────────────────────────────
function OverlayGrid({
  baseline,
  stressed,
  title,
}: {
  baseline: StressedCell[];
  stressed: StressedCell[];
  title: string;
}) {
  const baseMap = new Map(baseline.map((c) => [`${c.likelihood}-${c.impact}`, c]));
  const stressMap = new Map(stressed.map((c) => [`${c.likelihood}-${c.impact}`, c]));
  const likelihoods = [5, 4, 3, 2, 1];
  const impacts = [1, 2, 3, 4, 5];

  return (
    <div className="inline-flex flex-col gap-1">
      <p className="mb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      <div className="flex items-stretch gap-1">
        <div className="flex flex-col justify-center pr-1">
          <span className="rotate-180 text-[10px] font-semibold uppercase tracking-wider text-slate-500 [writing-mode:vertical-rl]">
            Likelihood →
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {likelihoods.map((l) => (
            <div key={l} className="flex items-center gap-1">
              <span className="w-4 text-right text-[10px] font-semibold text-slate-400">{l}</span>
              {impacts.map((i) => {
                const base = baseMap.get(`${l}-${i}`);
                const stress = stressMap.get(`${l}-${i}`);
                const band = stress?.band ?? base?.band ?? "LOW";
                const stressCount = stress?.count ?? 0;
                const baseCount = base?.count ?? 0;
                return (
                  <div
                    key={`${l}-${i}`}
                    title={`L${l} × I${i} — baseline ${baseCount}, stressed ${stressCount}`}
                    className="relative flex h-16 w-16 items-center justify-center rounded text-sm font-bold text-white"
                    style={{ backgroundColor: BAND_HEX[band] ?? "#94a3b8", opacity: stressCount === 0 && baseCount === 0 ? 0.35 : 1 }}
                  >
                    {/* Ghosted baseline dot */}
                    {baseCount > 0 && (
                      <span className="absolute left-1 top-1 rounded-full bg-white/40 px-1 text-[9px] font-semibold text-white/90 ring-1 ring-white/50">
                        {baseCount}
                      </span>
                    )}
                    {/* Solid stressed count */}
                    {stressCount > 0 && <span className="text-base">{stressCount}</span>}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="flex items-center gap-1 pl-5">
            {impacts.map((i) => (
              <span key={i} className="w-16 text-center text-[10px] font-semibold text-slate-400">
                {i}
              </span>
            ))}
          </div>
          <div className="pl-5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Impact →
          </div>
        </div>
      </div>
    </div>
  );
}

function StressedOverlay({ heatmap, onClose }: { heatmap: StressedHeatMap; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white p-6 print:p-0">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Stressed Heat Map</h2>
            <p className="text-sm text-slate-500">
              {heatmap.scenarioTitle} — baseline (ghosted) vs stressed exposure. Presentational only; the register
              is not modified.
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-primary-500"
            >
              <Printer size={15} /> Export PNG
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              <X size={15} /> Close
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-center gap-10">
          <OverlayGrid baseline={heatmap.baseline} stressed={heatmap.baseline} title="Baseline" />
          <OverlayGrid baseline={heatmap.baseline} stressed={heatmap.stressed} title="Stressed (overlay)" />
        </div>

        <div className="mt-8">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Movements ({heatmap.movements.length})
          </h3>
          {heatmap.movements.length === 0 ? (
            <p className="text-sm text-slate-400">No risk migrated under this scenario.</p>
          ) : (
            <ul className="space-y-1.5">
              {heatmap.movements.map((m) => (
                <li
                  key={m.riskId}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                >
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {m.riskCode}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-700">{m.title}</span>
                  <span className="inline-flex items-center gap-1.5 text-xs tabular-nums text-slate-500">
                    <span>
                      L{m.fromL}×I{m.fromI}
                    </span>
                    <ArrowRight size={13} className="text-rose-500" />
                    <span className="font-semibold text-rose-600">
                      L{m.toL}×I{m.toI}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex items-center gap-4 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded-full bg-white px-1 text-[9px] text-slate-600 ring-1 ring-slate-300">n</span>
            baseline count (ghosted)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className={cn("h-3 w-3 rounded")}
              style={{ backgroundColor: BAND_HEX.CRITICAL }}
            />
            stressed band / count (solid)
          </span>
        </div>
      </div>
    </div>
  );
}
