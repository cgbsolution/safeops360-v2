import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { EditRecordIconButton } from "@/components/common/edit-icon-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkflowTracker } from "@/components/workflow/workflow-tracker";
import { ActionRecordPanel } from "@/components/workflow/action-record";
import { PARTY_SELECT, toParty } from "@/lib/workflow/party";
import { markRecordTasksRead } from "@/lib/workflow/read-state";
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
import { DerosterPanel, type DerosterStatus } from "@/components/observations/deroster-panel";
import { TargetDateHistory } from "@/components/observations/target-date-history";
import { getUserRoleCodes } from "@/lib/auth/permissions";

// Server-render wording only; the panel replaces these from the API, which is
// the authority (services/observation_deroster.visible_status). A pending flag
// must never read as "derostered" — nobody has decided yet.
const DEROSTER_FALLBACK_LABEL: Record<string, string> = {
  pending_review: "Under safety review",
  confirmed: "Derostered",
  overruled: "Review closed — no action",
  reinstated: "Reinstated"
};

// Mirrors DECISION_ROLES in app/services/observation_deroster.py. "Section
// Head" is the business name for the OBSERVATION workflow's CHECKER step,
// whose seeded approverRole is DEPARTMENT_HEAD — there is no SECTION_HEAD role.
const DEROSTER_DECISION_ROLES = [
  "DEPARTMENT_HEAD",
  "HSE_MANAGER",
  "PLANT_HSE_HEAD",
  "CORPORATE_HSE",
  "ADMIN"
];
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
        subCategoryCode: true,
        stopTaxonomy: { select: { subCategoryLabel: true, categoryLabel: true, stopReferenceCode: true } },
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
        // ─── SLA closure-date provenance + trail (spec §2.7: "not just
        //     stored, surfaced") ───
        targetDateSource: true,
        targetDateSlaConfig: true,
        targetDateOverrideReason: true,
        targetDateHistory: {
          orderBy: { changedAt: "asc" },
          select: {
            id: true,
            targetDate: true,
            source: true,
            reason: true,
            slaConfigApplied: true,
            changedById: true,
            changedAt: true
          }
        },
        // ─── Named workers + their safety reviews ───
        workersInvolved: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            partyType: true,
            nameSnapshot: true,
            roleSnapshot: true,
            employerSnapshot: true,
            userId: true,
            contractorWorkerId: true,
            user: { select: { rosterStatus: true } },
            contractorWorker: { select: { rosterStatus: true } },
            deroster: {
              select: {
                id: true,
                status: true,
                flaggedAt: true,
                flaggedReason: true,
                reviewSlaHours: true,
                reviewDueAt: true,
                reviewedById: true,
                reviewedAt: true,
                reviewDecisionReason: true,
                correctiveActionTrainingId: true,
                correctiveActionCompetencyId: true,
                escalatedAt: true,
                reinstatedAt: true,
                reinstatementNote: true
              }
            }
          }
        },
        plant: { select: { name: true } },
        area: { select: { name: true } },
        observer: { select: { name: true } },
        contractorCompany: { select: { name: true } },
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
            attachments: true,
            performedBy: { select: PARTY_SELECT }
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
            assignedTo: { select: PARTY_SELECT }
          }
        }
      }
    })
  ]);
  if (!o) return notFound();

  // Opening the record clears its Inbox unread state — however the viewer got
  // here (Inbox row, deep link, notification, modal). No-op unless they're the
  // action owner.
  await markRecordTasksRead({ module: "OBSERVATION", recordId: o.id, userId });

  // Whether to show the Confirm / Overrule / Reinstate controls. Presentation
  // only — the endpoints enforce the same role set server-side.
  const canDecideDeroster = o.workersInvolved.some((w) => w.deroster)
    ? (await getUserRoleCodes(userId)).some((c) => DEROSTER_DECISION_ROLES.includes(c))
    : false;

  // Find the user's pending task (if any) on this record. Only consider
  // it actionable when the workflow is still IN_PROGRESS — once the
  // instance is COMPLETED or REJECTED any leftover pending tasks are
  // stale and shouldn't drive the action panels.
  const workflowActive = instance?.status === "IN_PROGRESS";
  // Include OVERDUE/ESCALATED so an assignee can still act once a task
  // slips past its due date (mirrors the near-miss page).
  const OPEN_TASK_STATUSES = ["PENDING", "OVERDUE", "ESCALATED"];
  const myTask = workflowActive
    ? instance?.pendingTasks.find((t) => t.assignedToId === userId && OPEN_TASK_STATUSES.includes(t.status))
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
            {o.status !== "CLOSED" && (
              <EditRecordIconButton href={`/observations/${o.id}/edit`} permission="OBSERVATION.UPDATE" />
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
              performedBy: toParty(h.performedBy)
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
                      assignedTo: toParty(t.assignedTo)
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

          {/* The action owner's corrective-action narrative + the verifier's
              findings. Sits directly under the record details because on a
              closed observation it IS the outcome — previously it was only
              reachable by expanding the Audit Trail. Self-hides until someone
              has actually executed or commented. */}
          {instance && (
            <ActionRecordPanel
              history={instance.history.map((h) => ({
                id: h.id,
                stepId: h.stepId,
                stepName: h.stepName,
                action: h.action,
                performedAt: h.performedAt,
                comments: h.comments,
                attachments: h.attachments,
                performedBy: toParty(h.performedBy)
              }))}
              steps={instance.definition.steps.map((s) => ({ id: s.id, stepType: s.stepType }))}
            />
          )}

          {/* AI agent outputs (TriageAgent on submission, LessonsDistribution
              on closure). Self-hides when no agent has fired or
              ANTHROPIC_API_KEY isn't set. */}
          {/* Safety Review — one card per named worker carrying a deroster.
              Self-hides when nobody was flagged. Placed above the AI panel
              because an open review is time-boxed by an SLA. */}
          <DerosterPanel
            observationId={o.id}
            canDecide={canDecideDeroster}
            workers={o.workersInvolved.map((w) => ({
              id: w.id,
              partyType: w.partyType as "USER" | "CONTRACTOR_WORKER",
              name: w.nameSnapshot,
              role: w.roleSnapshot,
              employer: w.employerSnapshot,
              rosterStatus: w.user?.rosterStatus ?? w.contractorWorker?.rosterStatus ?? null,
              deroster: w.deroster
                ? {
                    ...w.deroster,
                    // `status` is a plain String column (not a Postgres enum),
                    // so Prisma types it as `string`; the DB CHECK-equivalent
                    // is the service layer's state machine.
                    status: w.deroster.status as DerosterStatus,
                    // The panel re-fetches these from the API on mount; the
                    // server owns both the wording and the corrective-action
                    // state, so nothing is derived from `status` here.
                    displayLabel: DEROSTER_FALLBACK_LABEL[w.deroster.status] ?? w.deroster.status,
                    punitive: w.deroster.status === "confirmed",
                    flaggedAt: w.deroster.flaggedAt.toISOString(),
                    reviewDueAt: w.deroster.reviewDueAt.toISOString(),
                    reviewedAt: w.deroster.reviewedAt?.toISOString() ?? null,
                    escalatedAt: w.deroster.escalatedAt?.toISOString() ?? null,
                    reinstatedAt: w.deroster.reinstatedAt?.toISOString() ?? null,
                    correctiveAction: null
                  }
                : null
            }))}
          />

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
              {o.contractorCompany && (
                <Meta icon={UserIcon} label="Contractor" value={o.contractorCompany.name} />
              )}
              <Meta
                icon={UserIcon}
                label="Responsible"
                value={o.responsiblePerson ? `${o.responsiblePerson.name}${o.responsiblePerson.designation ? ` — ${o.responsiblePerson.designation}` : ""}` : "—"}
              />
              <Meta icon={Clock} label="Target Date" value={formatDate(o.targetDate)} />
              {/* Which SLA policy produced that date, any override + reason,
                  and the full change trail. */}
              <TargetDateHistory
                targetDate={o.targetDate}
                source={o.targetDateSource}
                slaConfig={o.targetDateSlaConfig}
                overrideReason={o.targetDateOverrideReason}
                history={o.targetDateHistory}
              />
              <Meta icon={AlertCircle} label="Type" value={humanize(o.type)} />
              <Meta
                icon={AlertCircle}
                label="Category"
                value={
                  o.stopTaxonomy
                    ? `${o.stopTaxonomy.categoryLabel} (${o.stopTaxonomy.stopReferenceCode})`
                    : humanize(o.category)
                }
              />
              {/* Sub-category exists only on at-risk records classified under the
                  STOP taxonomy — legacy rows awaiting review show nothing here. */}
              {o.stopTaxonomy && (
                <Meta icon={AlertCircle} label="Sub-category" value={o.stopTaxonomy.subCategoryLabel} />
              )}
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
