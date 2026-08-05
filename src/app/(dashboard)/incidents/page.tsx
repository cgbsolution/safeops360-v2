import Link from "next/link";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { incidentReadScopeWhere } from "@/lib/auth/incident-access";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { statusColor, humanize, workflowChipColor } from "@/lib/utils";
import { Can } from "@/components/auth/can";
import { IncidentsTable, type IncidentRow } from "./incidents-table";
import { FilterTab, FilterTabsList } from "@/components/ui/filter-tabs";
import { AnalyticsStripSkeleton } from "@/components/dashboard/analytics-strip";
import { IncidentAnalyticsStrip } from "@/components/incidents/analytics-strip";
import { InsightBar } from "@/components/ai/InsightBar";
import { InsightHero } from "@/components/observations/insight-hero";
import { ObservationAnalyticsPanels } from "@/components/observations/analytics-panels";
import { buildHeroFromRecords } from "@/lib/insight-hero-from-records";
import { fetchInsights, type InsightBundle } from "@/lib/insights";

export const dynamic = "force-dynamic";

const TYPE_COLOR: Record<string, string> = {
  FIRST_AID: "bg-emerald-100 text-emerald-800 border-emerald-200",
  MTC: "bg-amber-100 text-amber-800 border-amber-200",
  RWC: "bg-orange-100 text-orange-800 border-orange-200",
  LTI: "bg-rose-100 text-rose-800 border-rose-200",
  FATALITY: "bg-rose-200 text-rose-900 border-rose-300 font-bold",
  PROPERTY_DAMAGE: "bg-blue-100 text-blue-800 border-blue-200",
  ENVIRONMENTAL: "bg-teal-100 text-teal-800 border-teal-200",
  FIRE: "bg-orange-100 text-orange-800 border-orange-200",
  HIPO_NEAR_MISS: "bg-violet-100 text-violet-800 border-violet-200"
};

const STATUS_OPTIONS = [
  { code: "REPORTED", label: "Reported" },
  { code: "INVESTIGATION", label: "Investigation" },
  { code: "CAPA_ASSIGNED", label: "CAPA Assigned" },
  { code: "VERIFIED", label: "Verified" },
  { code: "CLOSED", label: "Closed" }
];

