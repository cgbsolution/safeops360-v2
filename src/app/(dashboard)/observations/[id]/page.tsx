import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkflowTracker } from "@/components/workflow/workflow-tracker";
import { OrphanWorkflowRepair } from "@/components/workflow/orphan-repair";
import { ApprovalPanel } from "@/components/workflow/approval-panel";
import { ExecutionPanel, VerificationPanel } from "@/components/workflow/execution-panel";
import { LegacyCloseButton } from "../legacy-close-button";
import { ResubmitPanel } from "@/components/workflow/resubmit-panel";
import { ObservationAttachmentGallery } from "@/components/observations/attachment-gallery";
import { ActionEvidencePanel } from "@/components/observations/action-evidence-panel";
import { AiInsightsPanel } from "@/components/observations/ai-insights-panel";
import { DeleteObservationButton } from "@/components/observations/delete-observation-button";
import { RelatedItems } from "@/components/observations/related-items";
import { formatDate, statusColor, severityColor, humanize } from "@/lib/utils";
import { CalendarDays, MapPin, User as UserIcon, AlertCircle, Clock, Camera, CheckCircle2 as CheckCircle2Icon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ObservationDetailPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ "just-created"?: string; "photo-errors"?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const justCreated = searchParams?.["just-created"] === "1";
  const photoErrors = parseInt(searchParams?.["photo-errors"] ?? "0", 10) || 0;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id ?? "";

  // Both reads are independent — run them in parallel so the slowest one
  // (network RTT to Postgres) doesn't stack on top of the other.
  const [o, instance] = await Promise.all([
    prisma.observation.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        number: true,
        type: true,
        category: true,
        description: true,
        severity: true,
        status: true,
        date: true,
        targetDate: true,
        closedAt: true,
        closingRemark: true,
        immediateAction: true,
        plantId: true,
        observerId: true,
        responsiblePersonId: true,
        isRepeat: true,
        similarObservationIds: true,
        activePermitId: true,
        permitReviewFlagged: true,
        triggeredInspectionId: true,
        triggeredTbtId: true,
        contributedToIncidentId: true,
        closureTriggers: true,
        plant: { select: { name: true } },
        area: { select: { name: true } },
        observer: { select: { name: true } },
        responsiblePerson: { select: { name: true, designation: true } },
        activePermit: { select: { id: true, number: true } },
        triggeredInspection: { select: { id: true, number: true } },
        contributedToIncident: { select: { id: true, number: true } },
        coachingTasks: { select: { id: true, number: true, type: true, status: true } }
      }
    }),
    prisma.workflowInstance.findUnique({
      where: { module_recordId: { module: "OBSERVATION", recordId: params.id } },
      select: {
        id: true,
        status: true,
        currentStepId: true,
        initiatedById: true,
        completedAt: true,
        definition: {
          select: {
            steps: {
              orderBy: { sequence: "asc" },
              select: {
                id: true,
                sequence: true,
                stepType: true,
                name: true,
                approverRole: true,
                approverField: true,
                slaHours: true
              }
            }
          }
        },
        history: {
          orderBy: { performedAt: "asc" },
          select: {
            id: true,
            stepId: true,
            stepName: true,
            action: true,
            performedAt: true,
            comments: true,
            performedBy: { select: { name: true, designation: true } }
          }
        },
        pendingTasks: {
          select: {
            id: true,
            stepId: true,
            stepName: true,
            status: true,
            dueAt: true,
            assignedAt: true,
            assignedToId: true,
            taskType: true,
            assignedTo: { select: { name: true, designation: true, department: true } }
          }
        }
      }
    })
  ]);
  if (!o) return notFound();

  // Find the user's pending task (if any) on this record. Only consider
  // it actionable when the workflow is still IN_PROGRESS — once the
  // instance is COMPLETED or REJECTED any leftover pending tasks are
  // stale and shouldn't drive the action panels.
  const workflowActive = instance?.status === "IN_PROGRESS";
  const myTask = workflowActive
    ? instance?.pendingTasks.find((t) => t.assignedToId === userId && t.status === "PENDING")
    : undefined;

  // Detect workflow states that need self-heal: (a) orphan — instance is
  // active with currentStepId on an actor step but no pending task, (b)
  // duplicates — multiple PENDING tasks for the same step+assignee, or
  // (c) fallback-assigned — a pending task on a step that has an
  // approverField is held by the workflow initiator, the fingerprint of
  // an old assignee-resolution failure that fell back to initiator_id.
  const currentStep = instance?.definition.steps.find((s) => s.id === instance.currentStepId);
  const livePending = instance?.pendingTasks.filter(
    (t) => t.status === "PENDING" || t.status === "OVERDUE" || t.status === "ESCALATED"
  ) ?? [];
  const pendingKeys = livePending.map((t) => `${t.stepId}|${t.assignedToId}`);
  const hasDuplicates = pendingKeys.length !== new Set(pendingKeys).size;
  const isOrphan =
    !!instance &&
    instance.status === "IN_PROGRESS" &&
    !!instance.currentStepId &&
    livePending.length === 0 &&
    currentStep != null &&
    currentStep.stepType !== "MAKER";
  const hasFallbackAssignment =
    !!instance &&
    livePending.some((t) => {
      const step = instance.definition.steps.find((s) => s.id === t.stepId);
      return !!step?.approverField && t.assignedToId === instance.initiatedById;
    });
  // (d) REJECTED by verifier under the old engine — that should now flow
  // back to the action owner for rework, not full reject. The repair
  // endpoint converts these in place.
  const lastHistoryEntry = instance?.history.length
    ? instance.history[instance.history.length - 1]
    : null;
  const lastRejectedStep = lastHistoryEntry?.stepId
    ? instance?.definition.steps.find((s) => s.id === lastHistoryEntry.stepId)
    : null;
  const isVerifierReject =
    !!instance &&
    instance.status === "REJECTED" &&
    lastHistoryEntry?.action === "REJECTED" &&
    lastRejectedStep?.stepType === "VERIFIER";
  // (e) Stale pending tasks on a COMPLETED instance — leftover from past
  // duplicate-creation bugs. The repair endpoint closes them.
  const hasStalePendingOnCompleted =
    !!instance && instance.status === "COMPLETED" && livePending.length > 0;
  const needsRepair =
    isOrphan ||
    hasDuplicates ||
    hasFallbackAssignment ||
    isVerifierReject ||
    hasStalePendingOnCompleted;

  // Resubmit panel context: only when (a) workflow rejected AND (b) viewer is the initiator
  const isInitiator = instance && instance.initiatedById === userId;
  const showResubmit = !!instance && instance.status === "REJECTED" && !!isInitiator;
  const lastRejection = instance?.history
    .filter((h) => h.action === "REJECTED")
    .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())[0];

  return (
    <div>
      <PageHeader
        title={o.number}
        description={`${humanize(o.type)} · ${humanize(o.category)}`}
        breadcrumbs={[{ label: "Observations", href: "/observations" }, { label: o.number }]}
        action={
          <div className="flex items-center gap-2">
            <Badge className={severityColor(o.severity)}>{o.severity}</Badge>
            {instance ? (
              <Badge className={instance.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : instance.status === "REJECTED" ? "bg-rose-100 text-rose-800 border-rose-200" : "bg-blue-100 text-blue-800 border-blue-200"}>
                {humanize(instance.status)}
              </Badge>
            ) : (
              <Badge className={statusColor(o.status)}>{humanize(o.status)}</Badge>
            )}
          </div>
        }
      />

      {justCreated && photoErrors === 0 && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-start gap-2">
          <Camera size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <strong>Observation submitted.</strong> Photos uploaded with the report appear below. You can add more
            from the &ldquo;Photos &amp; Evidence&rdquo; section.
          </div>
        </div>
      )}
      {justCreated && photoErrors > 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <strong>Observation submitted, but {photoErrors} photo{photoErrors === 1 ? "" : "s"} failed to upload.</strong>{" "}
            Use the &ldquo;Photos &amp; Evidence&rdquo; section below to retry. The observation itself is saved.
          </div>
        </div>
      )}

      {/* Workflow tracker — replaces the old static status pill.
          Filter pendingTasks to only those genuinely awaiting action. The
          back-relation `pendingTasks` actually returns ALL tasks tied to the
          instance (regardless of status); without filtering, completed tasks
          show up under "Awaiting Action". */}
      {needsRepair && <OrphanWorkflowRepair module="OBSERVATION" recordId={o.id} />}

      {instance && (
        <div className="mb-4">
          <WorkflowTracker
            steps={instance.definition.steps.map((s) => ({
              id: s.id, sequence: s.sequence, stepType: s.stepType, name: s.name,
              approverRole: s.approverRole, approverField: s.approverField, slaHours: s.slaHours
            }))}
            history={instance.history.map((h) => ({
              id: h.id, stepId: h.stepId, stepName: h.stepName, action: h.action,
              performedAt: h.performedAt, comments: h.comments,
              performedBy: { name: h.performedBy.name, designation: h.performedBy.designation }
            }))}
            pendingTasks={
              workflowActive
                ? (() => {
                    // Dedupe: a step + assignee pair should only appear once
                    // even if duplicate WorkflowTask rows exist (legacy data
                    // from past engine bugs). Keep the newest by assignedAt.
                    const live = instance.pendingTasks
                      .filter((t) => t.status === "PENDING" || t.status === "OVERDUE" || t.status === "ESCALATED")
                      .sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime());
                    const seen = new Set<string>();
                    const unique: typeof live = [];
                    for (const t of live) {
                      const key = `${t.stepId}|${t.assignedToId}`;
                      if (seen.has(key)) continue;
                      seen.add(key);
                      unique.push(t);
                    }
                    return unique.map((t) => ({
                      id: t.id, stepId: t.stepId, stepName: t.stepName, status: t.status, dueAt: t.dueAt,
                      assignedTo: { name: t.assignedTo.name, designation: t.assignedTo.designation, department: t.assignedTo.department }
                    }));
                  })()
                : []
            }
            currentStepId={instance.currentStepId}
            status={instance.status}
          />
          {instance.status === "COMPLETED" && (
            <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 flex items-start gap-2">
              <CheckCircle2Icon size={18} className="text-emerald-700 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-emerald-900">Observation closed</div>
                <div className="text-xs text-emerald-700">
                  {instance.completedAt
                    ? <>Closed on {formatDate(instance.completedAt)} after HSE Manager Closure.</>
                    : <>Workflow completed after HSE Manager Closure.</>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Main */}
        <div className="lg:col-span-2 space-y-4">
          {/* Resubmit panel — visible when workflow rejected and viewer is the initiator */}
          {showResubmit && instance && (
            <ResubmitPanel
              instanceId={instance.id}
              rejectionReason={lastRejection?.comments ?? null}
              rejectedBy={lastRejection?.performedBy?.name ?? null}
              rejectedAt={lastRejection?.performedAt ?? null}
            />
          )}

          {/* Action panel — appears at top of main column when a task is assigned to me */}
          {myTask && myTask.taskType === "APPROVAL" && (() => {
            // The CHECKER step (Section Head Review) is now the place
            // where the responsible person gets assigned for an
            // observation. If the observation doesn't yet have one and
            // the current step is the CHECKER, force the picker.
            const currentStepDef = instance?.definition.steps.find((s) => s.id === myTask.stepId);
            const isCheckerOnObservation =
              currentStepDef?.stepType === "CHECKER" && !o.responsiblePersonId;
            return (
              <ApprovalPanel
                task={{ id: myTask.id, stepName: myTask.stepName, taskType: myTask.taskType, dueAt: myTask.dueAt, assignedAt: myTask.assignedAt }}
                needsResponsiblePerson={isCheckerOnObservation}
                plantId={o.plantId}
                // Pass everything the engine's _resolve_assignee may need for
                // the *next* step (ACTION_OWNER, RESPONSIBLE_PERSON, ORIGINATOR
                // approverField lookups). Without responsiblePersonId here, the
                // ASSIGNEE_TASK step falls back to the initiator (the observer)
                // instead of the real action owner.
                recordData={{
                  severity: o.severity,
                  category: o.category,
                  type: o.type,
                  plantId: o.plantId,
                  observerId: o.observerId,
                  responsiblePersonId: o.responsiblePersonId,
                  actionOwnerId: o.responsiblePersonId
                }}
              />
            );
          })()}
          {myTask && myTask.taskType === "EXECUTION" && (() => {
            // If this EXECUTION task was created because the verifier
            // rejected an earlier execution, pass the rejection reason
            // through so the action owner sees what to fix before redoing.
            const lastVerifierReject = instance?.history
              .filter((h) => {
                const step = instance.definition.steps.find((s) => s.id === h.stepId);
                return h.action === "REJECTED" && step?.stepType === "VERIFIER";
              })
              .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())[0];
            const reworkContext = lastVerifierReject
              ? {
                  rejectedBy: lastVerifierReject.performedBy?.name ?? null,
                  rejectedAt: lastVerifierReject.performedAt ?? null,
                  reason: lastVerifierReject.comments ?? null
                }
              : null;
            return (
              <ExecutionPanel
                task={{ id: myTask.id, stepName: myTask.stepName, taskType: myTask.taskType, dueAt: myTask.dueAt }}
                module="OBSERVATION"
                recordId={o.id}
                instruction="Execute the corrective action for this observation. Describe what you did, attach photo evidence, and submit for verification."
                reworkContext={reworkContext}
              />
            );
          })()}
          {myTask && myTask.taskType === "VERIFICATION" && (
            <VerificationPanel
              task={{ id: myTask.id, stepName: myTask.stepName, taskType: myTask.taskType, dueAt: myTask.dueAt }}
            />
          )}

          <Card>
            <CardHeader><CardTitle>Observation Details</CardTitle></CardHeader>
            <CardContent>
              <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</div>
              <p className="text-slate-800 whitespace-pre-wrap">{o.description}</p>

              {o.immediateAction && (
                <div className="mt-6 pt-6 border-t">
                  <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Immediate Action Taken</div>
                  <p className="text-slate-700">{o.immediateAction}</p>
                </div>
              )}

              {o.closingRemark && (
                <div className="mt-6 pt-6 border-t">
                  <div className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-2">Closing Remark</div>
                  <p className="text-slate-700">{o.closingRemark}</p>
                  <p className="text-xs text-slate-500 mt-2">Closed on {formatDate(o.closedAt)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI agent outputs (TriageAgent on submission, LessonsDistribution
              on closure). Self-hides when no agent has fired or
              ANTHROPIC_API_KEY isn't set. */}
          <AiInsightsPanel closureTriggers={o.closureTriggers} />

          {/* Corrective-action photos uploaded by the action owner — shown
              prominently above the general gallery so reviewers see the
              proof of action without scrolling. Self-hides when empty.
              The uploader can remove their own photos (e.g., wrong upload
              or after a rework rejection). */}
          <ActionEvidencePanel observationId={o.id} currentUserId={userId} />

          {/* Upload gating — only two legitimate uploaders:
                - Observer (the maker) → INITIAL_PHOTO, while record isn't closed
                - Action Owner with active EXECUTION task → ACTION_EVIDENCE
              Verifier and everyone else can read but doesn't see the
              Add Photos button. */}
          {(() => {
            const isObserver = userId === o.observerId;
            const isExecutor = myTask?.taskType === "EXECUTION";
            const workflowOpen = instance ? instance.status !== "COMPLETED" : true;
            const canUpload = workflowOpen && (isObserver || isExecutor);
            const uploadCategory = isExecutor ? "ACTION_EVIDENCE" : "INITIAL_PHOTO";
            return (
              <ObservationAttachmentGallery
                observationId={o.id}
                uploadCategory={uploadCategory}
                canUpload={canUpload}
                currentUserId={userId}
              />
            );
          })()}

          {/* Related Items — cross-module triggers (Dimension 4) */}
          <RelatedItems
            observationNumber={o.number}
            isRepeat={o.isRepeat}
            similarObservationIds={o.similarObservationIds ?? []}
            activePermitId={o.activePermitId ?? null}
            activePermitNumber={o.activePermit?.number ?? null}
            permitReviewFlagged={o.permitReviewFlagged}
            triggeredInspectionId={o.triggeredInspectionId ?? null}
            triggeredInspectionNumber={o.triggeredInspection?.number ?? null}
            triggeredTbtId={o.triggeredTbtId ?? null}
            triggeredTbtCode={null}
            contributedToIncidentId={o.contributedToIncidentId ?? null}
            contributedToIncidentNumber={o.contributedToIncident?.number ?? null}
            closureTriggers={(o.closureTriggers as any) ?? null}
            coachingTasks={o.coachingTasks ?? []}
          />

          {/* Legacy close button for old records that pre-date the workflow engine */}
          {!instance && o.status !== "CLOSED" && (
            <div className="flex justify-end">
              <LegacyCloseButton id={o.id} />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Metadata</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Meta icon={CalendarDays} label="Date" value={formatDate(o.date)} />
              <Meta icon={MapPin} label="Plant" value={o.plant.name} />
              <Meta icon={MapPin} label="Area" value={o.area?.name ?? "—"} />
              <Meta icon={UserIcon} label="Observer" value={o.observer.name} />
              <Meta
                icon={UserIcon}
                label="Responsible"
                value={o.responsiblePerson ? `${o.responsiblePerson.name}${o.responsiblePerson.designation ? ` — ${o.responsiblePerson.designation}` : ""}` : "—"}
              />
              <Meta icon={Clock} label="Target Date" value={formatDate(o.targetDate)} />
              <Meta icon={AlertCircle} label="Type" value={humanize(o.type)} />
              <Meta icon={AlertCircle} label="Category" value={humanize(o.category)} />
            </CardContent>
          </Card>

          {/* Delete — visible only to roles with OBSERVATION.DELETE
              (HSE Manager / Corporate HSE / System Admin per the RBAC
              matrix). The Python endpoint enforces the same check. */}
          <DeleteObservationButton observationId={o.id} observationNumber={o.number} />
        </div>
      </div>
    </div>
  );
}

function Meta({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={14} className="text-slate-400 mt-0.5" />
      <div className="flex-1">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-slate-900 font-medium">{value}</div>
      </div>
    </div>
  );
}
