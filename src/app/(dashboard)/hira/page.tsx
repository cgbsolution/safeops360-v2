import Link from "next/link";
import { Suspense } from "react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Can } from "@/components/auth/can";
import { FilterTab, FilterTabsList } from "@/components/ui/filter-tabs";
import { AnalyticsStripSkeleton } from "@/components/dashboard/analytics-strip";
import { HiraAnalyticsStrip } from "@/components/hira/analytics-strip";
import { InsightBar } from "@/components/ai/InsightBar";
import { SignalChip } from "@/components/ai/SignalChip";
import { InsightHero } from "@/components/observations/insight-hero";
import { ObservationAnalyticsPanels } from "@/components/observations/analytics-panels";
import { buildHeroFromRecords } from "@/lib/insight-hero-from-records";
import { fetchInsights } from "@/lib/insights";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { code: "DRAFT", label: "Draft" },
  { code: "IN_PROGRESS", label: "In Progress" },
  { code: "TEAM_REVIEW", label: "Team Review" },
  { code: "APPROVAL_PENDING", label: "Approval Pending" },
  { code: "ACTIVE", label: "Active" },
  { code: "SUPERSEDED", label: "Superseded" }
];

const STATUS_CHIP: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-800 border-slate-200",
  IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-200",
  TEAM_REVIEW: "bg-indigo-100 text-indigo-800 border-indigo-200",
  APPROVAL_PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ACTIVE: "bg-emerald-200 text-emerald-900 border-emerald-300 font-semibold",
  SUPERSEDED: "bg-slate-200 text-slate-700 border-slate-300",
  ARCHIVED: "bg-slate-200 text-slate-700 border-slate-300"
};