export default async function IncidentsPage(
  props: { searchParams: Promise<{ status?: string; type?: string; denied?: string; insight?: string }> }
) {
  const searchParams = await props.searchParams;
  const showDenied = searchParams.denied === "1";

  // Scope every query to records this user is allowed to READ, so the list
  // never shows rows that would throw "Access denied" on click (and never
  // leaks their number / description / plant). `false` = no access at all.
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id ?? "";
  const accessWhere = await incidentReadScopeWhere(userId);

  const filters: any = {};
  if (searchParams.status) filters.status = searchParams.status;
  if (searchParams.type) filters.type = searchParams.type;

  // findMany and groupBy are independent — fire them in parallel. When the
  // user can read nothing, skip the DB entirely and render an empty list.
  const emptyBundle: InsightBundle = {
    bar: [],
    signalByRecord: new Map(),
    signalsByRecord: new Map(),
  };
  const [items, statusCounts, insightsBundle] =
    accessWhere === false
      ? [[], [] as { status: string; _count: number }[], emptyBundle]
      : await Promise.all([
          prisma.incident.findMany({
            where: { AND: [accessWhere, filters] },
            select: {
              id: true,
              number: true,
              date: true,
              type: true,
              location: true,
              description: true,
              lostDays: true,
              propertyDamageCost: true,
              status: true,
              plant: { select: { name: true } }
            },
            // Newest-created first (platform-wide list convention).
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 100
          }),
          // Counts reflect the accessible set across all statuses.
          prisma.incident.groupBy({ by: ["status"], where: accessWhere, _count: true }),
          // Deterministic insight layer for this screen (tolerant — degrades
          // to an empty bundle if the backend is unavailable).
          fetchInsights("incident")
        ]);

  const ids = items.map((i) => i.id);
  const instances = ids.length
    ? await prisma.workflowInstance.findMany({
        where: { module: "INCIDENT", recordId: { in: ids } },
        select: { recordId: true, status: true, currentStepName: true }
      })
    : [];
  const instanceByRecord = new Map(instances.map((i) => [i.recordId, i]));
  const statusCountMap: Record<string, number> = {};
  statusCounts.forEach((c) => { statusCountMap[c.status] = c._count; });
  const all = Object.values(statusCountMap).reduce((a, b) => a + b, 0);

  // Type aggregates for header cards (use filtered slice for headline number to match what user sees)
  const rows: IncidentRow[] = items.map((i) => {
    const inst = instanceByRecord.get(i.id);
    const workflowStep = inst ? inst.currentStepName ?? "Completed" : humanize(i.status);
    const workflowColor = inst ? workflowChipColor(inst.status) : statusColor(i.status);
    return {
      id: i.id,
      number: i.number,
      date: i.date.toISOString(),
      type: i.type,
      typeColor: TYPE_COLOR[i.type] ?? "bg-slate-100 text-slate-800 border-slate-200",
      plantName: i.plant.name.replace(" Integrated Unit", "").replace(" Grinding Unit", ""),
      location: i.location ?? "",
      description: i.description,
      lostDays: i.lostDays,
      propertyDamageCost: i.propertyDamageCost ? i.propertyDamageCost.toString() : null,
      workflowStep,
      workflowColor,
      signal: insightsBundle.signalByRecord.get(i.id) ?? null
    };
  });

  // Insight-card click-through: narrow the list to the active insight's records.
  const activeInsight = searchParams.insight
    ? insightsBundle.bar.find((i) => i.id === searchParams.insight)
    : undefined;
  const visibleRows = activeInsight
    ? rows.filter((r) => activeInsight.recordRefs.includes(r.number))
    : rows;

  // "This week's focus" hero + panels — reuse the shared builder + component.
  const incOpen = items.filter((i) => i.status !== "CLOSED");
  const incHero = buildHeroFromRecords(
    items.map((i) => ({ date: i.date, open: i.status !== "CLOSED", severity: i.type, group: i.location || i.plant.name })),
    {
      type: "incident risk",
      critical: ["LTI", "FATALITY"],
      highSeverities: ["RWC", "MTC"],
      headline: (n, g) => `${n} open incidents concentrated in ${g}`,
      qualifier: "recordable severity",
      actionHref: "/incidents",
      railTitle: "Where they're happening",
      closing: (d) => `Oldest open investigation is ${d} days.`,
      statLabels: { critical: "LTI + fatal", high: "RWC + MTC" }
    }
  );
  const incNowMs = Date.now();
  const incStepAgg = new Map<string, { count: number; totalDays: number }>();
  incOpen.forEach((i) => {
    const step = instanceByRecord.get(i.id)?.currentStepName ?? humanize(i.status);
    const days = Math.max(0, Math.floor((incNowMs - i.date.getTime()) / 86_400_000));
    const e = incStepAgg.get(step) ?? { count: 0, totalDays: 0 };
    e.count += 1;
    e.totalDays += days;
    incStepAgg.set(step, e);
  });
  const incBottleneck = Array.from(incStepAgg.entries())
    .map(([step, v]) => ({ step, count: v.count, avgDays: Math.round((v.totalDays / v.count) * 10) / 10 }))
    .sort((a, b) => b.avgDays - a.avgDays);
  const incCatAgg = new Map<string, { count: number; areas: Set<string> }>();
  incOpen.forEach((i) => {
    const e = incCatAgg.get(i.type) ?? { count: 0, areas: new Set<string>() };
    e.count += 1;
    if (i.location) e.areas.add(i.location);
    incCatAgg.set(i.type, e);
  });
  const incCategory = Array.from(incCatAgg.entries())
    .map(([category, v]) => ({ category, count: v.count, areaCount: v.areas.size }))
    .sort((a, b) => b.count - a.count);

  const fac = items.filter((i) => i.type === "FIRST_AID").length;
  const mtc = items.filter((i) => i.type === "MTC").length;
  const rwc = items.filter((i) => i.type === "RWC").length;
  const lti = items.filter((i) => i.type === "LTI").length;
  const fatal = items.filter((i) => i.type === "FATALITY").length;

  return (
    <div>
      <PageHeader
        title="Incident Investigation"
        description="Structured root-cause analysis and CAPA tracking"
        action={
          <Can permission="INCIDENT.CREATE">
            <Button asChild>
              <Link href="/incidents/new"><Plus size={16} /> Report Incident</Link>
            </Button>
          </Can>
        }
      />

      {showDenied && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 flex items-start gap-2">
          <span className="font-semibold">Access denied:</span>
          <span>You don't have permission to view that incident. The Incident Investigation matrix limits Workers and Contractor Workmen to records they reported themselves; Supervisors / Permit Issuers / Department Heads to records in their department; HSE Manager / Plant Head to records at their plant.</span>
        </div>
      )}

      <div className="mb-4">
        <Suspense fallback={<AnalyticsStripSkeleton />}>
          <IncidentAnalyticsStrip userId={userId} />
        </Suspense>
      </div>

      {/* Severity-type breakdown — complements the strip's investigation
          flow view (open/closed/CAPA-linkage) with the by-type mix. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatBox label="First Aid Cases" value={fac} tone="success" />
        <StatBox label="MTC + RWC" value={mtc + rwc} tone="warning" />
        <StatBox label="LTI" value={lti} tone="danger" />
        <StatBox label="Fatalities" value={fatal} tone="danger" />
      </div>

      {incHero ? <InsightHero hero={incHero} /> : <InsightBar insights={insightsBundle.bar} />}

      {(incBottleneck.length > 0 || incCategory.length > 0) && (
        <ObservationAnalyticsPanels
          bottleneck={incBottleneck}
          category={incCategory}
          activeCategory={null}
          basePath="/incidents"
          concentratedTitle="By incident type"
        />
      )}

      {/* Status filter tabs */}
      <FilterTabsList label="Status" className="mb-4">
        <FilterTab
          href={searchParams.type ? `/incidents?type=${searchParams.type}` : "/incidents"}
          label="All"
          count={all}
          active={!searchParams.status}
        />
        {STATUS_OPTIONS.map((s) => {
          const href = searchParams.type ? `/incidents?type=${searchParams.type}&status=${s.code}` : `/incidents?status=${s.code}`;
          return (
            <FilterTab
              key={s.code}
              href={href}
              label={s.label}
              count={statusCountMap[s.code] ?? 0}
              active={searchParams.status === s.code}
            />
          );
        })}
      </FilterTabsList>

      <IncidentsTable data={visibleRows} />
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
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
