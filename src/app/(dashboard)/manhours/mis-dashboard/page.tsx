import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessiblePlantIds } from "@/lib/dashboard/scope";
import { requirePermission } from "@/lib/auth/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PERSONA_KEYS,
  PERSONA_LABELS,
  PERSONA_LAYOUTS,
  personaForRole,
  type PersonaKey,
  type WidgetConfig
} from "@/lib/manhours/personas";
import {
  buildMonthAxis,
  kpiDrillHref,
  loadHeinrichPyramid,
  loadKpiSingle,
  loadOpenItems,
  loadPlantComparison,
  loadSubmissionGrid,
  loadTrendHistory
} from "@/lib/manhours/dashboard-loaders";
import { buildScorecard } from "@/lib/manhours/scorecard";
import type { KpiPeriod, KpiScope } from "@/lib/manhours/kpi-engine";
import { KPI_REGISTRY, type KpiCode } from "@/lib/manhours/kpi-registry";

// Widget components
import { KpiTile } from "@/components/manhours/widgets/kpi-tile";
import { KpiGauge } from "@/components/manhours/widgets/kpi-gauge";
import { DaysSinceStreak } from "@/components/manhours/widgets/days-since-streak";
import { KpiTrendLine, MultiKpiTrend } from "@/components/manhours/widgets/trend-charts";
import { PlantComparisonBar } from "@/components/manhours/widgets/plant-comparison-bar";
import { PerformanceScorecard } from "@/components/manhours/widgets/performance-scorecard";
import { OpenItemsCounter } from "@/components/manhours/widgets/open-items-counter";
import { SubmissionStatusMini } from "@/components/manhours/widgets/submission-status-mini";
import { HeinrichPyramid } from "@/components/dashboard/charts";

export const dynamic = "force-dynamic";