export default async function HiraStudiesPage(
  props: { searchParams: Promise<{ status?: string; plantId?: string; insight?: string }> }
) {
  const searchParams = await props.searchParams;
  // Pure 3-tier: all reads go through the FastAPI backend; no Prisma here.
  type StudyListItem = {
    id: string;
    number: string;
    plantId: string;
    departmentId: string | null;
    areaId: string | null;
    title: string;
    scopeType: string | null;
    status: string;
    initiatedAt: string;
    nextScheduledReviewDate: string | null;
    aggregateMetrics: any | null;
    teamLeaderId: string;
    plantName: string | null;
    departmentName: string | null;
    areaName: string | null;
    teamLeaderName: string | null;
    entryCount: number;
  };
  type StudyListResponse = {
    items: StudyListItem[];
    total: number;
    statusCounts: Record<string, number>;
  };

  // Insights are plant-scoped when a plant is selected; without one the engine
  // computes the cross-plant view (e.g. the same hazard live across plants).
  const [data, insights] = await Promise.all([
    backendFetch<StudyListResponse>("/api/hira/studies", {
      query: {
        status: searchParams.status ?? null,
        plant_id: searchParams.plantId ?? null
      }
    }),
    fetchInsights("hira", { plant: searchParams.plantId })
  ]);

  const studies = data.items.map((s) => ({
    ...s,
    initiatedAt: new Date(s.initiatedAt),
    nextScheduledReviewDate: s.nextScheduledReviewDate ? new Date(s.nextScheduledReviewDate) : null,
    plant: { name: s.plantName ?? "" },
    department: s.departmentName ? { name: s.departmentName } : null,
    area: s.areaName ? { name: s.areaName } : null,
    teamLeader: { name: s.teamLeaderName ?? "" },
    _count: { entries: s.entryCount }
  }));

  const statusCountMap = data.statusCounts;
  const all = Object.values(statusCountMap).reduce((a, b) => a + b, 0);

  // Insight-card click-through: narrow the list to the active insight's studies.
  const activeInsight = searchParams.insight
    ? insights.bar.find((i) => i.id === searchParams.insight)
    : undefined;
  const visibleStudies = activeInsight
    ? studies.filter((s) => activeInsight.recordRefs.includes(s.number))
    : studies;

  // "This week's focus" hero + panels — reuse the shared builder + component.
  const HIRA_DONE = ["ACTIVE", "ARCHIVED", "SUPERSEDED"];
  const hiraOpen = studies.filter((s) => !HIRA_DONE.includes(s.status));
  const hiraHero = buildHeroFromRecords(
    studies.map((s) => ({
      date: s.initiatedAt,
      open: !HIRA_DONE.includes(s.status),
      severity: s.status,
      group: s.scopeType || s.plant.name
    })),
    {
      type: "hira progress",
      critical: ["DRAFT", "IN_PROGRESS"],
      highSeverities: ["TEAM_REVIEW", "APPROVAL_PENDING"],
      headline: (n) => `${n} HIRA studies still in progress`,
      qualifier: "not yet active",
      actionHref: "/hira?status=IN_PROGRESS",
      railTitle: "By scope",
      closing: (d) => `Oldest opened ${d} days ago.`,
      statLabels: { critical: "drafting", high: "in review" }
    }
  );
  const hNow = Date.now();
  const hiraScopeAgg = new Map<string, { count: number; areas: Set<string> }>();
  hiraOpen.forEach((s) => {
    const g = s.scopeType || "OTHER";
    const e = hiraScopeAgg.get(g) ?? { count: 0, areas: new Set<string>() };
    e.count += 1;
    if (s.area?.name) e.areas.add(s.area.name);
    hiraScopeAgg.set(g, e);
  });
  const hiraCategory = Array.from(hiraScopeAgg.entries())
    .map(([category, v]) => ({ category, count: v.count, areaCount: v.areas.size }))
    .sort((a, b) => b.count - a.count);
  const hiraStatusAgg = new Map<string, { count: number; totalDays: number }>();
  hiraOpen.forEach((s) => {
    const days = Math.max(0, Math.floor((hNow - s.initiatedAt.getTime()) / 86_400_000));
    const e = hiraStatusAgg.get(s.status) ?? { count: 0, totalDays: 0 };
    e.count += 1;
    e.totalDays += days;
    hiraStatusAgg.set(s.status, e);
  });
  const hiraBottleneck = Array.from(hiraStatusAgg.entries())
    .map(([step, v]) => ({ step: step.replace(/_/g, " "), count: v.count, avgDays: Math.round((v.totalDays / v.count) * 10) / 10 }))
    .sort((a, b) => b.avgDays - a.avgDays);

  return (
    <div>
      <PageHeader
        title="HIRA Studies"
        description="Hazard Identification and Risk Assessment — the live risk register"
        action={
          <Can permission="HIRA.CREATE">
            <Button asChild>
              <Link href="/hira/new">
                <Plus size={16} /> New Study
              </Link>
            </Button>
          </Can>
        }
      />

      <div className="mb-4">
        <Suspense fallback={<AnalyticsStripSkeleton />}>
          <HiraAnalyticsStrip />
        </Suspense>
      </div>

      {hiraHero ? <InsightHero hero={hiraHero} /> : <InsightBar insights={insights.bar} />}

      {(hiraBottleneck.length > 0 || hiraCategory.length > 0) && (
        <ObservationAnalyticsPanels
          bottleneck={hiraBottleneck}
          category={hiraCategory}
          activeCategory={null}
          basePath="/hira"
          concentratedTitle="By scope"
        />
      )}

      <FilterTabsList label="Status" className="mb-4">
        <FilterTab href="/hira" label="All" count={all} active={!searchParams.status} />
        {STATUS_OPTIONS.map((s) => (
          <FilterTab
            key={s.code}
            href={`/hira?status=${s.code}`}
            label={s.label}
            count={statusCountMap[s.code] ?? 0}
            active={searchParams.status === s.code}
          />
        ))}
      </FilterTabsList>

      {studies.length === 0 ? (
        <EmptyState />
      ) : (
        <Card className="overflow-x-auto rounded-xl border bg-white shadow-none">
          <Table className="w-full text-sm">
            <TableHeader className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider">
              <TableRow>
                <TableHead className="text-left px-4 py-3">Study</TableHead>
                <TableHead className="text-left px-4 py-3">Scope</TableHead>
                <TableHead className="text-left px-4 py-3">Status</TableHead>
                <TableHead className="text-left px-4 py-3">Entries</TableHead>
                <TableHead className="text-left px-4 py-3">Team Lead</TableHead>
                <TableHead className="text-left px-4 py-3">Next Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100">
              {visibleStudies.map((s) => {
                const scopeBits = [
                  s.plant?.name,
                  s.department?.name,
                  s.area?.name
                ].filter(Boolean);
                return (
                  <TableRow key={s.id} className="hover:bg-slate-50">
                    <TableCell className="px-4 py-3">
                      <Link
                        href={`/hira/${s.id}`}
                        className="font-medium text-primary-700 hover:underline"
                      >
                        {s.number}
                      </Link>
                      <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {s.title}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {scopeBits.map((b) => (
                          <span
                            key={b}
                            className="inline-block px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-700"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs rounded border ${
                            STATUS_CHIP[s.status] ?? "bg-slate-100 text-slate-800 border-slate-200"
                          }`}
                        >
                          {s.status.replace(/_/g, " ")}
                        </span>
                        {insights.signalByRecord.get(s.id) && (
                          <SignalChip signal={insights.signalByRecord.get(s.id)!} href={`/hira/${s.id}`} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-slate-700">{s._count.entries}</TableCell>
                    <TableCell className="px-4 py-3 text-slate-700">{s.teamLeader?.name ?? "—"}</TableCell>
                    <TableCell className="px-4 py-3 text-slate-700">
                      {s.nextScheduledReviewDate
                        ? new Date(s.nextScheduledReviewDate).toLocaleDateString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="rounded-xl border bg-white p-10 text-center shadow-none">
      <div className="text-lg font-medium text-slate-700">No HIRA studies yet</div>
      <div className="text-sm text-slate-500 mt-2 max-w-xl mx-auto">
        A HIRA (Hazard Identification and Risk Assessment) study scopes a set of activities, identifies the hazards
        they present, and analyses the risk before and after the controls in place. Studies are reviewed annually,
        triggered by incidents, or triggered by management of change.
      </div>
      <Can permission="HIRA.CREATE">
        <div className="mt-6">
          <Button asChild>
            <Link href="/hira/new">
              <Plus size={16} /> Create your first study
            </Link>
          </Button>
        </div>
      </Can>
    </Card>
  );
}
