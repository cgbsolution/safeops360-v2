"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const PRIMARY = "#7c3aed";
const COLOURS = ["#7c3aed", "#f59e0b", "#10b981", "#0ea5e9", "#ef4444", "#06b6d4"];

export interface TrendPoint {
  month: string; // formatted label e.g. "Apr 26"
  /** Map of code → numeric value. Missing values render as gaps. */
  values: Record<string, number | null>;
}

/**
 * Single-KPI line over a configurable history. Optional target /
 * benchmark reference line drawn at world-class threshold.
 */
export function KpiTrendLine({
  title,
  subtitle,
  data,
  kpiCode,
  benchmark
}: {
  title: string;
  subtitle?: string;
  data: TrendPoint[];
  kpiCode: string;
  benchmark?: { worldClass: number; label: string } | null;
}) {
  const chartData = data.map((p) => ({ month: p.month, value: p.values[kpiCode] }));
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" />
            <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
            {benchmark && (
              <ReferenceLine
                y={benchmark.worldClass}
                stroke="#10b981"
                strokeDasharray="4 4"
                label={{ value: benchmark.label, position: "right", fill: "#10b981", fontSize: 10 }}
              />
            )}
            <Line type="monotone" dataKey="value" name={kpiCode} stroke={PRIMARY} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Multiple KPIs overlaid on the same axis. Useful for the
 * leading-lagging story: NEAR_MISS_RATE rising while LTIFR holds
 * means the reporting culture is working.
 */
export function MultiKpiTrend({
  title,
  subtitle,
  data,
  kpiCodes
}: {
  title: string;
  subtitle?: string;
  data: TrendPoint[];
  kpiCodes: string[];
}) {
  const chartData = data.map((p) => {
    const row: Record<string, number | string | null> = { month: p.month };
    for (const code of kpiCodes) row[code] = p.values[code] ?? null;
    return row;
  });
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" />
            <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {kpiCodes.map((code, i) => (
              <Line
                key={code}
                type="monotone"
                dataKey={code}
                name={code}
                stroke={COLOURS[i % COLOURS.length]}
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
