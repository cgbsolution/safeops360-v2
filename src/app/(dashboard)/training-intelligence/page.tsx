import Link from "next/link";
import { ChevronRight, AlertTriangle, ArrowRight } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { PlantSwitcher } from "@/components/plant-switcher";
import { resolvePlantContext } from "@/lib/plant-context";
import { cn } from "@/lib/utils";
import { FilterTab, FilterTabsList, type FilterTone } from "@/components/ui/filter-tabs";
import {
  RISK_BAND_META,
  PERSON_RISK_STATUS_META,
  type PersonRiskListResponse,
  type RiskBand
} from "@/lib/training-intelligence";
import { RunAnalysisButton } from "./run-analysis-button";

export const dynamic = "force-dynamic";

type SearchParams = { band?: string; status?: string; plantId?: string };

const BAND_TABS: { key: string; label: string; tone: FilterTone }[] = [
  { key: "all", label: "All bands", tone: "primary" },
  { key: "elevated", label: "Elevated", tone: "amber" },
  { key: "high", label: "High", tone: "amber" },
  { key: "critical", label: "Critical", tone: "rose" }
];

const STATUS_TABS: { key: string; label: string; tone: FilterTone }[] = [
  { key: "all", label: "All", tone: "primary" },
  { key: "flagged", label: "Flagged", tone: "rose" },
  { key: "acknowledged", label: "Acknowledged", tone: "blue" },
  { key: "training_assigned", label: "Training assigned", tone: "primary" },
  { key: "cleared", label: "Cleared", tone: "emerald" }
];

