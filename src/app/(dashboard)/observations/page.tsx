import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Can } from "@/components/auth/can";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { statusColor, humanize, workflowChipColor } from "@/lib/utils";
import { buildObservationListWhere, getReadScope } from "@/lib/auth/list-filters";
import { ObservationsTable, type ObservationRow } from "./observations-table";
import { FilterTab, FilterTabsList } from "@/components/ui/filter-tabs";
import { AnalyticsStripSkeleton } from "@/components/dashboard/analytics-strip";
import { ObservationAnalyticsStrip } from "@/components/observations/analytics-strip";
import { InsightHero } from "@/components/observations/insight-hero";
import { InsightEmptyState } from "@/components/observations/insight-empty-state";
import { ObservationAnalyticsPanels, type CategoryDatum } from "@/components/observations/analytics-panels";
import { fetchInsights } from "@/lib/insights";
import { fetchWeeklyInsights, type WeeklyInsight } from "@/lib/weekly-insights";

export const dynamic = "force-dynamic";

const SCOPE_LABELS: Record<string, string> = {
  ALL_PLANTS: "Showing observations from all plants",
  OWN_PLANT: "Showing observations from your plant",
  OWN_DEPARTMENT: "Showing observations from your department",
  OWN_RECORDS: "Showing only observations you reported or are responsible for"
};

// The observations register as /api/observations?register=true returns it: rows
// with display names and workflow chip, plus the aggregates the panels need —
// status tab counts, the open category x area rollup, per-step dwell, and the
// unsafe-record projection the hero is built from. This replaced eight separate
// queries the page used to run for itself.
type ObservationListItem = {
  id: string;
  number: string;
  /** ISO string over the wire, not a Date. */
  date: string;
  type: string;
  category: string;
  description: string;
  severity: string;
  status: string;
  areaId: string | null;
  plantName: string | null;
  areaName: string | null;
  workflow: { status: string; currentStepName: string | null } | null;
};

type ObservationRegister = {
  items: ObservationListItem[];
  statusCounts: Record<string, number>;
  categoryGroups: CategoryDatum[];
  bottleneck: { step: string; count: number; avgDays: number }[];
  openCount: number;
  unsafeRecords: {
    category: string;
    subCategoryCode: string | null;
    date: string;
    status: string;
    responsiblePersonId: string | null;
    plantId: string;
    plantName: string | null;
    areaName: string | null;
  }[];
};

const EMPTY_REGISTER: ObservationRegister = {
  items: [], statusCounts: {}, categoryGroups: [], bottleneck: [],
  openCount: 0, unsafeRecords: []
};

