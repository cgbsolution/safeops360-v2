import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { KpiTile } from "@/components/erm/shared";
import {
  EXERCISE_STATUS_CHIP,
  fmtRto,
  type ExerciseListResponse,
} from "@/app/(dashboard)/erm/lib-p3";
import { fmtDate } from "@/app/(dashboard)/erm/lib";
import { ScheduleExerciseButton } from "./schedule-form";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  DESK_CHECK: "Desk Check",
  TABLETOP: "Tabletop",
  SIMULATION: "Simulation",
  FULL_INTERRUPTION_TEST: "Full Interruption",
  CALL_TREE_TEST: "Call-Tree Test",
};

const STATUS_FILTERS = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

export default async function ExerciseProgrammePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  const statusRaw = sp.status;
  const status = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;

  let data: ExerciseListResponse = { items: [], total: 0, statusCounts: {} };
  let error: string | null = null;
  try {
    data = await backendFetch<ExerciseListResponse>("/api/erm/bcm/exercises", {
      query: { status: status ?? undefined },
    });
  } catch (e: any) {
    error = e?.message ?? "Failed to load exercise programme";
  }

  const counts = data.statusCounts ?? {};

  const statusChip = (s: string, label: string) => {
    const next = new URLSearchParams();
    if (status !== s) next.set("status", s);
    const active = status === s;
    return (
      <Link
        key={s}
        href={`/erm/bcm/exercises${next.toString() ? `?${next.toString()}` : ""}`}
        className={
          "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
          (active
            ? "border-slate-900 bg-slate-900 text-white"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")
        }
      >
        {label} <span className="tabular-nums opacity-70">{counts[s] ?? 0}</span>
      </Link>
    );
  };

  return (
    <div>
      <PageHeader
        title="BCM Exercise Programme"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Business Continuity", href: "/erm/bcm" },
          { label: "Exercises" },
        ]}
        description="Schedule, run and evidence continuity exercises — desk checks, tabletops, simulations, full-interruption tests and call-tree drills. Gaps spawn CAPAs on the universal engine."
        action={<ScheduleExerciseButton />}
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}. Ensure the ERM Phase 3 (BCM) seed has been run and you are logged in with a BCM role.
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiTile label="Total Exercises" value={data.total} />
            <KpiTile label="Planned" value={counts.PLANNED ?? 0} tone="warn" href="/erm/bcm/exercises?status=PLANNED" />
            <KpiTile label="Completed" value={counts.COMPLETED ?? 0} tone="good" href="/erm/bcm/exercises?status=COMPLETED" />
            <KpiTile label="In Progress" value={counts.IN_PROGRESS ?? 0} href="/erm/bcm/exercises?status=IN_PROGRESS" />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</span>
            {STATUS_FILTERS.map((s) => statusChip(s, s.replace(/_/g, " ")))}
            <span className="ml-auto text-xs text-slate-500">{data.items.length} shown</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-slate-50/95">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Code</th>
                  <th className="px-3 py-2.5">Title</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Scheduled</th>
                  <th className="px-3 py-2.5">Facilitator</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Outcome</th>
                  <th className="px-3 py-2.5">RTO Achieved</th>
                  <th className="px-3 py-2.5">Findings</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-10 text-center text-sm text-slate-400">
                      No exercises match the current filter. Use “Schedule Exercise” to plan one.
                    </td>
                  </tr>
                ) : (
                  data.items.map((ex) => (
                    <tr key={ex.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                      <td className="px-3 py-2.5">
                        <Link href={`/erm/bcm/exercises/${ex.id}`} className="font-medium text-primary-700 hover:underline">
                          {ex.exerciseCode}
                        </Link>
                      </td>
                      <td className="max-w-[260px] px-3 py-2.5 text-slate-700">{ex.title}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {TYPE_LABEL[ex.exerciseType] ?? ex.exerciseType.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{fmtDate(ex.scheduledDate)}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{ex.facilitatorName ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={
                            "inline-block rounded border px-2 py-0.5 text-[11px] " +
                            (EXERCISE_STATUS_CHIP[ex.status] ?? "bg-slate-100 text-slate-600 border-slate-200")
                          }
                        >
                          {ex.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">
                        {ex.outcome ? ex.outcome.replace(/_/g, " ") : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs tabular-nums text-slate-600">
                        {ex.rtoAchievedHours != null ? fmtRto(ex.rtoAchievedHours) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs tabular-nums">
                        {ex.findings.length > 0 ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">
                            {ex.findings.length}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
