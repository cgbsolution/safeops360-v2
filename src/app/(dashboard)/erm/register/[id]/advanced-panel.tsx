"use client";

// ADVANCED (CRO-grade) risk panel — surfaces the quantitative spine on the risk
// detail: inherent→residual→target, control-DERIVED residual vs asserted (override
// variance), ₹ expected loss, control risk-reduction value, 3-lines-of-defence,
// bow-tie, and correlation propagation. Degrades gracefully when data is absent.
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck, Target, TrendingDown, AlertTriangle, GitBranch, Network, Banknote, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BandBadge } from "@/components/erm/shared";
import { fmtInr, type RiskDetail } from "../../lib";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

type Propagation = {
  sourceRiskCode: string;
  sourceExpectedLossInr: number;
  totalAddedExpectedLossInr: number;
  affectedCount: number;
  directTargets: { riskId: string; riskCode: string; title: string; linkageType: string; addedExpectedLossInr: number; stressedExpectedLossInr: number }[];
};

const BARRIER_CHIP: Record<string, string> = {
  WORKED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  UNTESTED: "bg-slate-100 text-slate-600 border-slate-200",
  FAILED: "bg-rose-100 text-rose-800 border-rose-200",
  ABSENT: "bg-rose-100 text-rose-800 border-rose-200",
};

