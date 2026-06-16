"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BandBadge, HeatMap, KpiTile, TrendArrow } from "@/components/erm/shared";
import { BAND_HEX, type DashboardSummary } from "./lib";

type Phase2Kpis = { redKris: number; openAppetiteBreaches: number; netLossQtd: number };

function fmtLakh(v: number): string {
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)} Cr`;
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(1)} L`;
  return `₹${v.toLocaleString("en-IN")}`;
}

export function ErmHomeView({ summary, phase2 }: { summary: DashboardSummary; phase2?: Phase2Kpis }) {
  const router = useRouter();
  const [mode, setMode] = useState<"INHERENT" | "RESIDUAL">("RESIDUAL");
  const cells = mode === "INHERENT" ? summary.inherentHeatMap : summary.residualHeatMap;

  function onCell(l: number, i: number) {
    router.push(`/erm/register?likelihood=${l}&impact=${i}`);
  }

  return (
    <div className="space-y-5">
      {/* Appetite breach banner (Phase 2) */}
      {phase2 && phase2.openAppetiteBreaches > 0 && (
        <Link
          href="/erm/appetite/breaches"
          className="flex items-center justify-between gap-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 hover:bg-rose-100"
        >
          <span>
            <b>{phase2.openAppetiteBreaches} risk-appetite breach{phase2.openAppetiteBreaches > 1 ? "es" : ""}</b> outside board-approved tolerance — committee decision required.
          </span>
          <span className="text-xs font-semibold underline">Review breaches →</span>
        </Link>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile label="Active Risks" value={summary.totalActiveRisks} href="/erm/register" />
        <KpiTile label="Critical (residual)" value={summary.criticalResidual} tone="critical" href="/erm/register?band=CRITICAL" />
        <KpiTile label="High (residual)" value={summary.highResidual} tone="high" href="/erm/register?band=HIGH" />
        <KpiTile label="Overdue Reviews" value={summary.overdueReviews} tone="warn" href="/erm/register?overdueOnly=1" />
        <KpiTile label="Open Treatments" value={summary.openTreatments} href="/erm/treatments" />
        <KpiTile label="Escalated (qtr)" value={summary.escalatedThisQuarter} tone="critical" href="/erm/register?state=ESCALATED" />
      </div>

      {/* Phase 2 monitoring strip */}
      {phase2 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <KpiTile label="RED KRIs" value={phase2.redKris} tone="critical" href="/erm/kris?status=RED" sub="Key risk indicators in the red" />
          <KpiTile label="Open Appetite Breaches" value={phase2.openAppetiteBreaches} tone="critical" href="/erm/appetite/breaches" sub="Outside board tolerance" />
          <KpiTile label="Net Loss QTD" value={fmtLakh(phase2.netLossQtd)} tone="warn" href="/erm/loss" sub="Quantified losses this quarter" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Heat map */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Enterprise Heat Map</h2>
              <p className="text-xs text-slate-500">
                {mode === "RESIDUAL" ? "Residual exposure — after current controls" : "Inherent exposure — before controls"}
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
              {(["INHERENT", "RESIDUAL"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={
                    "rounded-md px-3 py-1.5 transition-all " +
                    (mode === m ? "bg-white text-primary-700 shadow-sm" : "text-slate-500 hover:text-slate-700")
                  }
                >
                  {m === "INHERENT" ? "Inherent" : "Residual"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center py-2">
            <HeatMap cells={cells} onCellClick={onCell} />
          </div>
          <p className="mt-3 text-center text-[11px] text-slate-400">
            Click any cell to filter the register. The dot migration between inherent and residual is the value of your risk programme.
          </p>
        </div>

        {/* Movement panel */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Band Movement</h2>
          <p className="mb-3 text-xs text-slate-500">Risks that changed band this quarter</p>
          {summary.movement.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">No band changes this quarter.</p>
          ) : (
            <ul className="space-y-2">
              {summary.movement.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
                  <div className="min-w-0">
                    <Link href={`/erm/register/${m.id}`} className="block truncate text-xs font-medium text-primary-700 hover:underline">
                      {m.riskCode}
                    </Link>
                    <span className="block truncate text-[11px] text-slate-500">{m.title}</span>
                  </div>
                  <span className={"inline-flex items-center gap-1 text-xs font-semibold " + (m.direction === "UP" ? "text-rose-600" : "text-emerald-600")}>
                    {m.direction === "UP" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {m.fromBand}→{m.toBand}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Category bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Risks by Category &amp; Band</h2>
        <ResponsiveContainer width="100%" height={Math.max(220, summary.categoryBars.length * 34)}>
          <BarChart data={summary.categoryBars} layout="vertical" margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} stroke="#64748b" allowDecimals={false} />
            <YAxis type="category" dataKey="categoryName" tick={{ fontSize: 11 }} stroke="#64748b" width={120} />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
            <Bar dataKey="low" stackId="a" fill={BAND_HEX.LOW} name="Low" radius={[0, 0, 0, 0]} />
            <Bar dataKey="medium" stackId="a" fill={BAND_HEX.MEDIUM} name="Medium" />
            <Bar dataKey="high" stackId="a" fill={BAND_HEX.HIGH} name="High" />
            <Bar dataKey="critical" stackId="a" fill={BAND_HEX.CRITICAL} name="Critical" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top 10 */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Top 10 Risks (by residual score)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Code</th>
                <th className="px-2 py-2">Title</th>
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2">Residual</th>
                <th className="px-2 py-2">Trend</th>
                <th className="px-2 py-2">Owner</th>
                <th className="px-2 py-2">Review</th>
              </tr>
            </thead>
            <tbody>
              {summary.topRisks.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                  <td className="px-2 py-2 font-semibold tabular-nums text-slate-400">{r.rank}</td>
                  <td className="px-2 py-2">
                    <Link href={`/erm/register/${r.id}`} className="font-medium text-primary-700 hover:underline">
                      {r.riskCode}
                    </Link>
                  </td>
                  <td className="max-w-[280px] truncate px-2 py-2 text-slate-700">{r.title}</td>
                  <td className="px-2 py-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                      style={{ backgroundColor: r.categoryColor ?? "#64748b" }}
                    >
                      {r.categoryCode}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <BandBadge band={r.residualBand} score={r.residualScore} />
                  </td>
                  <td className="px-2 py-2">
                    <TrendArrow trend={r.trend} delta={r.trendDelta} />
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-600">{r.riskOwnerName ?? "—"}</td>
                  <td className="px-2 py-2 text-xs tabular-nums text-slate-500">
                    {r.daysToReview != null ? (r.daysToReview < 0 ? <span className="text-rose-600">{Math.abs(r.daysToReview)}d overdue</span> : `${r.daysToReview}d`) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
