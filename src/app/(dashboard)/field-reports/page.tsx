import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { backendFetch } from "@/lib/backend/fetch";
import type { SubmissionOut } from "@/lib/capture/types";
import { FilterTabs } from "./filter-tabs";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

// Officer triage queue for guided field capture. Lives in the normal
// dashboard skin (Midnight Executive is scoped to the field + daily-brief
// surfaces — DECISIONS.md D9).

const SEVERITY_STYLE: Record<string, string> = {
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_STYLE: Record<string, string> = {
  submitted: "bg-blue-50 text-blue-700 border-blue-200",
  triaged: "bg-amber-50 text-amber-700 border-amber-200",
  converted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-neutral-100 text-neutral-600 border-neutral-200",
  rejected: "bg-neutral-100 text-neutral-500 border-neutral-200 line-through",
};

const TYPE_LABEL: Record<string, string> = {
  observation: "Observation",
  near_miss: "Near-miss",
  unsafe_condition: "Unsafe condition",
  incident: "Incident",
  ptw: "Work permit",
  flra: "FLRA",
};

export default async function FieldReportsPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const status = sp.status ?? "submitted";

  let items: SubmissionOut[] = [];
  let loadError: string | null = null;
  try {
    const query: Record<string, string> = { limit: "100" };
    if (status !== "all") query.status = status;
    const data = await backendFetch<{ items: SubmissionOut[] }>("/api/capture/submissions", { query });
    items = data.items;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load field reports";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Field Reports"
        description="Guided-capture submissions from field technicians — triage onto the 5×5 matrix, then convert into Observations, Near-Misses or Incidents."
      />

      <FilterTabs active={status} />

      {loadError ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError}</p>
      ) : null}

      {!loadError && items.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No field reports{status !== "all" ? ` with status "${status}"` : ""}.
        </p>
      ) : null}

      <div className="grid gap-3">
        {items.map((sub) => {
          const l1 = sub.categorySnapshot?.l1?.labels?.en;
          const l2 = sub.categorySnapshot?.l2?.labels?.en;
          return (
            <Link
              key={sub.id}
              href={`/field-reports/${sub.id}`}
              className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40"
            >
              <span className="font-mono text-sm font-semibold">{sub.number}</span>
              <Badge variant="outline" className="text-xs font-medium">
                {TYPE_LABEL[sub.type] ?? sub.type}
              </Badge>
              <span className="min-w-0 flex-1 truncate text-sm">
                {l1 ? `${l1}${l2 ? " — " + l2 : ""}` : (sub.description ?? "—")}
              </span>
              <Badge variant="outline" className={`text-xs font-medium ${SEVERITY_STYLE[sub.severitySelfReported] ?? ""}`}>
                {sub.severitySelfReported}
              </Badge>
              {sub.triage.riskLevel ? (
                <Badge variant="violet" className="bg-violet-50 text-xs font-medium text-violet-700">
                  {sub.triage.riskLevel} ({sub.triage.riskScore})
                </Badge>
              ) : null}
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[sub.status] ?? ""}`}>
                {sub.status}
              </span>
              <span className="text-xs text-muted-foreground">
                {sub.isAnonymous ? "Anonymous" : (sub.reporter?.name ?? "—")}
                {sub.createdAt ? ` · ${new Date(sub.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : ""}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
