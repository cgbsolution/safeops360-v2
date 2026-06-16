import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, ShieldAlert, AlertTriangle } from "lucide-react";
import { WorkflowTracker } from "@/components/workflow/workflow-tracker";
import { ApprovalPanel } from "@/components/workflow/approval-panel";
import { VerificationPanel } from "@/components/workflow/execution-panel";
import { ResubmitPanel } from "@/components/workflow/resubmit-panel";
import { InspectionExecutionPanel } from "@/components/inspections/inspection-execution-panel";
import { TypedExecutionPanel } from "@/components/inspections/typed-execution-panel";
import { healStuckInspectionWorkflow } from "@/lib/inspections/workflow-cleanup";
import { formatDate, statusColor, humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

// B2: defensive parse — was a hard JSON.parse before
function safeParseObject(s: string | null | undefined): Record<string, string> {
  if (!s) return {};
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) out[k] = String(v);
      return out;
    }
    return {};
  } catch {
    return {};
  }
}

export default async function InspectionDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id ?? "";

  const i = await prisma.inspection.findUnique({
    where: { id: params.id },
    include: {
      plant: true,
      equipment: true,
      inspector: true,
      inspectionType: true,
      checklistTemplate: {
        include: { items: { orderBy: { sequence: "asc" } } }
      },
      itemResults: {
        include: { checklistItem: true, finding: { select: { id: true, findingNumber: true, severity: true, status: true } } },
        orderBy: { sequence: "asc" }
      },
      findings: {
        select: { id: true, findingNumber: true, title: true, severity: true, status: true, isCritical: true },
        orderBy: { createdAt: "asc" }
      }
    }
  });
  if (!i) return notFound();

  // Self-heal: if this inspection's executor task was left PENDING by an
  // older code path (the items endpoint used to skip the workflow advance),
  // close it now so the UI doesn't keep showing it as awaiting action.
  await healStuckInspectionWorkflow(i.id);

  const cl = safeParseObject(i.checklistResult);
  const isLegacy = !i.checklistTemplate; // older inspections still use the JSON blob

  // Workflow context
  const instance = await prisma.workflowInstance.findUnique({
    where: { module_recordId: { module: "INSPECTION", recordId: i.id } },
    include: {
      definition: { include: { steps: { orderBy: { sequence: "asc" } } } },
      history: { include: { performedBy: true }, orderBy: { performedAt: "asc" } },
      pendingTasks: { include: { assignedTo: true } }
    }
  });

  const myTask = instance?.pendingTasks.find((t) => t.assignedToId === userId && t.status === "PENDING");
  const isInitiator = !!instance && instance.initiatedById === userId;
  const showResubmit = !!instance && instance.status === "REJECTED" && isInitiator;
  const lastRejection = instance?.history
    .filter((h) => h.action === "REJECTED")
    .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())[0];

  return (
    <div>
      <PageHeader
        title={i.number}
        description={`${i.equipment.name} · ${i.equipment.code}`}
        breadcrumbs={[{ label: "Inspections", href: "/inspections" }, { label: i.number }]}
        action={
          <div className="flex items-center gap-2">
            {instance ? (
              <Badge
                className={
                  instance.status === "COMPLETED"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : instance.status === "REJECTED"
                      ? "bg-rose-100 text-rose-800 border-rose-200"
                      : "bg-blue-100 text-blue-800 border-blue-200"
                }
              >
                {humanize(instance.status)}
              </Badge>
            ) : (
              <Badge className={statusColor(i.status)}>{humanize(i.status)}</Badge>
            )}
            {i.result && (
              <Badge
                className={
                  i.result === "Pass"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : i.result === "Fail"
                      ? "bg-rose-100 text-rose-800 border-rose-200"
                      : "bg-amber-100 text-amber-800 border-amber-200"
                }
              >
                {i.result}
              </Badge>
            )}
          </div>
        }
      />

      {instance && (
        <div className="mb-4">
          <WorkflowTracker
            steps={instance.definition.steps.map((s) => ({
              id: s.id,
              sequence: s.sequence,
              stepType: s.stepType,
              name: s.name,
              approverRole: s.approverRole,
              approverField: s.approverField,
              slaHours: s.slaHours
            }))}
            history={instance.history.map((h) => ({
              id: h.id,
              stepId: h.stepId,
              stepName: h.stepName,
              action: h.action,
              performedAt: h.performedAt,
              comments: h.comments,
              performedBy: { name: h.performedBy.name, designation: h.performedBy.designation }
            }))}
            pendingTasks={instance.pendingTasks.map((t) => ({
              id: t.id,
              stepId: t.stepId,
              stepName: t.stepName,
              status: t.status,
              dueAt: t.dueAt,
              assignedTo: { name: t.assignedTo.name, designation: t.assignedTo.designation, department: t.assignedTo.department }
            }))}
            currentStepId={instance.currentStepId}
            status={instance.status}
          />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Resubmit panel (initiator only, after rejection) */}
          {showResubmit && instance && (
            <ResubmitPanel
              instanceId={instance.id}
              rejectionReason={lastRejection?.comments ?? null}
              rejectedBy={lastRejection?.performedBy?.name ?? null}
              rejectedAt={lastRejection?.performedAt ?? null}
            />
          )}

          {/* Action panels — typed checklist takes precedence over legacy
              Equipment.checklistTemplate JSON when ChecklistTemplate is bound. */}
          {!isLegacy && (i.status === "IN_PROGRESS" || i.status === "DUE" || i.status === "OVERDUE" || i.status === "SCHEDULED") && i.checklistTemplate && (
            <Card>
              <CardHeader>
                <CardTitle>Execute checklist</CardTitle>
              </CardHeader>
              <CardContent>
                <TypedExecutionPanel
                  inspectionId={i.id}
                  inspectionNumber={i.number}
                  items={i.checklistTemplate.items as any}
                  existingResults={i.itemResults.map((r) => ({
                    itemId: r.checklistItemId ?? "",
                    resultStatus: r.resultStatus,
                    valueText: r.valueText,
                    valueNumeric: r.valueNumeric,
                    comment: r.comment,
                    photoUrls: r.photoUrls
                  }))}
                />
              </CardContent>
            </Card>
          )}
          {!isLegacy && i.status === "COMPLETED" && i.checklistTemplate && (
            <Card>
              <CardHeader>
                <CardTitle>Inspection results</CardTitle>
              </CardHeader>
              <CardContent>
                <TypedExecutionPanel
                  inspectionId={i.id}
                  inspectionNumber={i.number}
                  items={i.checklistTemplate.items as any}
                  existingResults={i.itemResults.map((r) => ({
                    itemId: r.checklistItemId ?? "",
                    resultStatus: r.resultStatus,
                    valueText: r.valueText,
                    valueNumeric: r.valueNumeric,
                    comment: r.comment,
                    photoUrls: r.photoUrls
                  }))}
                  readOnly
                />
              </CardContent>
            </Card>
          )}
          {isLegacy && myTask && myTask.taskType === "EXECUTION" && (
            <InspectionExecutionPanel
              inspectionId={i.id}
              taskId={myTask.id}
              taskName={myTask.stepName}
              taskDueAt={myTask.dueAt}
              checklistTemplateJson={i.equipment.checklistTemplate}
              initialChecklistResultJson={i.checklistResult}
              initialResult={i.result}
              initialObservations={i.observations}
            />
          )}

          {i.findings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-rose-600" />
                  Findings ({i.findings.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {i.findings.map((f) => (
                  <Link key={f.id} href={`/inspections/findings/${f.id}`}
                    className="block border border-slate-200 rounded-md p-2 hover:border-primary-300 hover:bg-primary-50/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-xs text-slate-500">{f.findingNumber}</span>
                        <span className="ml-2 font-medium text-sm">{f.title}</span>
                      </div>
                      <div className="flex gap-1 items-center">
                        <Badge className={f.severity === "CRITICAL" ? "bg-rose-600 text-white" : f.severity === "HIGH" ? "bg-rose-100 text-rose-800" : f.severity === "MEDIUM" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}>
                          {f.severity}
                        </Badge>
                        <Badge className="bg-slate-100 text-slate-700">{f.status.replace(/_/g, " ")}</Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
          {myTask && myTask.taskType === "VERIFICATION" && (
            <VerificationPanel task={{ id: myTask.id, stepName: myTask.stepName, taskType: myTask.taskType, dueAt: myTask.dueAt }} />
          )}
          {myTask && myTask.taskType === "APPROVAL" && (
            <ApprovalPanel
              task={{ id: myTask.id, stepName: myTask.stepName, taskType: myTask.taskType, dueAt: myTask.dueAt, assignedAt: myTask.assignedAt }}
              recordData={{ plantId: i.plantId, equipmentId: i.equipmentId, inspectorId: i.inspectorId }}
            />
          )}

          {Object.keys(cl).length > 0 && (
            <Card>
              <CardHeader><CardTitle>Checklist Results</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(cl).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between border-b last:border-0 py-2">
                      <span className="text-sm">{k}</span>
                      {v === "Pass" ? (
                        <span className="text-emerald-700 flex items-center gap-1 text-sm font-medium">
                          <CheckCircle2 size={14} /> Pass
                        </span>
                      ) : v === "Fail" ? (
                        <span className="text-rose-700 flex items-center gap-1 text-sm font-medium">
                          <XCircle size={14} /> Fail
                        </span>
                      ) : (
                        <span className="text-amber-700 flex items-center gap-1 text-sm font-medium">
                          <AlertCircle size={14} /> {v}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {i.observations && (
            <Card>
              <CardHeader><CardTitle>Observations</CardTitle></CardHeader>
              <CardContent>
                <p className="text-slate-800 text-sm whitespace-pre-wrap">{i.observations}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Inspection Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Equipment Code" value={i.equipment.code} />
              <Row label="Category" value={i.equipment.category} />
              <Row label="Plant" value={i.plant.name} />
              <Row label="Location" value={i.equipment.location} />
              {i.inspectionType && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-500">Type</span>
                  <span className="font-medium text-slate-900 text-right flex items-center gap-1">
                    {i.inspectionType.isStatutory && <ShieldAlert size={11} className="text-rose-600" />}
                    {i.inspectionType.name}
                  </span>
                </div>
              )}
              <Row label="Frequency" value={humanize(i.equipment.frequency)} />
              <Row label="Scheduled" value={formatDate(i.scheduledDate)} />
              <Row label="Completed" value={i.completedDate ? formatDate(i.completedDate) : "—"} />
              <Row label="Inspector" value={i.inspector?.name ?? "Not assigned"} />
              {i.checklistTemplate && (
                <Row label="Checklist" value={`${i.checklistTemplate.name} v${i.checklistTemplateVersion ?? i.checklistTemplate.version}`} />
              )}
              {i.result && <Row label="Result" value={i.result} />}
              <Row label="Follow-up" value={i.followUpRequired ? "Required" : "Not required"} />
              {i.isStatutory && i.statutoryFormType && (
                <Row label="Statutory form" value={i.statutoryFormType.replace(/_/g, " ")} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900 text-right">{value}</span>
    </div>
  );
}
