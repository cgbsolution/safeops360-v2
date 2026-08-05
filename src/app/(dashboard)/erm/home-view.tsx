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
import { ErmAlerts } from "@/components/erm/erm-alerts";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { BAND_HEX, type DashboardSummary } from "./lib";

const BAND_ORDER = [
  { key: "critical", label: "Critical", hex: BAND_HEX.CRITICAL },
  { key: "high", label: "High", hex: BAND_HEX.HIGH },
  { key: "medium", label: "Medium", hex: BAND_HEX.MEDIUM },
  { key: "low", label: "Low", hex: BAND_HEX.LOW },
] as const;

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
      {/* Header row — title + notifications bell */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Enterprise Risk Dashboard</h1>
          <p className="text-xs text-slate-500">Residual exposure, treatment progress and drivers across the estate</p>
        </div>
        <ErmAlerts />
      </div>

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

      {/* Residual band spread — full Critical → Low breakdown */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Residual bands</span>
        {[
          { band: "CRITICAL", label: "Critical", value: summary.criticalResidual, hex: BAND_HEX.CRITICAL },
          { band: "HIGH", label: "High", value: summary.highResidual, hex: BAND_HEX.HIGH },
          { band: "MEDIUM", label: "Medium", value: summary.mediumResidual, hex: BAND_HEX.MEDIUM },
          { band: "LOW", label: "Low", value: summary.lowResidual, hex: BAND_HEX.LOW },
        ].map((b) => (
          <Link
            key={b.band}
            href={`/erm/register?band=${b.band}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-300"
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: b.hex }} />
            {b.label}
            <span className="tabular-nums font-semibold text-slate-900">{b.value}</span>
          </Link>
        ))}
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
                <Button
                  key={m}
                  type="button"
                  variant="ghost"
                  onClick={() => setMode(m)}
                  className={cn(
                    "h-auto rounded-md px-3 py-1.5 transition-all",
                    mode === m ? "bg-white text-primary-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {m === "INHERENT" ? "Inherent" : "Residual"}
                </Button>
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

      {/* Risk by Department / Business Unit — stacked horizontal bars */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Risk by Department / Business Unit</h2>
        <p className="mb-4 text-xs text-slate-500">Residual band spread per business unit</p>
        {summary.departmentBars.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">No business-unit risk data yet.</p>
        ) : (
          <div className="space-y-3">
            {summary.departmentBars.map((d) => (
              <div key={d.businessUnit} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-xs font-medium text-slate-700" title={d.businessUnit}>
                  {d.businessUnit}
                </span>
                <div className="flex h-5 flex-1 overflow-hidden rounded bg-slate-100">
                  {BAND_ORDER.map((b) =>
                    d[b.key] > 0 ? (
                      <div
                        key={b.key}
                        className="h-full"
                        style={{ width: `${(d[b.key] / Math.max(d.total, 1)) * 100}%`, backgroundColor: b.hex }}
                        title={`${b.label}: ${d[b.key]}`}
                      />
                    ) : null,
                  )}
                </div>
                <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-600">{d.total}</span>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
              {BAND_ORDER.map((b) => (
                <span key={b.key} className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: b.hex }} />
                  {b.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mitigation progress + Top root causes */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Mitigation progress */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Mitigation Progress</h2>
          <p className="mb-4 text-xs text-slate-500">Treatment completion across open risk treatments</p>
          <div className="mb-1 flex items-end justify-between">
            <span className="text-2xl font-bold tabular-nums text-slate-900">{summary.mitigationProgressPct}%</span>
            <span className="text-xs text-slate-500">avg completion across open treatments</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(Math.max(summary.mitigationProgressPct, 0), 100)}%` }}
            />
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <span className="text-xs font-medium text-slate-600">Overdue actions</span>
            <Link
              href="/erm/treatments?overdueOnly=1"
              className={
                "text-sm font-bold tabular-nums hover:underline " +
                (summary.overdueTreatments > 0 ? "text-rose-600" : "text-slate-500")
              }
            >
              {summary.overdueTreatments}
            </Link>
          </div>
        </div>

        {/* Top root causes */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Top Root Causes</h2>
          <p className="mb-4 text-xs text-slate-500">Most frequent drivers from approved RCA</p>
          {summary.topRootCauses.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">No approved RCA data yet.</p>
          ) : (
            <ul className="space-y-2">
              {summary.topRootCauses.map((rc, i) => (
                <li
                  key={`${rc.label}-${i}`}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-medium text-slate-800" title={rc.label}>
                        {rc.label}
                      </span>
                      {rc.isRecurringDriver && (
                        <span className="shrink-0 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                          recurring driver
                        </span>
                      )}
                    </div>
                    {rc.categoryName && <span className="block truncate text-[11px] text-slate-400">{rc.categoryName}</span>}
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-[11px] font-medium tabular-nums text-slate-500">
                    {rc.riskReach} risk{rc.riskReach === 1 ? "" : "s"} · {rc.occurrences} occ.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Pending approvals — items awaiting a governance decision (§7.5) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Pending Approvals</h2>
            <p className="text-xs text-slate-500">Risks awaiting validation &amp; treatments awaiting verification</p>
          </div>
          <span
            className={
              "rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums " +
              ((summary.pendingApprovals ?? 0) > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500")
            }
          >
            {summary.pendingApprovals ?? 0}
          </span>
        </div>
        {(summary.pendingApprovalItems?.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">Nothing awaiting approval.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {(summary.pendingApprovalItems ?? []).map((it, i) => (
              <li key={`${it.code}-${i}`} className="flex items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold " +
                      (it.type === "RISK" ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700")
                    }
                  >
                    {it.type}
                  </span>
                  <Link href={it.href} className="truncate text-sm font-medium text-primary-700 hover:underline">
                    {it.code}
                  </Link>
                  {it.title && <span className="truncate text-xs text-slate-500">{it.title}</span>}
                </div>
                <span className="shrink-0 whitespace-nowrap text-[11px] font-medium text-slate-400">
                  {(it.state ?? "").replace(/_/g, " ").toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Top 10 */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Top 10 Risks (by residual score)</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Residual</TableHead>
              <TableHead>Trend</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Review</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.topRisks.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-semibold tabular-nums text-slate-400">{r.rank}</TableCell>
                <TableCell>
                  <Link href={`/erm/register/${r.id}`} className="font-medium text-primary-700 hover:underline">
                    {r.riskCode}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[280px] truncate">{r.title}</TableCell>
                <TableCell>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                    style={{ backgroundColor: r.categoryColor ?? "#64748b" }}
                  >
                    {r.categoryCode}
                  </span>
                </TableCell>
                <TableCell>
                  <BandBadge band={r.residualBand} score={r.residualScore} />
                </TableCell>
                <TableCell>
                  <TrendArrow trend={r.trend} delta={r.trendDelta} />
                </TableCell>
                <TableCell className="text-xs text-slate-600">{r.riskOwnerName ?? "—"}</TableCell>
                <TableCell className="text-xs tabular-nums text-slate-500">
                  {r.daysToReview != null ? (r.daysToReview < 0 ? <span className="text-rose-600">{Math.abs(r.daysToReview)}d overdue</span> : `${r.daysToReview}d`) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
