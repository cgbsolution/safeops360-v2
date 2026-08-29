import { notFound } from "next/navigation";
import Link from "next/link";
import { backendFetch, BackendError } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/auth/can";
import { StudyActions } from "./study-actions";
import { markRecordTasksReadForViewer } from "@/lib/workflow/read-state";
import { Plus, FileText, FileSpreadsheet, Printer } from "lucide-react";

export const dynamic = "force-dynamic";

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

const RISK_CHIP: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-300",
  MODERATE: "bg-amber-100 text-amber-800 border-amber-300",
  HIGH: "bg-orange-100 text-orange-900 border-orange-300",
  CRITICAL: "bg-rose-200 text-rose-900 border-rose-400 font-semibold"
};

type StudyDetailResponse = {
  study: {
    id: string;
    number: string;
    title: string;
    description: string | null;
    status: string;
    scopeType: string;
    processCode: string | null;
    initiatedAt: string;
    targetCompletionDate: string | null;
    approvedAt: string | null;
    effectiveFrom: string | null;
    nextScheduledReviewDate: string | null;
    reviewFrequency: string;
    riskMatrixId: string;
    teamLeaderId: string;
    aggregateMetrics: any;
    team: { id: string; userId: string; teamRole: string; department: string | null; signedAt: string | null }[];
  };
  entries: {
    id: string;
    sequenceNumber: number;
    groupLabel: string | null;
    activityDescription: string;
    initialRiskLevel: string;
    initialRiskScore: number;
    residualRiskLevel: string | null;
    residualRiskScore: number | null;
    residualAcceptable: boolean | null;
    residualAlarpRegion: string | null;
    alarpStatus: string | null;
    targetRiskLevel: string | null;
    targetAlarpRegion: string | null;
    unacceptableOverrideActive: boolean;
    status: string;
    lastReviewedAt: string | null;
    nextReviewDue: string | null;
    hazardCount: number;
    existingControlCount: number;
    recommendedControlCount: number;
  }[];
  plantName: string | null;
  departmentName: string | null;
  areaName: string | null;
  teamLeaderName: string | null;
  approvedByName: string | null;
  createdByName: string | null;
  teamMemberNames: Record<string, string>;
  riskMatrix: {
    id: string;
    code: string;
    name: string;
    likelihoodLevels: number;
    severityLevels: number;
    acceptableResidual: Record<string, string>;
    controlHierarchyEnforced: boolean;
  } | null;
};

