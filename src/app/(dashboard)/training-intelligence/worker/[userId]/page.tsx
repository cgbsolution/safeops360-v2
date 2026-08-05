import Link from "next/link";
import {
  AlertTriangle,
  CircleDot,
  ExternalLink,
  GraduationCap,
  ListChecks,
  User
} from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Can } from "@/components/auth/can";
import { cn } from "@/lib/utils";
import { fmtDate, labelize, sourceRecordHref } from "@/lib/training-engine";
import {
  EVENT_MODULE_META,
  RISK_BAND_META,
  type PersonRiskDetail
} from "@/lib/training-intelligence";
import { AssignTrainingButton, WorkerRiskActions } from "./worker-risk-actions";

export const dynamic = "force-dynamic";

export default async function WorkerRiskDetailPage(props: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await props.params;

  let data: PersonRiskDetail | null = null;
  let error: string | null = null;
  try {
    data = await backendFetch<PersonRiskDetail>(`/api/training-engine/person-risk/${userId}`);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load worker risk detail";
  }

  if (error || !data) {
    return (
      <div>
        <PageHeader
          title="Worker risk"
          breadcrumbs={[
            { label: "People & Competency" },
            { label: "Training Intelligence", href: "/training-intelligence" },
            { label: "Worker risk" }
          ]}
        />
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "Worker risk detail not found."}
        </div>
      </div>
    );
  }

  const { worker, counts, reasons, contributingRecords, recommendedCompetencies, flag } = data;
  const bandMeta = RISK_BAND_META[data.riskBand];

  const TILES: { label: string; value: number; tone: string }[] = [
    { label: "Incidents", value: counts.incident, tone: "text-rose-700" },
    { label: "Near misses", value: counts.nearMiss, tone: "text-amber-700" },
    { label: "Observations", value: counts.observation, tone: "text-sky-700" },
    { label: "SIF events", value: counts.sif, tone: "text-rose-700" },
    { label: "Total events", value: counts.total, tone: "text-slate-900" }
  ];

  const assignmentCount = flag?.assignmentIds?.length ?? 0;

  return (
    <div>
      <PageHeader
        title={worker.name}
        description={`Person-risk detail — repeat safety-event involvement over the last ${data.windowDays} days.`}
        breadcrumbs={[
          { label: "People & Competency" },
          { label: "Training Intelligence", href: "/training-intelligence" },
          { label: worker.name }
        ]}
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
            <User size={13} className="text-slate-400" />
            {worker.designation ?? worker.role.replace(/_/g, " ")}
            {worker.department ? ` · ${worker.department}` : ""}
          </span>
        }
      />

      {/* Risk banner: band + score + reasons */}
      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border px-5 py-3 text-center",
                bandMeta.chip
              )}
            >
              <span className="text-3xl font-bold tabular-nums leading-none">{data.riskScore}</span>
              <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider">
                {bandMeta.label} risk
              </span>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800">
                {data.flagged ? "Flagged for training intervention" : "Below flag threshold"}
              </div>
              <div className="text-xs text-slate-500">
                {worker.role.replace(/_/g, " ")}
                {worker.department ? ` · ${worker.department}` : ""}
                {` · ${data.windowDays}-day window`}
              </div>
            </div>
          </div>

          {flag && (
            <Can permission="SKILL_MATRIX.ASSESS">
              <WorkerRiskActions userId={worker.id} status={flag.status} />
            </Can>
          )}
        </div>

        {reasons.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {reasons.map((r, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600"
              >
                <CircleDot size={11} className={bandMeta.text} />
                {r}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Counts */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {TILES.map((t) => (
          <div key={t.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className={cn("text-2xl font-bold tabular-nums", t.tone)}>{t.value}</div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-slate-500">{t.label}</div>
          </div>
        ))}
      </div>

      {/* Recommended training */}
      <div className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <GraduationCap size={16} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">Recommended training</h2>
          </div>
          {recommendedCompetencies.length > 0 && (
            <Can permission="SKILL_MATRIX.ASSESS">
              <AssignTrainingButton userId={worker.id} />
            </Can>
          )}
        </div>
        <div className="p-4">
          {recommendedCompetencies.length === 0 ? (
            <p className="text-sm text-slate-400">
              No competencies mapped from this worker&apos;s events yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {recommendedCompetencies.map((c) => (
                <span
                  key={c.competencyId}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700"
                >
                  {c.name}
                  <span className="rounded-full bg-primary-100 px-1.5 text-[10px] font-bold tabular-nums text-primary-700">
                    {c.fromEvents}
                  </span>
                </span>
              ))}
            </div>
          )}
          {assignmentCount > 0 && (
            <div className="mt-3 text-xs text-slate-500">
              <Link href="/training/assignments" className="text-primary-700 hover:underline">
                Training assigned ({assignmentCount})
              </Link>{" "}
              — view in Training Assignments.
            </div>
          )}
        </div>
      </div>

      {/* Contributing events timeline */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <ListChecks size={16} className="text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">Contributing events</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            {contributingRecords.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Module</th>
                <th className="px-4 py-2.5 font-semibold">Record</th>
                <th className="px-4 py-2.5 font-semibold">Date</th>
                <th className="px-4 py-2.5 font-semibold">Role</th>
                <th className="px-4 py-2.5 font-semibold">Severity</th>
                <th className="px-4 py-2.5 font-semibold">SIF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contributingRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                    No contributing events on record.
                  </td>
                </tr>
              ) : (
                contributingRecords.map((rec, i) => {
                  const meta = EVENT_MODULE_META[rec.module];
                  const href = sourceRecordHref(rec.module, rec.id);
                  return (
                    <tr key={`${rec.module}-${rec.id}-${i}`} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 align-top">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                            meta ? meta.chip : "bg-slate-100 text-slate-600 border-slate-200"
                          )}
                        >
                          {meta ? meta.label : labelize(rec.module)}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {rec.ref ? (
                          href ? (
                            <Link
                              href={href}
                              className="inline-flex items-center gap-1 text-primary-700 hover:underline"
                            >
                              {rec.ref}
                              <ExternalLink size={12} />
                            </Link>
                          ) : (
                            <span className="font-mono text-xs text-slate-600">{rec.ref}</span>
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top tabular-nums text-slate-600">
                        {fmtDate(rec.date)}
                      </td>
                      <td className="px-4 py-3 align-top text-slate-600">
                        {rec.role ? labelize(rec.role) : "—"}
                      </td>
                      <td className="px-4 py-3 align-top text-slate-600">
                        {rec.severity ? labelize(rec.severity) : "—"}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {rec.sif ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                            <AlertTriangle size={11} />
                            SIF
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
