"use client";

import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { HeatMap, BandBadge, KpiTile } from "@/components/erm/shared";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { STATE_CHIP, type Band, type HeatMapCell } from "../../lib";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Response shape of GET /api/erm/dashboard/category/{code}
export type CategoryDrilldown = {
  category: { code: string; name: string; description: string; colorHex: string };
  total: number;
  subCategoryDonut: { code: string; count: number }[];
  bandCounts: Record<Band, number>;
  residualHeatMap: HeatMapCell[];
  risks: {
    id: string;
    riskCode: string;
    title: string;
    residualScore: number | null;
    residualBand: string | null;
    lifecycleState: string;
  }[];
};

// Palette for donut slices — falls back through these when a sub-category has no colour.
const DONUT_PALETTE = ["#2563eb", "#7c3aed", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777", "#475569"];

export function CategoryDrilldownView({ data }: { data: CategoryDrilldown }) {
  const { category, total, subCategoryDonut, bandCounts, residualHeatMap, risks } = data;
  const donutData = subCategoryDonut.filter((d) => d.count > 0);

  return (
    <div className="space-y-5">
      {/* Header card */}
      <Card className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-none">
        <span className="h-10 w-10 shrink-0 rounded-lg" style={{ backgroundColor: category.colorHex }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">{category.name}</h2>
            <Badge variant="neutral" className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: category.colorHex }}>
              {category.code}
            </Badge>
          </div>
          {category.description && <p className="mt-0.5 text-sm text-slate-500">{category.description}</p>}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums text-slate-900">{total}</div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total risks</div>
        </div>
      </Card>

      {/* Band KPI tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="Low" value={bandCounts?.LOW ?? 0} tone="good" href={`/erm/register?category=${category.code}&band=LOW`} />
        <KpiTile label="Medium" value={bandCounts?.MEDIUM ?? 0} tone="warn" href={`/erm/register?category=${category.code}&band=MEDIUM`} />
        <KpiTile label="High" value={bandCounts?.HIGH ?? 0} tone="high" href={`/erm/register?category=${category.code}&band=HIGH`} />
        <KpiTile label="Critical" value={bandCounts?.CRITICAL ?? 0} tone="critical" href={`/erm/register?category=${category.code}&band=CRITICAL`} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Sub-category donut */}
        <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Sub-category Mix</h2>
          {donutData.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-400">No sub-categories with risks.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={donutData} dataKey="count" nameKey="code" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {donutData.map((d, i) => (
                    <Cell key={d.code} fill={DONUT_PALETTE[i % DONUT_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Category heat map */}
        <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Residual Heat Map</h2>
          <p className="mb-3 text-xs text-slate-500">Residual exposure for {category.name} risks</p>
          <div className="flex justify-center py-2">
            <HeatMap cells={residualHeatMap} />
          </div>
        </Card>
      </div>

      {/* Risks table */}
      <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Risks in this category</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Residual</TableHead>
              <TableHead>State</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {risks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-slate-400">
                  No risks in this category.
                </TableCell>
              </TableRow>
            ) : (
              risks.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/erm/register/${r.id}`} className="font-medium text-primary-700 hover:underline">
                      {r.riskCode}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[360px] truncate text-slate-700">{r.title}</TableCell>
                  <TableCell>
                    <BandBadge band={r.residualBand} score={r.residualScore} />
                  </TableCell>
                  <TableCell>
                    <span className={"inline-block rounded border px-2 py-0.5 text-[11px] " + (STATE_CHIP[r.lifecycleState] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
                      {r.lifecycleState.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
