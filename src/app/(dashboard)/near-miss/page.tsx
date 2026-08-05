import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { statusColor, humanize, workflowChipColor } from "@/lib/utils";
import { Can } from "@/components/auth/can";
import { NearMissTable, type NearMissRow } from "./near-miss-table";
import { FilterTab, FilterTabsList } from "@/components/ui/filter-tabs";
import { AnalyticsStripSkeleton } from "@/components/dashboard/analytics-strip";
import { NearMissAnalyticsStrip } from "@/components/near-miss/analytics-strip";
import { InsightBar } from "@/components/ai/InsightBar";
import { InsightHero } from "@/components/observations/insight-hero";
import { ObservationAnalyticsPanels } from "@/components/observations/analytics-panels";
import { buildHeroFromRecords } from "@/lib/insight-hero-from-records";
import { fetchInsights } from "@/lib/insights";

export const dynamic = "force-dynamic";

export default async function NearMissPage(props: { searchParams: Promise<{ status?: string; insight?: string }> }) {
  const searchParams = await props.searchParams;
  const where = searchParams.status ? { status: searchParams.status as any } : {};
  const [items, counts, insights] = await Promise.all([
    prisma.nearMiss.findMany({
      where,
      select: {
        id: true,
        number: true,
        date: true,
        location: true,
        description: true,
        potentialSeverity: true,
        promotedToIncident: true,
        status: true,
        rootCauseCategory: true,
        initialRootCauseCategory: true,
        plant: { select: { name: true } }
      },
      // Newest-created first (platform-wide list convention) — see observations.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100
    }),
    prisma.nearMiss.groupBy({ by: ["status"], _count: true }),
    fetchInsights("nearmiss")
  ]);

  const ids = items.map((i) => i.id);
  const instances = ids.length
    ? await prisma.workflowInstance.findMany({
        where: { module: "NEAR_MISS", recordId: { in: ids } },
        select: { recordId: true, status: true, currentStepName: true }
      })
    : [];
  const instanceByRecord = new Map(instances.map((i) => [i.recordId, i]));
  const statusCounts: Record<string, number> = {};
  counts.forEach((c) => {
    statusCounts[c.status] = c._count;
  });
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const closed = items.filter((i) => i.status === "CLOSED").length;
  const promoted = items.filter((i) => i.promotedToIncident).length;
  const critical = items.filter((i) => i.potentialSeverity === "CRITICAL").length;

  const rows: NearMissRow[] = items.map((n) => {
    const inst = instanceByRecord.get(n.id);
    const workflowStep = inst ? inst.currentStepName ?? "Completed" : humanize(n.status);
    const workflowColor = inst ? workflowChipColor(inst.status) : statusColor(n.status);
    return {
      id: n.id,
      number: n.number,
      date: n.date.toISOString(),
      plantName: n.plant.name.replace(" Integrated Unit", "").replace(" Grinding Unit", ""),
      location: n.location ?? "",
      description: n.description,
      potentialSeverity: n.potentialSeverity,
      promotedToIncident: n.promotedToIncident,
      workflowStep,
      workflowColor,
      signal: insights.signalByRecord.get(n.id) ?? null
    };
  });

  // When an insight card is active (?insight=<id>), narrow the list to the
  // records that insight is grounded in (spec §1.2 click-through).
  const activeInsight = searchParams.insight
    ? insights.bar.find((i) => i.id === searchParams.insight)
    : undefined;
  const visibleRows = activeInsight
    ? rows.filter((r) => activeInsight.recordRefs.includes(r.number))
    : rows;

  // "This week's focus" navy/gold hero — reuses the shared builder + <InsightHero>
  // (the same format as Safety Observations), driven by near-miss records.
  const nmHero = buildHeroFromRecords(
    items.map((n) => ({
      date: n.date,
      open: n.status !== "CLOSED",
      severity: n.potentialSeverity,
      group: n.location || n.plant.name
    })),
    {
      type: "near-miss risk",
      critical: ["CRITICAL"],
      headline: (n, g) => `${n} critical-potential near misses concentrated in ${g}`,
      qualifier: "these precede LTIs",
      actionHref: "/near-miss?status=REPORTED",
      railTitle: "Where they're happening",
      closing: (d) => `Oldest is ${d} days unreviewed.`,
      statLabels: { critical: "critical", high: "high" }
    }
  );

  // Secondary-row panels — reuse ObservationAnalyticsPanels per near-miss:
  // "Where it's stuck" (workflow dwell) + "Where it's concentrated" (potential
  // severity). Duplicates omitted (near-miss has no duplicate insight) → 2 cards.
  const nmOpenIds = items.filter((n) => n.status !== "CLOSED").map((n) => n.id);
  const nmWfInstances = nmOpenIds.length
    ? await prisma.workflowInstance.findMany({
        where: { module: "NEAR_MISS", recordId: { in: nmOpenIds }, status: "IN_PROGRESS" },
        select: { id: true, currentStepName: true, initiatedAt: true }
      })
    : [];
  const nmWfHistory = nmWfInstances.length
    ? await prisma.workflowHistory.findMany({
        where: { instanceId: { in: nmWfInstances.map((i) => i.id) } },
        select: { instanceId: true, performedAt: true },
        orderBy: { performedAt: "asc" }
      })
    : [];
  const nmEnteredAt = new Map<string, Date>();
  nmWfHistory.forEach((h) => nmEnteredAt.set(h.instanceId, h.performedAt));
  const nmNowMs = Date.now();
  const nmStepAgg = new Map<string, { count: number; totalDays: number }>();
  nmWfInstances.forEach((i) => {
    if (!i.currentStepName) return;
    const entered = nmEnteredAt.get(i.id) ?? i.initiatedAt;
    const days = Math.max(0, Math.floor((nmNowMs - entered.getTime()) / 86_400_000));
    const e = nmStepAgg.get(i.currentStepName) ?? { count: 0, totalDays: 0 };
    e.count += 1;
    e.totalDays += days;
    nmStepAgg.set(i.currentStepName, e);
  });
  const nmBottleneck = Array.from(nmStepAgg.entries())
    .map(([step, v]) => ({ step, count: v.count, avgDays: Math.round((v.totalDays / v.count) * 10) / 10 }))
    .sort((a, b) => b.avgDays - a.avgDays);

  // "Where it's concentrated" by ROOT CAUSE (not severity) — near-miss carries a
  // root-cause category (HUMAN_FACTOR / EQUIPMENT / PROCESS / …).
  const nmCatAgg = new Map<string, { count: number; areas: Set<string> }>();
  items
    .filter((n) => n.status !== "CLOSED")
    .forEach((n) => {
      const cause = n.rootCauseCategory || n.initialRootCauseCategory || "UNCATEGORIZED";
      const e = nmCatAgg.get(cause) ?? { count: 0, areas: new Set<string>() };
      e.count += 1;
      if (n.location) e.areas.add(n.location);
      nmCatAgg.set(cause, e);
    });
  const nmCategory = Array.from(nmCatAgg.entries())
    .map(([category, v]) => ({ category, count: v.count, areaCount: v.areas.size }))
    .sort((a, b) => b.count - a.count);

  // Likely-duplicates card: same location + near-identical description among near
  // misses (light client-side heuristic — near-miss has no backend dup insight).
  const norm = (s: string) =>
    (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3).slice(0, 6).join(" ");
  const nmDupGroups = new Map<string, number>();
  items.forEach((n) => {
    const key = `${n.location ?? ""}|${norm(n.description)}`;
    nmDupGroups.set(key, (nmDupGroups.get(key) ?? 0) + 1);
  });
  let nmDupSets = 0;
  let nmDupRecords = 0;
  nmDupGroups.forEach((size) => {
    if (size >= 2) {
      nmDupSets += 1;
      nmDupRecords += size;
    }
  });
  const nmDuplicate =
    nmDupSets > 0
      ? { sets: nmDupSets, records: nmDupRecords, pctOfOpen: Math.round((nmDupRecords / (nmOpenIds.length || 1)) * 100) }
      : null;

  return (
    <div>
      <PageHeader
        title="Near Miss Reporting"
        description="Capture unplanned events that did not cause harm but could have"
        action={
          <Can permission="NEAR_MISS.CREATE">
            <Button asChild>
              <Link href="/near-miss/new">
                <Plus size={16} /> Report Near Miss
              </Link>
            </Button>
          </Can>
        }
      />

      <div className="mb-4">
        <Suspense fallback={<AnalyticsStripSkeleton />}>
          <NearMissAnalyticsStrip />
        </Suspense>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatBox label="Total" value={items.length} tone="default" />
        <StatBox label="Closed" value={closed} tone="success" />
        <StatBox label="Critical Potential" value={critical} tone="danger" />
        <StatBox label="Promoted to Incident" value={promoted} tone="warning" />
      </div>

      {nmHero ? <InsightHero hero={nmHero} /> : <InsightBar insights={insights.bar} />}

      {(nmBottleneck.length > 0 || nmCategory.length > 0) && (
        <ObservationAnalyticsPanels
          bottleneck={nmBottleneck}
          category={nmCategory}
          activeCategory={null}
          basePath="/near-miss"
          concentratedTitle="Where it's concentrated"
          duplicate={nmDuplicate}
        />
      )}

      <FilterTabsList label="Status" className="mb-4">
        <FilterTab href="/near-miss" label="All" count={total} active={!searchParams.status} />
        <FilterTab href="/near-miss?status=REPORTED" label="Reported" count={statusCounts.REPORTED ?? 0} active={searchParams.status === "REPORTED"} />
        <FilterTab href="/near-miss?status=UNDER_REVIEW" label="Under Review" count={statusCounts.UNDER_REVIEW ?? 0} active={searchParams.status === "UNDER_REVIEW"} />
        <FilterTab href="/near-miss?status=ACTION_ASSIGNED" label="Action Assigned" count={statusCounts.ACTION_ASSIGNED ?? 0} active={searchParams.status === "ACTION_ASSIGNED"} />
        <FilterTab href="/near-miss?status=CLOSED" label="Closed" count={statusCounts.CLOSED ?? 0} active={searchParams.status === "CLOSED"} />
      </FilterTabsList>

      <NearMissTable data={visibleRows} />
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number; tone: "default" | "success" | "warning" | "danger" }) {
  const colors = {
    default: "bg-primary-50 text-primary-800",
    success: "bg-emerald-50 text-emerald-800",
    warning: "bg-amber-50 text-amber-800",
    danger: "bg-rose-50 text-rose-800"
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[tone]}`}>
      <div className="text-xs uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