const BAR_TONE: Record<string, string> = {
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
};
function Bar({ pct, tone = "emerald" }: { pct: number; tone?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={cn("h-full rounded-full", BAR_TONE[tone] ?? BAR_TONE.emerald)} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

function ScoreCell({ label, score, band, el, accent }: { label: string; score: number | null | undefined; band: string | null | undefined; el?: number | null; accent: string }) {
  return (
    <div className={cn("flex-1 rounded-lg border p-3 text-center", accent)}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{score ?? "—"}</div>
      <div className="mt-1 flex justify-center"><BandBadge band={band} /></div>
      {el != null && <div className="mt-1 text-[11px] font-medium text-slate-500">{fmtInr(el)}</div>}
    </div>
  );
}

export function AdvancedRiskPanel({ risk }: { risk: RiskDetail }) {
  const [prop, setProp] = useState<Propagation | null>(null);
  const dr = risk.derivedResidual;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/erm/risks/${risk.id}/propagation`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setProp(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [risk.id]);

  const override = dr && dr.overrideVariance != null && dr.overrideVariance !== 0;

  return (
    <div className="mt-5 space-y-4">
      {/* Alerts */}
      {(risk.controlAlert || risk.kriAlert) && (
        <div className="flex flex-wrap gap-2">
          {risk.controlAlert && (
            <Alert variant="destructive" className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              <AlertTriangle size={14} /> A mapped control is deficient — residual reassessment recommended.
            </Alert>
          )}
          {risk.kriAlert && (
            <Alert variant="destructive" className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              <AlertTriangle size={14} /> A linked KRI is RED — early-warning reassessment recommended.
            </Alert>
          )}
        </div>
      )}

      {/* Inherent → Residual → Target journey + ₹ exposure */}
      <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <TrendingDown size={15} className="text-slate-400" /> Risk Reduction Journey (quantified)
        </h2>
        <div className="flex items-stretch gap-2">
          <ScoreCell label="Inherent" score={risk.inherentScore} band={risk.inherentBand} el={risk.inherentExpectedLossInr} accent="border-slate-200 bg-slate-50" />
          <div className="flex items-center text-slate-300">→</div>
          <ScoreCell label="Residual" score={risk.residualScore} band={risk.residualBand} el={risk.residualExpectedLossInr} accent="border-slate-200 bg-white" />
          <div className="flex items-center text-slate-300">→</div>
          <ScoreCell label="Target" score={risk.targetScore} band={risk.targetBand} el={risk.targetExpectedLossInr} accent="border-dashed border-emerald-300 bg-emerald-50/40" />
        </div>
        {risk.targetRationale && <p className="mt-2 text-[11px] italic text-slate-500">Target: {risk.targetRationale}</p>}
        {risk.residualWorstLossInr != null && (
          <p className="mt-2 text-[11px] text-slate-500">Worst-case (tail) exposure: <span className="font-semibold text-slate-700">{fmtInr(risk.residualWorstLossInr)}</span></p>
        )}
      </Card>

      {/* Control-derived residual */}
      {dr && (
        <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <ShieldCheck size={15} className="text-slate-400" /> Control-Derived Residual
            <span className="ml-auto text-[11px] font-normal text-slate-400">{dr.ratedControlCount}/{dr.mappedControlCount} controls rated</span>
          </h2>

          {override && (
            <Alert variant="warning" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <span className="font-semibold">Expert override:</span> asserted residual {dr.assertedResidualScore} vs control-derived {dr.derivedResidualScore}
              {" "}(variance {dr.overrideVariance! > 0 ? "+" : ""}{dr.overrideVariance}). Residual is derived from controls — the variance is documented, not hidden.
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-[11px] font-medium text-slate-600"><span>Preventive (cuts likelihood)</span><span className="tabular-nums">{dr.preventiveEffectivenessPct}%</span></div>
                <Bar pct={dr.preventiveEffectivenessPct} tone="sky" />
              </div>
              <div>
                <div className="flex justify-between text-[11px] font-medium text-slate-600"><span>Mitigating (cuts impact)</span><span className="tabular-nums">{dr.mitigatingEffectivenessPct}%</span></div>
                <Bar pct={dr.mitigatingEffectivenessPct} tone="violet" />
              </div>
              <div>
                <div className="flex justify-between text-[11px] font-semibold text-slate-700"><span>Combined effectiveness</span><span className="tabular-nums">{dr.combinedEffectivenessPct}%</span></div>
                <Bar pct={dr.combinedEffectivenessPct} tone="emerald" />
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Derived residual</span>
                <BandBadge band={dr.derivedResidualBand} score={dr.derivedResidualScore} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500">Residual ₹ (controls applied)</span>
                <span className="font-semibold tabular-nums text-slate-800">{fmtInr(dr.derivedResidualExpectedLossInr)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-xs">
                <span className="font-medium text-emerald-700">Risk reduction from controls</span>
                <span className="font-bold tabular-nums text-emerald-700">{fmtInr(dr.controlRiskReductionInr)}</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">= inherent ₹{dr.inherentExpectedLossInr != null ? "" : ""} minus residual ₹. What the control environment is worth.</p>
            </div>
          </div>

          {dr.contributingControls.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
              {dr.contributingControls.map((c) => (
                <li key={c.controlId} className="flex items-center justify-between gap-2 text-xs">
                  <Link href={`/erm/controls/${c.controlId}`} className="truncate text-primary-700 hover:underline">{c.controlCode} · {c.name}</Link>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">{c.axis === "LIKELIHOOD" ? "↓L" : "↓I"}</span>
                    <span className={cn("rounded border px-1.5 py-0.5 text-[10px]", c.rating === "EFFECTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : c.rating === "DEFICIENT" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-500")}>{c.rating.replace(/_/g, " ")}</span>
                    <span className="tabular-nums text-slate-400">{(c.contribution * 100).toFixed(0)}%</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Three lines of defence */}
        <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Layers size={15} className="text-slate-400" /> Three Lines of Defence</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">1st line — owns & manages</dt><dd className="font-medium text-slate-800">{risk.firstLineOwnerName ?? risk.riskOwnerName ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">2nd line — risk oversight</dt><dd className="font-medium text-slate-800">{risk.secondLineOwnerName ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">3rd line — assurance</dt><dd className="font-medium text-slate-800">{risk.thirdLineAssurance ?? "—"}</dd></div>
          </dl>
        </Card>

        {/* Correlation propagation */}
        <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Network size={15} className="text-slate-400" /> If This Risk Materialises</h2>
          {!prop || prop.affectedCount === 0 ? (
            <p className="text-xs text-slate-400">No weighted linkages — this risk has no modelled knock-on effect.</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-slate-600">Triggers <span className="font-semibold">{prop.affectedCount}</span> linked risk(s), adding <span className="font-semibold text-rose-600">{fmtInr(prop.totalAddedExpectedLossInr)}</span> of correlated exposure.</p>
              <ul className="space-y-1.5">
                {prop.directTargets.slice(0, 4).map((t) => (
                  <li key={t.riskId} className="flex items-center justify-between gap-2 text-xs">
                    <Link href={`/erm/register/${t.riskId}`} className="truncate text-primary-700 hover:underline">{t.riskCode} · {t.title}</Link>
                    <span className="shrink-0 font-medium tabular-nums text-rose-600">+{fmtInr(t.addedExpectedLossInr)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      {/* Bow-tie */}
      {risk.bowtie && (
        <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900"><GitBranch size={15} className="text-slate-400" /> Bow-Tie — Causal Structure</h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Threats → preventive barriers</div>
              {risk.bowtie.threats.map((t) => (
                <Card key={t.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2 shadow-none">
                  <div className="text-xs font-medium text-slate-700">{t.description}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {t.preventiveBarriers.map((b) => (
                      <span key={b.id} className={cn("rounded border px-1.5 py-0.5 text-[10px]", BARRIER_CHIP[b.status])} title={b.description}>{b.controlCode ? b.controlCode + " · " : ""}{b.status}</span>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
            <div className="flex flex-col items-center justify-center">
              <Alert variant="destructive" className="rounded-full border-2 border-rose-300 bg-rose-50 px-4 py-3 text-center text-xs font-bold text-rose-700">TOP EVENT<div className="mt-0.5 max-w-[160px] truncate font-normal">{risk.bowtie.topEvent}</div></Alert>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Consequences → mitigating barriers</div>
              {risk.bowtie.consequences.map((c) => (
                <Card key={c.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2 shadow-none">
                  <div className="text-xs font-medium text-slate-700">{c.description}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.mitigatingBarriers.map((b) => (
                      <span key={b.id} className={cn("rounded border px-1.5 py-0.5 text-[10px]", BARRIER_CHIP[b.status])} title={b.description}>{b.controlCode ? b.controlCode + " · " : ""}{b.status}</span>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
