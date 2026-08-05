import Link from "next/link";
import { Suspense } from "react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus, Leaf } from "lucide-react";
import { Can } from "@/components/auth/can";
import { FilterTab, FilterTabsList } from "@/components/ui/filter-tabs";
import { resolvePlantContext } from "@/lib/plant-context";
import { PlantSwitcher } from "@/components/plant-switcher";
import { AnalyticsStripSkeleton } from "@/components/dashboard/analytics-strip";
import { EaiAnalyticsStrip } from "@/components/eai/analytics-strip";
import { InsightBar } from "@/components/ai/InsightBar";
import { SignalChip } from "@/components/ai/SignalChip";
import { InsightHero } from "@/components/observations/insight-hero";
import { ObservationAnalyticsPanels } from "@/components/observations/analytics-panels";
import { buildHeroFromRecords } from "@/lib/insight-hero-from-records";
import { fetchInsights } from "@/lib/insights";

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

type StudyListItem = {
  id: string;
  number: string;
  title: string;
  plantId: string;
  departmentId: string | null;
  areaId: string | null;
  scopeType: string;
  status: string;
  initiatedAt: string;
  nextScheduledReviewDate: string | null;
  entryCount: number;
  significantCount: number;
};

type StudyListResponse = {
  items: StudyListItem[];
  total: number;
};

type FeatureFlag = {
  plantId: string;
  eaiRegisterEnabled: boolean;
  combinedRegisterEnabled: boolean;
  riskDashboardEnabled: boolean;
  hiraAssistantV2Enabled: boolean;
};

