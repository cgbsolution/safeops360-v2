import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkflowTracker } from "@/components/workflow/workflow-tracker";
import { ActionRecordPanel } from "@/components/workflow/action-record";
import { PARTY_INCLUDE, toParty } from "@/lib/workflow/party";
import { markRecordTasksRead } from "@/lib/workflow/read-state";
import { ApprovalPanel } from "@/components/workflow/approval-panel";
import { ExecutionPanel, VerificationPanel } from "@/components/workflow/execution-panel";
import { ResubmitPanel } from "@/components/workflow/resubmit-panel";
import { SuspendResumePanel } from "@/components/ptw/suspend-resume-panel";
import { ActiveOperationsPanel } from "@/components/ptw/active-operations-panel";
import { ClosurePanel } from "@/components/ptw/closure-panel";
import { AcceptPanel } from "@/components/ptw/accept-panel";
import { PtwLifecycleActions } from "@/components/ptw/lifecycle-actions";
import {
  IsolationVerifyPanel,
  EvidenceTimelineCard
} from "@/components/ptw/isolation-verify-panel";
import {
  AuditTrailPanel,
  ApprovalsCard,
  IsolationsCard
} from "@/components/ptw/audit-trail-panel";
import { PrintButton } from "@/components/ui/print-button";
import { HiraSuggestionsPanel } from "@/components/hira/hira-suggestions-panel";
import { PanelBoundary } from "@/components/ui/panel-boundary";
import { getPtwActivationGate } from "@/lib/ptw/activation-gate";
import { formatDateTime, statusColor, humanize } from "@/lib/utils";
import { CheckCircle2, XCircle, Clock, FileText, Hammer, AlertTriangle, PlayCircle, RefreshCcw } from "lucide-react";

export const dynamic = "force-dynamic";

function safeParseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export default async function PermitDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id ?? "";
  const role = (session?.user as any)?.role ?? "";

  const p = await prisma.permit.findUnique({
    where: { id: params.id },
    include: {
      plant: true,
      area: true,
      originator: true,
      issuer: true,
      receiver: true,
      flras: { include: { crewSignatures: true } },
      workCrew: { include: { user: { select: { id: true, name: true, designation: true } } } },
      extensions: {
        orderBy: { requestedAt: "desc" },
        include: {
          requestedBy: { select: { name: true } },
          approvedBy: { select: { name: true } }
        }
      },
      isolations: true,
      approvalsLog: {
        orderBy: { decidedAt: "asc" },
        include: { approver: { select: { name: true, designation: true } } }
      },
      suspensions: {
        orderBy: { suspendedAt: "asc" },
        include: {
          suspendedBy: { select: { name: true } },
          resumedBy: { select: { name: true } }
        }
      },
      gasTestReadings: {
        orderBy: { recordedAt: "asc" },
        take: 50,
        include: { recordedBy: { select: { name: true } } }
      },
      // Closed-loop field evidence (GPS + photo + signature per action)
      actionEvidence: {
        orderBy: { capturedAt: "asc" },
        include: {
          actor: { select: { name: true } },
          photos: { select: { id: true } }
        }
      }
    }
  });
  // Soft-deleted permits (governed-entity delete) are treated as gone — a
  // deep-link/bookmark to one 404s rather than rendering a removed record.
  if (!p || p.isDeleted) return notFound();

  // Opening the record clears its Inbox unread state, however the viewer got
  // here. No-op unless they're the action owner.
  await markRecordTasksRead({ module: "PTW", recordId: p.id, userId });

  const activationGate = await getPtwActivationGate(p.id);
  const liveFlra = p.flras.find((f) => f.status === "IN_PROGRESS" || f.status === "COMPLETED") ?? null;
  const supersededFlras = p.flras.filter((f) => f.status === "SUPERSEDED");

  // B9 — defensive JSON parse
  const ppe = safeParseJson<Record<string, boolean>>(p.ppeChecklist, {});

  // Workflow context — same pattern as Observation / Near Miss
  const instance = await prisma.workflowInstance.findUnique({
    where: { module_recordId: { module: "PTW", recordId: p.id } },
    include: {
      definition: { include: { steps: { orderBy: { sequence: "asc" } } } },
      history: { include: { performedBy: { include: PARTY_INCLUDE } }, orderBy: { performedAt: "asc" } },
      pendingTasks: { include: { assignedTo: { include: PARTY_INCLUDE } } }
    }
  });

  // Include OVERDUE/ESCALATED so an assignee can still act once a task
  // slips past its due date (mirrors the near-miss page).
  const OPEN_TASK_STATUSES = ["PENDING", "OVERDUE", "ESCALATED"];
  const myTask = instance?.pendingTasks.find((t) => t.assignedToId === userId && OPEN_TASK_STATUSES.includes(t.status));
  const isInitiator = !!instance && instance.initiatedById === userId;
  const showResubmit = !!instance && instance.status === "REJECTED" && isInitiator;
  const lastRejection = instance?.history
    .filter((h) => h.action === "REJECTED")
    .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())[0];

  // Activation-gate hint shown to receiver during ASSIGNEE_TASK step
  const isReceiverStep =
    !!myTask &&
    myTask.taskType === "EXECUTION" &&
    myTask.assignedToId === p.receiverId;
  const activationBlocked = isReceiverStep && !activationGate.ok;

  // Closed-loop rebuild: the acceptance step is a dedicated signed act
  // (POST /api/ptw/{id}/accept); FLRA / legacy combined steps keep the
  // generic execution panel.
  const isAcceptStep =
    isReceiverStep && myTask!.stepName === "Receiver Accepts Permit";
  const isClosureApproval =
    !!myTask && myTask.taskType === "APPROVAL" && myTask.stepName === "Closure";

  const canSuspendResume = role === "HSE_MANAGER" || role === "ADMIN";
  const canVerifyRoles =
    role === "PERMIT_ISSUER" || role === "SAFETY_OFFICER" || role === "PLANT_HEAD" ||
    role === "HSE_MANAGER" || role === "ADMIN";
  const canCancel =
    canVerifyRoles || userId === p.originatorId || userId === p.issuerId;

  return (
    <div>
      <PageHeader
        title={p.number}
        description={`${humanize(p.type)} · ${p.scopeOfWork.slice(0, 60)}`}
        breadcrumbs={[{ label: "Permits", href: "/ptw" }, { label: p.number }]}
        action={
          <div className="flex items-center gap-2">
            {instance ? (
              <Badge
                className={
                  instance.status === "COMPLETED"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : instance.status === "REJECTED" || p.status === "CANCELLED"
                      ? "bg-rose-100 text-rose-800 border-rose-200"
                      : p.status === "SUSPENDED"
                        ? "bg-amber-100 text-amber-800 border-amber-200"
                        : p.status === "EXPIRED"
                          ? "bg-rose-100 text-rose-800 border-rose-200"
                          : ["WORK_COMPLETED", "HANDBACK_INSPECTION"].includes(p.status)
                            ? "bg-teal-100 text-teal-800 border-teal-200"
                            : "bg-blue-100 text-blue-800 border-blue-200"
                }
              >
                {/* Closed-loop states live on the permit, not the workflow instance */}
                {["SUSPENDED", "EXPIRED", "ISSUED", "APPROVED", "WORK_COMPLETED", "HANDBACK_INSPECTION", "CANCELLED"].includes(p.status)
                  ? humanize(p.status)
                  : humanize(instance.status)}
              </Badge>
            ) : (
              <Badge className={statusColor(p.status)}>{humanize(p.status)}</Badge>
            )}
            <PrintButton />
          </div>
        }
      />
      {/* HIRA context — visible to issuer + reviewers. Surfaces high-residual
          entries in the permit's area and any explicit influences-PTW flags.
          Sits above the workflow tracker so it's seen before approval action. */}
      <div className="mb-4">
        <PanelBoundary label="HIRA suggestions">
          <HiraSuggestionsPanel
            mode="ptw"
            plantId={p.plantId}
            areaId={p.areaId}
            permitType={p.type}
          />
        </PanelBoundary>
      </div>

      {/* Workflow tracker */}
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
              // performedBy may be null if the actor was deleted; toParty
              // tolerates that (renders "Unassigned") so a missing actor never
              // crashes the audit-trail render.
              performedBy: toParty(h.performedBy)
            }))}
            pendingTasks={instance.pendingTasks.map((t) => ({
              id: t.id,
              stepId: t.stepId,
              stepName: t.stepName,
              status: t.status,
              dueAt: t.dueAt,
              assignedTo: toParty(t.assignedTo)
            }))}
            currentStepId={instance.currentStepId}
            status={instance.status}
          />
        </div>
      )}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* The narrative each actor wrote when completing their step —
              acceptance, hand-back, verification, rework reasons. Was only
              reachable by expanding the Audit Trail. */}
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

          {/* Closed-loop lifecycle actions: cancel / archive / report */}
          <PtwLifecycleActions
            permitId={p.id}
            status={p.status}
            isArchived={Boolean((p as any).isArchived)}
            canCancel={canCancel}
            canArchive={canVerifyRoles}
          />

          {/* Suspend / Resume banner — appears on ACTIVE or SUSPENDED permits */}
          <SuspendResumePanel
            permitId={p.id}
            status={p.status}
            suspendedAt={p.suspendedAt}
            suspendedReason={p.suspendedReason}
            canAct={canSuspendResume}
          />

          {/* Active-phase operations: validity countdown, gas test, extensions, crew change */}
          <ActiveOperationsPanel
            permitId={p.id}
            plantId={p.plantId}
            status={p.status}
            validTo={p.validTo}
            type={p.type}
            workCrew={p.workCrew.map((c) => ({
              id: c.id,
              userId: c.userId,
              role: c.role,
              removedAt: c.removedAt,
              // c.user may be null if the linked user was deleted — fall
              // back to a placeholder so the row still renders.
              user: c.user
                ? { id: c.user.id, name: c.user.name, designation: c.user.designation }
                : { id: c.userId, name: "(deleted user)", designation: null }
            }))}
            extensions={p.extensions.map((e) => ({
              id: e.id,
              newValidTo: e.newValidTo,
              reason: e.reason,
              status: e.status as "PENDING" | "APPROVED" | "REJECTED",
              approverComments: e.approverComments
            }))}
            canAct={canSuspendResume}
          />

          {/* Approvals + Isolations summary cards */}
          <ApprovalsCard
            approvals={p.approvalsLog.map((a) => ({
              id: a.id,
              step: a.step,
              decision: a.decision,
              comments: a.comments,
              conditions: a.conditions,
              decidedAt: a.decidedAt,
              approver: a.approver
                ? { name: a.approver.name, designation: a.approver.designation }
                : null
            }))}
          />
          <IsolationsCard
            isolations={p.isolations.map((i) => ({
              id: i.id,
              isolationType: i.isolationType,
              description: i.description,
              isolationPointTag: i.isolationPointTag,
              lotoTagNumber: i.lotoTagNumber,
              isolationVerifiedAt: i.isolationVerifiedAt,
              restoredAt: i.restoredAt
            }))}
          />

          {/* Closed-loop: lock-out verification with field evidence — the
              activation gate blocks until every isolation is verified.
              (Previously nothing could set isolationVerifiedAt at all.) */}
          {["APPROVED", "ISSUED", "SUBMITTED", "ACTIVE", "SUSPENDED"].includes(p.status) && (
            <IsolationVerifyPanel
              permitId={p.id}
              isolations={p.isolations.map((i) => ({
                id: i.id,
                isolationType: i.isolationType,
                description: i.description,
                isolationPointTag: i.isolationPointTag,
                lotoTagNumber: i.lotoTagNumber,
                isolationVerifiedAt: i.isolationVerifiedAt,
                restoredAt: i.restoredAt
              }))}
              canVerify={canVerifyRoles || userId === p.receiverId}
            />
          )}

          {/* Audit trail — unified timeline of approvals/suspensions/extensions/gas readings */}
          <AuditTrailPanel
            approvals={p.approvalsLog.map((a) => ({
              id: a.id,
              step: a.step,
              decision: a.decision,
              comments: a.comments,
              conditions: a.conditions,
              decidedAt: a.decidedAt,
              approver: a.approver
                ? { name: a.approver.name, designation: a.approver.designation }
                : null
            }))}
            suspensions={p.suspensions.map((s) => ({
              id: s.id,
              reason: s.reason,
              reasonDetail: s.reasonDetail,
              suspendedAt: s.suspendedAt,
              resumedAt: s.resumedAt,
              resumptionConditions: s.resumptionConditions,
              reFlraRequired: s.reFlraRequired,
              suspendedBy: s.suspendedBy ? { name: s.suspendedBy.name } : null,
              resumedBy: s.resumedBy ? { name: s.resumedBy.name } : null
            }))}
            extensions={p.extensions.map((e) => ({
              id: e.id,
              newValidTo: e.newValidTo,
              reason: e.reason,
              status: e.status,
              approverComments: e.approverComments,
              requestedAt: e.requestedAt,
              approvedAt: e.approvedAt,
              requestedBy: e.requestedBy ? { name: e.requestedBy.name } : null,
              approvedBy: e.approvedBy ? { name: e.approvedBy.name } : null
            }))}
            gasReadings={p.gasTestReadings.map((g) => ({
              id: g.id,
              recordedAt: g.recordedAt,
              isExceedance: g.isExceedance,
              isPreEntry: g.isPreEntry,
              instrumentSerial: g.instrumentSerial,
              readings: g.readings,
              recordedBy: g.recordedBy ? { name: g.recordedBy.name } : null
            }))}
            workflowHistory={(instance?.history ?? []).map((h) => ({
              id: h.id,
              action: h.action,
              stepName: h.stepName,
              performedAt: h.performedAt,
              comments: h.comments,
              performedBy: h.performedBy ? { name: h.performedBy.name } : null
            }))}
          />

          {/* Field evidence timeline — GPS + photo + signature per action */}
          <EvidenceTimelineCard
            items={((p as any).actionEvidence ?? []).map((ev: any) => ({
              id: ev.id,
              action: ev.action,
              actorName: ev.actor?.name ?? null,
              capturedAt: ev.capturedAt,
              gpsLatitude: ev.gpsLatitude,
              gpsLongitude: ev.gpsLongitude,
              gpsAccuracyMeters: ev.gpsAccuracyMeters,
              declarationText: ev.declarationText,
              hasSignature: Boolean(ev.signatureImageBase64),
              photoCount: (ev.photos ?? []).length
            }))}
          />

          {/* Work Completed → Handback Inspection → Closure */}
          <ClosurePanel
            permitId={p.id}
            status={p.status}
            receiverId={p.receiverId}
            currentUserId={userId}
            canVerify={canVerifyRoles}
            workCompletedAt={(p as any).workCompletedAt ?? null}
            outcome={(p as any).outcome ?? null}
            returnedAt={p.returnedAt}
            returnNotes={p.returnNotes}
            siteVerifiedAt={p.siteVerifiedAt}
            siteVerificationChecklist={p.siteVerificationChecklist}
            closingRemark={p.closingRemark}
            closedAt={p.closedAt}
          />

          {/* Resubmit panel for rejected workflows where viewer is the originator */}
          {showResubmit && instance && (
            <ResubmitPanel
              instanceId={instance.id}
              rejectionReason={lastRejection?.comments ?? null}
              rejectedBy={lastRejection?.performedBy?.name ?? null}
              rejectedAt={lastRejection?.performedAt ?? null}
            />
          )}

          {/* Activation-gate notice — shown to receiver while any blocker is open */}
          {activationBlocked && (
            <Card className="border-amber-300 ring-2 ring-amber-100">
              <CardHeader className="bg-amber-50 rounded-t-xl">
                <CardTitle className="text-amber-900 flex items-center gap-2">
                  <AlertTriangle size={18} /> Activation blocked
                </CardTitle>
                <CardDescription className="text-amber-800">
                  Resolve every item below before the permit can become ACTIVE.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <ul className="space-y-2">
                  {activationGate.blockers.map((b) => (
                    <li
                      key={b.code}
                      className="flex items-start gap-2 text-sm rounded-md border border-amber-200 bg-white px-3 py-2"
                    >
                      {b.severity === "WARN" ? (
                        <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle size={14} className="text-rose-600 mt-0.5 shrink-0" />
                      )}
                      <span className="text-slate-800">{b.message}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 pt-1">
                  {activationGate.flra ? (
                    <Button asChild>
                      <Link href={`/flra/${activationGate.flra.id}`}>
                        <Hammer size={14} /> Open FLRA {activationGate.flra.number}
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild>
                      <Link href={`/flra/new?permitId=${p.id}`}>
                        <Hammer size={14} /> Start FLRA now
                      </Link>
                    </Button>
                  )}
                  {activationGate.crewPpeIssues.length > 0 && (
                    <Button asChild variant="outline">
                      <Link href="/ppe?tab=people">
                        <AlertTriangle size={14} /> Open PPE Compliance
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action panels — closed-loop rebuild: every approval carries
              field evidence (GPS + photo + signature); the closure approval
              needs GPS + signature (photo optional per policy). */}
          {myTask && myTask.taskType === "APPROVAL" && (
            <ApprovalPanel
              task={{ id: myTask.id, stepName: myTask.stepName, taskType: myTask.taskType, dueAt: myTask.dueAt, assignedAt: myTask.assignedAt }}
              recordData={{
                type: p.type,
                plantId: p.plantId,
                originatorId: p.originatorId,
                issuerId: p.issuerId,
                receiverId: p.receiverId,
                flraRequired: Boolean((p as any).flraRequired)
              }}
              ptwEvidence={{ permitId: p.id, requirePhoto: !isClosureApproval }}
            />
          )}
          {myTask && myTask.taskType === "EXECUTION" && isAcceptStep && (
            <AcceptPanel permitId={p.id} permitNumber={p.number} gateOk={activationGate.ok} />
          )}
          {myTask && myTask.taskType === "EXECUTION" && !isAcceptStep && (
            <ExecutionPanel
              task={{ id: myTask.id, stepName: myTask.stepName, taskType: myTask.taskType, dueAt: myTask.dueAt }}
              module="PTW"
              instruction={
                myTask.stepName === "FLRA & Crew Sign-off"
                  ? "Complete the FLRA at the worksite and collect every crew signature, then close this step."
                  : isReceiverStep
                    ? "Acknowledge the permit on site. Confirm FLRA is complete and PPE is in place. Submitting activates the permit."
                    : "Execute and acknowledge this step. Attach evidence."
              }
            />
          )}
          {myTask && myTask.taskType === "VERIFICATION" && (
            <VerificationPanel task={{ id: myTask.id, stepName: myTask.stepName, taskType: myTask.taskType, dueAt: myTask.dueAt }} />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Scope of Work</CardTitle>
              <CardDescription>{p.location}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-slate-800 whitespace-pre-wrap">{p.scopeOfWork}</p>
            </CardContent>
          </Card>

          {Object.keys(ppe).length > 0 && (
            <Card>
              <CardHeader><CardTitle>PPE Checklist</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(ppe).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2 text-sm">
                      {v ? <CheckCircle2 size={14} className="text-emerald-600" /> : <XCircle size={14} className="text-slate-300" />}
                      <span className={v ? "text-slate-800" : "text-slate-400"}>{k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {(p.gasTestRequired || p.isolationsRequired || p.fireWatchRequired || p.rescuePlan) && (
            <Card>
              <CardHeader><CardTitle>Safety Conditions</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {p.isolationsRequired && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Isolations</div>
                    <p className="text-slate-700">{p.isolationsRequired}</p>
                  </div>
                )}
                {p.gasTestRequired && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded border bg-emerald-50 border-emerald-200 p-3">
                      <div className="text-xs text-emerald-600 uppercase">O₂ Level</div>
                      <div className="font-bold text-emerald-900">{p.o2Level ?? "—"}</div>
                    </div>
                    <div className="rounded border bg-emerald-50 border-emerald-200 p-3">
                      <div className="text-xs text-emerald-600 uppercase">LEL</div>
                      <div className="font-bold text-emerald-900">{p.lelLevel ?? "—"}</div>
                    </div>
                    <div className="rounded border bg-emerald-50 border-emerald-200 p-3">
                      <div className="text-xs text-emerald-600 uppercase">H₂S</div>
                      <div className="font-bold text-emerald-900">{p.h2sLevel ?? "—"}</div>
                    </div>
                  </div>
                )}
                {p.fireWatchRequired && (
                  <div className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm">
                    🔥 <strong>Fire Watch Required</strong> — A dedicated fire watcher must be present throughout the work and 30 minutes after.
                  </div>
                )}
                {p.rescuePlan && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Rescue Plan</div>
                    <p className="text-slate-700">{p.rescuePlan}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* FLRA & Activation — status-aware panel. Closed-loop rebuild:
              FLRA is a conditional sub-flow; the card is hidden entirely
              when this permit doesn't require one (and none exists). */}
          {(activationGate.flraRequired || liveFlra || supersededFlras.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlayCircle size={18} className="text-primary-700" /> FLRA & Activation
                {!activationGate.flraRequired && (
                  <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">
                    Optional for this permit
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {p.status === "ACTIVE"
                  ? "Permit is live. Crew on site. Re-do FLRA if conditions change materially."
                  : p.status === "SUSPENDED"
                    ? "Permit is paused. New FLRA must be signed before resuming."
                    : p.status === "CLOSED"
                      ? "Permit closed. FLRA history archived for audit."
                      : activationGate.flraRequired
                        ? "FLRA must be completed and signed by every crew member before this permit can become ACTIVE."
                        : "An FLRA is not required for this permit under the site policy; any FLRA raised is shown for reference."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {liveFlra ? (
                <Link
                  href={`/flra/${liveFlra.id}`}
                  className="flex items-start justify-between rounded-lg border p-3 hover:bg-slate-50"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold">{liveFlra.number}</span>
                      <Badge
                        className={
                          liveFlra.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                            : "bg-amber-100 text-amber-700 border-amber-200"
                        }
                      >
                        {humanize(liveFlra.status)}
                      </Badge>
                    </div>
                    <div className="text-sm text-slate-700">{liveFlra.jobDescription.slice(0, 90)}</div>
                    <div className="text-xs text-slate-500">
                      Crew sign-off: {liveFlra.crewSignatures.filter((s) => s.signed).length} of {liveFlra.crewSignatures.length} complete
                    </div>
                  </div>
                  <FileText size={16} className="text-slate-400" />
                </Link>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                  No FLRA started yet for this permit.
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {!liveFlra && ["SUBMITTED", "APPROVED", "ISSUED", "ISSUER_APPROVED", "SAFETY_APPROVED", "PLANT_HEAD_APPROVED"].includes(p.status) && (
                  <Button asChild size="sm">
                    <Link href={`/flra/new?permitId=${p.id}`}><Hammer size={14} /> Start FLRA</Link>
                  </Button>
                )}
                {liveFlra && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/flra/${liveFlra.id}`}><FileText size={14} /> View FLRA</Link>
                  </Button>
                )}
                {liveFlra && liveFlra.status === "COMPLETED" && (p.status === "ACTIVE" || p.status === "SUSPENDED") && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/flra/${liveFlra.id}#redo`}><RefreshCcw size={14} /> Re-do FLRA</Link>
                  </Button>
                )}
              </div>

              {supersededFlras.length > 0 && (
                <details className="text-xs text-slate-500 pt-2 border-t">
                  <summary className="cursor-pointer hover:text-slate-700">
                    {supersededFlras.length} superseded FLRA{supersededFlras.length === 1 ? "" : "s"} (re-do history)
                  </summary>
                  <div className="mt-2 space-y-1.5">
                    {supersededFlras.map((f) => (
                      <Link
                        key={f.id}
                        href={`/flra/${f.id}`}
                        className="block rounded border bg-slate-50 px-3 py-2 hover:bg-slate-100"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px]">{f.number}</span>
                          <Badge className="bg-slate-200 text-slate-600 border-slate-300 text-[10px]">Superseded</Badge>
                        </div>
                        {f.supersededReason && (
                          <div className="text-[11px] text-slate-500 mt-1">{f.supersededReason}</div>
                        )}
                      </Link>
                    ))}
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Validity</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Clock size={14} className="text-slate-400 mt-0.5" />
                <div>
                  <div className="text-xs text-slate-500">Valid From</div>
                  <div className="font-medium">{formatDateTime(p.validFrom)}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock size={14} className="text-slate-400 mt-0.5" />
                <div>
                  <div className="text-xs text-slate-500">Valid To</div>
                  <div className="font-medium">{formatDateTime(p.validTo)}</div>
                </div>
              </div>
              {p.expiredAt && (
                <div className="flex items-start gap-3">
                  <Clock size={14} className="text-rose-500 mt-0.5" />
                  <div>
                    <div className="text-xs text-rose-600">Expired</div>
                    <div className="font-medium text-rose-700">{formatDateTime(p.expiredAt)}</div>
                  </div>
                </div>
              )}
              {p.closedAt && (
                <div className="flex items-start gap-3">
                  <Clock size={14} className="text-emerald-500 mt-0.5" />
                  <div>
                    <div className="text-xs text-emerald-600">Closed</div>
                    <div className="font-medium text-emerald-700">{formatDateTime(p.closedAt)}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">People</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Originator" value={p.originator.name} />
              <Row label="Issuer" value={p.issuer?.name ?? "—"} />
              <Row label="Receiver" value={p.receiver?.name ?? "—"} />
              {p.contractorName && <Row label="Contractor" value={p.contractorName} />}
            </CardContent>
          </Card>

          {p.workCrew.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Work Crew</CardTitle>
                <CardDescription className="text-xs">{p.workCrew.length} crew member{p.workCrew.length === 1 ? "" : "s"} named on this permit</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {p.workCrew.map((c) => (
                  <div key={c.id} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-900">{c.user?.name ?? "(deleted user)"}</div>
                      {c.user?.designation && <div className="text-xs text-slate-500">{c.user.designation}</div>}
                    </div>
                    <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">{c.role}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