export default async function TrainingIntelligencePage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await props.searchParams;
  const band = sp.band ?? "all";
  const status = sp.status ?? "all";
  const { plantId, plants } = await resolvePlantContext(sp.plantId);

  let data: PersonRiskListResponse = {
    items: [],
    summary: { total: 0, byBand: {}, byStatus: {}, critical: 0, high: 0 }
  };
  let error: string | null = null;
  try {
    data = await backendFetch<PersonRiskListResponse>("/api/training-engine/person-risk", {
      query: {
        status: status !== "all" ? status : null,
        riskBand: band !== "all" ? band : null,
        plantId: plantId ?? null
      }
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load person-risk flags";
  }

  const byBand = data.summary.byBand ?? {};
  const byStatus = data.summary.byStatus ?? {};
  const bandCount = (k: string) => byBand[k] ?? 0;
  const statusCount = (k: string) => byStatus[k] ?? 0;

  const items = [...data.items].sort((a, b) => b.riskScore - a.riskScore);

  const autoAssigned = items.filter((f) => f.status === "training_assigned").length;
  const open = items.filter((f) => f.status === "flagged").length;

  function chipHref(next: Partial<SearchParams>): string {
    const params = new URLSearchParams();
    const merged: SearchParams = { band, status, plantId: sp.plantId, ...next };
    if (merged.band && merged.band !== "all") params.set("band", merged.band);
    if (merged.status && merged.status !== "all") params.set("status", merged.status);
    if (merged.plantId) params.set("plantId", merged.plantId);
    const s = params.toString();
    return s ? `/training-intelligence?${s}` : "/training-intelligence";
  }

  const KPIS: { label: string; value: number; tone: string }[] = [
    { label: "Flagged workers", value: data.summary.total, tone: "text-slate-900" },
    { label: "Critical", value: data.summary.critical, tone: "text-rose-700" },
    { label: "High", value: data.summary.high, tone: "text-orange-700" },
    { label: "Training auto-assigned", value: autoAssigned, tone: "text-primary-700" },
    { label: "Open / unactioned", value: open, tone: "text-amber-700" }
  ];

  return (
    <div>
      <PageHeader
        title="Training Intelligence"
        description="Person-risk analytics — workers whose repeat safety-event involvement crosses the threshold are auto-flagged and routed to the training their events point to."
        breadcrumbs={[{ label: "People & Competency" }, { label: "Training Intelligence" }]}
        action={
          <div className="flex items-center gap-2">
            <PlantSwitcher plants={plants} currentPlantId={plantId} />
            <RunAnalysisButton />
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}
        </div>
      ) : (
        <>
          {/* Explainer — the Events → Person risk → Training flow */}
          <div className="mb-5 flex flex-col gap-3 rounded-xl border border-primary-200 bg-primary-50/50 px-4 py-3 text-sm text-primary-900 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-3xl">
              Every incident, near miss, and observation logged against a worker is scored. Workers
              who cross the threshold are automatically flagged and assigned the training their
              events point to.
            </p>
            <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold">
              <span className="rounded-full bg-white/70 px-2.5 py-1">Events</span>
              <ArrowRight size={14} className="text-primary-500" />
              <span className="rounded-full bg-white/70 px-2.5 py-1">Person risk</span>
              <ArrowRight size={14} className="text-primary-500" />
              <span className="rounded-full bg-white/70 px-2.5 py-1">Training</span>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {KPIS.map((k) => (
              <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className={cn("text-2xl font-bold tabular-nums", k.tone)}>{k.value}</div>
                <div className="mt-1 text-[11px] uppercase tracking-wider text-slate-500">
                  {k.label}
                </div>
              </div>
            ))}
          </div>

          <div className="mb-4 flex flex-col gap-3">
            <FilterTabsList label="Band">
              {BAND_TABS.map((t) => (
                <FilterTab
                  key={t.key}
                  href={chipHref({ band: t.key })}
                  label={t.label}
                  count={t.key === "all" ? data.summary.total : bandCount(t.key)}
                  active={band === t.key}
                  tone={t.tone}
                />
              ))}
            </FilterTabsList>
            <FilterTabsList label="Status">
              {STATUS_TABS.map((t) => (
                <FilterTab
                  key={t.key}
                  href={chipHref({ status: t.key })}
                  label={t.label}
                  count={t.key === "all" ? data.summary.total : statusCount(t.key)}
                  active={status === t.key}
                  tone={t.tone}
                />
              ))}
            </FilterTabsList>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Worker</th>
                  <th className="px-4 py-2.5 font-semibold">Risk band</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Score</th>
                  <th className="px-4 py-2.5 font-semibold">Events</th>
                  <th className="px-4 py-2.5 font-semibold">Recommended training</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                      No workers flagged — run the analysis or check back after events accumulate.
                    </td>
                  </tr>
                ) : (
                  items.map((f) => {
                    const bandMeta = RISK_BAND_META[f.riskBand];
                    const statusMeta =
                      PERSON_RISK_STATUS_META[f.status] ?? PERSON_RISK_STATUS_META.flagged;
                    const href = `/training-intelligence/worker/${f.personUserId}`;
                    const recs = f.recommendedCompetencies ?? [];
                    const extraRecs = Math.max(0, recs.length - 2);
                    return (
                      <tr key={f.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 align-top">
                          <Link href={href} className="font-medium text-slate-900 hover:text-primary-700">
                            {f.worker?.name ?? "—"}
                          </Link>
                          <div className="text-[11px] text-slate-500">
                            {f.worker?.role ? f.worker.role.replace(/_/g, " ") : ""}
                            {f.worker?.department ? ` · ${f.worker.department}` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                              bandMeta.chip
                            )}
                          >
                            {bandMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-right">
                          <span className={cn("text-sm font-bold tabular-nums", bandMeta.text)}>
                            {f.riskScore}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 tabular-nums">
                              <AlertTriangle size={11} className="text-rose-500" />
                              {f.incidentCount} INC · {f.nearMissCount} NM · {f.observationCount} OBS
                            </span>
                            {f.sifCount > 0 && (
                              <span className="inline-flex rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800 tabular-nums">
                                SIF {f.sifCount}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {recs.length === 0 ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {recs.slice(0, 2).map((c) => (
                                <span
                                  key={c.competencyId}
                                  className="inline-flex rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700"
                                >
                                  {c.name}
                                </span>
                              ))}
                              {extraRecs > 0 && (
                                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                  +{extraRecs}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                              statusMeta.chip
                            )}
                          >
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-right">
                          <Link
                            href={href}
                            className="inline-flex items-center text-slate-400 hover:text-primary-700"
                            aria-label="Open worker risk detail"
                          >
                            <ChevronRight size={16} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
