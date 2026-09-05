import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { getAccessiblePlantIds } from "@/lib/dashboard/scope";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiTrendLine, MultiKpiTrend } from "@/components/manhours/widgets/trend-charts";
import { loadTrendHistory, buildMonthAxis } from "@/lib/manhours/dashboard-loaders";
import { KpiEngine, type KpiPeriod, type KpiResult } from "@/lib/manhours/kpi-engine";
import { KPI_REGISTRY, type KpiCode } from "@/lib/manhours/kpi-registry";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PERIODS = [
  { key: "12", label: "12 months", months: 12 },
  { key: "24", label: "24 months", months: 24 },
  { key: "36", label: "36 months", months: 36 },
  { key: "60", label: "5 years", months: 60 }
] as const;

const FOCUS_KPIS: KpiCode[] = ["LTIFR", "TRIFR", "SEVERITY_RATE", "NEAR_MISS_RATE"];

export default async function TrendsPage(props: {
  searchParams: Promise<{ plantId?: string; range?: string }>;
}) {
  const sp = await props.searchParams;
  await requirePermission("MANHOURS.READ");

  const accessibleIds = await getAccessiblePlantIds();
  const plants = await prisma.plant.findMany({
    where: accessibleIds ? { id: { in: accessibleIds } } : undefined,
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true }
  });

  const range = PERIODS.find((p) => p.key === sp.range) ?? PERIODS[1];
  const plantId = sp.plantId && plants.some((p) => p.id === sp.plantId) ? sp.plantId : null;
  const scope = plantId ? { plantId } : {};
  const scopeLabel = plantId ? plants.find((p) => p.id === plantId)!.name : "All plants";

  // Multi-period history for the focus KPIs.
  const trendData = await loadTrendHistory({
    prisma,
    codes: FOCUS_KPIS,
    scope,
    months: range.months
  });

  // YoY comparison: current rolling-12 vs same window last year.
  const now = new Date();
  const anchorMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const anchorYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const curPeriod: KpiPeriod = { year: anchorYear, month: anchorMonth, isRolling12: true };
  const priorPeriod: KpiPeriod = { year: anchorYear - 1, month: anchorMonth, isRolling12: true };
  const engine = new KpiEngine(prisma);
  const [curBatch, priorBatch] = await Promise.all([
    engine.computeKpiBatch(FOCUS_KPIS, scope, curPeriod),
    engine.computeKpiBatch(FOCUS_KPIS, scope, priorPeriod)
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Multi-period trends"
        description={`${scopeLabel} · KPI evolution over ${range.label} + year-over-year benchmark`}
        breadcrumbs={[{ label: "Manhours", href: "/manhours" }, { label: "Trends" }]}
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-[11px] uppercase tracking-wider text-slate-500">Plant</div>
        <Button asChild variant={!plantId ? "default" : "outline"} size="sm">
          <Link href={`/manhours/trends?range=${range.key}`}>All plants</Link>
        </Button>
        {plants.map((p) => (
          <Button key={p.id} asChild variant={plantId === p.id ? "default" : "outline"} size="sm">
            <Link href={`/manhours/trends?range=${range.key}&plantId=${p.id}`}>{p.code}</Link>
          </Button>
        ))}
        <span className="mx-2 text-slate-300">|</span>
        <div className="text-[11px] uppercase tracking-wider text-slate-500">Range</div>
        {PERIODS.map((p) => (
          <Button key={p.key} asChild variant={p.key === range.key ? "default" : "outline"} size="sm">
            <Link href={`/manhours/trends?range=${p.key}${plantId ? `&plantId=${plantId}` : ""}`}>{p.label}</Link>
          </Button>
        ))}
      </div>

      {/* YoY tile row */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Year-over-year</CardTitle>
          <CardDescription>
            Rolling 12-month ending {curBatch[FOCUS_KPIS[0]]?.period.label ?? "—"} vs same window one year ago.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {FOCUS_KPIS.map((code) => {
              const cur = curBatch[code];
              const prior = priorBatch[code];
              if (!cur || !prior) return null;
              const def = KPI_REGISTRY[code];
              const delta = prior.value !== 0 ? ((cur.value - prior.value) / Math.abs(prior.value)) * 100 : null;
              const direction = deltaDirection(delta, def.isPercentage ?? false);
              const goodDirection =
                direction === "FLAT"
                  ? "flat"
                  : (direction === "UP") === def.higherIsBetter
                    ? "good"
                    : "bad";
              return (
                <YoyTile
                  key={code}
                  name={def.name}
                  code={code}
                  current={cur}
                  prior={prior}
                  delta={delta}
                  direction={direction}
                  goodDirection={goodDirection}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Multi-KPI overlay over the chosen range */}
      <MultiKpiTrend
        title={`Leading + lagging — ${range.label}`}
        subtitle="LTIFR + TRIFR (lagging) overlaid with Near Miss Rate (leading) — rising leading + falling lagging is the healthy pattern"
        data={trendData}
        kpiCodes={FOCUS_KPIS}
      />

      {/* One per focus KPI for readability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {FOCUS_KPIS.map((code) => (
          <KpiTrendLine
            key={code}
            title={KPI_REGISTRY[code].name}
            subtitle={`${range.label} · ${KPI_REGISTRY[code].formula}`}
            data={trendData}
            kpiCode={code}
            benchmark={
              KPI_REGISTRY[code].benchmarks
                ? {
                    worldClass: KPI_REGISTRY[code].benchmarks!.worldClass,
                    label: `World-class ${KPI_REGISTRY[code].benchmarks!.worldClass}`
                  }
                : null
            }
          />
        ))}
      </div>
    </div>
  );
}

function YoyTile({
  name,
  code,
  current,
  prior,
  delta,
  direction,
  goodDirection
}: {
  name: string;
  code: KpiCode;
  current: KpiResult;
  prior: KpiResult;
  delta: number | null;
  direction: "UP" | "DOWN" | "FLAT";
  goodDirection: "good" | "bad" | "flat";
}) {
  return (
    <Card className="rounded-md border bg-white p-3 shadow-none">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{name}</div>
      <div className="mt-1 flex items-baseline justify-between">
        <div className="text-2xl font-bold tabular-nums" style={{ color: current.bandColor }}>
          {current.formattedValue}
        </div>
        <div className="text-[11px] text-slate-500 tabular-nums">prev {prior.formattedValue}</div>
      </div>
      {delta != null ? (
        <div
          className={cn(
            "mt-1 inline-flex items-center gap-1 text-xs",
            goodDirection === "good" && "text-emerald-700",
            goodDirection === "bad" && "text-rose-700",
            goodDirection === "flat" && "text-slate-500"
          )}
        >
          {direction === "UP" ? (
            <ArrowUp size={12} />
          ) : direction === "DOWN" ? (
            <ArrowDown size={12} />
          ) : (
            <Minus size={12} />
          )}
          <span className="tabular-nums font-medium">
            {Math.abs(delta).toFixed(1)}%
          </span>
          <span className="text-slate-500">YoY</span>
        </div>
      ) : (
        <div className="mt-1 text-xs text-slate-500">No prior baseline</div>
      )}
      <div className="mt-1 text-[10px] text-slate-400 font-mono">{code}</div>
    </Card>
  );
}

function deltaDirection(delta: number | null, isPercentage: boolean): "UP" | "DOWN" | "FLAT" {
  if (delta == null) return "FLAT";
  const threshold = isPercentage ? 0.5 : 5;
  if (Math.abs(delta) < threshold) return "FLAT";
  return delta > 0 ? "UP" : "DOWN";
}
