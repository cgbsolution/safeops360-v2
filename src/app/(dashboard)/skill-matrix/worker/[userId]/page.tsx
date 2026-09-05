import Link from "next/link";
import { AlertTriangle, ClipboardCheck, GraduationCap, User } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ASSIGNMENT_STATUS_META,
  COMPETENCY_STATE_META,
  SOURCE_META,
  fmtDate,
  labelize,
  type WorkerProfile
} from "@/lib/training-engine";

export const dynamic = "force-dynamic";

export default async function WorkerProfilePage(props: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await props.params;

  let data: WorkerProfile | null = null;
  let error: string | null = null;
  try {
    data = await backendFetch<WorkerProfile>(`/api/skill-matrix/profile/${userId}`);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load worker profile";
  }

  if (error || !data) {
    return (
      <div>
        <PageHeader
          title="Worker profile"
          breadcrumbs={[
            { label: "People & Competency" },
            { label: "Skill Matrix", href: "/skill-matrix" },
            { label: "Worker profile" }
          ]}
        />
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "Worker profile not found."}
        </Alert>
      </div>
    );
  }

  const { user, records, gaps, assignments, summary } = data;

  const TILES: { label: string; value: number; tone: string }[] = [
    { label: "Competencies held", value: summary.held, tone: "text-slate-900" },
    { label: "Valid", value: summary.met, tone: "text-emerald-700" },
    { label: "Gaps", value: summary.gaps, tone: "text-rose-700" },
    { label: "Open assignments", value: summary.openAssignments, tone: "text-primary-700" }
  ];

  return (
    <div>
      <PageHeader
        title={user.name}
        description="Competency profile — held records, gaps and active training assignments."
        breadcrumbs={[
          { label: "People & Competency" },
          { label: "Skill Matrix", href: "/skill-matrix" },
          { label: user.name }
        ]}
        action={
          <Badge variant="neutral" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
            <User size={13} className="text-slate-400" />
            {user.designation ?? user.role.replace(/_/g, " ")}
            {user.department ? ` · ${user.department}` : ""}
          </Badge>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map((t) => (
          <Card key={t.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-none">
            <div className={cn("text-2xl font-bold tabular-nums", t.tone)}>{t.value}</div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-slate-500">{t.label}</div>
          </Card>
        ))}
      </div>

      {/* Competency records */}
      <Card className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <GraduationCap size={16} className="text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">Competency records</h2>
        </div>
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <TableHead className="px-4 py-2.5 font-semibold">Competency</TableHead>
                <TableHead className="px-4 py-2.5 font-semibold">State</TableHead>
                <TableHead className="px-4 py-2.5 font-semibold">Proficiency</TableHead>
                <TableHead className="px-4 py-2.5 font-semibold">Valid until</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100">
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                    No competency records held.
                  </TableCell>
                </TableRow>
              ) : (
                records.map((r) => {
                  const meta = COMPETENCY_STATE_META[r.state];
                  return (
                    <TableRow key={r.competencyId} className="hover:bg-slate-50/70">
                      <TableCell className="px-4 py-3 align-top">
                        <div className="font-medium text-slate-900">{r.name}</div>
                        <div className="text-[11px] text-slate-500">{r.category}</div>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                            meta ? meta.cell : "bg-slate-100 text-slate-500 border-slate-200"
                          )}
                        >
                          {meta ? meta.label : labelize(r.state)}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top text-slate-600">
                        {r.currentProficiency ? labelize(r.currentProficiency) : "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top tabular-nums text-slate-600">
                        {fmtDate(r.validUntil)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Gaps */}
      {gaps.length > 0 && (
        <div className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-600" />
            <h2 className="text-sm font-semibold text-slate-800">
              Competency gaps
              <Badge variant="danger" className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                {gaps.length}
              </Badge>
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gaps.map((g) => (
              <Alert variant="destructive"
                key={g.competencyId}
                className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
                <div className="font-medium text-slate-900">{g.name}</div>
                <div className="mt-1 text-xs text-rose-700">{labelize(g.requirementType)}</div>
                <dl className="mt-3 space-y-1 text-xs">
                  {g.requiredProficiency && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Required</dt>
                      <dd className="font-medium text-slate-700">
                        {labelize(g.requiredProficiency)}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Current</dt>
                    <dd className="font-medium text-slate-700">
                      {g.currentState ? labelize(g.currentState) : "None"}
                    </dd>
                  </div>
                </dl>
              </Alert>
            ))}
          </div>
        </div>
      )}

      {/* Assignments */}
      <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <ClipboardCheck size={16} className="text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">Training assignments</h2>
        </div>
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <TableHead className="px-4 py-2.5 font-semibold">Competency</TableHead>
                <TableHead className="px-4 py-2.5 font-semibold">Source</TableHead>
                <TableHead className="px-4 py-2.5 font-semibold">Status</TableHead>
                <TableHead className="px-4 py-2.5 font-semibold">Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100">
              {assignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                    No training assignments.
                  </TableCell>
                </TableRow>
              ) : (
                assignments.map((a) => {
                  const meta = ASSIGNMENT_STATUS_META[a.status] ?? ASSIGNMENT_STATUS_META.assigned;
                  const srcMeta = SOURCE_META[a.source] ?? SOURCE_META.manual;
                  return (
                    <TableRow key={a.id} className="hover:bg-slate-50/70">
                      <TableCell className="px-4 py-3 align-top">
                        <Link
                          href={`/training/assignments/${a.id}`}
                          className="font-medium text-primary-700 hover:underline"
                        >
                          {a.competencyName}
                        </Link>
                        {a.isMandatory && (
                          <Badge variant="danger" className="ml-2 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                            Mandatory
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            srcMeta.chip
                          )}
                        >
                          {srcMeta.label}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                            meta.chip
                          )}
                        >
                          {meta.label}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top tabular-nums text-slate-600">
                        {fmtDate(a.dueDate)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
