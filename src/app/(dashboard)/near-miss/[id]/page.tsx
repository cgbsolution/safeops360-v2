import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { backendFetch } from "@/lib/backend/fetch";
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
import { NearMissAttachmentGallery } from "@/components/near-miss/nearmiss-attachment-gallery";
import { CapaPlanSection } from "@/components/near-miss/capa-plan-section";
import { TargetClosureDate } from "@/components/near-miss/target-closure-date";
import { CommentsThread } from "@/components/near-miss/comments-thread";
import PrintButtonClient from "./print-button";
import {
  HAZARD_CATEGORY_LABELS,
  NEAR_MISS_CATEGORIES,
  NEAR_MISS_CATEGORY_LABELS,
  NEAR_MISS_CATEGORY_OTHER,
  RISK_CATEGORY_LABELS
} from "@/lib/near-miss/risk-masters";
import { formatDate, formatDateTime, statusColor, severityColor, humanize } from "@/lib/utils";
import { getWorkflowState } from "@/lib/workflow/state";
import {
  CalendarDays,
  MapPin,
  User as UserIcon,
  AlertTriangle,
  ArrowUpRight,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Sparkles,
  Building2,
  Wrench,
  Users,
  AlertCircle,
  Printer,
  ExternalLink
} from "lucide-react";

export const dynamic = "force-dynamic";

const RISK_BADGE: Record<string, string> = {
  LOW: "bg-emerald-500 text-white border-emerald-500",
  MEDIUM: "bg-amber-400 text-amber-950 border-amber-400",
  HIGH: "bg-orange-500 text-white border-orange-500",
  CRITICAL: "bg-rose-600 text-white border-rose-600"
};

