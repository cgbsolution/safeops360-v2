"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banknote, TrendingUp, Layers, Activity, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { KpiTile } from "@/components/erm/shared";
import {
  fmtInr,
  type EnterpriseExposure, type CorrelatedExposure, type FrameworkCoverage, type MonteCarlo, type ReverseStress,
} from "../lib";

function Section({ title, icon, children, right }: { title: string; icon: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-1.5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">{icon} {title}</h2>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      {children}
    </div>
  );
}

export function ExposureView({
  exposure, correlated, frameworks,
}: {
  exposure: EnterpriseExposure;
  correlated: CorrelatedExposure | null;
  frameworks: FrameworkCoverage | null;
}) {
  const [mc, setMc] = useState<MonteCarlo | null>(null);
  const [iterations, setIterations] = useState(10000);
  const [rs, setRs] = useState<ReverseStress | null>(null);
  const [threshold, setThreshold] = useState(200000000); // ₹20 Cr

  useEffect(() => {
    fetch(`/api/erm/portfolio/monte-carlo?iterations=${iterations}&seed=42`).then((r) => (r.ok ? r.json() : null)).then(setMc).catch(() => {});
  }, [iterations]);

  function runReverseStress() {
    fetch(`/api/erm/portfolio/reverse-stress?threshold_inr=${threshold}`).then((r) => (r.ok ? r.json() : null)).then(setRs).catch(() => {});
  }

  const maxBucket = mc ? Math.max(...mc.distribution.map((b) => b.count), 1) : 1;
  const hhiTone = exposure.portfolioConcentrationIndex > 0.25 ? "critical" : exposure.portfolioConcentrationIndex > 0.15 ? "warn" : "good";

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiTile label="Total Expected Loss" value={fmtInr(exposure.totalExpectedLossInr)} tone="critical" sub={`${exposure.quantifiedRiskCount} quantified risks`} />
        <KpiTile label="Worst-Case (tail)" value={fmtInr(exposure.totalWorstLossInr)} tone="high" sub="Σ residual worst-case" />
        <KpiTile label="Top-5 Share" value={`${exposure.top5SharePct}%`} tone="warn" sub="of total exposure" />
        <KpiTile label="Concentration (HHI)" value={exposure.portfolioConcentrationIndex.toFixed(3)} tone={hhiTone as any} sub={exposure.portfolioConcentrationIndex > 0.25 ? "Concentrated" : "Diversified"} />
        <KpiTile label="Unquantified" value={exposure.unquantifiedRiskCount} tone="neutral" sub="risks lacking ₹ figures" />
      </div>

      {/* Top drivers (Pareto) */}
      <Section title="Top Risk Drivers (Pareto)" icon={<TrendingUp size={15} className="text-slate-400" />}>
        <ul className="space-y-2">
          {exposure.topDrivers.map((d) => (
            <li key={d.id} className="flex items-center gap-3">
              <span className="w-6 text-right text-xs font-bold tabular-nums text-slate-400">{d.rank}</span>
              <Link href={`/erm/register/${d.id}`} className="w-44 shrink-0 truncate text-sm text-primary-700 hover:underline" title={d.title}>{d.riskCode}</Link>
              <div className="flex-1">
                <div className="h-5 overflow-hidden rounded bg-slate-100">
                  <div className="flex h-full items-center rounded bg-rose-400 px-2 text-[10px] font-semibold text-white" style={{ width: `${Math.max(6, d.pctOfTotal)}%` }}>{d.pctOfTotal}%</div>
                </div>
              </div>
              <span className="w-24 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700">{fmtInr(d.residualExpectedLossInr)}</span>
              <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-slate-400">{d.cumulativePct}%</span>
            </li>
          ))}
        </ul>
      </Section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Concentration by category */}
        <Section title="Concentration by Category" icon={<Layers size={15} className="text-slate-400" />}>
          <ul className="space-y-2">
            {exposure.byCategory.map((c) => (
              <li key={c.categoryCode} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate text-xs text-slate-600" title={c.categoryName}>{c.categoryName}</span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
                  <div className="h-full rounded" style={{ width: `${Math.max(4, c.pctOfTotal)}%`, backgroundColor: c.colorHex ?? "#64748b" }} />
                </div>
                <span className="w-20 shrink-0 text-right text-[11px] font-medium tabular-nums text-slate-600">{fmtInr(c.expectedLossInr)}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Concentration by site */}
        <Section title="Concentration by Site" icon={<Layers size={15} className="text-slate-400" />}>
          <ul className="space-y-2">
            {exposure.bySite.map((s) => (
              <li key={s.plantId ?? "ent"} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate text-xs text-slate-600" title={s.plantName}>{s.plantName}</span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
                  <div className="h-full rounded bg-indigo-400" style={{ width: `${Math.max(4, exposure.totalExpectedLossInr ? (s.expectedLossInr * 100) / exposure.totalExpectedLossInr : 0)}%` }} />
                </div>
                <span className="w-20 shrink-0 text-right text-[11px] font-medium tabular-nums text-slate-600">{fmtInr(s.expectedLossInr)}</span>
                <span className="w-12 shrink-0 text-right text-[10px] tabular-nums text-slate-400" title="Within-site concentration (HHI)">{s.concentrationIndex}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {/* Monte Carlo + VaR */}
      <Section
        title="Monte-Carlo Loss Distribution & Value-at-Risk"
        icon={<Activity size={15} className="text-slate-400" />}
        right={
          <Select value={iterations} onChange={(e) => setIterations(Number(e.target.value))} className="text-xs">
            <option value={5000}>5,000 trials</option>
            <option value={10000}>10,000 trials</option>
            <option value={50000}>50,000 trials</option>
          </Select>
        }
      >
        {!mc ? (
          <p className="text-xs text-slate-400">Simulating…</p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-2 text-center"><div className="text-[10px] uppercase tracking-wider text-slate-400">Mean / yr</div><div className="text-sm font-bold tabular-nums text-slate-800">{fmtInr(mc.meanLossInr)}</div></div>
              <div className="rounded-lg bg-amber-50 p-2 text-center"><div className="text-[10px] uppercase tracking-wider text-amber-500">VaR 90%</div><div className="text-sm font-bold tabular-nums text-amber-700">{fmtInr(mc.p90LossInr)}</div></div>
              <div className="rounded-lg bg-orange-50 p-2 text-center"><div className="text-[10px] uppercase tracking-wider text-orange-500">VaR 95%</div><div className="text-sm font-bold tabular-nums text-orange-700">{fmtInr(mc.p95LossInr)}</div></div>
              <div className="rounded-lg bg-rose-50 p-2 text-center"><div className="text-[10px] uppercase tracking-wider text-rose-500">VaR 99%</div><div className="text-sm font-bold tabular-nums text-rose-700">{fmtInr(mc.p99LossInr)}</div></div>
            </div>
            <div className="flex h-32 items-end gap-0.5">
              {mc.distribution.map((b, i) => (
                <div key={i} className="group relative flex-1" title={`${fmtInr(b.bucketFromInr)}${b.bucketToInr != null ? "–" + fmtInr(b.bucketToInr) : "+"}: ${b.pct}%`}>
                  <div className="rounded-t bg-sky-400 transition-colors group-hover:bg-sky-500" style={{ height: `${(b.count / maxBucket) * 100}%`, minHeight: b.count > 0 ? 2 : 0 }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>₹0</span><span>annual aggregate loss →</span><span>{fmtInr(mc.distribution[mc.distribution.length - 1]?.bucketFromInr)}+</span>
            </div>
            {mc.correlated && (mc.contagionTailUpliftInr ?? 0) > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs">
                <span className="font-semibold text-rose-700">Correlation-aware</span>
                <span className="text-slate-600">VaR 99% independent <span className="font-medium tabular-nums">{fmtInr(mc.independentP99LossInr)}</span></span>
                <span className="text-slate-600">→ with contagion <span className="font-medium tabular-nums">{fmtInr(mc.p99LossInr)}</span></span>
                <span className="rounded bg-rose-600 px-2 py-0.5 font-semibold text-white">+{fmtInr(mc.contagionTailUpliftInr)} tail uplift</span>
                <span className="text-slate-500">({mc.linkageCount} linkages drive induced firing + amplification)</span>
              </div>
            )}
            <p className="mt-2 text-[11px] text-slate-500">Each of {mc.iterations.toLocaleString("en-IN")} trials fires every risk by its annualised probability; severity sampled from triangular(best, expected, worst) over {mc.riskCount} risks{mc.correlated ? ", with RiskLinkage contagion inside the simulation" : ""}.</p>
          </>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Reverse stress */}
        <Section title="Reverse Stress Test" icon={<Zap size={15} className="text-slate-400" />}>
          <p className="mb-2 text-xs text-slate-500">What combination of simultaneous risks breaches a loss threshold?</p>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-slate-500">₹</span>
            <Input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-40 text-xs tabular-nums" />
            <button onClick={runReverseStress} className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700">Run</button>
            <span className="text-[11px] text-slate-400">({fmtInr(threshold)})</span>
          </div>
          {rs && (
            <div>
              <p className={cn("mb-2 rounded-md px-3 py-1.5 text-xs font-semibold", rs.breached ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700")}>
                {rs.breached ? `Breached by just ${rs.minRisksToBreach} simultaneous risk(s) (₹${fmtInr(rs.combinedWorstLossInr).slice(1)})` : `Not breachable — portfolio worst-case ${fmtInr(rs.portfolioWorstCaseInr)}`}
              </p>
              <ul className="space-y-1">
                {rs.breakingCombination.map((r) => (
                  <li key={r.riskId} className="flex items-center justify-between gap-2 text-xs">
                    <Link href={`/erm/register/${r.riskId}`} className="truncate text-primary-700 hover:underline">{r.riskCode} · {r.title}</Link>
                    <span className="shrink-0 font-medium tabular-nums text-rose-600">{fmtInr(r.worstLossInr)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {/* Correlated exposure (contagion) */}
        <Section title="Correlated Exposure (Contagion)" icon={<TrendingUp size={15} className="text-slate-400" />}>
          {!correlated ? (
            <p className="text-xs text-slate-400">No linkage data.</p>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2 text-xs">
                <div className="flex-1 rounded-lg bg-slate-50 p-2 text-center"><div className="text-[10px] uppercase text-slate-400">Standalone Σ</div><div className="font-bold tabular-nums text-slate-700">{fmtInr(correlated.standaloneExpectedLossInr)}</div></div>
                <span className="text-slate-300">+</span>
                <div className="flex-1 rounded-lg bg-rose-50 p-2 text-center"><div className="text-[10px] uppercase text-rose-400">Contagion gap</div><div className="font-bold tabular-nums text-rose-600">{fmtInr(correlated.diversificationGapInr)}</div></div>
                <span className="text-slate-300">=</span>
                <div className="flex-1 rounded-lg bg-orange-50 p-2 text-center"><div className="text-[10px] uppercase text-orange-400">Correlated</div><div className="font-bold tabular-nums text-orange-700">{fmtInr(correlated.correlatedExpectedLossInr)}</div></div>
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Top contagion sources</div>
              <ul className="mt-1 space-y-1">
                {correlated.topContagionSources.map((s) => (
                  <li key={s.sourceRiskId} className="flex items-center justify-between gap-2 text-xs">
                    <Link href={`/erm/register/${s.sourceRiskId}`} className="truncate text-primary-700 hover:underline">{s.sourceRiskCode} → {s.affectedCount} risk(s)</Link>
                    <span className="shrink-0 font-medium tabular-nums text-rose-600">+{fmtInr(s.totalAddedExpectedLossInr)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
      </div>

      {/* Framework alignment */}
      {frameworks && (
        <Section title="Regulatory Framework Alignment" icon={<ShieldCheck size={15} className="text-slate-400" />} right={<span className="text-xs font-semibold text-emerald-600">{frameworks.overallCoveragePct}% overall</span>}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {frameworks.frameworks.map((f) => (
              <div key={f.framework} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">{f.framework}</span>
                  <span className="text-xs font-bold tabular-nums text-emerald-600">{f.coveragePct}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${f.coveragePct}%` }} /></div>
                <ul className="mt-2 space-y-1">
                  {f.clauses.map((c) => (
                    <li key={c.clause} className="flex items-start gap-1.5 text-[11px]">
                      <span className={cn("mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full", c.status === "MET" ? "bg-emerald-500" : c.status === "PARTIAL" ? "bg-amber-500" : "bg-rose-500")} />
                      <span className="text-slate-600"><span className="font-medium text-slate-700">{c.clause}</span> · {c.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
