import Link from "next/link";
import { Suspense } from "react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { FilterTab, FilterTabsList } from "@/components/ui/filter-tabs";
import { ShieldAlert } from "lucide-react";
import { resolvePlantContext } from "@/lib/plant-context";
import { PlantSwitcher } from "@/components/plant-switcher";
import { AnalyticsStripSkeleton } from "@/components/dashboard/analytics-strip";
import { RiskRegisterAnalyticsStrip } from "@/components/risk-register/analytics-strip";
import { InsightBar } from "@/components/ai/InsightBar";
import { SignalChip } from "@/components/ai/SignalChip";
import { InsightHero } from "@/components/observations/insight-hero";
import { ObservationAnalyticsPanels } from "@/components/observations/analytics-panels";
import { buildHeroFromRecords } from "@/lib/insight-hero-from-records";
import { fetchInsights } from "@/lib/insights";

export const dynamic = "force-dynamic";

type CombinedRow = {
  id: string;
  type: "HIRA" | "EAI";
  moduleNumber: string;
  sequenceNumber: number;
  plantId: string;
  areaId: string | null;
  departmentId: string | null;
  activityDescription: string;
  initialRiskOrImpactLevel: string;
  initialRiskOrImpactScore: number;
  residualRiskOrImpactLevel: string | null;
  residualRiskOrImpactScore: number | null;
  significantOrCritical: boolean;
  status: string;
  lastReviewedAt: string | null;
  nextReviewDue: string | null;
  updatedAt: string;
};

type CombinedResponse = {
  items: CombinedRow[];
  total: number;
  hiraTotal: number;
  eaiTotal: number;
};

const LEVEL_COLOR: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-200",
  MODERATE: "bg-amber-100 text-amber-800 border-amber-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  CRITICAL: "bg-rose-100 text-rose-800 border-rose-200",
  SIGNIFICANT: "bg-orange-100 text-orange-800 border-orange-200",
  MAJOR: "bg-rose-100 text-rose-800 border-rose-200"
};

