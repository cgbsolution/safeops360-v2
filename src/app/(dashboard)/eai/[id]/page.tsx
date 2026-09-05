import Link from "next/link";
import { notFound } from "next/navigation";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft } from "lucide-react";
import { Can } from "@/components/auth/can";
import { StudyActions } from "./study-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type StudyOut = {
  id: string;
  number: string;
  plantId: string;
  departmentId: string | null;
  areaId: string | null;
  scopeType: string;
  title: string;
  description: string | null;
  status: string;
  initiatedAt: string;
  targetCompletionDate: string | null;
  approvedAt: string | null;
  effectiveFrom: string | null;
  nextScheduledReviewDate: string | null;
  reviewFrequency: string;
  applicableRegulations: string[] | null;
  team: {
    id: string;
    userId: string;
    teamRole: string;
    department: string | null;
  }[];
  impactMatrixId: string;
};

type EntryListItem = {
  id: string;
  sequenceNumber: number;
  activityDescription: string;
  occurrence: string;
  initialImpactLevel: string;
  initialImpactScore: number;
  residualImpactLevel: string | null;
  residualImpactScore: number | null;
  residualSignificant: boolean;
  legalComplianceStatus: string | null;
  status: string;
  nextReviewDue: string | null;
};

const LEVEL_COLOR: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-200",
  MODERATE: "bg-amber-100 text-amber-800 border-amber-200",
  SIGNIFICANT: "bg-orange-100 text-orange-800 border-orange-200",
  MAJOR: "bg-rose-100 text-rose-800 border-rose-200"
};

export default async function EaiStudyDetailPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  const study = await backendFetch<StudyOut>(`/api/eai/studies/${id}`).catch(() => null);
  if (!study) return notFound();

  const entries = await backendFetch<{ items: EntryListItem[] }>(
    `/api/eai/studies/${id}/entries`
  ).catch(() => ({ items: [] }));

  const isEditable = ["DRAFT", "IN_PROGRESS", "TEAM_REVIEW"].includes(study.status);

  const significant = entries.items.filter((e) => e.residualSignificant).length;
  const nonCompliant = entries.items.filter(
    (e) => e.legalComplianceStatus === "NON_COMPLIANT" || e.legalComplianceStatus === "MARGINAL"
  ).length;

  return (
    <div>
      <Link
        href={`/eai?plantId=${study.plantId}`}
        className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline mb-3"
      >
        <ChevronLeft size={14} /> Back to EAI register
      </Link>

      <PageHeader
        title={`${study.number} — ${study.title}`}
        description={`${study.scopeType.replace(/_/g, " ")} · ${study.status.replace(/_/g, " ")}`}
        action={
          <div className="flex items-center gap-2">
            <StudyActions studyId={study.id} status={study.status} />
            {isEditable && (
              <Can permission="EAI.UPDATE">
                <Button asChild>
                  <Link href={`/eai/${study.id}/entries/new`}>
                    <Plus size={16} /> Add Entry
                  </Link>
                </Button>
              </Can>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
        <StatBox label="Entries" value={entries.items.length} tone="default" />
        <StatBox label="Significant" value={significant} tone="danger" />
        <StatBox label="Compliance Issues" value={nonCompliant} tone="warning" />
        <StatBox
          label="Team Members"
          value={study.team.length}
          tone="default"
        />
      </div>
      <div className="mb-4">
        <Link
          href={`/eai/reviews?plantId=${study.plantId}`}
          className="text-xs text-emerald-700 hover:underline"
        >
          View review cycles →
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2 rounded-xl border bg-white p-4 shadow-none">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Study Overview</h3>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <KV label="Description" value={study.description ?? "—"} />
            <KV
              label="Initiated"
              value={new Date(study.initiatedAt).toLocaleDateString()}
            />
            <KV
              label="Target Completion"
              value={
                study.targetCompletionDate
                  ? new Date(study.targetCompletionDate).toLocaleDateString()
                  : "—"
              }
            />
            <KV label="Review Frequency" value={study.reviewFrequency} />
            <KV
              label="Effective From"
              value={
                study.effectiveFrom
                  ? new Date(study.effectiveFrom).toLocaleDateString()
                  : "—"
              }
            />
            <KV
              label="Next Review"
              value={
                study.nextScheduledReviewDate
                  ? new Date(study.nextScheduledReviewDate).toLocaleDateString()
                  : "—"
              }
            />
          </dl>
        </Card>

        <Card className="rounded-xl border bg-white p-4 shadow-none">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Applicable Regulations</h3>
          {study.applicableRegulations && study.applicableRegulations.length > 0 ? (
            <ul className="space-y-1">
              {study.applicableRegulations.map((r) => (
                <li key={r} className="text-xs">
                  <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {r}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-slate-400">None specified.</div>
          )}
        </Card>
      </div>

      <Card className="rounded-xl border bg-white shadow-none">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Entries</h3>
          <div className="text-xs text-slate-500">{entries.items.length} total</div>
        </div>
        {entries.items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            No entries yet. Add the first entry to start identifying environmental aspects.
          </div>
        ) : (
          <Table className="w-full text-sm">
            <TableHeader className="bg-slate-50 text-xs uppercase tracking-wider text-slate-700">
              <TableRow>
                <TableHead className="text-left px-4 py-2">#</TableHead>
                <TableHead className="text-left px-4 py-2">Activity</TableHead>
                <TableHead className="text-left px-4 py-2">Occurrence</TableHead>
                <TableHead className="text-left px-4 py-2">Initial</TableHead>
                <TableHead className="text-left px-4 py-2">Residual</TableHead>
                <TableHead className="text-left px-4 py-2">Compliance</TableHead>
                <TableHead className="text-left px-4 py-2">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100">
              {entries.items.map((e) => (
                <TableRow key={e.id} className="hover:bg-emerald-50/40">
                  <TableCell className="px-4 py-2 text-slate-500">{e.sequenceNumber}</TableCell>
                  <TableCell className="px-4 py-2">
                    <Link
                      href={`/eai/entry/${e.id}`}
                      className="text-emerald-700 hover:underline line-clamp-2"
                    >
                      {e.activityDescription}
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {e.occurrence}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <Chip level={e.initialImpactLevel} score={e.initialImpactScore} />
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    {e.residualImpactLevel ? (
                      <Chip
                        level={e.residualImpactLevel}
                        score={e.residualImpactScore ?? 0}
                      />
                    ) : (
                      <span className="text-xs text-slate-400">pending</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2 text-xs">
                    {e.legalComplianceStatus ? (
                      <span
                        className={`px-2 py-0.5 rounded border ${
                          e.legalComplianceStatus === "COMPLIANT"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : e.legalComplianceStatus === "MARGINAL"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {e.legalComplianceStatus.replace(/_/g, " ")}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2 text-xs text-slate-700">
                    {e.status.replace(/_/g, " ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
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

function KV({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value ?? "—"}</dd>
    </div>
  );
}

function StatBox({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "default" | "success" | "warning" | "danger";
}) {
  const toneCls =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "warning"
      ? "border-amber-200 bg-amber-50"
      : tone === "danger"
      ? "border-rose-200 bg-rose-50"
      : "border-slate-200 bg-white";
  return (
    <div className={`rounded-xl border ${toneCls} p-4`}>
      <div className="text-xs uppercase tracking-wider text-slate-600 font-medium">
        {label}
      </div>
      <div className="text-3xl font-bold text-slate-900 mt-1">{value}</div>
    </div>
  );
}