export default async function MisDashboardPage(props: {
  searchParams: Promise<{ persona?: string }>;
}) {
  const sp = await props.searchParams;
  await requirePermission("MANHOURS.READ");

  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string;
  const userRole = (session?.user as any)?.role as string | null;
  const userPlantId = (session?.user as any)?.plantId as string | null;

  // Persona resolution: query param wins, then user-role default,
  // then fall back to corporate-hse (broad view).
  const requested = (sp.persona as PersonaKey | undefined);
  const persona: PersonaKey =
    (requested && PERSONA_KEYS.includes(requested) ? requested : null) ??
    personaForRole(userRole) ??
    "corporate-hse";
  const layout = PERSONA_LAYOUTS[persona];

  // Anchor: most-recently-completed month + rolling-12 window.
  const now = new Date();
  const anchorYear = now.getFullYear();
  const anchorMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // last completed
  const rollingPeriod: KpiPeriod = { year: anchorYear, month: anchorMonth + 1, isRolling12: true };

  // Plants visible to this user — collected from UserRole PLANT-scoped entries
  // (covers multi-plant assignments like NW+SW for Meridian Manufacturing).
  // Group-wide roles see all plants.
  const accessibleIds = await getAccessiblePlantIds();
  const allPlants = await prisma.plant.findMany({
    where: accessibleIds ? { id: { in: accessibleIds } } : undefined,
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true }
  });

  // Resolve scope per widget. user-plant mode uses session.plantId;
  // falls back to company-wide if the user has no plant assigned
  // (Corporate HSE, CEO, ADMIN).
  function scopeFor(widget: WidgetConfig): KpiScope {
    const mode = widget.options?.scopeMode ?? layout.defaultScope;
    if (mode === "user-plant" && userPlantId) return { plantId: userPlantId };
    return {};
  }

  function scopeLabelFor(widget: WidgetConfig): string {
    const mode = widget.options?.scopeMode ?? layout.defaultScope;
    if (mode === "user-plant" && userPlantId) {
      const p = allPlants.find((x) => x.id === userPlantId);
      return p?.name ?? "Your plant";
    }
    return "All plants";
  }

  // Load every widget's data. Sequential per-widget loops would
  // serialise on the connection pool anyway, but we issue the
  // top-level loaders in parallel where their queries are
  // independent.
  const widgetData = await Promise.all(
    layout.widgets.map(async (w) => {
      const scope = scopeFor(w);
      try {
        return { widget: w, data: await loadWidget(w, scope) };
      } catch (e: any) {
        return { widget: w, data: null, error: e?.message ?? "Load failed" };
      }
    })
  );

  async function loadWidget(w: WidgetConfig, scope: KpiScope): Promise<unknown> {
    switch (w.kind) {
      case "DAYS_SINCE_LTI": {
        const { result } = await loadKpiSingle({
          prisma,
          code: "DAYS_SINCE_LAST_LTI",
          scope,
          period: rollingPeriod,
          withTrend: false
        });
        return { days: result.value, scopeLabel: scopeLabelFor(w) };
      }
      case "KPI_TILE": {
        const code = w.options?.kpiCode;
        if (!code) throw new Error("KPI_TILE requires options.kpiCode");
        const r = await loadKpiSingle({ prisma, code, scope, period: rollingPeriod, withTrend: true });
        return { kpi: r.result, trend: r.trend, href: kpiDrillHref({ code, scope, period: rollingPeriod }) };
      }
      case "KPI_GAUGE": {
        const code = w.options?.kpiCode;
        if (!code) throw new Error("KPI_GAUGE requires options.kpiCode");
        const r = await loadKpiSingle({ prisma, code, scope, period: rollingPeriod, withTrend: false });
        return { kpi: r.result, href: kpiDrillHref({ code, scope, period: rollingPeriod }) };
      }
      case "KPI_TREND_LINE": {
        const code = w.options?.kpiCode;
        if (!code) throw new Error("KPI_TREND_LINE requires options.kpiCode");
        const months = w.options?.months ?? 12;
        const data = await loadTrendHistory({ prisma, codes: [code], scope, months });
        return { data, code, benchmark: kpiBenchmark(code) };
      }
      case "MULTI_KPI_TREND": {
        const codes = w.options?.kpiCodes ?? [];
        if (codes.length === 0) throw new Error("MULTI_KPI_TREND requires options.kpiCodes");
        const months = w.options?.months ?? 12;
        const data = await loadTrendHistory({ prisma, codes, scope, months });
        return { data, codes };
      }
      case "PLANT_COMPARISON_BAR": {
        const code = w.options?.kpiCode;
        if (!code) throw new Error("PLANT_COMPARISON_BAR requires options.kpiCode");
        const data = await loadPlantComparison({ prisma, code, period: rollingPeriod, plants: allPlants });
        const def = KPI_REGISTRY[code];
        return { data, higherIsBetter: def.higherIsBetter, target: def.benchmarks?.worldClass ?? null, code };
      }
      case "PERFORMANCE_SCORECARD": {
        const rows = await buildScorecard({ prisma, plants: allPlants, period: rollingPeriod });
        return { rows };
      }
      case "OPEN_ITEMS_COUNTER": {
        return await loadOpenItems({ prisma, scope, userId });
      }
      case "SUBMISSION_STATUS_MINI": {
        return await loadSubmissionGrid({ prisma, scope, monthCount: 12 });
      }
      case "HEINRICH_PYRAMID": {
        return await loadHeinrichPyramid({ prisma, scope });
      }
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${layout.title} dashboard`}
        description={layout.description}
        action={<PersonaSwitcher current={persona} />}
      />

      <div className="grid grid-cols-12 gap-3">
        {widgetData.map((entry, i) => (
          <div key={i} className={colSpanClass(entry.widget.cols)}>
            <Widget entry={entry} />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
        Want more? See the&nbsp;
        <Link className="text-primary-700 hover:underline" href="/manhours/compare">
          plant-vs-plant comparison
        </Link>
        &nbsp;or the&nbsp;
        <Link className="text-primary-700 hover:underline" href="/manhours/trends">
          multi-period trends
        </Link>
        .
      </div>
    </div>
  );
}

// ── Widget dispatcher ─────────────────────────────────────────

type WidgetEntry = { widget: WidgetConfig; data: any; error?: string };

function Widget({ entry }: { entry: WidgetEntry }) {
  if (entry.error) {
    return (
      <Card>
        <CardContent className="p-4 text-xs text-rose-700 bg-rose-50 rounded">
          <div className="font-medium">{entry.widget.kind}</div>
          <div className="mt-1">{entry.error}</div>
        </CardContent>
      </Card>
    );
  }
  const w = entry.widget;
  const d = entry.data;
  switch (w.kind) {
    case "DAYS_SINCE_LTI":
      return <DaysSinceStreak days={d.days} scopeLabel={d.scopeLabel} />;
    case "KPI_TILE":
      return <KpiTile kpi={d.kpi} trend={d.trend} href={d.href} />;
    case "KPI_GAUGE":
      return <KpiGauge kpi={d.kpi} href={d.href} />;
    case "KPI_TREND_LINE":
      return (
        <KpiTrendLine
          title={KPI_REGISTRY[d.code as KpiCode].name}
          subtitle={`${d.data.length}-month trend`}
          data={d.data}
          kpiCode={d.code}
          benchmark={d.benchmark}
        />
      );
    case "MULTI_KPI_TREND":
      return (
        <MultiKpiTrend
          title="Leading + lagging trend"
          subtitle={`${d.codes.length} KPIs · ${d.data.length}-month window`}
          data={d.data}
          kpiCodes={d.codes}
        />
      );
    case "PLANT_COMPARISON_BAR":
      return (
        <PlantComparisonBar
          title={`${KPI_REGISTRY[d.code as KpiCode].name} — by plant`}
          subtitle="Rolling 12-month"
          data={d.data}
          higherIsBetter={d.higherIsBetter}
          target={d.target}
        />
      );
    case "PERFORMANCE_SCORECARD":
      return <PerformanceScorecard rows={d.rows} href={(r) => `/manhours/compare?focusPlantId=${r.plantId}`} />;
    case "OPEN_ITEMS_COUNTER":
      return <OpenItemsCounter items={d} />;
    case "SUBMISSION_STATUS_MINI":
      return (
        <SubmissionStatusMini
          title="Submission status"
          description="Last 12 months · all plants in scope"
          plants={d.plants}
          monthsAxis={d.monthsAxis}
          cells={d.cells}
        />
      );
    case "HEINRICH_PYRAMID":
      return (
        <Card className="h-full">
          <CardContent className="p-4">
            <div className="text-sm font-semibold mb-2">Heinrich Pyramid</div>
            <div className="text-[10px] text-slate-500 mb-3">Rolling 12-month event mix</div>
            <HeinrichPyramid data={d} />
          </CardContent>
        </Card>
      );
  }
}

function kpiBenchmark(code: KpiCode) {
  const b = KPI_REGISTRY[code].benchmarks;
  return b ? { worldClass: b.worldClass, label: `World-class ${b.worldClass}` } : null;
}

/**
 * Tailwind JIT only picks up class names it can see as literal
 * strings during the build. Dynamic concatenation like
 * `md:col-span-${cols}` produces no output. This switch returns
 * literal strings the scanner finds.
 */
function colSpanClass(cols: 3 | 4 | 6 | 8 | 12): string {
  switch (cols) {
    case 3: return "col-span-12 md:col-span-3";
    case 4: return "col-span-12 md:col-span-4";
    case 6: return "col-span-12 md:col-span-6";
    case 8: return "col-span-12 md:col-span-8";
    case 12: return "col-span-12";
  }
}

// ── Persona switcher ─────────────────────────────────────────

function PersonaSwitcher({ current }: { current: PersonaKey }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] uppercase tracking-wider text-slate-500">View as</span>
      {PERSONA_KEYS.map((p) => (
        <Button key={p} asChild variant={p === current ? "default" : "outline"} size="sm">
          <Link href={`/manhours/mis-dashboard?persona=${p}`}>{PERSONA_LABELS[p]}</Link>
        </Button>
      ))}
    </div>
  );
}
