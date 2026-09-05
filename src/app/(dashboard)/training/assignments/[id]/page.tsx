import Link from "next/link";
import {
  Info,
  User,
  BookOpen,
  Link2,
  ShieldAlert,
  Clock,
  ExternalLink,
  PackageOpen
} from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import {
  ASSIGNMENT_STATUS_META,
  SOURCE_META,
  fmtDate,
  labelize,
  sourceRecordHref,
  type AssignmentDetail
} from "@/lib/training-engine";
import { AssignmentActions } from "../../assignment-actions";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function provenanceValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export default async function AssignmentDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  let a: AssignmentDetail | null = null;
  let error: string | null = null;
  try {
    a = await backendFetch<AssignmentDetail>(`/api/training-engine/assignments/${id}`);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load assignment";
  }

  if (error || !a) {
    return (
      <div>
        <PageHeader
          title="Assignment"
          breadcrumbs={[
            { label: "People & Competency" },
            { label: "Training Assignments", href: "/training/assignments" },
            { label: "Assignment" }
          ]}
        />
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "Assignment not found."}
        </Alert>
      </div>
    );
  }

  const meta = ASSIGNMENT_STATUS_META[a.status] ?? ASSIGNMENT_STATUS_META.assigned;
  const srcMeta = SOURCE_META[a.source] ?? SOURCE_META.manual;
  const srcHref = sourceRecordHref(a.sourceModule, a.sourceRecordId);
  const nonDismissible = a.isMandatory || !a.dismissible;
  const content = a.content ?? null;
  const provEntries = a.provenance ? Object.entries(a.provenance) : [];

  return (
    <div>
      <PageHeader
        title={a.competencyName}
        description="Training assignment"
        breadcrumbs={[
          { label: "People & Competency" },
          { label: "Training Assignments", href: "/training/assignments" },
          { label: a.competencyName }
        ]}
        action={
          <span
            className={cn(
              "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
              meta.chip
            )}
          >
            {meta.label}
          </span>
        }
      />

      {nonDismissible && (
        <Alert variant="destructive" className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">
          <ShieldAlert size={16} className="shrink-0" />
          <span className="font-semibold">Mandatory — cannot be dismissed.</span>
          <span className="text-rose-700">
            This assignment must be completed; there is no decline option.
          </span>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Worker + key facts */}
          <Card className="rounded-xl border border-slate-200 bg-white shadow-none">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <User size={16} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-800">Worker & assignment</h2>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-4 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-slate-500">Worker</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{a.worker?.name ?? "—"}</dd>
                <dd className="text-xs text-slate-500">
                  {a.worker?.role ? a.worker.role.replace(/_/g, " ") : ""}
                  {a.worker?.department ? ` · ${a.worker.department}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-slate-500">Competency</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{a.competencyName}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-slate-500">Assigned</dt>
                <dd className="mt-0.5 text-slate-700">{fmtDate(a.assignedAt)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-slate-500">Due</dt>
                <dd className="mt-0.5 flex items-center gap-1 text-slate-700">
                  <Clock size={13} className="text-slate-400" />
                  {fmtDate(a.dueDate)}
                </dd>
              </div>
              {a.completedAt && (
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-slate-500">Completed</dt>
                  <dd className="mt-0.5 text-emerald-700">
                    {fmtDate(a.completedAt)}
                    {a.completionEvidenceType
                      ? ` · ${labelize(a.completionEvidenceType)}`
                      : ""}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-slate-500">Mandatory</dt>
                <dd className="mt-0.5">
                  {a.isMandatory ? (
                    <Badge variant="danger" className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                      Yes
                    </Badge>
                  ) : (
                    <span className="text-slate-500">No</span>
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          {/* Provenance — "why this was assigned" */}
          <Card className="rounded-xl border border-primary-200 bg-primary-50/40 shadow-none">
            <div className="flex items-center gap-2 border-b border-primary-100 px-4 py-3">
              <Info size={16} className="text-primary-700" />
              <h2 className="text-sm font-semibold text-primary-900">Why this was assigned</h2>
            </div>
            <div className="space-y-3 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    srcMeta.chip
                  )}
                >
                  {srcMeta.label}
                </span>
                {a.ruleType && (
                  <Badge variant="neutral" className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                    {labelize(a.ruleType)}
                  </Badge>
                )}
                {a.sourceModule && (
                  <Badge variant="neutral" className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                    <Link2 size={11} /> {labelize(a.sourceModule)}
                  </Badge>
                )}
              </div>

              {a.sourceRecordRef && (
                <div className="text-slate-700">
                  Triggered by{" "}
                  {srcHref ? (
                    <Link
                      href={srcHref}
                      className="inline-flex items-center gap-1 font-medium text-primary-700 hover:underline"
                    >
                      {a.sourceRecordRef}
                      <ExternalLink size={12} />
                    </Link>
                  ) : (
                    <span className="font-mono text-xs font-medium text-slate-800">
                      {a.sourceRecordRef}
                    </span>
                  )}
                </div>
              )}

              {provEntries.length > 0 && (
                <dl className="grid grid-cols-1 gap-2 rounded-lg border border-primary-100 bg-white p-3 sm:grid-cols-2">
                  {provEntries.map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <dt className="text-[11px] uppercase tracking-wider text-slate-500">
                        {labelize(k)}
                      </dt>
                      <dd className="mt-0.5 break-words text-slate-800">{provenanceValue(v)}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {provEntries.length === 0 && !a.sourceRecordRef && (
                <p className="text-slate-500">
                  No structured provenance was recorded for this assignment.
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Right column: content + actions */}
        <div className="space-y-5">
          <Card className="rounded-xl border border-slate-200 bg-white shadow-none">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <BookOpen size={16} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-800">Assigned content</h2>
            </div>
            <div className="p-4 text-sm">
              {content ? (
                <>
                  <div className="font-medium text-slate-900">{content.title}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="neutral" className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                      {labelize(content.contentType)}
                    </Badge>
                    <Badge variant="neutral" className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                      {labelize(content.deliveryMode)}
                    </Badge>
                    {content.durationMinutes ? (
                      <Badge variant="neutral" className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                        {content.durationMinutes} min
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-3">
                    {content.vendorId ? (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                        <PackageOpen size={13} className="text-slate-400" />
                        Vendor: <span className="font-medium">{content.vendorName ?? "—"}</span>
                      </span>
                    ) : (
                      <Badge variant="warning" className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        Demo / placeholder content
                      </Badge>
                    )}
                  </div>
                  {content.contentRef && (
                    <a
                      href={content.contentRef}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs text-primary-700 hover:underline"
                    >
                      Open content <ExternalLink size={12} />
                    </a>
                  )}
                </>
              ) : (
                <p className="text-slate-500">
                  No learning content is linked to this assignment yet. Configure content in the{" "}
                  <Link
                    href="/skill-matrix/configuration/content"
                    className="text-primary-700 hover:underline"
                  >
                    content adapter
                  </Link>
                  .
                </p>
              )}
            </div>
          </Card>

          <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-none">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Actions</h2>
            <AssignmentActions
              assignmentId={a.id}
              status={a.status}
              isMandatory={a.isMandatory}
              dismissible={a.dismissible}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
