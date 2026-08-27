import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { backendFetch } from "@/lib/backend/fetch";
import { can } from "@/lib/auth/permissions";
import { canReadIncident } from "@/lib/auth/incident-access";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkflowTracker } from "@/components/workflow/workflow-tracker";
import { ActionRecordPanel } from "@/components/workflow/action-record";
import { PARTY_INCLUDE, toParty } from "@/lib/workflow/party";
import { markRecordTasksRead } from "@/lib/workflow/read-state";
import { ApprovalPanel } from "@/components/workflow/approval-panel";
import { ExecutionPanel, VerificationPanel } from "@/components/workflow/execution-panel";
import { ResubmitPanel } from "@/components/workflow/resubmit-panel";
import { ClassificationPanel } from "@/components/incidents/classification-panel";
import { InvestigationPanel } from "@/components/incidents/investigation-panel";
import { IncidentIntelligencePanel } from "@/components/incidents/incident-intelligence-panel";
import { CauseAnalysisCanvas } from "@/components/incidents/cause-analysis-canvas";
import { IncidentSimilarCard } from "@/components/incidents/incident-similar-card";
import { IncidentDownstreamPanel } from "@/components/incidents/incident-downstream-panel";
import { IncidentCostCard } from "@/components/incidents/incident-cost-card";
import { IncidentStatutoryPanel } from "@/components/incidents/incident-statutory-panel";
import { MultiFileUpload } from "@/components/incidents/multi-file-upload";
import { AttachmentGallery, MissingInitialPhotosBanner } from "@/components/incidents/attachment-gallery";
import { PrintIncidentButton } from "@/components/incidents/print-incident-button";
import { LessonsLearnedPanel } from "@/components/incidents/lessons-learned-panel";
import { DeleteIncidentIconButton } from "@/components/incidents/delete-icon-button";
import {
  IncidentSummarySection, PersonsInvolvedSection, TimelineSection,
  WitnessStatementsSection, EvidenceSection, EquipmentSection,
  CauseAnalysisSection, CapasSection, CostBreakdownSection,
  StatutorySection, InvestigationTeamSection,
  RelatedItemsSection, IncidentMetadataSidebar,
  DocumentsReviewedSection, EffectivenessReviewSection, CommentsSection
} from "@/components/incidents/incident-detail-sections";
import { humanize } from "@/lib/utils";
import { ArrowUpRight, Camera } from "lucide-react";
import { getWorkflowState, openTasks } from "@/lib/workflow/state";

export const dynamic = "force-dynamic";