export default async function EaiStudiesPage(
  props: { searchParams: Promise<{ status?: string; plantId?: string; insight?: string }> }
) {
  const searchParams = await props.searchParams;
  const { plantId, plants } = await resolvePlantContext(searchParams.plantId);

  if (!plantId) {
    return (
      <div>
        <PageHeader
          title="EAI — Environmental Register"
          description="ISO 14001 §6.1.2 environmental aspect and impact register"
        />
        <PlantSelectorEmptyState />
      </div>
    );
  }

  const flag = await backendFetch<FeatureFlag>(
    `/api/eai/feature-flag/${plantId}`
  ).catch(() => null);

  if (!flag?.eaiRegisterEnabled) {
    return (
      <div>
        <PageHeader
          title="EAI — Environmental Register"
          description="ISO 14001 §6.1.2 environmental aspect and impact register"
          action={<PlantSwitcher plants={plants} currentPlantId={plantId} />}
        />
        <FeatureDisabledNotice plantId={plantId} />
      </div>
    );
  }

  const [data, insights] = await Promise.all([
    backendFetch<StudyListResponse>("/api/eai/studies", {
      query: {
        plantId,
        status: searchParams.status ?? null
      }
    }).catch(() => ({ items: [], total: 0 } as StudyListResponse)),
    fetchInsights("eai", { plant: plantId })
  ]);

  const studies = data.items;

  // Insight-card click-through: narrow the list to the active insight's studies.
  const activeInsight = searchParams.insight
    ? insights.bar.find((i) => i.id === searchParams.insight)
    : undefined;
  const visibleStudies = activeInsight
    ? studies.filter((s) => activeInsight.recordRefs.includes(s.number))
    : studies;

  // "This week's focus" hero + panels — reuse the shared builder + component.
  const EAI_DONE = ["ACTIVE", "ARCHIVED", "SUPERSEDED"];
  const eaiOpen = studies.filter((s) => !EAI_DONE.includes(s.status));
  const eaiHero = buildHeroFromRecords(
    studies.map((s) => ({
      date: new Date(s.initiatedAt),
      open: !EAI_DONE.includes(s.status),
      severity: s.status,
      group: s.scopeType || "Plant-wide"
    })),
    {
      type: "eai progress",
      critical: ["DRAFT", "IN_PROGRESS"],
      highSeverities: ["TEAM_REVIEW", "APPROVAL_PENDING"],
      headline: (n) => `${n} environmental aspect studies still in progress`,
      qualifier: "not yet active",
      actionHref: `/eai?plantId=${plantId}&status=IN_PROGRESS`,
      railTitle: "By scope",
      closing: (d) => `Oldest opened ${d} days ago.`,
      statLabels: { critical: "drafting", high: "in review" }
    }
  );
  const eNow = Date.now();
  const eaiScopeAgg = new Map<string, { count: number; areas: Set<string> }>();
  eaiOpen.forEach((s) => {
    const g = s.scopeType || "OTHER";
    const e = eaiScopeAgg.get(g) ?? { count: 0, areas: new Set<string>() };
    e.count += 1;
    if (s.areaId) e.areas.add(s.areaId);
    eaiScopeAgg.set(g, e);
  });
  const eaiCategory = Array.from(eaiScopeAgg.entries())
    .map(([category, v]) => ({ category, count: v.count, areaCount: v.areas.size }))
    .sort((a, b) => b.count - a.count);
  const eaiStatusAgg = new Map<string, { count: number; totalDays: number }>();
  eaiOpen.forEach((s) => {
    const days = Math.max(0, Math.floor((eNow - new Date(s.initiatedAt).getTime()) / 86_400_000));
    const e = eaiStatusAgg.get(s.status) ?? { count: 0, totalDays: 0 };
    e.count += 1;
    e.totalDays += days;
    eaiStatusAgg.set(s.status, e);
  });
  const eaiBottleneck = Array.from(eaiStatusAgg.entries())
    .map(([step, v]) => ({ step: step.replace(/_/g, " "), count: v.count, avgDays: Math.round((v.totalDays / v.count) * 10) / 10 }))
    .sort((a, b) => b.avgDays - a.avgDays);

  return (
    <div>
      <PageHeader
        title="EAI — Environmental Register"
        description="ISO 14001 §6.1.2 environmental aspect and impact register"
        action={
          <div className="flex items-center gap-2">
            <PlantSwitcher plants={plants} currentPlantId={plantId} />
            <Can permission="EAI.CREATE">
              <Button asChild>
                <Link href={`/eai/new?plantId=${plantId}`}>
                  <Plus size={16} /> New EAI Study
                </Link>
              </Button>
            </Can>
          </div>
        }
      />

      <div className="mb-4">
        <Suspense fallback={<AnalyticsStripSkeleton />}>
          <EaiAnalyticsStrip />
        </Suspense>
      </div>

      {eaiHero ? <InsightHero hero={eaiHero} /> : <InsightBar insights={insights.bar} />}

      {(eaiBottleneck.length > 0 || eaiCategory.length > 0) && (
        <ObservationAnalyticsPanels
          bottleneck={eaiBottleneck}
          category={eaiCategory}
          activeCategory={null}
          basePath="/eai"
          concentratedTitle="By scope"
        />
      )}

      <FilterTabsList label="Status" className="mb-4">
        <FilterTab
          href={`/eai?plantId=${plantId}`}
          label="All"
          count={studies.length}
          active={!searchParams.status}
        />
        {STATUS_OPTIONS.map((s) => {
          const n = studies.filter((x) => x.status === s.code).length;
          return (
            <FilterTab
              key={s.code}
              href={`/eai?plantId=${plantId}&status=${s.code}`}
              label={s.label}
              count={n}
              active={searchParams.status === s.code}
            />
          );
        })}
      </FilterTabsList>

      {studies.length === 0 ? (
        <EmptyState plantId={plantId} />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-emerald-50 text-emerald-900 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Study</th>
                <th className="text-left px-4 py-3">Scope</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Entries</th>
                <th className="text-left px-4 py-3">Significant</th>
                <th className="text-left px-4 py-3">Next Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleStudies.map((s) => (
                <tr key={s.id} className="hover:bg-emerald-50/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/eai/${s.id}`}
                      className="font-medium text-emerald-700 hover:underline"
                    >
                      {s.number}
                    </Link>
                    <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                      {s.title}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {s.scopeType.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs rounded border ${
                          STATUS_CHIP[s.status] ?? "bg-slate-100 text-slate-800 border-slate-200"
                        }`}
                      >
                        {s.status.replace(/_/g, " ")}
                      </span>
                      {insights.signalByRecord.get(s.id) && (
                        <SignalChip signal={insights.signalByRecord.get(s.id)!} href={`/eai/${s.id}`} />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{s.entryCount}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {s.significantCount > 0 ? (
                      <span className="font-medium text-rose-700">{s.significantCount}</span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {s.nextScheduledReviewDate
                      ? new Date(s.nextScheduledReviewDate).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyState({ plantId }: { plantId: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white py-16 px-6 text-center">
      <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
        <Leaf className="text-emerald-500" size={28} />
      </div>
      <div className="text-lg font-semibold text-slate-800">No EAI studies yet</div>
      <div className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
        An EAI study scopes a plant, department, area, or process and lists
        the environmental aspects (air, water, waste, noise, etc.) and their
        impacts. Start your first one to populate the register.
      </div>
      <Can permission="EAI.CREATE">
        <Button asChild className="mt-5">
          <Link href={`/eai/new?plantId=${plantId}`}>
            <Plus size={16} /> Create your first EAI study
          </Link>
        </Button>
      </Can>
      <div className="mt-3 text-[11px] text-slate-400">
        Need help? See the{" "}
        <Link href="/docs/eai" className="underline hover:text-slate-600">
          EAI quick-start guide
        </Link>
        .
      </div>
    </div>
  );
}

function PlantSelectorEmptyState() {
  return (
    <div className="rounded-xl border bg-white p-8 text-sm text-slate-600">
      <div className="font-medium text-slate-800 mb-1">Select a plant to view EAI studies</div>
      <p>
        Add{" "}
        <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">?plantId=</code>{" "}
        to the URL to view environmental aspect & impact studies for that plant.
        EAI is enabled per plant; ask the Plant Head to flip the feature flag.
      </p>
    </div>
  );
}

function FeatureDisabledNotice({ plantId }: { plantId: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm">
      <div className="font-medium text-amber-900 mb-2">EAI Register is not enabled for this plant</div>
      <p className="text-amber-800">
        The HIRA Phase 2 EAI Register is currently disabled for plant{" "}
        <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">{plantId}</code>.
      </p>
      <p className="text-amber-800 mt-2">
        Plant Head or System Admin can enable it from{" "}
        <Link
          href={`/configuration/feature-flags?plantId=${plantId}`}
          className="text-amber-900 underline"
        >
          Feature Flags configuration
        </Link>
        .
      </p>
    </div>
  );
}
