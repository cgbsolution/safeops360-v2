import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

export default async function ObservationsPage(props: {
  searchParams: Promise<{ status?: string; insight?: string; cat?: string; area?: string }>;
}) {
  const searchParams = await props.searchParams;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const userId = (session.user as any).id as string;

  // RBAC scope filter — without this every user sees every observation.
  // Both helpers share the same cached underlying call (React.cache) so
  // running them in parallel costs the same as one.
  const [scopeWhere, scope] = await Promise.all([
    buildObservationListWhere(userId),
    getReadScope(userId, "OBSERVATION.READ")
  ]);
  const where = {
    ...scopeWhere,
    ...(searchParams.status ? { status: searchParams.status as any } : {})
  };

  // findMany and groupBy are independent — fire them in parallel. Slim
  // the include payload to just the fields we render in the table. The
  // deterministic insight layer degrades to an empty bundle if the backend
  // is unavailable, so it never blocks the list.
  const [observations, counts, catAreaGroups, insights, weeklyView] = await Promise.all([
    prisma.observation.findMany({
      where,
      select: {
        id: true,
        number: true,
        date: true,
        type: true,
        category: true,
        description: true,
        severity: true,
        status: true,
        plant: { select: { name: true } },
        area: { select: { id: true, name: true } }
      },
      // Newest-created first, platform-wide convention: whatever anyone just
      // submitted must be the top row. Ordering by the user-entered event
      // `date` buried fresh submissions whenever the event was backdated.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100
    }),
    prisma.observation.groupBy({
      by: ["status"],
      where: scopeWhere,
      _count: true
    }),
    // Part 4 — category × area breakdown of the OPEN backlog. One grouped
    // aggregate (no per-row query); folded into per-category totals below.
    prisma.observation.groupBy({
      by: ["category", "areaId"],
      where: { AND: [scopeWhere, { status: { not: "CLOSED" } }] },
      _count: true
    }),
    fetchInsights("observation"),
    // Weekly Insight Engine view (hero + secondary row lifecycle). Tolerant —
    // degrades to an empty view (e.g. before the InsightSnapshot table is applied).
    fetchWeeklyInsights("observation")
  ]);

  const ids = observations.map((o) => o.id);
  const instances = ids.length
    ? await prisma.workflowInstance.findMany({
        where: { module: "OBSERVATION", recordId: { in: ids } },
        select: { recordId: true, status: true, currentStepName: true }
      })
    : [];
  const instanceByRecord = new Map(instances.map((i) => [i.recordId, i]));
  const statusCounts: Record<string, number> = {};
  counts.forEach((c: { status: string; _count: number }) => {
    statusCounts[c.status] = c._count;
  });
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const rows: ObservationRow[] = observations.map((o) => {
    const inst = instanceByRecord.get(o.id);
    const workflowStep = inst ? inst.currentStepName ?? "Completed" : humanize(o.status);
    const workflowColor = inst ? workflowChipColor(inst.status) : statusColor(o.status);
    return {
      id: o.id,
      number: o.number,
      date: o.date.toISOString(),
      plantName: o.plant.name.replace(" Integrated Unit", "").replace(" Grinding Unit", ""),
      areaName: o.area?.name ?? null,
      areaId: o.area?.id ?? null,
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

  // Part 4 — fold the (category, areaId) groups into per-category totals with a
  // distinct-area count, sorted by open volume descending.
  const catAgg = new Map<string, { count: number; areas: Set<string> }>();
  catAreaGroups.forEach((g: { category: string; areaId: string | null; _count: number }) => {
    const entry = catAgg.get(g.category) ?? { count: 0, areas: new Set<string>() };
    entry.count += g._count;
    if (g.areaId) entry.areas.add(g.areaId);
    catAgg.set(g.category, entry);
  });
  const categoryData: CategoryDatum[] = Array.from(catAgg.entries())
    .map(([category, v]) => ({ category, count: v.count, areaCount: v.areas.size }))
    .sort((a, b) => b.count - a.count);

  // "Where it's stuck": per-workflow-step dwell over the OPEN backlog. Mirrors
  // the backend bottleneck insight exactly — days-in-step = now − the record's
  // last workflow transition (WorkflowHistory.performedAt, or initiation) — so
  // this panel and the insight card agree on "42.0d, 6 stuck".
  const openIdRows = await prisma.observation.findMany({
    where: { AND: [scopeWhere, { status: { not: "CLOSED" } }] },
    select: { id: true }
  });
  const openObsIds = openIdRows.map((o) => o.id);
  const openInstances = openObsIds.length
    ? await prisma.workflowInstance.findMany({
        where: { module: "OBSERVATION", recordId: { in: openObsIds }, status: "IN_PROGRESS" },
        select: { id: true, currentStepName: true, initiatedAt: true }
      })
    : [];
  const stepHistory = openInstances.length
    ? await prisma.workflowHistory.findMany({
        where: { instanceId: { in: openInstances.map((i) => i.id) } },
        select: { instanceId: true, performedAt: true },
        orderBy: { performedAt: "asc" }
      })
    : [];
  // asc order → the last write per instance is its most recent transition = when
  // it entered its current step.
  const enteredStepAt = new Map<string, Date>();
  stepHistory.forEach((h) => enteredStepAt.set(h.instanceId, h.performedAt));
  const nowMs = Date.now();
  const stepAgg = new Map<string, { count: number; totalDays: number }>();
  openInstances.forEach((i) => {
    if (!i.currentStepName) return;
    const entered = enteredStepAt.get(i.id) ?? i.initiatedAt;
    const days = Math.max(0, Math.floor((nowMs - entered.getTime()) / 86_400_000));
    const e = stepAgg.get(i.currentStepName) ?? { count: 0, totalDays: 0 };
    e.count += 1;
    e.totalDays += days;
    stepAgg.set(i.currentStepName, e);
  });
  const bottleneckData = Array.from(stepAgg.entries())
    .map(([step, v]) => ({ step, count: v.count, avgDays: Math.round((v.totalDays / v.count) * 10) / 10 }))
    .sort((a, b) => b.avgDays - a.avgDays);

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
  const heroWindowStart = new Date(nowMs - 180 * 86_400_000);
  const unsafeRecords = await prisma.observation.findMany({
    where: {
      AND: [scopeWhere, { type: { in: ["UNSAFE_ACT", "UNSAFE_CONDITION"] as any }, date: { gte: heroWindowStart } }]
    },
    select: {
      category: true,
      subCategoryCode: true,
      date: true,
      status: true,
      responsiblePersonId: true,
      plantId: true,
      plant: { select: { name: true } },
      area: { select: { name: true } }
    }
  });
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
      const name = r.area?.name ?? "Unassigned area";
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

    const oldestDays = Math.max(0, ...topRecs.map((r) => Math.floor((nowMs - r.date.getTime()) / 86_400_000)));

    const clusterAll = unsafeRecords.filter((r) => `${r.plantId}|${r.category}` === topKey);
    const cut = nowMs - 90 * 86_400_000;
    const recent = clusterAll.filter((r) => r.date.getTime() >= cut).length;
    const prior = clusterAll.filter((r) => r.date.getTime() < cut).length;
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
        headline: `Open unsafe ${humanize(cat).toLowerCase()} observations concentrated at ${topRecs[0].plant.name}`,
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
        pctOfOpen: Math.round((dupInsight.recordRefs.length / (openObsIds.length || 1)) * 100)
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

