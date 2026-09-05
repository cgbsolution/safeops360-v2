import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { getAccessiblePlantIds } from "@/lib/dashboard/scope";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiEngine, type KpiPeriod, type KpiResult } from "@/lib/manhours/kpi-engine";
import { KPI_REGISTRY, type KpiCode } from "@/lib/manhours/kpi-registry";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildScorecard } from "@/lib/manhours/scorecard";
import { PerformanceScorecard } from "@/components/manhours/widgets/performance-scorecard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

// The KPIs surfaced in the comparison table. Keep this short — the
// scorecard widget below covers the weighted composite, and dense
// numerical comparison reads better with 5-6 columns than 10+.
const COMPARE_KPIS: KpiCode[] = [
  "LTIFR",
  "TRIFR",
  "SEVERITY_RATE",
  "NEAR_MISS_RATE",
  "TRAINING_COMPLIANCE",
  "INSPECTION_COMPLIANCE"
];

export default async function PlantComparePage(props: {
  searchParams: Promise<{ focusPlantId?: string }>;
}) {
  const sp = await props.searchParams;
  await requirePermission("MANHOURS.READ");

  const accessibleIds = await getAccessiblePlantIds();
  const plants = await prisma.plant.findMany({
    where: accessibleIds ? { id: { in: accessibleIds } } : undefined,
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, unitType: true }
  });

  const now = new Date();
  const anchorMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const anchorYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const period: KpiPeriod = { year: anchorYear, month: anchorMonth, isRolling12: true };

  const engine = new KpiEngine(prisma);

  // Per-plant batch of comparison KPIs + the prior-period equivalent
  // for the YoY (rolling-12 vs prior-rolling-12) delta column.
  type PlantRow = {
    plant: (typeof plants)[number];
    kpis: Record<string, KpiResult>;
    priorKpis: Record<string, KpiResult>;
  };

  const rows: PlantRow[] = await Promise.all(
    plants.map(async (plant) => {
      const scope = { plantId: plant.id };
      const kpis = await engine.computeKpiBatch(COMPARE_KPIS, scope, period);

      // Prior rolling-12 ending one month earlier.
      const priorPeriod: KpiPeriod = (() => {
        const a = new Date(anchorYear, anchorMonth - 1, 1);
        const prev = new Date(a.getFullYear(), a.getMonth() - 1, 1);
        return { year: prev.getFullYear(), month: prev.getMonth() + 1, isRolling12: true };
      })();
      const priorKpis = await engine.computeKpiBatch(COMPARE_KPIS, scope, priorPeriod);
      return { plant, kpis, priorKpis };
    })
  );

  const scorecardRows = await buildScorecard({ prisma, plants, period });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Plant-vs-plant comparison"
        description={`Rolling 12-month (${rows[0]?.kpis[COMPARE_KPIS[0]]?.period.label ?? "—"}) across ${plants.length} plants. Click any cell to drill into the KPI's audit trail.`}
        breadcrumbs={[{ label: "Manhours", href: "/manhours" }, { label: "Compare" }]}
      />

      {/* Comparison table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">KPI comparison</CardTitle>
          <CardDescription>
            Each cell shows the current rolling-12 value with the YoY change vs prior rolling-12.
            Arrows are coloured by whether the move is good for the KPI (lower-is-better KPIs invert).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader className="border-b bg-slate-50">
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  Plant
                </TableHead>
                {COMPARE_KPIS.map((c) => (
                  <TableHead key={c} className="px-3 py-2 text-right text-[11px] uppercase tracking-wider text-slate-500" title={KPI_REGISTRY[c].name}>
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y">
              {rows.map((row) => {
                const focused = sp.focusPlantId === row.plant.id;
                return (
                  <TableRow key={row.plant.id} className={cn(focused && "bg-amber-50")}>
                    <TableCell className="sticky left-0 z-10 bg-white px-3 py-2">
                      <Link href={`/manhours/mis-dashboard?plantId=${row.plant.id}`} className="block">
                        <div className="font-medium">{row.plant.name}</div>
                        <div className="text-[10px] text-slate-500">{row.plant.code} · {row.plant.unitType}</div>
                      </Link>
                    </TableCell>
                    {COMPARE_KPIS.map((code) => {
                      const cur = row.kpis[code];
                      const pri = row.priorKpis[code];
                      const def = KPI_REGISTRY[code];
                      const delta = pri && pri.value !== 0 ? ((cur.value - pri.value) / Math.abs(pri.value)) * 100 : null;
                      const goodDirection =
                        delta == null
                          ? "flat"
                          : Math.abs(delta) < (def.isPercentage ? 0.5 : 5)
                            ? "flat"
                            : (delta > 0) === def.higherIsBetter
                              ? "good"
                              : "bad";
                      return (
                        <TableCell key={code} className="px-3 py-2 text-right">
                          <Link
                            href={kpiHref(code, row.plant.id, anchorYear, anchorMonth)}
                            className="inline-block group"
                          >
                            <div
                              className="font-bold tabular-nums group-hover:underline"
                              style={{ color: cur.bandColor }}
                            >
                              {cur.formattedValue}
                            </div>
                            {delta != null && (
                              <div
                                className={cn(
                                  "text-[10px] inline-flex items-center gap-0.5 tabular-nums",
                                  goodDirection === "good" && "text-emerald-600",
                                  goodDirection === "bad" && "text-rose-600",
                                  goodDirection === "flat" && "text-slate-500"
                                )}
                              >
                                {delta > 0 ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
                                {Math.abs(delta).toFixed(1)}%
                              </div>
                            )}
                          </Link>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PerformanceScorecard rows={scorecardRows} />
    </div>
  );
}

function kpiHref(code: KpiCode, plantId: string, year: number, month: number): string {
  const p = new URLSearchParams({
    code,
    plantId,
    year: String(year),
    month: String(month),
    isRolling12: "true",
    includeTrend: "true"
  });
  return `/manhours/kpi?${p.toString()}`;
}