export default async function HiraStudyDetailPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  let data: StudyDetailResponse;
  try {
    data = await backendFetch<StudyDetailResponse>(`/api/hira/studies/${id}/detail`);
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  // Opening the record clears its Inbox unread state, however the viewer got
  // here. No-op unless they're the action owner.
  await markRecordTasksReadForViewer({ module: "HIRA_STUDY", recordId: id });

  const study = data.study;
  const scopeBits = [data.plantName, data.departmentName, data.areaName].filter(Boolean) as string[];

  return (
    <div>
      <PageHeader
        title={`${study.number} — ${study.title}`}
        description={study.description ?? "HIRA study"}
        action={
          <div className="flex items-center gap-2">
            <Can permission="HIRA.EXPORT">
              <div className="inline-flex items-center divide-x divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <a
                  href={`/api/hira/studies/${study.id}/export?format=csv`}
                  download
                  title="Download as CSV"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <FileText size={15} className="text-sky-600" /> CSV
                </a>
                <a
                  href={`/api/hira/studies/${study.id}/export?format=xlsx`}
                  download
                  title="Download as Excel workbook"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <FileSpreadsheet size={15} className="text-emerald-600" /> Excel
                </a>
                <Link
                  href={`/hira/${study.id}/export`}
                  title="Open print-ready report (Print or Save as PDF)"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Printer size={15} className="text-slate-500" /> Print / PDF
                </Link>
              </div>
            </Can>
            {["DRAFT", "IN_PROGRESS"].includes(study.status) && (
              <Can permission="HIRA.UPDATE">
                <Button asChild>
                  <Link href={`/hira/${study.id}/entries/new`}>
                    <Plus size={16} /> Add Entry
                  </Link>
                </Button>
              </Can>
            )}
            <StudyActions studyId={study.id} status={study.status} />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card title="Status">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block px-2 py-0.5 text-sm rounded border ${
                  STATUS_CHIP[study.status] ?? "bg-slate-100 text-slate-800 border-slate-200"
                }`}
              >
                {study.status.replace(/_/g, " ")}
              </span>
            </div>
            <DefList
              items={[
                ["Initiated", new Date(study.initiatedAt).toLocaleDateString()],
                ["Target completion", study.targetCompletionDate ? new Date(study.targetCompletionDate).toLocaleDateString() : "—"],
                ["Approved", study.approvedAt ? new Date(study.approvedAt).toLocaleDateString() : "—"],
                ["Effective from", study.effectiveFrom ? new Date(study.effectiveFrom).toLocaleDateString() : "—"],
                ["Next review", study.nextScheduledReviewDate ? new Date(study.nextScheduledReviewDate).toLocaleDateString() : "—"],
                ["Review frequency", study.reviewFrequency.replace(/_/g, " ")]
              ]}
            />
          </Card>

          <Card title="Scope">
            <div className="flex flex-wrap gap-1.5">
              {scopeBits.map((b) => (
                <span key={b} className="inline-block px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-700">
                  {b}
                </span>
              ))}
            </div>
            <DefList
              items={[
                ["Scope type", study.scopeType],
                ["Process", study.processCode ?? "—"]
              ]}
            />
          </Card>

          {data.riskMatrix && (
            <Card title="Methodology">
              <DefList
                items={[
                  ["Risk matrix", `${data.riskMatrix.name} (${data.riskMatrix.likelihoodLevels}×${data.riskMatrix.severityLevels})`],
                  ["Control hierarchy enforced", data.riskMatrix.controlHierarchyEnforced ? "Yes" : "No"]
                ]}
              />
              <div className="mt-2 text-xs text-slate-500">
                Acceptable residual:
                <div className="mt-1 grid grid-cols-3 gap-1">
                  {Object.entries(data.riskMatrix.acceptableResidual).map(([k, v]) => (
                    <div key={k} className="rounded bg-slate-50 px-2 py-1 text-slate-700">
                      <div className="uppercase text-[10px]">{k.replace(/_/g, " ")}</div>
                      <div className="font-semibold">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          <Card title="Team">
            <div className="text-sm text-slate-700">
              <div className="font-medium">Leader: {data.teamLeaderName ?? "—"}</div>
              {study.team.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {study.team.map((m) => (
                    <li key={m.id} className="text-xs flex items-center justify-between">
                      <span>{data.teamMemberNames[m.userId] ?? m.userId}</span>
                      <span className="text-slate-500">{m.teamRole.replace(/_/g, " ")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card title={`Entries (${data.entries.length})`} dense>
            {data.entries.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                No entries yet. Add the first activity to begin the assessment.
              </div>
            ) : (
              <div className="overflow-x-auto -mx-3 -mb-3">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-3 py-2">#</th>
                      <th className="text-left px-3 py-2">Activity</th>
                      <th className="text-left px-3 py-2">Hazards</th>
                      <th className="text-left px-3 py-2">Initial</th>
                      <th className="text-left px-3 py-2">Residual</th>
                      <th className="text-left px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.entries.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-600">
                          <Link
                            href={`/hira/${study.id}/entries/${e.id}`}
                            className="text-primary-700 hover:underline"
                          >
                            {e.sequenceNumber}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <Link
                            href={`/hira/${study.id}/entries/${e.id}`}
                            className="block hover:text-primary-700"
                          >
                            <div className="line-clamp-2">{e.activityDescription}</div>
                            {e.groupLabel && (
                              <div className="text-xs text-slate-500 mt-0.5">{e.groupLabel}</div>
                            )}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{e.hazardCount}</td>
                        <td className="px-3 py-2">
                          <RiskChip level={e.initialRiskLevel} score={e.initialRiskScore} />
                        </td>
                        <td className="px-3 py-2">
                          {e.residualRiskLevel ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1">
                                <RiskChip level={e.residualRiskLevel} score={e.residualRiskScore ?? 0} />
                                {e.residualAcceptable === false && (
                                  <span title="Not yet acceptable" className="text-rose-600 text-xs">⚠</span>
                                )}
                              </div>
                              {e.residualAlarpRegion && (
                                <AlarpRegionChip region={e.residualAlarpRegion} status={e.alarpStatus} />
                              )}
                              {e.targetRiskLevel && (
                                <span
                                  title={`Forecast target after recommended controls${e.targetAlarpRegion ? ` — ${e.targetAlarpRegion.replace(/_/g, " ").toLowerCase()}` : ""}`}
                                  className="text-[10px] text-slate-500"
                                >
                                  → target <span className="font-medium">{e.targetRiskLevel}</span>
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">not assessed</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={
                                e.status === "PENDING_REAPPROVAL"
                                  ? "inline-block px-1.5 py-0.5 rounded border bg-amber-100 text-amber-900 border-amber-300 font-medium"
                                  : "text-slate-600"
                              }
                            >
                              {e.status.replace(/_/g, " ")}
                            </span>
                            {e.unacceptableOverrideActive && (
                              <span
                                title="Unacceptable risk accepted under an elevated, time-bounded override"
                                className="inline-block px-1.5 py-0.5 rounded border bg-rose-100 text-rose-800 border-rose-400 font-semibold"
                              >
                                ⚠ OVERRIDE
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {study.aggregateMetrics ? (
            <Card title="Risk Distribution" className="mt-4">
              <AggregateDistribution metrics={study.aggregateMetrics} />
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
  dense,
  className
}: {
  title: string;
  children: React.ReactNode;
  dense?: boolean;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border bg-white ${className ?? ""}`}>
      <div className="px-4 py-2.5 border-b text-xs uppercase tracking-wider text-slate-600 font-medium">
        {title}
      </div>
      <div className={dense ? "p-3" : "p-4"}>{children}</div>
    </div>
  );
}