export default async function NearMissDetail(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ "just-created"?: string; "photo-errors"?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id ?? "";
  const role = (session?.user as any)?.role ?? "";
  const justCreated = searchParams?.["just-created"] === "1";
  const photoErrors = parseInt(searchParams?.["photo-errors"] ?? "0", 10) || 0;

  // Plant, area, reporter, owners, department, equipment, contractor, the
  // cross-module links and all three people child tables arrive nested.
  const n: any = await backendFetch<any>(`/api/near-miss/${params.id}`).catch(() => null);
  if (!n) return notFound();

  // Opening the record clears its Inbox unread state, however the viewer got
  // here. No-op unless they're the action owner.
  await markRecordTasksRead({ module: "NEAR_MISS", recordId: n.id, userId });

  const instance: any = await getWorkflowState("NEAR_MISS", n.id);

  // A task assigned to me is actionable whenever it is still OPEN — that
  // includes the SLA states OVERDUE / ESCALATED, not just PENDING. The
  // escalation layer stamps OVERDUE/ESCALATED on top of an unfinished task
  // (and raises a parallel nudge task for the escalation-role holder), but the
  // original assignee can and must still complete the work. Matching only
  // "PENDING" here is what hid the action panel — the task showed in the
  // "Awaiting Action" list (which already includes OVERDUE/ESCALATED) yet the
  // assignee got no button to act on it.
  const OPEN_TASK_STATUSES = ["PENDING", "OVERDUE", "ESCALATED"];
  const myTask = instance?.pendingTasks.find(
    (t: any) => t.assignedToId === userId && OPEN_TASK_STATUSES.includes(t.status)
  );
  const isInitiator = !!instance && instance.initiatedById === userId;
  const showResubmit = !!instance && instance.status === "REJECTED" && isInitiator;
  const lastRejection = instance?.history
    .filter((h: any) => h.action === "REJECTED")
    .sort((a: any, b: any) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())[0];

  const currentStep = instance?.definition.steps.find((s: any) => s.id === instance.currentStepId);

  // Permission gates
  const isHseManagerLike = role === "HSE_MANAGER" || role === "ADMIN" || role === "CORPORATE_HSE";
  // Only the actor who currently holds the "Review Meeting & CAPA Definition"
  // task may define CAPAs — not every HSE Manager, and not the reporter. This
  // mirrors the backend gate in near_miss.create_capa (_is_capa_definition_actor).
  const canDefineCapa =
    !!instance &&
    instance.status === "IN_PROGRESS" &&
    currentStep?.name === "Review Meeting & CAPA Definition" &&
    !!myTask &&
    myTask.stepId === currentStep?.id;
  const canVerifyCapa =
    !!instance &&
    instance.status === "IN_PROGRESS" &&
    isHseManagerLike &&
    currentStep?.stepType === "VERIFIER";

  // Record-level target closure date. The backend gate is NEAR_MISS.UPDATE +
  // "not CLOSED"; mirror it here with the roles that actually hold UPDATE at
  // plant scope or wider (see prisma/seed-rbac.ts), plus whoever currently
  // holds the review & CAPA-definition task — the natural moment to set it.
  const canSetTargetDate = n.status !== "CLOSED" && (canDefineCapa || isHseManagerLike);

  // Joint Review reviewers (extracted from history — APPROVED entries on the
  // first CHECKER step "Joint Review")
  const jointReviewStep = instance?.definition.steps.find((s: any) => s.name === "Joint Review");
  const jointReviewApprovals: any[] = jointReviewStep
    ? instance.history.filter(
        (h: any) => h.stepId === jointReviewStep.id && h.action === "APPROVED"
      )
    : [];

  // Verification entry
  const verifierStep = instance?.definition.steps.find((s: any) => s.stepType === "VERIFIER");
  const verifyEntry = verifierStep
    ? instance.history.find((h: any) => h.stepId === verifierStep.id && h.action === "VERIFIED")
    : null;

  // Closure entry
  const closureStep = instance?.definition.steps.find((s: any) => s.stepType === "CLOSURE");
  const closureEntry = closureStep
    ? instance.history.find((h: any) => h.stepId === closureStep.id && h.action === "APPROVED")
    : null;

  // SLA performance
  const slaPerformance = computeSlaPerf(n.slaTargetAt, n.closedAt ?? n.slaActualClosedAt);
  // Cycle time
  const cycleHours =
    n.closedAt && n.createdAt
      ? Math.round((new Date(n.closedAt).getTime() - new Date(n.createdAt).getTime()) / 3_600_000)
      : null;

  // Persons display arrays
  // A person row is either a directory link or a hand-typed MANUAL entry with
  // no user attached, so read the name snapshot first and fall back to the
  // linked record for rows written before the snapshot existed.
  const toPerson = (row: any, linked: any) => {
    const name = row.nameSnapshot ?? linked?.name;
    if (!name) return null;
    return {
      id: row.id,
      name,
      designation: row.codeSnapshot ?? linked?.designation ?? null
    };
  };
  const personsInvolved = (n.personsInvolved ?? [])
    .map((p: any) => toPerson(p, p.user))
    .filter(Boolean);
  const personsAffected = (n.personsPotentiallyAffected ?? [])
    .map((p: any) => toPerson(p, p.user))
    .filter(Boolean);
  const witnessUsers = (n.witnesses ?? [])
    .map((w: any) => toPerson(w, w.witness))
    .filter(Boolean);

  return (
    <div className="print:bg-white">
      <PageHeader
        title={n.number}
        description={`Near Miss · ${n.specificLocation ?? n.location ?? n.area?.name ?? "—"}`}
        breadcrumbs={[{ label: "Near Miss", href: "/near-miss" }, { label: n.number }]}
        action={
          <div className="flex items-center gap-2 print:hidden">
            <Badge className={severityColor(n.potentialSeverity)}>Potential: {n.potentialSeverity}</Badge>
            {n.riskLevel && <Badge className={RISK_BADGE[n.riskLevel] ?? ""}>Risk: {n.riskLevel}</Badge>}
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
              <Badge className={statusColor(n.status)}>{humanize(n.status)}</Badge>
            )}
          </div>
        }
      />

      {/* Just-created success banner */}
      {justCreated && photoErrors === 0 && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-start gap-2">
          <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
          <div><strong>Near miss reported.</strong> Reviewers have been notified.</div>
        </div>
      )}

      {/* Auto-promoted banner — both directions */}
      {n.promotedIncident && (
        <Link
          href={`/incidents/${n.promotedIncident.id}`}
          className="mb-4 flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 hover:bg-rose-100 transition print:bg-white print:border-rose-700"
        >
          <ArrowUpRight className="text-rose-700 flex-shrink-0" size={18} />
          <span className="text-sm text-rose-900">
            🔄 <strong>Auto-promoted to incident</strong>{" "}
            <span className="font-mono">{n.promotedIncident.number}</span> — investigation under way.
            <span className="ml-2 underline">View incident →</span>
          </span>
        </Link>
      )}

      {/* Workflow tracker */}
      {instance && (
        <div className="mb-4">
          <WorkflowTracker
            steps={instance.definition.steps.map((s: any) => ({
              id: s.id, sequence: s.sequence, stepType: s.stepType, name: s.name,
              approverRole: s.approverRole, approverField: s.approverField, slaHours: s.slaHours
            }))}
            history={instance.history.map((h: any) => ({
              id: h.id, stepId: h.stepId, stepName: h.stepName, action: h.action,
              performedAt: h.performedAt, comments: h.comments,
              performedBy: toParty(h.performedBy)
            }))}
            pendingTasks={
              instance.status === "IN_PROGRESS"
                ? instance.pendingTasks
                    .filter((t: any) => t.status === "PENDING" || t.status === "OVERDUE" || t.status === "ESCALATED")
                    .map((t: any) => ({
                      id: t.id, stepId: t.stepId, stepName: t.stepName, status: t.status, dueAt: t.dueAt,
                      assignedTo: toParty(t.assignedTo)
                    }))
                : []
            }
            currentStepId={instance.currentStepId}
            status={instance.status}
          />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Resubmit panel — for rejected workflows where viewer is the reporter */}
          {showResubmit && instance && (
            <ResubmitPanel
              instanceId={instance.id}
              rejectionReason={lastRejection?.comments ?? null}
              rejectedBy={lastRejection?.performedBy?.name ?? null}
              rejectedAt={lastRejection?.performedAt ?? null}
            />
          )}

          {/* Action panels */}
          {myTask && myTask.taskType === "APPROVAL" && (() => {
            // Roles eligible to take this task — used by the Reassign
            // dialog to filter the user picker. approverRole + parsed
            // approverGroupRoles JSON. Empty array means "any role".
            const myStep = instance?.definition.steps.find((s: any) => s.id === myTask.stepId);
            const roles: string[] = [];
            if (myStep?.approverRole) roles.push(myStep.approverRole);
            if (myStep?.approverGroupRoles) {
              try {
                const parsed = JSON.parse(myStep.approverGroupRoles);
                if (Array.isArray(parsed)) roles.push(...parsed.filter(Boolean));
              } catch {
                roles.push(...String(myStep.approverGroupRoles).split(",").map((s) => s.trim()).filter(Boolean));
              }
            }
            return (
              <ApprovalPanel
                task={{ id: myTask.id, stepName: myTask.stepName, taskType: myTask.taskType, dueAt: myTask.dueAt, assignedAt: myTask.assignedAt }}
                plantId={n.plantId}
                eligibleRoles={Array.from(new Set(roles))}
                recordData={{
                  potentialSeverity: n.potentialSeverity,
                  plantId: n.plantId,
                  reporterId: n.reporterId,
                  actionOwnerId: n.actionOwnerId
                }}
              />
            );
          })()}
          {myTask && myTask.taskType === "EXECUTION" && (
            <ExecutionPanel
              task={{ id: myTask.id, stepName: myTask.stepName, taskType: myTask.taskType, dueAt: myTask.dueAt }}
              module="NEAR_MISS"
              recordId={n.id}
              instruction="Execute your assigned CAPA. Describe what you did and submit evidence URL / photos via the gallery below."
              aiDraftPath={`/api/near-miss/${n.id}/capa-execution-draft`}
            />
          )}
          {myTask && myTask.taskType === "VERIFICATION" && (
            <VerificationPanel
              task={{ id: myTask.id, stepName: myTask.stepName, taskType: myTask.taskType, dueAt: myTask.dueAt }}
            />
          )}

          {/* The action owner's CAPA-execution narrative + rework reasons.
              VERIFIED is excluded — this page already has a dedicated
              "Verification & Effectiveness" card below. */}
          {instance && (
            <ActionRecordPanel
              exclude={["VERIFIED"]}
              history={instance.history.map((h: any) => ({
                id: h.id,
                stepId: h.stepId,
                stepName: h.stepName,
                action: h.action,
                performedAt: h.performedAt,
                comments: h.comments,
                attachments: h.attachments,
                performedBy: toParty(h.performedBy)
              }))}
              steps={instance.definition.steps.map((s: any) => ({ id: s.id, stepType: s.stepType }))}
            />
          )}

          {/* ─── Section: Initial Report ─── */}
          <Card>
            <CardHeader><CardTitle>Initial Report</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Lab>Description</Lab>
                <p className="text-slate-800 whitespace-pre-wrap">{n.description}</p>
              </div>
              {n.activityBeingPerformed || n.activity ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Lab>Activity</Lab>
                    {/* activityBeingPerformed holds a MasterItem id (or the
                        "OTHER" sentinel); the API hydrates its label. On Other
                        the whole answer is the free text, so print both — the
                        label alone reads as "Other" and says nothing. */}
                    <p className="text-sm text-slate-700">
                      {n.activityBeingPerformedLabel && n.activity
                        ? `${n.activityBeingPerformedLabel} — ${n.activity}`
                        : n.activityBeingPerformedLabel ?? n.activity ?? "—"}
                    </p>
                  </div>
                  {n.activityIsRoutine !== null && n.activityIsRoutine !== undefined && (
                    <div>
                      <Lab>Routine?</Lab>
                      <p className="text-sm text-slate-700">{n.activityIsRoutine ? "Routine" : "Non-routine"}</p>
                    </div>
                  )}
                </div>
              ) : null}
              {/* equipmentInvolved is the typed list; [] is the reporter
                  answering "no equipment", which is worth showing. n.equipment
                  is the legacy per-plant register link. */}
              {(n.equipmentInvolved || n.equipment) && (
                <div>
                  <Lab>Equipment / tool involved</Lab>
                  {n.equipmentInvolved?.length ? (
                    <ul className="text-sm text-slate-700 space-y-0.5">
                      {n.equipmentInvolved.map((item: string) => (
                        <li key={item} className="flex items-center gap-1">
                          <Wrench size={12} className="text-slate-400" /> {item}
                        </li>
                      ))}
                    </ul>
                  ) : n.equipment ? (
                    <p className="text-sm text-slate-700 flex items-center gap-1">
                      <Wrench size={12} className="text-slate-400" /> {n.equipment.name} ({n.equipment.code})
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500">None involved</p>
                  )}
                </div>
              )}
              {(n.gpsLatitude && n.gpsLongitude) && (
                <div>
                  <Lab>GPS</Lab>
                  <p className="text-sm">
                    <a
                      href={`https://www.google.com/maps?q=${n.gpsLatitude},${n.gpsLongitude}`}
                      target="_blank"
                      rel="noopener"
                      className="text-primary-700 hover:underline inline-flex items-center gap-1"
                    >
                      {n.gpsLatitude.toFixed(5)}, {n.gpsLongitude.toFixed(5)} <ExternalLink size={11} />
                    </a>
                  </p>
                </div>
              )}
              {n.immediateAction && (
                <div>
                  <Lab>Immediate action taken</Lab>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{n.immediateAction}</p>
                </div>
              )}
              {n.recommendedActions && (
                <div>
                  <Lab>Recommended actions (reporter)</Lab>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{n.recommendedActions}</p>
                </div>
              )}

              {(personsInvolved.length > 0 || personsAffected.length > 0 || witnessUsers.length > 0) && (
                <div className="pt-3 border-t space-y-3">
                  {personsInvolved.length > 0 && (
                    <div>
                      <Lab>Persons directly involved</Lab>
                      <PersonChips users={personsInvolved} />
                    </div>
                  )}
                  {personsAffected.length > 0 && (
                    <div>
                      <Lab>Persons potentially affected</Lab>
                      <PersonChips users={personsAffected} />
                    </div>
                  )}
                  {witnessUsers.length > 0 && (
                    <div>
                      <Lab>Witnesses</Lab>
                      <PersonChips users={witnessUsers} />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── Section: Potential Consequence Detail ─── */}
          <Card>
            <CardHeader><CardTitle>Potential Consequence</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <Badge className={severityColor(n.potentialSeverity)}>
                  Severity: {n.potentialSeverity}
                </Badge>
                {n.multipleWorkersAggravator && (
                  <Badge className="bg-rose-100 text-rose-800 border-rose-200">
                    <Users size={11} className="inline mr-1" /> Multiple worker impact
                  </Badge>
                )}
                {/* hazardCategories is the tick-any-number grid off the
                    printed card; hazardCategory / energySource are the single
                    MasterItem ids older records carry. */}
                {(n.hazardCategories ?? []).map((code: string) => (
                  <Badge key={code} className="bg-slate-50 text-slate-700 border-slate-300">
                    {HAZARD_CATEGORY_LABELS[code] ?? code}
                  </Badge>
                ))}
                {n.hazardCategoryOther && (
                  <Badge className="bg-slate-50 text-slate-700 border-slate-300">
                    Other: {n.hazardCategoryOther}
                  </Badge>
                )}
                {n.hazardCategory && <Badge className="bg-slate-50 text-slate-700 border-slate-300">Hazard cat: {n.hazardCategoryLabel ?? n.hazardCategory}</Badge>}
                {n.energySource && <Badge className="bg-slate-50 text-slate-700 border-slate-300">Energy: {n.energySourceLabel ?? n.energySource}</Badge>}
              </div>

              {n.nearMissCategory && (
                <div className="flex items-center gap-2.5 rounded-md border border-slate-200 bg-slate-50/60 p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      "/near-miss-categories/" +
                      (NEAR_MISS_CATEGORIES.find((c) => c.code === n.nearMissCategory)?.image ??
                        "other") +
                      ".webp"
                    }
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10 shrink-0 object-contain"
                  />
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">
                      Near miss category
                    </div>
                    <div className="text-sm text-slate-700">
                      {NEAR_MISS_CATEGORY_LABELS[n.nearMissCategory] ?? n.nearMissCategory}
                    </div>
                    {n.nearMissCategory === NEAR_MISS_CATEGORY_OTHER && n.nearMissCategoryDetail && (
                      <div className="text-xs text-slate-600 whitespace-pre-wrap">
                        {n.nearMissCategoryDetail}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* The site's Risk Calculator. Separate from the 5x5 matrix
                  below it: different scales, both recorded. */}
              {n.riskRating != null && (
                <div className="rounded-md border border-slate-200 p-2.5 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="font-medium text-slate-700">Risk Calculator</span>
                    {/* Never printed as an equation: the coordinator can set
                        the rating by hand, and "2 x 3 = 8" is not a thing to
                        show an auditor. The mismatch is called out instead. */}
                    <span>
                      L {n.riskProbability ?? "—"} · S {n.riskSeverityLevel ?? "—"} · RR{" "}
                      {n.riskRating}
                    </span>
                    {n.riskProbability != null &&
                      n.riskSeverityLevel != null &&
                      n.riskProbability * n.riskSeverityLevel !== n.riskRating && (
                        <span className="text-amber-700">
                          set by hand (L × S gives {n.riskProbability * n.riskSeverityLevel})
                        </span>
                      )}
                    {n.riskCategory && (
                      <Badge className={RISK_BADGE[severityOfCategory(n.riskCategory)] ?? ""}>
                        {RISK_CATEGORY_LABELS[n.riskCategory as keyof typeof RISK_CATEGORY_LABELS] ??
                          n.riskCategory}
                      </Badge>
                    )}
                  </div>
                  {n.riskSeverityDescription && (
                    <p className="text-xs text-slate-600">{n.riskSeverityDescription}</p>
                  )}
                </div>
              )}
              {Array.isArray(n.potentialConsequences) && n.potentialConsequences.length > 0 ? (
                <ul className="text-sm text-slate-700 space-y-1">
                  {n.potentialConsequences.map((c: any, i: number) => (
                    <li key={i} className="flex flex-wrap gap-2">
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200">{c.type}</Badge>
                      {c.subRating && <span className="text-xs text-slate-600">Sub-rating: {c.subRating}</span>}
                      {c.costEstimate && <span className="text-xs text-slate-600">Cost: ₹{c.costEstimate}</span>}
                      {c.downtimeHours && <span className="text-xs text-slate-600">Downtime: {c.downtimeHours}h</span>}
                      {c.substanceEstimate && <span className="text-xs text-slate-600">Substance: {c.substanceEstimate}</span>}
                    </li>
                  ))}
                </ul>
              ) : n.potentialConsequence ? (
                <div className="flex flex-wrap gap-2">
                  {n.potentialConsequence.split(",").filter(Boolean).map((c: string) => (
                    <Badge key={c} className="bg-amber-100 text-amber-800 border-amber-200">{c.trim()}</Badge>
                  ))}
                </div>
              ) : null}
              {n.riskLikelihood && n.riskConsequence && (
                <div className="pt-2 border-t flex items-center gap-3 text-xs text-slate-600">
                  <span>Risk matrix (5 x 5):</span>
                  <span>Likelihood {n.riskLikelihood} × Consequence {n.riskConsequence}</span>
                  <span>=</span>
                  <Badge className={RISK_BADGE[n.riskLevel ?? "MEDIUM"] ?? ""}>{n.riskLevel} ({n.riskScore})</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── Section: Existing Controls Analysis ─── */}
          {(n.controlsThatFailed || n.controlsThatWorked) && (
            <Card>
              <CardHeader><CardTitle>Existing Controls</CardTitle></CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4">
                  {n.controlsThatFailed && (
                    <div>
                      <Lab className="text-rose-700">Controls that failed</Lab>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{n.controlsThatFailed}</p>
                    </div>
                  )}
                  {n.controlsThatWorked && (
                    <div>
                      <Lab className="text-emerald-700">Controls that worked</Lab>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{n.controlsThatWorked}</p>
                    </div>
                  )}
                </div>
                {n.initialRootCauseCategory && (
                  <div className="mt-4 pt-4 border-t">
                    <Lab>Reporter's initial root cause hint</Lab>
                    <Badge className="bg-slate-50 text-slate-700 border-slate-300">{humanize(n.initialRootCauseCategory)}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ─── Section: Joint Review ─── */}
          {jointReviewApprovals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users size={16} /> Joint Review
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  {jointReviewApprovals.map((h: any) => (
                    <div key={h.id} className="flex items-start gap-2 text-sm bg-emerald-50 border border-emerald-200 rounded-md p-2.5">
                      <ShieldCheck size={14} className="text-emerald-700 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 truncate">{h.performedBy.name}</div>
                        <div className="text-xs text-slate-500">{h.performedBy.designation ?? "—"}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{formatDateTime(h.performedAt)}</div>
                        {h.comments && (
                          <div className="text-xs text-slate-700 mt-1 italic">"{h.comments}"</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {n.refinedRootCauseCategory && (
                  <div className="pt-2 border-t">
                    <Lab>Refined root cause category</Lab>
                    <Badge className="bg-slate-50 text-slate-700 border-slate-300">{humanize(n.refinedRootCauseCategory)}</Badge>
                  </div>
                )}
                {n.reviewerNotes && (
                  <div>
                    <Lab>Reviewer notes</Lab>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{n.reviewerNotes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ─── Section: Target closure date + CAPA Plan (client) ─── */}
          <TargetClosureDate
            nearMissId={n.id}
            targetDate={n.targetDate ?? null}
            closedAt={n.closedAt ?? null}
            canEdit={canSetTargetDate}
          />

          {instance && (
            <CapaPlanSection
              nearMissId={n.id}
              plantId={n.plantId}
              currentUserId={userId}
              canDefine={canDefineCapa}
              canVerify={canVerifyCapa}
            />
          )}

          {/* ─── Section: Verification & Effectiveness ─── */}
          {verifyEntry && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert size={16} /> Verification & Effectiveness
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-slate-700">
                  Verified by <strong>{verifyEntry.performedBy.name}</strong>
                  {verifyEntry.performedBy.designation && <> · {verifyEntry.performedBy.designation}</>}
                  <> · {formatDateTime(verifyEntry.performedAt)}</>
                </div>
                {n.verificationMethod && (
                  <div><Lab>Method</Lab><p className="text-sm">{n.verificationMethod}</p></div>
                )}
                {n.verificationNotes && (
                  <div><Lab>Notes</Lab><p className="text-sm whitespace-pre-wrap">{n.verificationNotes}</p></div>
                )}
                {n.effectivenessRating !== null && n.effectivenessRating !== undefined && (
                  <div className="flex items-center gap-2">
                    <Lab className="!mb-0">Effectiveness</Lab>
                    <span className="text-sm">{"★".repeat(n.effectivenessRating)}{"☆".repeat(5 - n.effectivenessRating)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ─── Section: Closure ─── */}
          {(closureEntry || n.closingRemark || n.lessonsLearned || n.closedAt) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-700" /> Closure
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {closureEntry && (
                  <div className="text-sm text-slate-700">
                    Closed by <strong>{closureEntry.performedBy.name}</strong> · {formatDateTime(closureEntry.performedAt)}
                  </div>
                )}
                {n.closingRemark && (
                  <div><Lab>Closing remark</Lab><p className="text-sm whitespace-pre-wrap">{n.closingRemark}</p></div>
                )}
                {n.lessonsLearned && (
                  <div className="bg-violet-50 border border-violet-200 rounded-md p-3">
                    <div className="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-violet-800 mb-1">
                      <Sparkles size={12} /> Lessons learned
                    </div>
                    <p className="text-sm text-violet-900 whitespace-pre-wrap">{n.lessonsLearned}</p>
                  </div>
                )}
                <div className="grid sm:grid-cols-3 gap-2 text-xs text-slate-600 pt-2 border-t">
                  {slaPerformance && <div><Lab className="!mb-0.5">SLA performance</Lab>{slaPerformance}</div>}
                  {n.slaTargetAt && <div><Lab className="!mb-0.5">SLA target</Lab>{formatDateTime(n.slaTargetAt)}</div>}
                  {cycleHours !== null && <div><Lab className="!mb-0.5">Cycle time</Lab>{cycleHours}h</div>}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Section: Photos & Evidence ─── */}
          <NearMissAttachmentGallery
            nearMissId={n.id}
            uploadCategory={
              myTask?.taskType === "EXECUTION"
                ? "CAPA_EVIDENCE"
                : myTask?.taskType === "VERIFICATION"
                  ? "VERIFICATION_PHOTO"
                  : "INITIAL_PHOTO"
            }
            canUpload={!!instance && instance.status === "IN_PROGRESS"}
            currentUserId={userId}
          />

          {/* ─── Section: Discussion (comments) ─── */}
          <CommentsThread nearMissId={n.id} />

          {/* ─── Section: Related Items ─── */}
          {(n.activePermit || n.promotedIncident || n.isRepeat ||
            n.triggeredInspectionId || n.triggeredTbtId ||
            (Array.isArray(n.closureTriggers) && n.closureTriggers.length > 0)) && (
            <Card>
              <CardHeader><CardTitle>Related Items</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {n.activePermit && (
                  <RelLink href={`/ptw/${n.activePermit.id}`} icon={<Shield size={14} />} label="Linked active permit" value={n.activePermit.number} />
                )}
                {n.promotedIncident && (
                  <RelLink href={`/incidents/${n.promotedIncident.id}`} icon={<AlertTriangle size={14} />} label="Promoted to incident" value={n.promotedIncident.number} />
                )}
                {n.isRepeat && (
                  <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2 flex items-start gap-2">
                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                    <div>
                      Repeat-pattern detected: similar near misses in this area in the last 30 days.
                      {Array.isArray(n.similarNearMissIds) && n.similarNearMissIds.length > 0 && (
                        <> ({n.similarNearMissIds.length} prior)</>
                      )}
                    </div>
                  </div>
                )}
                {n.triggeredInspectionId && (
                  <RelLink href={`/inspections/${n.triggeredInspectionId}`} icon={<ClipboardLikeIcon />} label="Spawned inspection" value="View" />
                )}
                {n.triggeredTbtId && (
                  <RelLink href={`/training/${n.triggeredTbtId}`} icon={<ClipboardLikeIcon />} label="Spawned toolbox talk" value="View" />
                )}
                {/* Post-closure rule audit (Dimension 4 — see
                    safeops_360_bakend/app/services/post_closure_rules_nm.py).
                    Each entry that fired with no dedicated FK column lands here. */}
                {Array.isArray(n.closureTriggers) && n.closureTriggers.filter((e: any) => e.fired).length > 0 && (
                  <div className="pt-2 border-t">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1.5">
                      Spawned by closure rules
                    </div>
                    <ul className="space-y-1.5">
                      {n.closureTriggers.filter((e: any) => e.fired).map((e: any, i: number) => (
                        <li key={i} className="text-xs flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded p-2">
                          <CheckCircle2 size={12} className="text-emerald-700 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-emerald-900">
                              {e.ruleName}
                              {e.spawnedRecordNumber && <span className="font-mono ml-2">{e.spawnedRecordNumber}</span>}
                            </div>
                            {e.reason && <div className="text-emerald-800 mt-0.5">{e.reason}</div>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {Array.isArray(n.closureTriggers) && n.closureTriggers.filter((e: any) => !e.fired && !e.error).length > 0 && (
                  <div className="pt-1">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1">
                      Rules that did not fire
                    </div>
                    <ul className="space-y-0.5">
                      {n.closureTriggers.filter((e: any) => !e.fired && !e.error).map((e: any, i: number) => (
                        <li key={i} className="text-[11px] text-slate-500 flex gap-2">
                          <span className="font-medium">{e.ruleName}</span>
                          <span>—</span>
                          <span>{e.reason ?? "skipped"}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ─── Section: Audit Trail (collapsible inside the workflow tracker already, but explicit list here for print) ─── */}
          {instance && instance.history.length > 0 && (
            <Card className="hidden print:block">
              <CardHeader><CardTitle>Audit Trail</CardTitle></CardHeader>
              <CardContent>
                <ol className="space-y-2 text-sm">
                  {instance.history.map((h: any) => (
                    <li key={h.id} className="border-b pb-2 last:border-b-0">
                      <div className="font-medium">
                        {h.performedBy.name} — {humanize(h.action)} · {h.stepName}
                      </div>
                      <div className="text-xs text-slate-500">{formatDateTime(h.performedAt)}</div>
                      {h.comments && <div className="text-xs italic">"{h.comments}"</div>}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm">Metadata</CardTitle>
              <PrintButton />
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Meta icon={CalendarDays} label="Reported" value={formatDateTime(n.date)} />
              <Meta icon={MapPin} label="Plant Unit Name" value={n.plant.name} />
              {n.department && <Meta icon={Building2} label="Department" value={n.department.name} />}
              {/* Records raised before the form moved to free-text location still
                  carry an Area; show whichever the record actually has. */}
              <Meta
                icon={MapPin}
                label="Location (Blocks & building)"
                value={n.location ?? n.area?.name ?? "—"}
              />
              <Meta icon={MapPin} label="Specific location" value={n.specificLocation ?? "—"} />
              {n.shift?.label && <Meta icon={Clock} label="Shift" value={n.shift.label} />}
              <Meta
                icon={UserIcon}
                label="Reporter"
                value={n.isAnonymous ? "Anonymous" : n.reporter.name}
              />
              {n.contractorCompany && (
                <Meta icon={Building2} label="Contractor" value={n.contractorCompany.name} />
              )}
              {n.suggestedActionOwner && (
                <Meta icon={UserIcon} label="Suggested owner" value={n.suggestedActionOwner.name} />
              )}
              <Meta icon={AlertTriangle} label="Potential severity" value={n.potentialSeverity} />
              {n.riskLevel && <Meta icon={AlertCircle} label="Risk level" value={`${n.riskLevel} (${n.riskScore})`} />}
              {n.targetDate && (
                <Meta icon={CalendarDays} label="Target closure" value={formatDate(n.targetDate)} />
              )}
              {n.slaTargetAt && <Meta icon={Clock} label="SLA target" value={formatDateTime(n.slaTargetAt)} />}
              {slaPerformance && <Meta icon={Clock} label="SLA performance" value={slaPerformance} />}
              {n.reporterType && (
                <Meta icon={UserIcon} label="Reporter type" value={REPORTER_TYPE_LABELS[n.reporterType] ?? n.reporterType} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

function Lab({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1 ${className ?? ""}`}>
      {children}
    </div>
  );
}

// The report form words these as "Employee Staff" / "External"; older records
// also carry CONTRACTOR and ANONYMOUS.
const REPORTER_TYPE_LABELS: Record<string, string> = {
  EMPLOYEE: "Employee Staff",
  EXTERNAL: "External",
  CONTRACTOR: "Contractor",
  ANONYMOUS: "Anonymous"
};

/** The Risk Calculator's band, in the vocabulary RISK_BADGE is keyed on. */
function severityOfCategory(category: string) {
  if (category === "HIGH_RISK") return "HIGH";
  if (category === "MEDIUM_RISK") return "MEDIUM";
  return "LOW";
}

function PersonChips({ users }: { users: { id: string; name: string; designation: string | null }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {users.map((u) => (
        <span key={u.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs border">
          <UserIcon size={10} className="text-slate-400" />
          {u.name}{u.designation ? ` · ${u.designation}` : ""}
        </span>
      ))}
    </div>
  );
}

function Meta({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={13} className="mt-0.5 text-slate-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
        <div className="text-sm text-slate-800 truncate">{value ?? "—"}</div>
      </div>
    </div>
  );
}

function RelLink({ href, icon, label, value }: { href: string; icon: React.ReactNode; label: string; value: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 text-sm hover:bg-slate-50 p-2 rounded-md border">
      <span className="text-slate-400">{icon}</span>
      <span className="text-xs text-slate-500 uppercase tracking-wider mr-1">{label}</span>
      <span className="font-mono text-primary-700">{value}</span>
      <ExternalLink size={11} className="text-slate-400 ml-auto" />
    </Link>
  );
}

function ClipboardLikeIcon() {
  // Reuse Sparkles as a generic "spawned item" icon to avoid an extra import
  return <Sparkles size={14} />;
}

function PrintButton() {
  // Print button is a "use client" component imported directly. Next.js
  // App Router handles the server/client boundary automatically — no
  // next/dynamic + ssr:false dance needed (and that pattern is in fact
  // disallowed inside server components, which manifests as random
  // "Cannot read properties of undefined (reading 'call')" webpack
  // crashes during hot-reload).
  return <PrintButtonClient />;
}

// ─── SLA performance ────────────────────────────────────────────
function computeSlaPerf(targetAt: Date | string | null, closedAt: Date | string | null): string | null {
  if (!targetAt) return null;
  if (!closedAt) {
    const ms = new Date(targetAt).getTime() - Date.now();
    if (ms < 0) {
      return `Overdue by ${Math.round(Math.abs(ms) / 3_600_000)}h`;
    }
    return "On track";
  }
  const ms = new Date(targetAt).getTime() - new Date(closedAt).getTime();
  if (ms < 0) return `Late by ${Math.round(Math.abs(ms) / 3_600_000)}h`;
  return `On time (${Math.round(ms / 3_600_000)}h spare)`;
}
