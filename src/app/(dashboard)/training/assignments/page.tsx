import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { FilterTab, FilterTabsList, type FilterTone } from "@/components/ui/filter-tabs";
import {
  ASSIGNMENT_STATUS_META,
  SOURCE_META,
  fmtDate,
  sourceRecordHref,
  type AssignmentListResponse,
  type Tone
} from "@/lib/training-engine";
import { RunEngineButton } from "./run-engine-button";

export const dynamic = "force-dynamic";

const STATUS_TABS: { key: string; label: string; tone: FilterTone }[] = [
  { key: "all", label: "All", tone: "primary" },
  { key: "assigned", label: "Assigned", tone: "blue" },
  { key: "in_progress", label: "In progress", tone: "primary" },
  { key: "overdue", label: "Overdue", tone: "rose" },
  { key: "escalated", label: "Escalated", tone: "rose" },
  { key: "completed", label: "Completed", tone: "emerald" },
  { key: "cancelled", label: "Cancelled", tone: "slate" }
];

const KPI_TONE: Record<Tone, string> = {
  primary: "text-primary-700",
  emerald: "text-emerald-700",
  amber: "text-amber-700",
  rose: "text-rose-700",
  sky: "text-sky-700",
  slate: "text-slate-900"
};

type SearchParams = {
  status?: string;
  source?: string;
  plantId?: string;
  competencyId?: string;
  personUserId?: string;
};

export default async function TrainingAssignmentsPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await props.searchParams;
  const status = sp.status ?? "all";
  const source = sp.source ?? "all";

  let data: AssignmentListResponse = { items: [], summary: { total: 0, byStatus: {} } };
  let error: string | null = null;
  try {
    data = await backendFetch<AssignmentListResponse>("/api/training-engine/assignments", {
      query: {
        status: status !== "all" ? status : null,
        source: source !== "all" ? source : null,
        plantId: sp.plantId ?? null,
        competencyId: sp.competencyId ?? null,
        personUserId: sp.personUserId ?? null
      }
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load training assignments";
  }

  const byStatus = data.summary.byStatus ?? {};
  const count = (k: string) => byStatus[k] ?? 0;

  function chipHref(next: Partial<SearchParams>): string {
    const params = new URLSearchParams();
    const merged: SearchParams = { status, source, ...sp, ...next };
    if (merged.status && merged.status !== "all") params.set("status", merged.status);
    if (merged.source && merged.source !== "all") params.set("source", merged.source);
    if (merged.plantId) params.set("plantId", merged.plantId);
    if (merged.competencyId) params.set("competencyId", merged.competencyId);
    if (merged.personUserId) params.set("personUserId", merged.personUserId);
    const s = params.toString();
    return s ? `/training/assignments?${s}` : "/training/assignments";
  }

  const KPIS: { label: string; value: number; tone: Tone }[] = [
    { label: "Total", value: data.summary.total ?? data.items.length, tone: "slate" },
    { label: "Assigned", value: count("assigned"), tone: "sky" },
    { label: "In progress", value: count("in_progress"), tone: "primary" },
    { label: "Overdue", value: count("overdue"), tone: "rose" },
    { label: "Escalated", value: count("escalated"), tone: "rose" },
    { label: "Completed", value: count("completed"), tone: "emerald" }
  ];

  return (
    <div>
      <PageHeader
        title="Training Assignments"
        description="Assignments the competency engine has raised from incidents, near misses, observations and recert windows — routed to the right worker with a due date and provenance."
        breadcrumbs={[{ label: "People & Competency" }, { label: "Training Assignments" }]}
        action={<RunEngineButton />}
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {KPIS.map((k) => (
              <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className={cn("text-2xl font-bold tabular-nums", KPI_TONE[k.tone])}>
                  {k.value}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-wider text-slate-500">
                  {k.label}
                </div>
              </div>
            ))}
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <FilterTabsList label="Status">
              {STATUS_TABS.map((t) => (
                <FilterTab
                  key={t.key}
                  href={chipHref({ status: t.key })}
                  label={t.label}
                  count={t.key === "all" ? data.summary.total : count(t.key)}
                  active={status === t.key}
                  tone={t.tone}
                />
              ))}
            </FilterTabsList>

            <form action="/training/assignments" method="GET" className="flex items-center gap-2">
              {status !== "all" && <input type="hidden" name="status" value={status} />}
              {sp.plantId && <input type="hidden" name="plantId" value={sp.plantId} />}
              {sp.competencyId && <input type="hidden" name="competencyId" value={sp.competencyId} />}
              {sp.personUserId && (
                <input type="hidden" name="personUserId" value={sp.personUserId} />
              )}
              <select
                name="source"
                defaultValue={source}
                className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="all">All sources</option>
                {Object.entries(SOURCE_META).map(([k, m]) => (
                  <option key={k} value={k}>
                    {m.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Apply
              </button>
            </form>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Worker</th>
                  <th className="px-4 py-2.5 font-semibold">Competency</th>
                  <th className="px-4 py-2.5 font-semibold">Source</th>
                  <th className="px-4 py-2.5 font-semibold">Source record</th>
                  <th className="px-4 py-2.5 font-semibold">Due</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                      No assignments match this filter.
                    </td>
                  </tr>
                ) : (
                  data.items.map((a) => {
                    const meta = ASSIGNMENT_STATUS_META[a.status] ?? ASSIGNMENT_STATUS_META.assigned;
                    const srcMeta = SOURCE_META[a.source] ?? SOURCE_META.manual;
                    const srcHref = sourceRecordHref(a.sourceModule, a.sourceRecordId);
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium text-slate-900">{a.worker?.name ?? "—"}</div>
                          <div className="text-[11px] text-slate-500">
                            {a.worker?.role ? a.worker.role.replace(/_/g, " ") : ""}
                            {a.worker?.department ? ` · ${a.worker.department}` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Link
                            href={`/training/assignments/${a.id}`}
                            className="font-medium text-primary-700 hover:underline"
                          >
                            {a.competencyName}
                          </Link>
                          {a.isMandatory && (
                            <span className="ml-2 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                              Mandatory
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                              srcMeta.chip
                            )}
                          >
                            {srcMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-slate-600">
                          {a.sourceRecordRef ? (
                            srcHref ? (
                              <Link
                                href={srcHref}
                                className="inline-flex items-center gap-1 text-primary-700 hover:underline"
                              >
                                {a.sourceRecordRef}
                                <ExternalLink size={12} />
                              </Link>
                            ) : (
                              <span className="font-mono text-xs">{a.sourceRecordRef}</span>
                            )
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top tabular-nums text-slate-600">
                          {fmtDate(a.dueDate)}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                              meta.chip
                            )}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-right">
                          <Link
                            href={`/training/assignments/${a.id}`}
                            className="inline-flex items-center text-slate-400 hover:text-primary-700"
                            aria-label="Open assignment"
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