function DefList({ items }: { items: [string, string | number | null | undefined][] }) {
  return (
    <dl className="mt-3 grid grid-cols-1 gap-1.5 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3">
          <dt className="text-slate-500 text-xs">{k}</dt>
          <dd className="text-slate-800 text-right">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function RiskChip({ level, score }: { level: string; score: number }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs rounded border ${
        RISK_CHIP[level] ?? "bg-slate-100 text-slate-800 border-slate-200"
      }`}
    >
      {level} · {score}
    </span>
  );
}

const ALARP_REGION_CHIP: Record<string, { label: string; cls: string }> = {
  BROADLY_ACCEPTABLE: { label: "Broadly acceptable", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  TOLERABLE: { label: "Tolerable · ALARP", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  UNACCEPTABLE: { label: "Unacceptable", cls: "bg-rose-50 text-rose-700 border-rose-200" }
};

function AlarpRegionChip({ region, status }: { region: string; status: string | null }) {
  const meta = ALARP_REGION_CHIP[region];
  if (!meta) return null;
  const pending = region === "TOLERABLE" && status !== "DEMONSTRATED";
  return (
    <span
      title={pending ? "ALARP demonstration outstanding" : undefined}
      className={`inline-block px-1.5 py-0.5 text-[10px] rounded border ${meta.cls}`}
    >
      {meta.label}
      {pending ? " ⏳" : region === "TOLERABLE" ? " ✓" : ""}
    </span>
  );
}

function AggregateDistribution({
  metrics
}: {
  metrics: {
    total_entries?: number;
    risk_distribution_initial?: { low?: number; moderate?: number; high?: number; critical?: number };
    risk_distribution_residual?: { low?: number; moderate?: number; high?: number; critical?: number };
  };
}) {
  const initial = metrics.risk_distribution_initial ?? {};
  const residual = metrics.risk_distribution_residual ?? {};
  const rows = [
    { label: "Low", color: "bg-emerald-500", i: initial.low ?? 0, r: residual.low ?? 0 },
    { label: "Moderate", color: "bg-amber-500", i: initial.moderate ?? 0, r: residual.moderate ?? 0 },
    { label: "High", color: "bg-orange-500", i: initial.high ?? 0, r: residual.high ?? 0 },
    { label: "Critical", color: "bg-rose-500", i: initial.critical ?? 0, r: residual.critical ?? 0 }
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 text-xs font-medium text-slate-500 px-1">
        <div>Level</div>
        <div className="text-right">Initial</div>
        <div className="text-right">Residual</div>
      </div>
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-3 items-center text-sm px-1">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${r.color}`} />
            {r.label}
          </div>
          <div className="text-right">{r.i}</div>
          <div className="text-right">{r.r}</div>
        </div>
      ))}
    </div>
  );
}
