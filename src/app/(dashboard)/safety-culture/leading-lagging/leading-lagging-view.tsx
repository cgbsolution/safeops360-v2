"use client";

// Leading / Lagging Ratio — the drill-down for the 20%-weighted Culture Maturity
// component. Headline ratio (e.g. "55:1") + 0-100 score (identical to the maturity
// component bar), a 6-month trend with a site-configurable target line, and a fully
// transparent breakdown table (each leading + lagging component with raw counts).

import * as React from "react";
import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { ScoreDial } from "../ui";
import { PALETTE, scoreColor, type LeadingLaggingDetail } from "../lib";
import { Table, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Card } from "@/components/ui/card";

const GREEN = "#1F7A4D";
const AMBER = "#C9761F";

function fmtRatio(r: number): string {
  if (!Number.isFinite(r)) return "—";
  return `${r >= 10 ? Math.round(r) : r.toFixed(1)} : 1`;
}

export function LeadingLaggingView({ detail }: { detail: LeadingLaggingDetail }) {
  const trend = detail.trend ?? [];
  const chartData = trend.map((p) => ({ period: p.period.slice(2), ratio: p.ratio }));

  const LEADING = [
    { key: "observations", label: "Observations logged" },
    { key: "nearMisses", label: "Near-miss reports" },
    { key: "audits", label: "Audits / inspections" },
    { key: "trainings", label: "Training completions" },
  ] as const;
  const LAGGING = [
    { key: "incidents", label: "Recordable incidents" },
    { key: "injuries", label: "LTI / MTC / RWC / fatal" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="grid gap-4 lg:grid-cols-[auto,1fr]">
        <Card className="flex items-center gap-5 rounded-xl border bg-white p-5 shadow-none">
          <ScoreDial score={detail.score} label="LL Score" />
          <div className="max-w-md">
            <p className="text-xs uppercase tracking-wide text-slate-500">Leading : Lagging</p>
            <p className="mt-0.5 text-4xl font-bold" style={{ color: PALETTE.navy }}>
              {fmtRatio(detail.ratio)}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-semibold text-slate-800">{detail.leading.toLocaleString()}</span> leading actions
              per <span className="font-semibold text-slate-800">{detail.lagging.toLocaleString()}</span> lagging{" "}
              {detail.lagging === 1 ? "event" : "events"} over the last 90 days. Scored against a target of{" "}
              <span className="font-semibold" style={{ color: PALETTE.navy }}>
                {detail.target}:1
              </span>
              {detail.industryVertical ? ` (${detail.industryVertical} benchmark)` : ""}.
            </p>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiTile label="Leading (90d)" value={detail.leading.toLocaleString()} hint="Proactive actions" accent={GREEN} />
          <KpiTile label="Lagging (90d)" value={detail.lagging.toLocaleString()} hint="Incidents & injuries" accent="#B4232A" />
          <KpiTile label="Target ratio" value={`${detail.target}:1`} hint="Site-configurable" accent={PALETTE.gold} />
          <KpiTile
            label="Maturity contribution"
            value={`${Math.round(detail.score)}`}
            hint="0-100 · 20% weight"
          />
        </div>
      </div>

      {/* Under-reporting caveat */}
      {detail.underReporting && (
        <Card
          className="flex items-start gap-2 rounded-xl border p-4 text-sm shadow-none"
          style={{ borderColor: AMBER, background: "#FBF7EC", color: "#7A6320" }}>
          <span className="mt-0.5" style={{ color: AMBER }}>
            ⚠
          </span>
          <div>
            <span className="font-semibold">A ratio under 10:1 is a possible under-reporting signal, not a good score.</span>{" "}
            Mature cultures typically run 50–100 near-misses per recordable (SmartQHSE guidance). A very low ratio usually
            means leading activity — near-miss and observation reporting — is being under-recorded, not that the site is
            unusually safe.
          </div>
        </Card>
      )}

      {/* Trend */}
      <Card className="rounded-xl border bg-white p-5 shadow-none">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold" style={{ color: PALETTE.navy }}>
            6-month ratio trend
          </p>
          <span className="text-xs text-slate-500">Monthly leading ÷ lagging · target line at {detail.target}:1</span>
        </div>
        {chartData.length < 2 ? (
          <p className="py-8 text-center text-sm text-slate-400">Not enough history yet to draw a trend.</p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#EEF2F7" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  formatter={(v: number) => [`${v}:1`, "Ratio"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}
                />
                <ReferenceLine
                  y={detail.target}
                  stroke={PALETTE.gold}
                  strokeDasharray="4 4"
                  label={{ value: `Target ${detail.target}:1`, fontSize: 10, fill: "#7A6320", position: "insideTopRight" }}
                />
                <Line
                  type="monotone"
                  dataKey="ratio"
                  stroke={PALETTE.navy}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: PALETTE.navy }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Breakdown table (transparency — mirrors BBS's component → count pattern) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <BreakdownCard
          title="Leading indicators"
          subtitle="Proactive activity (numerator)"
          rows={LEADING.map((c) => ({ label: c.label, value: detail.breakdown[c.key] ?? 0 }))}
          total={detail.leading}
          accent={GREEN}
        />
        <BreakdownCard
          title="Lagging indicators"
          subtitle="Outcome events (denominator) — from Incident Management"
          rows={LAGGING.map((c) => ({ label: c.label, value: detail.breakdown[c.key] ?? 0 }))}
          total={detail.lagging}
          accent="#B4232A"
        />
      </div>
    </div>
  );
}

function KpiTile({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <Card className="rounded-xl border bg-white p-5 shadow-none">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold" style={{ color: accent ?? PALETTE.navy }}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </Card>
  );
}

function BreakdownCard({
  title,
  subtitle,
  rows,
  total,
  accent,
}: {
  title: string;
  subtitle: string;
  rows: { label: string; value: number }[];
  total: number;
  accent: string;
}) {
  return (
    <Card className="rounded-xl border bg-white p-5 shadow-none">
      <div className="mb-3">
        <p className="text-sm font-semibold" style={{ color: PALETTE.navy }}>
          {title}
        </p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      <Table>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.label} className="border-b last:border-0">
              <TableCell className="py-2 text-slate-600">{r.label}</TableCell>
              <TableCell className="py-2 text-right font-semibold" style={{ color: PALETTE.navy }}>
                {r.value.toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Total</TableCell>
            <TableCell className="py-2 text-right text-lg font-bold" style={{ color: accent }}>
              {total.toLocaleString()}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>
  );
}