// `backendFetch` returns parsed JSON, so every timestamp on the incident is an
// ISO *string*, not a Date. Calling .toISOString() on one threw
// "occurredAt.toISOString is not a function" and took the whole detail page
// down with a render error — but only on the branch that builds the
// ClassificationPanel, so the crash hit exactly one person: the HSE Manager
// holding the classification task, i.e. the only user who could act on it.
function isoOf(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

const TYPE_COLOR: Record<string, string> = {
  FIRST_AID: "bg-emerald-100 text-emerald-800 border-emerald-200",
  MTC: "bg-amber-100 text-amber-800 border-amber-200",
  RWC: "bg-orange-100 text-orange-800 border-orange-200",
  LTI: "bg-rose-100 text-rose-800 border-rose-200",
  FATALITY: "bg-rose-200 text-rose-900 border-rose-300 font-bold",
  PROPERTY_DAMAGE: "bg-blue-100 text-blue-800 border-blue-200",
  ENVIRONMENTAL: "bg-teal-100 text-teal-800 border-teal-200",
  FIRE: "bg-orange-100 text-orange-800 border-orange-200",
  PROCESS_SAFETY: "bg-indigo-100 text-indigo-800 border-indigo-200",
  HIPO_NEAR_MISS: "bg-violet-100 text-violet-800 border-violet-200"
};

export default async function IncidentDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id ?? "";

  // Fetch the incident with everything the audit-grade view needs in
  // ONE Prisma findUnique. The 8 child collections are run in a single
  // round-trip via include — cheaper than parallel queries on Vercel
  // with Supabase's connection pool.
  // One call for the whole audit-grade view: header identities plus the
  // eight child collections, and the initial-photo count alongside them.
  const i = await backendFetch<any>(`/api/incidents/${params.id}`).catch(() => null);
  if (!i) return notFound();

  // Opening the record clears its Inbox unread state, however the viewer got
  // here. No-op unless they're the action owner.
  await markRecordTasksRead({ module: "INCIDENT", recordId: i.id, userId });

  // ─── Page-level permission gate ───────────────────────────────────
  // Block users who don't have INCIDENT.READ for THIS specific record
  // before any child data is fetched. Without this check the page would
  // render but every client-side child-row API (capas, attachments,
  // timeline-events, witnesses, evidence, documents-reviewed, persons,
  // equipment) would 403, leaving the user looking at a broken UI with
  // "Failed to load" errors plastered everywhere. The RBAC matrix says:
  //   • Worker / Contractor Workman → READ on OWN_RECORDS only
  //   • Supervisor / Permit Issuer / Department Head → READ on OWN_DEPT
  //   • Safety Officer / HSE Manager / Plant Head → READ on OWN_PLANT
  //   • Corporate HSE / Admin → READ on ALL_PLANTS
  // The records the user can see is already filtered on the LIST page,
  // but a deep-link / bookmark could still land here — so we defend.
  // Same scope filter the LIST page uses, so the two never disagree — a row
  // visible in the list always opens, and a hidden one always denies.
  const canReadThis = await canReadIncident(userId, i.id);
  // Agent-platform permissions — gate the assistant card + transparency
  // drawer at render time so unauthorised users never see a disabled UI
  // (just no card). The Python backend re-checks on every invoke / detail
  // call regardless of what we render.
  const [agentInvokeCheck, agentAuditCheck] = await Promise.all([
    can(userId, "AGENT.RCA_INVOKE", { plantId: i.plantId }),
    can(userId, "AGENT.AUDIT_VIEW", { plantId: i.plantId }),
  ]);
  const canInvokeRcaAgent = agentInvokeCheck.allowed;
  const canViewAgentAudit = agentAuditCheck.allowed;
  if (!canReadThis) {
    // Send back to the list rather than 404 — the user knows the record
    // exists (they came from somewhere); 404 would be misleading.
    redirect("/incidents?denied=1");
  }

  // Privileged-legal comment visibility: HSE Manager / Plant Head /
  // Corporate HSE / Admin can see them. Workers and supervisors cannot.
  const role = (session?.user as any)?.role ?? "";
  const canSeePrivilegedComments = ["HSE_MANAGER", "PLANT_HEAD", "CORPORATE_HSE", "ADMIN"].includes(role);
  // Feature 5 — the numeric risk score is visible to Plant Head and above.
  const canSeeScore = ["PLANT_HEAD", "CORPORATE_HSE", "ADMIN"].includes(role);
  // Features 1/2 — who may run AI assist + raise CAPAs from causes (backend
  // re-checks INCIDENT.UPDATE; this only gates the UI).
  const canManageIntel =
    ["HSE_MANAGER", "PLANT_HEAD", "CORPORATE_HSE", "ADMIN"].includes(role) ||
    i.investigationTeamLead === userId;

  const initialPhotoCount = i.initialPhotoCount ?? 0;
  const isMTCorAbove = ["MTC", "RWC", "LTI", "FATALITY"].includes(i.type);

  // /api/workflow/state returns EVERY task on the instance, so the
  // PENDING/OVERDUE/ESCALATED narrowing the old query did in SQL happens here
  // instead. Without it, COMPLETED / REJECTED tasks render as ghost "Awaiting
  // Action" entries on the tracker panel.
  const rawInstance = await getWorkflowState("INCIDENT", i.id);
  const instance = rawInstance
    ? { ...rawInstance, pendingTasks: openTasks(rawInstance) }
    : null;

  // Mirror the near-miss page: an assignee must still be able to act on
  // their task once it slips past its due date. Without OVERDUE/ESCALATED
  // here, an overdue task shows in the "Awaiting Action" banner (which uses
  // the broader status set) but its action panel never renders — leaving
  // the assignee with nothing to click.
  const OPEN_TASK_STATUSES = ["PENDING", "OVERDUE", "ESCALATED"];
  const myTask = instance?.pendingTasks.find((t) => t.assignedToId === userId && OPEN_TASK_STATUSES.includes(t.status));
  const isInitiator = !!instance && instance.initiatedById === userId;
  const isClosed = instance?.status === "COMPLETED" || i.status === "CLOSED";
  const showResubmit = !!instance && instance.status === "REJECTED" && isInitiator;
  const lastRejection = instance?.history
    .filter((h) => h.action === "REJECTED")
    .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())[0];

  return (
    <div className="print:bg-white">
      <PageHeader
        title={i.number}
        description={`${humanize(i.type)} · ${i.plant.name}`}
        breadcrumbs={[{ label: "Incidents", href: "/incidents" }, { label: i.number }]}
        action={
          <div className="flex items-center gap-2 print:hidden">
            <Badge className={TYPE_COLOR[i.type]}>{humanize(i.type)}</Badge>
            {(i as any).severity && (
              <Badge className={
                (i as any).severity === "CRITICAL" ? "bg-rose-200 text-rose-900 border-rose-300" :
                (i as any).severity === "HIGH" ? "bg-orange-100 text-orange-800 border-orange-200" :
                (i as any).severity === "MEDIUM" ? "bg-amber-100 text-amber-800 border-amber-200" :
                "bg-emerald-100 text-emerald-800 border-emerald-200"
              }>{(i as any).severity}</Badge>
            )}
            {(i as any).isReportable && (
              <Badge className="bg-rose-100 text-rose-800 border-rose-200">REPORTABLE</Badge>
            )}
            {instance && (
              <Badge className={
                instance.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                instance.status === "REJECTED" ? "bg-rose-100 text-rose-800 border-rose-200" :
                "bg-blue-100 text-blue-800 border-blue-200"
              }>{humanize(instance.status)}</Badge>
            )}
            <PrintIncidentButton />
            <DeleteIncidentIconButton incidentId={i.id} incidentNumber={i.number} redirectTo="/incidents" />
          </div>
        }
      />

      {/* Promoted-from-NearMiss back-link */}
      {i.fromNearMiss && (
        <Link
          href={`/near-miss/${i.fromNearMiss.id}`}
          className="mb-4 flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 p-3 hover:bg-violet-100 transition print:bg-white"
        >
          <ArrowUpRight className="text-violet-700 flex-shrink-0" size={16} />
          <span className="text-sm text-violet-800">
            Auto-promoted from near miss <span className="font-mono">{i.fromNearMiss.number}</span>.
          </span>
        </Link>
      )}

      {/* Workflow tracker — the audit "spine" of the record */}
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
            pendingTasks={instance.pendingTasks.map((t) => ({
              id: t.id, stepId: t.stepId, stepName: t.stepName, status: t.status, dueAt: t.dueAt,
              assignedTo: toParty(t.assignedTo)
            }))}
            currentStepId={instance.currentStepId}
            status={instance.status}
          />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">

          {/* ─── Action panels (in-flight only — hidden on closed records and on print) ─── */}
          <div className="print:hidden">
            {showResubmit && instance && (
              <ResubmitPanel
                instanceId={instance.id}
                rejectionReason={lastRejection?.comments ?? null}
                rejectedBy={lastRejection?.performedBy?.name ?? null}
                rejectedAt={lastRejection?.performedAt ?? null}
              />
            )}
            {myTask && myTask.taskType === "APPROVAL" && myTask.stepName === "HSE Manager Classification" && (
              <ClassificationPanel
                incidentId={i.id}
                taskId={myTask.id}
                initial={{
                  type: i.type,
                  severity: (i as any).severity ?? null,
                  isReportable: (i as any).isReportable ?? false,
                  reportableUnder: ((i as any).reportableUnder as string[] | null) ?? null,
                  occurredAt: isoOf((i as any).occurredAt) ?? isoOf(i.date) ?? new Date().toISOString(),
                  plantId: i.plantId,
                  costPropertyDamage: (i as any).costPropertyDamage ? Number((i as any).costPropertyDamage) : null,
                  costLostProduction: (i as any).costLostProduction ? Number((i as any).costLostProduction) : null
                }}
              />
            )}
            {myTask && myTask.taskType === "APPROVAL" && myTask.stepName !== "HSE Manager Classification" && (
              <ApprovalPanel
                task={{ id: myTask.id, stepName: myTask.stepName, taskType: myTask.taskType, dueAt: myTask.dueAt, assignedAt: myTask.assignedAt }}
                recordData={{ type: i.type, plantId: i.plantId, reporterId: i.reporterId, lostDays: i.lostDays }}
              />
            )}
            {myTask && myTask.taskType === "EXECUTION" && myTask.stepName === "Investigation Team RCA + CAPA Definition" && (
              <InvestigationPanel
                incidentId={i.id}
                taskId={myTask.id}
                canInvokeRcaAgent={canInvokeRcaAgent}
                canViewAgentAudit={canViewAgentAudit}
                initial={{
                  plantId: i.plantId,
                  rcaMethod: i.rootCauseMethod ?? null,
                  rcaData: i.rootCauseData,
                  immediateCauses: ((i as any).immediateCauses as string[] | null) ?? [],
                  underlyingCauses: ((i as any).underlyingCauses as string[] | null) ?? [],
                  rootCauses: ((i as any).rootCauses as string[] | null) ?? [],
                  contributingFactors: ((i as any).contributingFactors as string[] | null) ?? [],
                  isReportable: (i as any).isReportable ?? false,
                  statutoryDeadline: isoOf((i as any).statutoryDeadline)
                }}
              />
            )}
            {myTask && myTask.taskType === "EXECUTION" && myTask.stepName !== "Investigation Team RCA + CAPA Definition" && (
              <ExecutionPanel
                task={{ id: myTask.id, stepName: myTask.stepName, taskType: myTask.taskType, dueAt: myTask.dueAt }}
                module="INCIDENT"
                recordId={i.id}
                instruction={
                  myTask.stepName === "CAPA Execution"
                    ? "Carry out the CAPA(s) assigned to you, describe what was done and attach the completion evidence, then submit for Safety Officer verification."
                    : "Execute the step. Add evidence below then submit."
                }
                evidenceLabel={
                  myTask.stepName === "CAPA Execution"
                    ? "CAPA Completion Evidence (before / after photos, work order, revised SOP)"
                    : "Evidence Photos (proof of corrective action)"
                }
              />
            )}
            {myTask && myTask.taskType === "VERIFICATION" && (
              <VerificationPanel task={{ id: myTask.id, stepName: myTask.stepName, taskType: myTask.taskType, dueAt: myTask.dueAt }} />
            )}
          </div>

          {/* ─── 2. Incident Summary ─── */}
          <IncidentSummarySection incident={i} reclassifications={i.reclassifications as any} />

          {/* The narrative each actor wrote when completing their step —
              corrective action, verification findings, rework reasons. Was
              only reachable by expanding the Audit Trail. */}
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

          {/* ─── Initial photos — upload widget hidden on closed/print ─── */}
          <Card id="initial-photos">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Camera size={16} className="text-blue-700" /> Initial Site Photos ({initialPhotoCount})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <MissingInitialPhotosBanner show={isMTCorAbove && initialPhotoCount === 0} />
              <div className={isClosed ? "print:hidden" : ""}>
                <MultiFileUpload
                  incidentId={i.id}
                  category="INITIAL_PHOTO"
                  accept="image/*"
                  buttonLabel="Add Photos"
                  helpText="Photos taken at the incident site."
                />
              </div>
            </CardContent>
          </Card>

          {/* ─── 3. Persons Involved ─── */}
          <PersonsInvolvedSection persons={i.personsInvolved as any} />

          {/* ─── 4. Timeline ─── */}
          <TimelineSection events={i.timelineEvents as any} />

          {/* ─── 5. Witness Statements ─── */}
          <WitnessStatementsSection witnesses={i.witnessStatements as any} />

          {/* ─── 6. Evidence Collection ─── */}
          <EvidenceSection evidence={i.evidenceItems as any} />

          {/* ─── 7. Documents Reviewed ─── */}
          <DocumentsReviewedSection documents={i.documentsReviewed as any} />

          {/* ─── 8. Equipment Involvement ─── */}
          <EquipmentSection equipment={i.equipmentInvolved as any} />

          {/* ─── 9. Cause Analysis ─── */}
          <CauseAnalysisSection incident={i} />

          {/* ─── 9a. Visual RCA canvas — Fishbone / 5-Why shared model (Feature 1) ─── */}
          <CauseAnalysisCanvas
            incidentId={i.id}
            plantId={i.plantId}
            initial={i.causeAnalysis as any}
            canManage={canManageIntel}
          />

          {/* ─── 9b. Incident Intelligence — AI assist + inline CAPA (Features 1, 2) ─── */}
          <IncidentIntelligencePanel
            incidentId={i.id}
            plantId={i.plantId}
            rootCauses={(i.rootCauses ?? []) as string[]}
            aiAssist={i.aiAssist as any}
            canManage={canManageIntel}
          />

          {/* ─── 9c. Trend tie-back + downstream impact (Features 3, 7) ─── */}
          <IncidentSimilarCard incidentId={i.id} />
          <IncidentDownstreamPanel incidentId={i.id} />

          {/* ─── 10. CAPAs ─── */}
          <CapasSection capas={i.capas as any} />

          {/* ─── 11. Cost ─── */}
          <CostBreakdownSection incident={i} />

          {/* ─── 11a. Cost of unsafety rollup (Feature 8) ─── */}
          <IncidentCostCard plantId={i.plantId} costImpact={i.costImpact as any} />

          {/* ─── 12. Statutory & Compliance ─── */}
          <StatutorySection incident={i} />

          {/* ─── 12a. Statutory form auto-generation (Feature 4) ─── */}
          <IncidentStatutoryPanel incidentId={i.id} canManage={canManageIntel} />

          {/* ─── 14. Lessons Learned ─── */}
          <LessonsLearnedPanel
            incidentId={i.id}
            initial={(i as any).lessonsLearned ?? null}
            distributedTo={((i as any).lessonsDistributedTo as string[] | null) ?? null}
            canManage={canManageIntel}
            isClosed={isClosed}
          />

          {/* ─── 15. 90-Day Effectiveness Review ─── */}
          <EffectivenessReviewSection incident={i} />

          {/* ─── 16. Comments & Discussion ─── */}
          <CommentsSection comments={i.comments as any} currentUserCanSeePrivileged={canSeePrivilegedComments} />

          {/* ─── 17. Related Items ─── */}
          <RelatedItemsSection incident={i} />

          {/* ─── Unified attachment gallery — hidden on print ─── */}
          <div className="print:hidden">
            <AttachmentGallery incidentId={i.id} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* ─── Sidebar metadata ─── */}
          <IncidentMetadataSidebar incident={i} canSeeScore={canSeeScore} />

          {/* ─── 13. Investigation Team ─── */}
          <InvestigationTeamSection team={i.investigationTeam as any} />
        </div>
      </div>
    </div>
  );
}
