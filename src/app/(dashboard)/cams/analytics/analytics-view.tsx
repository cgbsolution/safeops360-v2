"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { SEVERITY_CHIP, labelize, engagementTypeLabel, type Analytics } from "../lib-cams";

const SEV_HEX: Record<string, string> = {
  CRITICAL_NC: "#C0392B", MAJOR_NC: "#E67E22", MINOR_NC: "#E6A817",
  OBSERVATION: "#94a3b8", OPPORTUNITY_FOR_IMPROVEMENT: "#38bdf8",
};
function conformanceHex(pct: number) { return pct >= 90 ? "#2E8B57" : pct >= 75 ? "#E6A817" : "#C0392B"; }

function Kpi({ label, value, sub, tone = "slate" }: { label: string; value: string | number; sub?: string; tone?: string }) {
  const t: Record<string, string> = { slate: "text-slate-900", emerald: "text-emerald-700", amber: "text-amber-700", rose: "text-rose-700", blue: "text-blue-700" };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={"mt-1 text-2xl font-bold tabular-nums " + (t[tone] ?? t.slate)}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function Panel({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function AnalyticsView({ a }: { a: Analytics }) {
  const p = a.programme;
  const sevData = ["CRITICAL_NC", "MAJOR_NC", "MINOR_NC", "OBSERVATION", "OPPORTUNITY_FOR_IMPROVEMENT"]
    .map((k) => ({ key: k, label: labelize(k), count: a.findingsBySeverity[k] ?? 0 }))
    .filter((d) => d.count > 0);
  const benchData = a.benchmarkingBySite.filter((b) => b.avgScorePct != null)
    .map((b) => ({ name: b.siteName ?? "—", score: b.avgScorePct as number }));

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Completion" value={`${p.completionRatePct}%`} sub={`${p.closed + p.reportIssued}/${p.total} conducted`} tone="blue" />
        <Kpi label="Overdue Audits" value={p.overdue} tone={p.overdue ? "rose" : "emerald"} />
        <Kpi label="Open Findings" value={a.openFindingCount} tone={a.openFindingCount ? "amber" : "emerald"} />
        <Kpi label="Repeat-Finding Rate" value={`${a.repeatFindingRatePct}%`} tone={a.repeatFindingRatePct ? "rose" : "emerald"} />
        <Kpi label="Avg Closure" value={a.avgClosureDays != null ? `${a.avgClosureDays}d` : "—"} />
        <Kpi label="CAPA Overdue" value={`${a.capaOverduePct}%`} tone={a.capaOverduePct ? "amber" : "emerald"} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Benchmarking */}
        <Panel title="Benchmarking — average score by site" hint="Normalised: avg conformance score across conducted audits. The North vs South gap.">
          {benchData.length ? (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={benchData} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`${v}%`, "Avg score"]} />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="score" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fill: "#475569" }} />
                    {benchData.map((d, i) => <Cell key={i} fill={conformanceHex(d.score)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty />}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                <th className="py-1 pr-2">Site</th><th className="py-1 pr-2 text-center">Conducted</th><th className="py-1 pr-2 text-center">Avg %</th>
                <th className="py-1 pr-2 text-center">Findings</th><th className="py-1 pr-2 text-center">Density</th><th className="py-1 pr-2 text-center">Maj/Crit</th><th className="py-1 text-center">Repeat</th>
              </tr></thead>
              <tbody>
                {a.benchmarkingBySite.map((b) => (
                  <tr key={b.siteId ?? "corp"} className="border-t border-slate-100">
                    <td className="py-1 pr-2 text-slate-700">{b.siteName}</td>
                    <td className="py-1 pr-2 text-center tabular-nums">{b.auditsConducted}/{b.auditsPlanned}</td>
                    <td className="py-1 pr-2 text-center font-semibold tabular-nums" style={{ color: b.avgScorePct != null ? conformanceHex(b.avgScorePct) : "#94a3b8" }}>{b.avgScorePct != null ? `${b.avgScorePct}%` : "—"}</td>
                    <td className="py-1 pr-2 text-center tabular-nums">{b.findingCount}</td>
                    <td className="py-1 pr-2 text-center tabular-nums">{b.findingDensity}</td>
                    <td className="py-1 pr-2 text-center tabular-nums text-rose-700">{b.majorCriticalCount}</td>
                    <td className="py-1 text-center tabular-nums text-rose-700">{b.repeatCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Findings by severity */}
        <Panel title="Findings by severity">
          {sevData.length ? (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={sevData} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: "#475569" }} />
                    {sevData.map((d, i) => <Cell key={i} fill={SEV_HEX[d.key] ?? "#94a3b8"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty />}
        </Panel>

        {/* Pareto by clause */}
        <Panel title="Findings Pareto — by ISO clause" hint="Where non-conformances concentrate. Drill into the Findings register filtered by clause.">
          {a.paretoByClause.length ? (
            <div style={{ width: "100%", height: Math.max(140, a.paretoByClause.length * 30) }}>
              <ResponsiveContainer>
                <BarChart data={a.paretoByClause} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: "#475569" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty />}
        </Panel>

        {/* Clause conformance */}
        <Panel title="Clause conformance" hint="% of audits assessing each clause that conformed. Worst first.">
          {a.clauseConformance.length ? (
            <div className="space-y-2">
              {a.clauseConformance.slice(0, 10).map((c) => (
                <div key={c.clause} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 truncate text-[11px] text-slate-600" title={c.clause}>{c.clause}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${c.conformancePct}%`, background: conformanceHex(c.conformancePct) }} />
                  </div>
                  <span className="w-10 shrink-0 text-right text-[11px] font-semibold tabular-nums" style={{ color: conformanceHex(c.conformancePct) }}>{c.conformancePct}%</span>
                </div>
              ))}
            </div>
          ) : <Empty msg="Conformance renders once audits with clause-mapped checklists are executed." />}
        </Panel>
      </div>

      {/* Provenance + type */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Audit activity by source" hint="Proves the shared engine — CAMS-native vs consumer-raised (Fire / PPE / Pharma / EPC).">
          <div className="flex flex-wrap gap-2">
            {Object.entries(a.bySourceModule).map(([k, v]) => (
              <span key={k} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">{k} <span className="ml-1 font-semibold tabular-nums">{v}</span></span>
            ))}
          </div>
        </Panel>
        <Panel title="Engagements by type">
          <div className="flex flex-wrap gap-2">
            {Object.entries(a.byType).map(([k, v]) => (
              <span key={k} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">{engagementTypeLabel(k)} <span className="ml-1 font-semibold tabular-nums">{v}</span></span>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Empty({ msg = "No data yet." }: { msg?: string }) {
  return <div className="py-8 text-center text-xs text-slate-400">{msg}</div>;
}
