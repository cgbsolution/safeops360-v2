import Link from "next/link";
import { Clock, GraduationCap, ShieldAlert } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import {
  ASSIGNMENT_STATUS_META,
  SOURCE_META,
  fmtDate,
  sourceRecordHref,
  type AssignmentMineResponse,
  type Tone
} from "@/lib/training-engine";
import { AssignmentActions } from "../assignment-actions";

export const dynamic = "force-dynamic";

const KPI_TONE: Record<Tone, string> = {
  primary: "text-primary-700",
  emerald: "text-emerald-700",
  amber: "text-amber-700",
  rose: "text-rose-700",
  sky: "text-sky-700",
  slate: "text-slate-900"
};

// Open statuses sort first; terminal (completed / cancelled) fall to the bottom.
const STATUS_ORDER: Record<string, number> = {
  overdue: 0,
  escalated: 1,
  assigned: 2,
  in_progress: 3,
  completed: 4,
  cancelled: 5
};

export default async function MyTrainingPage() {
  let data: AssignmentMineResponse = { items: [] };
  let error: string | null = null;
  try {
    data = await backendFetch<AssignmentMineResponse>("/api/training-engine/assignments/mine");
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load your training";
  }

  const items = [...data.items].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
  );

  const openCount = items.filter(
    (a) => a.status === "assigned" || a.status === "in_progress"
  ).length;
  const overdueCount = items.filter(
    (a) => a.status === "overdue" || a.status === "escalated"
  ).length;
  const completedCount = items.filter((a) => a.status === "completed").length;
  const mandatoryOpen = items.filter(
    (a) => a.isMandatory && a.status !== "completed" && a.status !== "cancelled"
  ).length;

  const KPIS: { label: string; value: number; tone: Tone }[] = [
    { label: "Open", value: openCount, tone: "primary" },
    { label: "Overdue / escalated", value: overdueCount, tone: "rose" },
    { label: "Completed", value: completedCount, tone: "emerald" },
    { label: "Mandatory open", value: mandatoryOpen, tone: "amber" }
  ];

  return (
    <div>
      <PageHeader
        title="My Training"
        description="Training the competency engine has assigned to you from incidents, near misses, observations and recert windows. Mandatory items must be completed — they can't be declined."
        breadcrumbs={[{ label: "People & Competency" }, { label: "My Training" }]}
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
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

          {items.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <GraduationCap size={32} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">
                You have no training assignments. You&apos;re all caught up.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((a) => {
                const meta = ASSIGNMENT_STATUS_META[a.status] ?? ASSIGNMENT_STATUS_META.assigned;
                const srcMeta = SOURCE_META[a.source] ?? SOURCE_META.manual;
                const srcHref = sourceRecordHref(a.sourceModule, a.sourceRecordId);
                return (
                  <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/training/assignments/${a.id}`}
                            className="font-semibold text-slate-900 hover:text-primary-700 hover:underline"
                          >
                            {a.competencyName}
                          </Link>
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                              meta.chip
                            )}
                          >
                            {meta.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 font-medium",
                              srcMeta.chip
                            )}
                          >
                            {srcMeta.label}
                          </span>
                          {a.sourceRecordRef &&
                            (srcHref ? (
                              <Link href={srcHref} className="text-primary-700 hover:underline">
                                {a.sourceRecordRef}
                              </Link>
                            ) : (
                              <span className="font-mono text-[11px]">{a.sourceRecordRef}</span>
                            ))}
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Clock size={13} className="text-slate-400" />
                            Due {fmtDate(a.dueDate)}
                          </span>
                        </div>

                        {a.isMandatory && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                            <ShieldAlert size={12} />
                            Mandatory — cannot be declined
                          </span>
                        )}
                      </div>

                      <div className="shrink-0">
                        <AssignmentActions
                          assignmentId={a.id}
                          status={a.status}
                          isMandatory={a.isMandatory}
                          dismissible={a.dismissible}
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
