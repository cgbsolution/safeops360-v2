"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmtDate } from "../../lib";
import { TASK_STATUS_CHIP, type ComplianceTask } from "../../lib-p2";
import { TaskActions } from "../[id]/detail-view";

function typeLabel(token: string | null | undefined): string {
  if (!token) return "—";
  return token.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ComplianceTasksView({ tasks, view }: { tasks: ComplianceTask[]; view: "mine" | "verify" }) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
        <Link
          href="/erm/compliance/tasks?view=mine"
          className={"rounded-md px-3 py-1.5 transition-all " + (view === "mine" ? "bg-white text-primary-700 shadow-sm" : "text-slate-500 hover:text-slate-700")}
        >
          My tasks
        </Link>
        <Link
          href="/erm/compliance/tasks?view=verify"
          className={"rounded-md px-3 py-1.5 transition-all " + (view === "verify" ? "bg-white text-primary-700 shadow-sm" : "text-slate-500 hover:text-slate-700")}
        >
          Verification queue
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
          {view === "verify" ? "Nothing awaiting verification — the queue is clear." : "No compliance tasks assigned to you right now."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {tasks.map((t) => (
            <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {t.obligationId ? (
                      <Link href={`/erm/compliance/${t.obligationId}`} className="text-xs font-semibold text-primary-700 hover:underline">
                        {t.obligationCode ?? "—"}
                      </Link>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400">{t.obligationCode ?? "—"}</span>
                    )}
                    <span className={"inline-block rounded border px-2 py-0.5 text-[11px] " + (TASK_STATUS_CHIP[t.status] ?? "")}>{t.status}</span>
                  </div>
                  <h3 className="mt-1 truncate text-sm font-medium text-slate-800">{t.obligationTitle ?? "—"}</h3>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>
                  Task <b className="text-slate-700">{typeLabel(t.taskType)}</b>
                </span>
                <span>
                  Period <b className="text-slate-700">{t.periodLabel}</b>
                </span>
                <span>
                  Due <b className="text-slate-700 tabular-nums">{fmtDate(t.dueDate)}</b>
                  {t.overdueDays > 0 && (
                    <span className="ml-1 rounded bg-rose-100 px-1 text-[10px] font-semibold text-rose-700">{t.overdueDays}d overdue</span>
                  )}
                </span>
                {view === "verify" && (
                  <span>
                    Evidence <b className="text-slate-700 tabular-nums">{t.attachmentCount}</b> file(s)
                    {t.attestedByName && <> · attested by {t.attestedByName}</>}
                  </span>
                )}
              </div>

              <div className="mt-3 border-t border-slate-100 pt-3">
                <TaskActions task={t} onChanged={() => router.refresh()} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