export default async function ObservationsPage(props: {
  searchParams: Promise<{ status?: string; insight?: string; cat?: string; area?: string }>;
}) {
  const searchParams = await props.searchParams;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const userId = (session.user as any).id as string;

  // Scope is applied backend-side from the bearer token. getReadScope stays
  // because the page shows the user WHICH scope narrowed their view.
  const [register, scope, insights, weeklyView] = await Promise.all([
    backendFetch<ObservationRegister>("/api/observations", {
      query: { register: true, status_filter: searchParams.status }
    }).catch(() => EMPTY_REGISTER),
    getReadScope(userId, "OBSERVATION.READ"),
    fetchInsights("observation"),
    // Weekly Insight Engine view (hero + secondary row lifecycle). Tolerant —
    // degrades to an empty view (e.g. before the InsightSnapshot table is applied).
    fetchWeeklyInsights("observation")
  ]);

  const observations = register.items;
  const statusCounts = register.statusCounts;
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const categoryData: CategoryDatum[] = register.categoryGroups;
  const bottleneckData = register.bottleneck;
  const nowMs = Date.now();

  const rows: ObservationRow[] = observations.map((o) => {
    const inst = o.workflow;
    const workflowStep = inst ? inst.currentStepName ?? "Completed" : humanize(o.status);
    const workflowColor = inst ? workflowChipColor(inst.status) : statusColor(o.status);
    return {
      id: o.id,
      number: o.number,
      date: o.date,
      plantName: (o.plantName ?? "").replace(" Integrated Unit", "").replace(" Grinding Unit", ""),
      areaName: o.areaName,
      areaId: o.areaId,
      type: o.type,
      category: o.category,
      description: o.description,
      severity: o.severity,
      status: o.status,
      workflowStep,
      workflowColor,
      signals: insights.signalsByRecord.get(o.id) ?? []
    };
  });

  // The category rollup and the per-step dwell now arrive with the register —
  // `categoryData` and `bottleneckData` above. Computing them here meant three
  // extra queries and a second definition of "open".

  // ── "This week's focus" hero (navy/gold mockup): the top OPEN unsafe cluster
  //    by plant + category. The rail shows a DIFFERENT cut from the left claim —
  //    where inside the unit (area breakdown) + who's holding them (ownership) +
  //    oldest. Real page-computed data; the weekly lifecycle engine is parked, so
  //    the lifecycle badge is a static "new".
  // Legacy hazard categories name an energy class outright. The DuPont STOP
  // categories are behavioural ("Positions of People" spans contact-with-current
  // AND overexertion), so for at-risk records the exposure only shows at the
  // sub-category level — hence the second set. Without it every observation
  // filed after the taxonomy change would silently lose this qualifier.
  // Mirrors insights/weekly/types.HIGH_ENERGY_SUBCATEGORIES.
  const HIGH_ENERGY = new Set([
    "HOT_WORK", "CONFINED_SPACE", "ELECTRICAL", "WORK_AT_HEIGHT", "CHEMICAL_HANDLING", "PROCESS_SAFETY", "LIFTING"
  ]);
  const HIGH_ENERGY_SUB = new Set([
    "PP_CONTACT_ELECTRICAL", "PP_CONTACT_TEMPERATURE", "PP_FALLING_DIFFERENT_LEVEL",
    "PP_CAUGHT_IN_ON_BETWEEN", "PP_STRUCK_BY", "PR_PERMIT_LOTO_BYPASSED", "TE_GUARD_MISSING"
  ]);
  const unsafeRecords = register.unsafeRecords;
  type UnsafeRec = (typeof unsafeRecords)[number];
  const openUnsafe = unsafeRecords.filter((r) => r.status !== "CLOSED");
  const clusterMap = new Map<string, UnsafeRec[]>();
  openUnsafe.forEach((r) => {
    const k = `${r.plantId}|${r.category}`;
    const arr = clusterMap.get(k) ?? [];
    arr.push(r);
    clusterMap.set(k, arr);
  });
  let topKey: string | null = null;
  let topRecs: UnsafeRec[] = [];
  for (const [k, recs] of Array.from(clusterMap.entries())) {
    if (recs.length >= 3 && recs.length > topRecs.length) {
      topKey = k;
      topRecs = recs;
    }
  }

  let fallbackHero: WeeklyInsight | null = null;
  if (topKey && topRecs.length) {
    const cat = topRecs[0].category as string;
    const count = topRecs.length;

    const areaCounts = new Map<string, number>();
    topRecs.forEach((r) => {
      const name = r.areaName ?? "Unassigned area";
      areaCounts.set(name, (areaCounts.get(name) ?? 0) + 1);
    });
    const sortedAreas = Array.from(areaCounts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
    const bars =
      sortedAreas.length > 3
        ? [
            ...sortedAreas.slice(0, 2),
            {
              label: `${sortedAreas.length - 2} other areas`,
              value: sortedAreas.slice(2).reduce((s, a) => s + a.value, 0)
            }
          ]
        : sortedAreas;

    const owned = topRecs.filter((r) => r.responsiblePersonId);
    const byOwner = new Map<string, number>();
    owned.forEach((r) => byOwner.set(r.responsiblePersonId!, (byOwner.get(r.responsiblePersonId!) ?? 0) + 1));
    const topOwner = byOwner.size ? Math.max(...Array.from(byOwner.values())) : 0;
    const ownership = { unassigned: count - owned.length, oneOwner: topOwner, others: owned.length - topOwner };

    const oldestDays = Math.max(0, ...topRecs.map((r) => Math.floor((nowMs - new Date(r.date).getTime()) / 86_400_000)));

    const clusterAll = unsafeRecords.filter((r) => `${r.plantId}|${r.category}` === topKey);
    const cut = nowMs - 90 * 86_400_000;
    const recent = clusterAll.filter((r) => new Date(r.date).getTime() >= cut).length;
    const prior = clusterAll.filter((r) => new Date(r.date).getTime() < cut).length;
    const delta = recent - prior;

    fallbackHero = {
      identityKey: `concentration:plant=${topRecs[0].plantId}|cat=${cat}`,
      type: "concentration",
      lifecycleState: "new",
      score: 0,
      weeksRunning: 1,
      display: {
        number: count,
        numberLabel: "records",
        headline: `Open unsafe ${humanize(cat).toLowerCase()} observations concentrated at ${topRecs[0].plantName ?? "this plant"}`,
        delta: delta > 0 ? `+${delta} vs prior 90d` : null,
        deltaTone: delta > 0 ? "up_bad" : "neutral",
        qualifier: (() => {
          if (HIGH_ENERGY.has(cat)) return "high-energy category";
          const hits = topRecs.filter((r) => HIGH_ENERGY_SUB.has(r.subCategoryCode ?? "")).length;
          return hits ? `${hits} high-energy exposure${hits === 1 ? "" : "s"}` : null;
        })(),
        actionLabel: "Show me these records",
        actionHref: `/observations?cat=${cat}`
      },
      rail: {
        kind: "concentration",
        railTitle: "Where inside the unit",
        bars: bars.map((b) => ({ label: b.label, value: b.value })),
        stats: [
          { value: String(ownership.unassigned), label: "unassigned", tone: ownership.unassigned ? "bad" : "neutral" },
          { value: String(ownership.oneOwner), label: "one owner" },
          { value: String(ownership.others), label: "others" }
        ],
        closing: `Oldest is ${oldestDays} days open.`
      }
    };
  }

  // "Likely duplicates" data-quality card (slot 2 of the secondary row), from
  // the existing deterministic duplicate insight.
  const dupInsight = insights.bar.find((i) => i.kind === "duplicate");
  const duplicate = dupInsight
    ? {
        sets:
          parseInt(dupInsight.headline.match(/(\d+)\s+sets/)?.[1] ?? "0", 10) ||
          Math.max(1, Math.ceil(dupInsight.recordRefs.length / 2)),
        records: dupInsight.recordRefs.length,
        pctOfOpen: Math.round((dupInsight.recordRefs.length / (register.openCount || 1)) * 100)
      }
    : null;

  // Row-filter mechanism: bar insight click-through (?insight=), plus the
  // category panel and repeat/duplicate chips (?cat / ?area). All narrow the
  // same client-visible row set — no re-query.
  const activeInsight = searchParams.insight
    ? insights.bar.find((i) => i.id === searchParams.insight)
    : undefined;
  const visibleRows = rows
    .filter((r) => (activeInsight ? activeInsight.recordRefs.includes(r.number) : true))
    .filter((r) => (searchParams.cat ? r.category === searchParams.cat : true))
    .filter((r) => (searchParams.area ? r.areaId === searchParams.area : true));

  return (
    <div>
      <PageHeader
        title="Safety Observations"
        description="Capture safe & unsafe acts and conditions across all plants"
        action={
          <Can permission="OBSERVATION.CREATE">
            <Button asChild>
              <Link href="/observations/new">
                <Plus size={16} /> New Observation
              </Link>
            </Button>
          </Can>
        }
      />

      {scope && scope !== "ALL_PLANTS" && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          {SCOPE_LABELS[scope] ?? "Filtered by your access scope"}
        </div>
      )}

      <div className="mb-4">
        <Suspense fallback={<AnalyticsStripSkeleton />}>
          <ObservationAnalyticsStrip userId={userId} />
        </Suspense>
      </div>

      {weeklyView.hero || fallbackHero ? (
        <InsightHero hero={(weeklyView.hero ?? fallbackHero)!} />
      ) : weeklyView.empty ? (
        <InsightEmptyState empty={weeklyView.empty} />
      ) : null}

      <ObservationAnalyticsPanels
        bottleneck={bottleneckData}
        category={categoryData}
        activeCategory={searchParams.cat ?? null}
        duplicate={duplicate}
      />

      {(searchParams.cat || searchParams.area) && (
        <div className="mb-4 flex items-center gap-2 text-xs text-slate-600">
          <span className="rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 font-medium text-primary-700">
            Filtered to {searchParams.cat ? humanize(searchParams.cat) : "area"}
            {searchParams.area ? " · one area" : ""}
            {" · "}
            {visibleRows.length} record{visibleRows.length === 1 ? "" : "s"}
          </span>
          <Link href="/observations" className="text-primary-700 hover:underline">
            Clear
          </Link>
        </div>
      )}

      <FilterTabsList label="Status" className="mb-4">
        <FilterTab href="/observations" label="All" count={total} active={!searchParams.status} />
        <FilterTab href="/observations?status=OPEN" label="Open" count={statusCounts.OPEN ?? 0} active={searchParams.status === "OPEN"} />
        <FilterTab href="/observations?status=ASSIGNED" label="Assigned" count={statusCounts.ASSIGNED ?? 0} active={searchParams.status === "ASSIGNED"} />
        <FilterTab href="/observations?status=IN_PROGRESS" label="In Progress" count={statusCounts.IN_PROGRESS ?? 0} active={searchParams.status === "IN_PROGRESS"} />
        <FilterTab href="/observations?status=CLOSED" label="Closed" count={statusCounts.CLOSED ?? 0} active={searchParams.status === "CLOSED"} />
      </FilterTabsList>

      <ObservationsTable data={visibleRows} />
    </div>
  );
}