export default async function CombinedRiskRegisterPage(props: {
  searchParams: Promise<{
    plantId?: string;
    type?: "all" | "hira" | "eai";
    significantOnly?: string;
    insight?: string;
  }>;
}) {
  const sp = await props.searchParams;
  const { plantId, plants } = await resolvePlantContext(sp.plantId);

  if (!plantId) {
    return (
      <div>
        <PageHeader
          title="Combined Risk Register"
          description="Unified HIRA + EAI register — safety and environmental risks side by side."
        />
        <div className="rounded-xl border bg-white p-8 text-sm text-slate-600">
          No plants are accessible. Contact your Plant Head or System Admin to
          ensure you have at least one plant assignment.
        </div>
      </div>
    );
  }

  const type = sp.type ?? "all";
  const significantOnly = sp.significantOnly === "1";

  const [data, insights] = await Promise.all([
    backendFetch<CombinedResponse>("/api/risk-register/combined", {
      query: {
        plantId,
        type,
        significantOnly: significantOnly ? "true" : "false"
      }
    }).catch(() => ({
      items: [],
      total: 0,
      hiraTotal: 0,
      eaiTotal: 0
    } as CombinedResponse)),
    fetchInsights("combined-risk", { plant: plantId })
  ]);

  // Insight-card click-through: narrow to the active insight's register rows
  // (identified as MODULE#SEQ, the same ref the engine grounds insights in).
  const activeInsight = sp.insight
    ? insights.bar.find((i) => i.id === sp.insight)
    : undefined;
  const visibleItems = activeInsight
    ? data.items.filter((r) => activeInsight.recordRefs.includes(`${r.moduleNumber}#${r.sequenceNumber}`))
    : data.items;

  // "This week's focus" hero + panels — reuse the shared builder + component.
  const rrNow = Date.now();
  const rrHero = buildHeroFromRecords(
    data.items.map((r) => ({
      date: new Date(r.updatedAt),
      open: true,
      severity: r.residualRiskOrImpactLevel || r.initialRiskOrImpactLevel,
      group: r.type
    })),
    {
      type: "risk exposure",
      critical: ["CRITICAL", "MAJOR"],
      highSeverities: ["HIGH", "SIGNIFICANT"],
      headline: (n) => `${n} unmitigated critical risks on the register`,
      qualifier: "residual still high",
      actionHref: `/risk-register?plantId=${plantId}&type=all&significantOnly=1`,
      railTitle: "By domain",
      closing: (d) => `Oldest unreviewed is ${d} days.`,
      statLabels: { critical: "critical", high: "high" }
    }
  );
  const rrLevelAgg = new Map<string, { count: number; areas: Set<string> }>();
  data.items.forEach((r) => {
    const lvl = r.residualRiskOrImpactLevel || "Unrated";
    const e = rrLevelAgg.get(lvl) ?? { count: 0, areas: new Set<string>() };
    e.count += 1;
    if (r.areaId) e.areas.add(r.areaId);
    rrLevelAgg.set(lvl, e);
  });
  const rrCategory = Array.from(rrLevelAgg.entries())
    .map(([category, v]) => ({ category, count: v.count, areaCount: v.areas.size }))
    .sort((a, b) => b.count - a.count);
  const rrStatusAgg = new Map<string, { count: number; totalDays: number }>();
  data.items.forEach((r) => {
    const days = Math.max(0, Math.floor((rrNow - new Date(r.updatedAt).getTime()) / 86_400_000));
    const e = rrStatusAgg.get(r.status) ?? { count: 0, totalDays: 0 };
    e.count += 1;
    e.totalDays += days;
    rrStatusAgg.set(r.status, e);
  });
  const rrBottleneck = Array.from(rrStatusAgg.entries())
    .map(([step, v]) => ({ step: step.replace(/_/g, " "), count: v.count, avgDays: Math.round((v.totalDays / v.count) * 10) / 10 }))
    .sort((a, b) => b.avgDays - a.avgDays);

  return (
    <div>
      <PageHeader
        title="Combined Risk Register"
        description="Unified HIRA + EAI register — safety and environmental risks side by side."
        action={<PlantSwitcher plants={plants} currentPlantId={plantId} />}
      />

      <div className="mb-4">
        <Suspense fallback={<AnalyticsStripSkeleton />}>
          <RiskRegisterAnalyticsStrip />
        </Suspense>
      </div>

      {rrHero ? <InsightHero hero={rrHero} /> : <InsightBar insights={insights.bar} />}

      {(rrBottleneck.length > 0 || rrCategory.length > 0) && (
        <ObservationAnalyticsPanels
          bottleneck={rrBottleneck}
          category={rrCategory}
          activeCategory={null}
          basePath="/risk-register"
          concentratedTitle="By residual level"
        />
      )}

      <div className="flex items-center justify-between mb-4 gap-4">
        <FilterTabsList label="Source">
          <FilterTab
            href={`/risk-register?plantId=${plantId}&type=all${significantOnly ? "&significantOnly=1" : ""}`}
            label="All"
            count={data.total}
            active={type === "all"}
          />
          <FilterTab
            href={`/risk-register?plantId=${plantId}&type=hira${significantOnly ? "&significantOnly=1" : ""}`}
            label="HIRA"
            count={data.hiraTotal}
            active={type === "hira"}
          />
          <FilterTab
            href={`/risk-register?plantId=${plantId}&type=eai${significantOnly ? "&significantOnly=1" : ""}`}
            label="EAI"
            count={data.eaiTotal}
            active={type === "eai"}
          />
        </FilterTabsList>

        <Link
          href={`/risk-register?plantId=${plantId}&type=${type}${
            significantOnly ? "" : "&significantOnly=1"
          }`}
          className={`text-xs px-3 py-1.5 rounded border ${
            significantOnly
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {significantOnly ? "✓ Significant only" : "Show significant only"}
        </Link>
      </div>

      {data.items.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
          <ShieldAlert className="mx-auto text-slate-400 mb-3" size={36} />
          <div className="text-slate-700 font-medium">No risk entries</div>
          <div className="text-sm text-slate-500 mt-1">
            No HIRA or EAI entries match the current filter for this plant.
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-700">
              <tr>
                <th className="text-left px-4 py-3">Source</th>
                <th className="text-left px-4 py-3">Module #</th>
                <th className="text-left px-4 py-3">Activity</th>
                <th className="text-left px-4 py-3">Initial</th>
                <th className="text-left px-4 py-3">Residual</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Last Reviewed</th>
                <th className="text-left px-4 py-3">Next Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleItems.map((row) => (
                <tr key={`${row.type}-${row.id}`} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-medium ${
                        row.type === "HIRA"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {row.type}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link
                      href={
                        row.type === "HIRA"
                          ? `/hira/entries/${row.id}`
                          : `/eai/entry/${row.id}`
                      }
                      className="text-primary-700 hover:underline"
                    >
                      {row.moduleNumber}#{row.sequenceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <div className="line-clamp-2 text-slate-700">
                      {row.activityDescription}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <Chip
                      level={row.initialRiskOrImpactLevel}
                      score={row.initialRiskOrImpactScore}
                    />
                  </td>
                  <td className="px-4 py-2">
                    {row.residualRiskOrImpactLevel ? (
                      <Chip
                        level={row.residualRiskOrImpactLevel}
                        score={row.residualRiskOrImpactScore ?? 0}
                      />
                    ) : (
                      <span className="text-xs text-slate-400">pending</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-700">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span>{row.status.replace(/_/g, " ")}</span>
                      {insights.signalByRecord.get(row.id) && (
                        <SignalChip
                          signal={insights.signalByRecord.get(row.id)!}
                          href={row.type === "HIRA" ? `/hira/entries/${row.id}` : `/eai/entry/${row.id}`}
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-700">
                    {row.lastReviewedAt
                      ? new Date(row.lastReviewedAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-700">
                    {row.nextReviewDue
                      ? new Date(row.nextReviewDue).toLocaleDateString()
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

function Chip({ level, score }: { level: string; score: number }) {
  const cls = LEVEL_COLOR[level] ?? "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded border ${cls}`}>
      {level} · {score}
    </span>
  );
}

