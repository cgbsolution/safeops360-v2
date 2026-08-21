"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  uploadAuditAttachment, deleteAuditAttachment, IMAGE_ACCEPT, DOCUMENT_ACCEPT,
} from "../upload-attachment";
import { AttachmentStrip } from "../attachment-tile";
import { EvidenceStrip } from "../evidence-strip";
import { TeamEditor } from "./team-editor";
import { AllocationWorkspace } from "./allocation-workspace";
import { NcRegisterPanel } from "./nc-register-panel";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  PlayCircle, CheckCircle2, XCircle, AlertTriangle, Lock,
  ChevronDown, ChevronRight, Camera, Loader2, ShieldCheck, Trash2, Users2,
  MessageSquare, RotateCcw, ArrowUpCircle, FileWarning, Building2, ListChecks, Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { usePermission } from "@/components/auth/can";
import {
  AuditDetail, AuditDashboard, AuditTeam, AuditTeamMember, CheckpointResponse, CheckpointInteraction, Finalizability, PlantUser, AuditReport, DisciplineRollup, StoredPhoto,
  StreamRollup, StreamCode, STREAM_META, CONFORMANCE_META, conformanceOf,
  STATUS_CHIP, STATUS_LABEL, CRITICALITY_CHIP, CRITICALITY_FALLBACK, VALUE_META,
  GRADE_META, STATUS_META, RISK_META, REQUIREMENT_TYPE_META, scoreBandLabel,
  WORKFLOW_STATE_META, INTERACTION_LABEL, Chip, fmtDate, fmtDateTime, apiErrorMessage, complianceColor, ragBar, ragText,
} from "../lib";
import { FileText, Download } from "lucide-react";
import { MeetingRecords } from "@/components/assurance/meeting-record";
import { CompetenceSnapshotPanel } from "@/components/assurance/competence-panel";
import { SignOffPanel, type SignOffStatus } from "@/components/assurance/signoff-panel";
import { SupplierPanel, type PortalSubmission } from "@/components/assurance/supplier-panel";
import { CalendarBookingsPanel } from "@/components/calendar/calendar-bookings-panel";
import type { CompetenceSnapshotRow, MeetingsResponse } from "../../lib-assurance";
import type { BookingsResponse } from "../../lib-calendar";

export function AuditDetailView({
  audit, dashboard, userMap, users = [], reports = [], meetings = null, competence = [],
  signoff = null, submissions = [], bookings = null,
}: {
  audit: AuditDetail;
  dashboard: AuditDashboard | null;
  userMap: Record<string, string>;
  users?: PlantUser[];
  reports?: AuditReport[];
  meetings?: MeetingsResponse | null;
  competence?: CompetenceSnapshotRow[];
  signoff?: SignOffStatus | null;
  /** WP-45 — external submissions, empty for an own-facility audit. */
  submissions?: PortalSubmission[];
  /** Null when the calendar-booking table has not been applied on this deployment. */
  bookings?: BookingsResponse | null;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const me = (session?.user as any)?.id as string | undefined;
  const canExecute = usePermission("AUDIT_COMPLIANCE.EXECUTE");
  const canApprove = usePermission("AUDIT_COMPLIANCE.APPROVE");
  // Raising a CAPA from a finding really does create a CAPA, so it needs
  // CAPA.CREATE — a permission several audit-capable roles do NOT hold. Without
  // this the button was always offered and the server's 403 came back as
  // "please retry", a loop that could never succeed.
  const canCreateCapa = usePermission("CAPA.CREATE");
  // Deciding an escalated finding is the DESIGNATED reviewer's job, not
  // everyone-with-APPROVE's. Mirrors the server rule in transition_checkpoint;
  // the server is the gate, this just stops offering an action that will fail.
  const isAuditTeam = !!me && (me === audit.leadAuditorUserId
    || (audit.coAuditors ?? []).some((c) => (typeof c === "string" ? c : c.userId) === me));
  const canDecideEscalation = canApprove && !isAuditTeam
    && (!audit.plantManagerUserId || me === audit.plantManagerUserId);
  const canClose = usePermission("AUDIT_COMPLIANCE.CLOSE");
  const canUpdate = usePermission("AUDIT_COMPLIANCE.UPDATE");
  const canExport = usePermission("AUDIT_COMPLIANCE.EXPORT");
  const [showAllocate, setShowAllocate] = useState(false);
  const [showTeam, setShowTeam] = useState(false);

  const name = (id: string | null | undefined) => (id ? userMap[id] ?? "—" : "—");

  const isConductable = ["scheduled", "in_progress"].includes(audit.status);
  const isReviewable = ["submitted_pending_response", "response_in_progress", "under_review"].includes(audit.status);
  const canAllocate = canUpdate && !["closed", "cancelled"].includes(audit.status);

  // Allocation rollup — "X assigned · Y unassigned" (from the slim payload's
  // aggregate; never iterates the full response set).
  const allocation = audit.allocationSummary ?? { assigned: 0, unassigned: 0, total: audit.totalCheckpoints ?? 0 };

  // Overview summary — derived from the discipline rollup (no full row load).
  const summary = useMemo(() => {
    const roll = audit.disciplineRollup ?? [];
    const passed = roll.reduce((s, c) => s + c.passed, 0);
    const partial = roll.reduce((s, c) => s + c.partial, 0);
    const failed = roll.reduce((s, c) => s + c.failed, 0);
    const na = roll.reduce((s, c) => s + c.na, 0);
    // "assessable" = pass/partial/fail (NA is answered but not assessable), so an
    // all-NA audit reads "Not assessed", not a red 0%.
    const assessable = passed + partial + failed;
    const answered = assessable + na;
    const completionPct = audit.progress?.completionPct
      ?? (audit.totalCheckpoints ? Math.round((audit.answeredCheckpoints / audit.totalCheckpoints) * 100) : 0);
    const compliancePct = assessable === 0 ? null : (dashboard?.score.overall_score_pct ?? audit.overallCompliancePct ?? null);
    const criticalOpen = dashboard?.score.critical_failures ?? audit.criticalFailureCount ?? roll.reduce((s, c) => s + c.criticalFailed, 0);
    return { completionPct, compliancePct, criticalOpen, notStarted: answered === 0, notAssessed: answered > 0 && assessable === 0 };
  }, [audit, dashboard]);

  // Per-discipline RAG (from the rollup) — proper "Not started" pre-conduct.
  //
  // `scorePct` is the POINTS score the server already summed for this
  // discipline (Σ obtained / Σ allotted). This used to recompute a pass-ratio
  // in the browser instead, so the same discipline read one percentage here and
  // a different one on its own audit report — Production showed 85% on this
  // screen and 88.3% in the PDF. The points score is the authoritative one, and
  // it is the only one that applies the -1 penalty a repeat finding carries.
  const disciplineRag = useMemo(() => {
    return (audit.disciplineRollup ?? []).map((c) => {
      const assessable = c.passed + c.partial + c.failed;
      // assessable===0 (nothing assessed, or all-NA) → null = neutral "Not started".
      const pct = assessable === 0 || !c.scoreAllotted ? null : c.scorePct;
      return { id: c.categoryId, name: c.categoryName, total: c.total, passed: c.passed, failed: c.failed, partial: c.partial, na: c.na, pct };
    });
  }, [audit.disciplineRollup]);

  // Review surface: the bounded findings / in-flight rows from the slim payload,
  // grouped by discipline. The full checkpoint set is browsed in the conduct
  // worklist (paginated) — this page only shows the rows that need workflow.
  const findingGroups = useMemo(() => {
    const map = new Map<string, { categoryId: string; categoryName: string; items: CheckpointResponse[] }>();
    for (const r of [...audit.responses].sort((a, b) => a.sequence - b.sequence)) {
      let g = map.get(r.categoryId);
      if (!g) { g = { categoryId: r.categoryId, categoryName: r.categoryName, items: [] }; map.set(r.categoryId, g); }
      g.items.push(r);
    }
    return [...map.values()];
  }, [audit.responses]);

  return (
    <div className="space-y-5">
      {/* Status + factory + meta strip */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <Chip map={STATUS_CHIP} value={audit.status} label={STATUS_LABEL[audit.status] ?? audit.status} className="text-xs" />
          {/* Target factory — linked to its profile when available */}
          {audit.factoryProfileId ? (
            <Link href={`/facilities/${audit.factoryProfileId}`} className="inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-800 hover:bg-primary-100">
              <Building2 size={14} /> {audit.plantName ?? audit.plantId}{audit.plantCode ? <span className="font-normal text-primary-400">· {audit.plantCode}</span> : null}
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
              <Building2 size={14} /> {audit.plantName ?? audit.plantId}
            </span>
          )}
          <Meta label="Template" value={audit.templateName ? `${audit.templateName}${audit.templateVersion ? ` · v${audit.templateVersion}` : ""}` : "—"} />
          <Meta label="Lead auditor" value={name(audit.leadAuditorUserId)} />
          <Meta label="Plant manager" value={name(audit.plantManagerUserId)} />
          {/* Counts only — the named cast with their discipline scope is in the
              team panel below, which is where there is room for it. */}
          <Meta label="Co-auditors" value={`${audit.team?.coAuditors.length ?? 0}`} />
          <Meta label="Auditees" value={`${audit.team?.auditees.length ?? 0}`} />
          <Meta label="Scheduled" value={fmtDate(audit.scheduledDate)} />
          <Meta label="Owners" value={`${audit.ownerCount ?? 0}`} />
          <div className="ml-auto flex gap-2">
            {isConductable && canExecute && (
              <Button asChild size="sm">
                <Link href={`/cams/audits/${audit.id}/conduct`}>
                  <PlayCircle size={16} /> {audit.status === "scheduled" ? "Start Audit" : "Continue Audit"}
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* WP-45 — who was audited. Sits directly under the site strip because
            that strip shows the OWNING plant, and on a supplier audit those are
            two different organisations. */}
        {audit.subjectType === "VENDOR" && audit.supplierDetail && (
          <div className="mt-3">
            <SupplierPanel
              auditId={audit.id}
              supplier={audit.supplierDetail}
              submissions={submissions}
              canManage={canUpdate}
              onChanged={() => router.refresh()}
            />
          </div>
        )}

        {/* Standard chips */}
        {(audit.standards?.length ?? 0) > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {audit.standards!.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700"><ShieldCheck size={10} /> {s}</span>
            ))}
          </div>
        )}

        {/* Overall summary — progress ring + compliance % + open criticals */}
        <div className="mt-3 flex flex-wrap items-center gap-6 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-3">
            <RingMini pct={summary.completionPct} />
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Progress</div>
              <div className="text-sm font-bold tabular-nums text-slate-800">{audit.answeredCheckpoints}/{audit.totalCheckpoints ?? "—"} <span className="font-normal text-slate-400">assessed</span></div>
            </div>
          </div>
          <SummaryStat
            label="Compliance"
            value={summary.notStarted ? "Not started" : summary.notAssessed ? "Not assessed" : summary.compliancePct == null ? "—" : `${summary.compliancePct}%`}
            tone={summary.notStarted || summary.notAssessed || summary.compliancePct == null ? "text-slate-400" : complianceColor(summary.compliancePct)}
          />
          <SummaryStat label="Open criticals" value={`${summary.criticalOpen}`} tone={summary.criticalOpen > 0 ? "text-rose-600" : "text-slate-700"} />
          <SummaryStat label="Ad-hoc added" value={`${audit.adHocCount ?? 0}`} />
          {audit.finalizability && audit.finalizability.submitted && (
            <SummaryStat label="In review" value={`${audit.finalizability.blockerCount}`} tone={audit.finalizability.blockerCount > 0 ? "text-amber-600" : "text-emerald-600"} />
          )}
        </div>
      </div>

      {/* Who is on this audit, in which seat, over which disciplines. */}
      {audit.team && (
        <TeamPanel
          team={audit.team}
          // Editable right up until closure. The auditees on a real audit are
          // usually identified at the opening meeting, not a week beforehand.
          onEdit={canAllocate ? () => setShowTeam(true) : undefined}
        />
      )}

      {/* Whose calendars this audit is holding. Directly under the team panel
          because the invited cast IS the team — naming an auditee above books
          them here, and seeing the two apart would hide that connection. */}
      <CalendarBookingsPanel
        engagementKind="AUDIT"
        engagementId={audit.id}
        data={bookings}
        canManage={canUpdate}
        locked={["closed", "cancelled"].includes(audit.status)}
      />

      {/* Finalize gate banner */}
      {isReviewable && canClose && audit.finalizability && (
        <FinalizeBanner auditId={audit.id} fin={audit.finalizability} />
      )}

      {/* Allocation banner */}
      {audit.responses.length > 0 && (canAllocate || allocation.unassigned > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm">
          <Users2 size={16} className="text-slate-500" />
          <span className="font-medium text-slate-700">{allocation.assigned} assigned</span>
          <span className="text-slate-300">·</span>
          <span className={cn("font-medium", allocation.unassigned > 0 ? "text-amber-700" : "text-slate-500")}>
            {allocation.unassigned} unassigned
          </span>
          {canAllocate && (
            <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => setShowAllocate(true)}>
              <Users2 size={14} /> Manage allocation
            </Button>
          )}
        </div>
      )}

      {/* Dashboard */}
      {dashboard && audit.answeredCheckpoints > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Overall score</div>
            {summary.notAssessed ? (
              <div className="mt-3 text-sm text-slate-400">No assessable checkpoints yet — <span className="font-medium text-slate-500">Not assessed</span> (all N/A).</div>
            ) : (
              <div className="mt-3 flex items-center gap-4">
                {/* The gauge is clamped at 0 by its own arc maths; the number
                    beside it is not. A repeat-heavy discipline really can score
                    below zero, and rounding that up to 0% would flatter it. */}
                <Gauge pct={Math.max(0, dashboard.score.overall_score_pct)} />
                <div>
                  <div className={cn("text-3xl font-extrabold tabular-nums", complianceColor(dashboard.score.overall_score_pct))}>{dashboard.score.overall_score_pct}%</div>
                  {/* Points, so the percentage can be reconciled against the
                      customer's own workbook instead of taken on trust. */}
                  {dashboard.score.score_allotted != null && dashboard.score.score_allotted > 0 && (
                    <div className="text-[11px] tabular-nums text-slate-500">
                      {dashboard.score.score_obtained}/{dashboard.score.score_allotted} points · {scoreBandLabel(dashboard.score.overall_score_pct)}
                    </div>
                  )}
                  {audit.auditPassed != null && (
                    <span className={cn("mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", audit.auditPassed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700")}>
                      {audit.auditPassed ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {audit.auditPassed ? "PASS" : "CONDITIONAL / FAIL"}
                    </span>
                  )}
                  {(dashboard.score.repeat_findings ?? 0) > 0 && (
                    <div className="mt-1 text-[11px] font-medium text-rose-700">
                      {dashboard.score.repeat_findings} repeat finding{dashboard.score.repeat_findings === 1 ? "" : "s"} · scored −1 each
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Critical checkpoint compliance</div>
            <div className="mt-3 flex items-center gap-4">
              <Gauge pct={dashboard.criticalCompliance.pct} accent={dashboard.criticalCompliance.pct >= 100 ? "#10b981" : "#f43f5e"} />
              <div>
                <div className="text-3xl font-extrabold tabular-nums text-slate-900">{dashboard.criticalCompliance.compliant}/{dashboard.criticalCompliance.total}</div>
                <div className="mt-1 text-[11px] text-slate-500">{dashboard.score.critical_failures} critical fail(s) · must be 0 to pass</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Finding breakdown</div>
            <div className="mt-1 flex items-center gap-3">
              <div className="h-[120px] w-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { k: "Pass", v: dashboard.donut.pass, c: "#10b981" },
                        { k: "Partial", v: dashboard.donut.partial, c: "#f59e0b" },
                        { k: "Fail", v: dashboard.donut.fail, c: "#f43f5e" },
                        { k: "N/A", v: dashboard.donut.na, c: "#cbd5e1" },
                        { k: "—", v: dashboard.donut.not_answered, c: "#f1f5f9" },
                      ].filter((d) => d.v > 0)}
                      dataKey="v" nameKey="k" innerRadius={36} outerRadius={56} paddingAngle={2}
                    >
                      {[0, 1, 2, 3, 4].map((i) => <Cell key={i} fill={["#10b981", "#f59e0b", "#f43f5e", "#cbd5e1", "#f1f5f9"][i]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 text-xs">
                <Legend c="#10b981" label="Pass" v={dashboard.donut.pass} />
                <Legend c="#f59e0b" label="Partial" v={dashboard.donut.partial} />
                <Legend c="#f43f5e" label="Fail" v={dashboard.donut.fail} />
                <Legend c="#cbd5e1" label="N/A" v={dashboard.donut.na} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assurance integrity — meeting records + auditor competence.
          These render from data or state their own absence; the report does the
          same, so the two never disagree (docs/cams/09 §2.2–2.3). */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MeetingRecords
          engagementKind="AUDIT"
          engagementId={audit.id}
          data={meetings}
          canRecord={canUpdate && !["closed", "cancelled"].includes(audit.status)}
        />
        <CompetenceSnapshotPanel rows={competence} />
      </div>

      {/* PIL/MR/F04-R1 — one numbered NC report per non-conformity, each with a
          Why-Why root cause analysis gating its Correction and Preventive
          Action. Only from submit onwards: before the auditor has submitted,
          the verdicts are still moving and an NC report raised against one that
          is about to change is a form somebody has to withdraw. */}
      {!["scheduled", "in_progress"].includes(audit.status) && (
        <NcRegisterPanel
          auditId={audit.id}
          userMap={userMap}
          canTrigger={canUpdate}
          canVerify={canExecute}
          canSign={canClose}
        />
      )}

      {/* WP-41 — sign-off gates closure. Shown once the audit is under way, so
          it is not noise on a freshly scheduled engagement. */}
      {audit.status !== "scheduled" && (
        <SignOffPanel
          auditId={audit.id}
          status={signoff}
          locked={["closed", "cancelled"].includes(audit.status)}
        />
      )}

      {/* Discipline compliance — RAG bars (always shown; "Not started" pre-conduct) */}
      {disciplineRag.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Discipline compliance</h3>
          <div className="space-y-2.5">
            {disciplineRag.map((c) => (
              <button key={c.id} type="button" onClick={() => document.getElementById(`disc-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })} className="block w-full text-left">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-600 hover:text-primary-700">{c.name}</span>
                  {c.pct == null ? (
                    <span className="font-medium text-slate-400">Not started <span className="font-normal">(0/{c.total})</span></span>
                  ) : (
                    <span className={cn("font-semibold tabular-nums", ragText(c.pct))}>{c.pct}% <span className="font-normal text-slate-400">({c.passed}✓ {c.failed}✗ of {c.total})</span></span>
                  )}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={cn("h-full rounded-full transition-all", ragBar(c.pct))} style={{ width: c.pct == null ? "100%" : `${c.pct}%`, opacity: c.pct == null ? 0.4 : 1 }} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Findings & responses — the bounded review surface (fail / partial /
          in-flight checkpoints), grouped by discipline, with the auditee +
          plant-manager workflow inline. Pass/N/A rows and the full checklist
          are browsed in the conduct worklist (paginated for large audits). */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">
            Findings &amp; responses <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{audit.responses.length}{audit.responsesTruncated ? "+" : ""}</span>
          </h3>
          <Link href={`/cams/audits/${audit.id}/conduct`} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline">
            <ListChecks size={13} /> Browse all {audit.totalCheckpoints ?? 0} checkpoints
          </Link>
        </div>
        {audit.responsesTruncated && (
          <div className="border-b bg-amber-50 px-4 py-2 text-[11px] text-amber-800">
            Showing the first {audit.responses.length} findings. Use the conduct worklist (filter “Fail”/“Partial”) to reach the rest.
          </div>
        )}
        {findingGroups.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">
            No findings yet — every assessed checkpoint is a pass / N/A, or the audit hasn&apos;t started.
          </div>
        ) : (
          findingGroups.map((g) => (
            <div key={g.categoryId} id={`disc-${g.categoryId}`} className="scroll-mt-16">
              <div className="sticky top-0 z-10 flex items-center justify-between border-y border-slate-100 bg-slate-50/95 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
                <span>{g.categoryName}</span><span className="text-slate-400">{g.items.length}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {g.items.map((r) => (
                  <FindingRow key={r.id} auditId={audit.id} r={r} me={me} userMap={userMap}
                    canExecute={canExecute} canApprove={canDecideEscalation} canUpdate={canUpdate}
                    canCreateCapa={canCreateCapa} plantManagerId={audit.plantManagerUserId}
                    auditOpen={!["closed", "cancelled"].includes(audit.status)} onChanged={() => router.refresh()} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reports (A-07) */}
      <ReportsPanel
        auditId={audit.id}
        reports={reports}
        userMap={userMap}
        canInterim={canExport && !["scheduled", "cancelled"].includes(audit.status)}
        canFinal={canClose && !!audit.finalizability?.finalizable}
        finalizable={!!audit.finalizability?.finalizable}
        streams={audit.streamRollup ?? []}
      />

      {audit.status === "closed" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="flex items-center gap-2 font-semibold"><Lock size={15} /> Audit closed on {fmtDate(audit.closedAt)}</div>
          {audit.closingRemarks && <p className="mt-1 text-emerald-800">{audit.closingRemarks}</p>}
        </div>
      )}

      {showAllocate && (
        <AllocationWorkspace
          auditId={audit.id}
          plantId={audit.plantId}
          disciplines={audit.disciplineRollup ?? []}
          knownNames={audit.userNames ?? {}}
          team={audit.team ?? null}
          onClose={() => setShowAllocate(false)}
          onChanged={() => router.refresh()}
        />
      )}

      {showTeam && (
        <TeamEditor
          audit={audit}
          disciplines={audit.disciplineRollup ?? []}
          onClose={() => setShowTeam(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}

// Allocation moved to ./allocation-workspace.tsx. The modal that lived here
// could only assign a whole discipline, and only the auditee — which forced
// every cross-departmental checkpoint to sit with the wrong owner and gave
// the auditor axis no home at all.

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="font-medium text-slate-700">{value}</div>
    </div>
  );
}

/**
 * The audit's full cast: every seat, the person in it, the permission that seat
 * requires and — for the per-discipline seats — exactly which disciplines they
 * cover. The header strip only ever named the lead auditor and plant manager,
 * so co-auditors and auditees were invisible on the record they are party to,
 * and nothing showed which disciplines each auditor had been given.
 *
 * The `authorised` flag is the part that earns its place: an audit outlives a
 * permission change, so someone seated in March can lack the grant in June.
 * Showing it here is what explains a missing Start Audit button, instead of
 * leaving the scheduler to guess.
 */
function TeamPanel({ team, onEdit }: { team: AuditTeam; onEdit?: () => void }) {
  const groups: { key: string; title: string; note: string; members: AuditTeamMember[] }[] = [
    { key: "lead", title: "Lead auditor", note: "Conducts every discipline not assigned to a co-auditor", members: team.leadAuditor ? [team.leadAuditor] : [] },
    { key: "pm", title: "Plant manager (reviewer)", note: "Accepts, sends back or escalates auditee responses", members: team.plantManager ? [team.plantManager] : [] },
    { key: "co", title: "Co-auditors by discipline", note: "Conduct only the disciplines listed against their name", members: team.coAuditors },
    { key: "auditee", title: "Auditees", note: "Failed checkpoints in these disciplines route to them", members: team.auditees },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Users2 size={15} className="text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-800">Audit team &amp; discipline scope</h2>
        <span className="text-[11px] text-slate-400">{team.memberCount ?? 0} assigned</span>
        {(team.unauthorisedCount ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
            <AlertTriangle size={10} /> {team.unauthorisedCount} no longer authorised
          </span>
        )}
        {onEdit && (
          <Button type="button" variant="outline" size="sm" className="ml-auto h-7 text-xs" onClick={onEdit}>
            <Users2 size={13} /> Edit team
          </Button>
        )}
      </div>
      {onEdit && team.auditees.length === 0 && (
        // The state this whole edit path exists for: an audit scheduled before
        // anyone knew who would answer for it. Saying so beats an empty list
        // that reads like a loading failure.
        <p className="mb-3 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2 text-[12px] text-amber-900">
          No auditees named yet. They are usually identified at the opening meeting — add them
          whenever they are known and the findings will route to them.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g.key} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{g.title}</div>
            <div className="mb-2 text-[11px] text-slate-400">{g.note}</div>
            {g.members.length === 0 ? (
              <div className="text-xs text-slate-400">— none assigned —</div>
            ) : (
              <ul className="space-y-2">
                {g.members.map((m) => (
                  <li key={m.userId} className="rounded-md border border-slate-200 bg-white px-2.5 py-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium text-slate-800">{m.name}</span>
                      {m.role && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          {m.role.replace(/_/g, " ")}
                        </span>
                      )}
                      {m.department && <span className="text-[10px] text-slate-400">{m.department}</span>}
                      {m.authorised ? (
                        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700" title={`Holds ${m.permission}`}>
                          <CheckCircle2 size={11} /> authorised
                        </span>
                      ) : (
                        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700" title={`Missing ${m.permission} at this plant`}>
                          <AlertTriangle size={11} /> cannot act
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      {m.authorised ? "Holds" : "Missing"} {m.permission}
                      {!m.authorised && " — grant it in Configuration → Roles"}
                    </div>
                    {m.disciplines && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {m.disciplines.length === 0 ? (
                          <span className="text-[10px] text-slate-400">No disciplines assigned</span>
                        ) : (
                          m.disciplines.map((d) => (
                            <span key={d.id} className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                              {d.name}
                            </span>
                          ))
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={cn("text-lg font-extrabold tabular-nums", tone ?? "text-slate-800")}>{value}</div>
    </div>
  );
}

function RingMini({ pct }: { pct: number }) {
  const r = 16, c = 2 * Math.PI * r, off = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <div className="relative">
      <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#f1f5f9" strokeWidth="5" />
        <circle cx="22" cy="22" r={r} fill="none" stroke="#7c3aed" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums text-slate-600">{pct}%</span>
    </div>
  );
}

function Legend({ c, label, v }: { c: string; label: string; v: number }) {
  return <div className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ backgroundColor: c }} /> <span className="text-slate-600">{label}</span> <span className="ml-1 font-semibold tabular-nums text-slate-800">{v}</span></div>;
}

function Gauge({ pct, accent = "#7c3aed" }: { pct: number; accent?: string }) {
  const r = 30, c = 2 * Math.PI * r, off = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" className="-rotate-90">
      <circle cx="38" cy="38" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
      <circle cx="38" cy="38" r={r} fill="none" stroke={accent} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
    </svg>
  );
}


function FindingRow({ auditId, r, me, userMap, canExecute, canApprove, canUpdate, canCreateCapa, plantManagerId, auditOpen, onChanged }: {
  auditId: string; r: CheckpointResponse; me: string | undefined; userMap: Record<string, string>;
  canExecute: boolean; canApprove: boolean; canUpdate: boolean; canCreateCapa: boolean;
  plantManagerId: string | null; auditOpen: boolean; onChanged: () => void;
}) {
  const ws = r.workflowState;
  const inFlight = ["AWAITING_AUDITEE", "AUDITEE_RESPONDED", "MORE_INFO_REQUESTED", "ESCALATED_PM"].includes(ws);
  const [open, setOpen] = useState(inFlight);
  // The grade is what the auditor chose; the pass/partial/fail bucket is what
  // the engine derived from it. Show the grade — falling back to the bucket
  // only for rows graded before this vocabulary existed.
  const val = r.auditorResponse?.value ?? null;
  const meta = (r.gradeAwarded && GRADE_META[r.gradeAwarded])
    || (val && VALUE_META[val])
    || { label: "Not graded", chip: "bg-slate-100 text-slate-500", dot: "bg-slate-300" };
  const wmeta = WORKFLOW_STATE_META[ws];
  const name = (id: string | null | undefined) => (id ? userMap[id] ?? "—" : "—");

  return (
    <div className="px-4 py-3">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 text-left">
        <span className={cn("mt-0.5 size-2.5 shrink-0 rounded-full", meta.dot)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-slate-500">{r.checkpointCode}</span>
            {r.requirementType && (
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase", REQUIREMENT_TYPE_META[r.requirementType].chip)}
                title={REQUIREMENT_TYPE_META[r.requirementType].label}>
                {REQUIREMENT_TYPE_META[r.requirementType].short}
              </span>
            )}
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase", CRITICALITY_CHIP[r.criticality] ?? CRITICALITY_FALLBACK)}>{r.criticality}</span>
            {/* Grade + the points it earned — the two workbook columns a
                reviewer scanning the finding list actually reads. */}
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.chip)}>
              {meta.label}
              {r.scoreAllotted !== null && r.scoreObtained !== null && (
                <span className="ml-1 tabular-nums opacity-70">{r.scoreObtained}/{r.scoreAllotted}</span>
              )}
            </span>
            {r.complianceStatus && (
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_META[r.complianceStatus].chip)}>
                {STATUS_META[r.complianceStatus].label}
              </span>
            )}
            {r.riskGrade && (
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", RISK_META[r.riskGrade].chip)}>
                {RISK_META[r.riskGrade].label} risk
              </span>
            )}
            {wmeta && ws !== "OPEN" && ws !== "PASSED" && <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", wmeta.chip)}>{wmeta.label}</span>}
            {r.currentRound > 0 && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">Round {r.currentRound}</span>}
            {r.isAdHoc && <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-700">Custom</span>}
            {/* Who the ball is with. While a finding sits at ESCALATED_PM it is
                the designated reviewer's, NOT the auditee it was originally
                routed to — showing the auditee there is what made an escalation
                look like it had gone to the wrong person. */}
            {ws === "ESCALATED_PM"
              ? <span className="text-[11px] font-medium text-rose-700">→ {plantManagerId ? name(plantManagerId) : "no reviewer assigned"} <span className="font-normal text-rose-400">(deciding)</span></span>
              : r.assignedOwnerId
                ? <span className="text-[11px] text-slate-500">→ {name(r.assignedOwnerId)}</span>
                : r.routedToUserId
                  ? <span className="text-[11px] text-slate-400">→ {name(r.routedToUserId)} <span className="text-slate-300">(routed)</span></span>
                  : <span className="text-[11px] font-medium text-amber-600">unassigned</span>}
            {r.capa?.capa_number && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800"><AlertTriangle size={10} /> {r.capa.capa_number}</span>}
          </div>
          <div className="mt-1 text-sm text-slate-800">{r.checkpointQuestion}</div>
        </div>
        {open ? <ChevronDown size={16} className="mt-1 text-slate-400" /> : <ChevronRight size={16} className="mt-1 text-slate-400" />}
      </button>

      {open && (
        <div className="ml-5 mt-3 space-y-3 border-l-2 border-slate-100 pl-4">
          {(r.auditorResponse?.text_observation || (r.auditorResponse?.photos?.length ?? 0) > 0) && (
            <Block label="Auditor finding">
              {r.auditorResponse?.text_observation && <p className="text-slate-600">{r.auditorResponse.text_observation}</p>}
              <PhotoStrip photos={r.auditorResponse?.photos} />
            </Block>
          )}

          {/* Chronological iteration thread */}
          {(r.interactions?.length ?? 0) > 0 && (
            <IterationThread
              interactions={r.interactions!}
              userMap={userMap}
              // Photos already carrying live URLs, so the common case renders
              // without a signing round trip per thumbnail.
              knownPhotos={[
                ...(r.auditorResponse?.photos ?? []),
                ...(r.auditeeResponse?.photos ?? []),
              ]}
            />
          )}

          {/* Role + state gated action bar */}
          <CheckpointActions
            auditId={auditId} r={r} me={me} canExecute={canExecute} canApprove={canApprove} canUpdate={canUpdate}
            canCreateCapa={canCreateCapa} auditOpen={auditOpen} onChanged={onChanged}
          />
        </div>
      )}
    </div>
  );
}

function IterationThread({ interactions, userMap, knownPhotos = [] }: {
  interactions: CheckpointInteraction[];
  userMap: Record<string, string>;
  knownPhotos?: StoredPhoto[];
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        <MessageSquare size={12} /> Iteration thread
      </div>
      <ol className="space-y-2">
        {interactions.map((i) => (
          <li key={i.id} className="flex gap-2">
            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-slate-300" />
            <div className="min-w-0 flex-1 text-[13px]">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium text-slate-700">{INTERACTION_LABEL[i.action] ?? i.action}</span>
                <span className="text-[11px] text-slate-400">{userMap[i.actorId] ?? i.actorRole.replace(/_/g, " ").toLowerCase()}</span>
                {i.round > 0 && <span className="rounded bg-slate-100 px-1 text-[10px] text-slate-500">R{i.round}</span>}
                <span className="text-[11px] text-slate-300">{fmtDateTime(i.timestamp)}</span>
              </div>
              {i.comment && <p className="text-slate-600">{i.comment}</p>}
              {i.evidenceIds.length > 0 && (
                <EvidenceStrip evidenceIds={i.evidenceIds} known={knownPhotos} />
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Unified, role + state gated action bar driving the iteration state machine.
function CheckpointActions({ auditId, r, me, canExecute, canApprove, canUpdate, canCreateCapa, auditOpen, onChanged }: {
  auditId: string; r: CheckpointResponse; me: string | undefined;
  canExecute: boolean; canApprove: boolean; canUpdate: boolean; canCreateCapa: boolean;
  auditOpen: boolean; onChanged: () => void;
}) {
  const ws = r.workflowState;
  const routedToMe = r.routedToUserId === me || r.assignedOwnerId === me;
  if (!auditOpen) return null;

  // Auditee respond — when this checkpoint awaits a response.
  if (canUpdate && ["AWAITING_AUDITEE", "MORE_INFO_REQUESTED"].includes(ws)) {
    return <RespondForm auditId={auditId} r={r} routedToMe={routedToMe} onChanged={onChanged} />;
  }
  // Auditor review — after the auditee responded.
  if (canExecute && ws === "AUDITEE_RESPONDED") {
    return <AuditorReview auditId={auditId} r={r} canCreateCapa={canCreateCapa} onChanged={onChanged} />;
  }
  // Plant manager decision — when escalated.
  if (canApprove && ws === "ESCALATED_PM") {
    return <PmDecision auditId={auditId} r={r} canCreateCapa={canCreateCapa} onChanged={onChanged} />;
  }
  // Re-assess a reopened/unassessed checkpoint (the only post-submit path back to terminal).
  if (canExecute && ws === "OPEN") {
    return <ReassessAction auditId={auditId} r={r} onChanged={onChanged} />;
  }
  // Reopen a passed checkpoint before finalization.
  if (canExecute && ws === "PASSED") {
    return <ReopenAction auditId={auditId} r={r} onChanged={onChanged} />;
  }
  return null;
}

// Re-assess an OPEN/Not-assessed checkpoint (e.g. after Reopen) — posts a fresh
// verdict; the backend reconciles pass/na→PASSED and fail/partial→AWAITING_AUDITEE.
function ReassessAction({ auditId, r, onChanged }: { auditId: string; r: CheckpointResponse; onChanged: () => void }) {
  const { toast } = useToast();
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  async function assess(value: "pass" | "partial" | "fail" | "na") {
    if ((value === "fail" || value === "partial") && obs.trim().length < 3) {
      toast({ variant: "error", title: "Observation required", description: "Add an observation for a fail/partial." });
      return;
    }
    setBusy(value);
    const res = await fetch(`/api/audit-compliance/${auditId}/responses`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ checkpointCode: r.checkpointCode, value, textObservation: obs }),
    });
    setBusy(null);
    if (res.ok) { toast({ variant: "success", title: "Re-assessed" }); onChanged(); }
    else { const j = await res.json().catch(() => ({})); toast({ variant: "error", title: "Couldn't re-assess", description: apiErrorMessage(j, res.status) }); }
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Re-assess checkpoint</div>
      <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observation (required for fail/partial)…" className="mb-2 h-8 text-xs" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="success" size="sm" onClick={() => assess("pass")} disabled={!!busy}><CheckCircle2 size={14} /> Pass</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => assess("partial")} disabled={!!busy}>~ Partial</Button>
        <Button type="button" variant="destructive" size="sm" onClick={() => assess("fail")} disabled={!!busy}><XCircle size={14} /> Fail</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => assess("na")} disabled={!!busy}>N/A</Button>
      </div>
    </div>
  );
}

async function postTransition(auditId: string, checkpointId: string, body: Record<string, unknown>): Promise<{ ok: boolean; detail?: string }> {
  const res = await fetch(`/api/audit-compliance/${auditId}/checkpoints/${checkpointId}/transition`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true };
  const j = await res.json().catch(() => ({}));
  return { ok: false, detail: apiErrorMessage(j, res.status) };
}

function AuditorReview({ auditId, r, canCreateCapa, onChanged }: { auditId: string; r: CheckpointResponse; canCreateCapa: boolean; onChanged: () => void }) {
  const { toast } = useToast();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  async function act(action: string, requireComment = false) {
    if (requireComment && comment.trim().length < 3) { toast({ variant: "error", title: "Comment required", description: "Add a short note for this action." }); return; }
    setBusy(action);
    const res = await postTransition(auditId, r.id, { action, comment });
    setBusy(null);
    if (res.ok) { toast({ variant: "success", title: "Updated" }); onChanged(); }
    else toast({ variant: "error", title: "Action failed", description: res.detail ?? "Please try again." });
  }
  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-800">Auditor review</div>
      <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Review note (required for more-info)…" className="mb-2 h-8 text-xs" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="success" size="sm" onClick={() => act("ACCEPT")} disabled={!!busy}><CheckCircle2 size={14} /> Accept & resolve</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => act("REQUEST_MORE_INFO", true)} disabled={!!busy}><RotateCcw size={14} /> Request more info</Button>
        {/* Hidden rather than disabled when the reviewer cannot create CAPAs:
            a greyed button invites a click and explains nothing, and the line
            below names the missing grant so it can actually be fixed. */}
        {canCreateCapa && (
          <Button type="button" variant="outline" size="sm" onClick={() => act("RAISE_CAPA")} disabled={!!busy}><FileWarning size={14} /> Raise CAPA</Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={() => act("ESCALATE")} disabled={!!busy}><ArrowUpCircle size={14} /> Escalate</Button>
      </div>
      {!canCreateCapa && (
        <p className="mt-1.5 text-[11px] text-slate-500">
          Raising a CAPA needs <span className="font-medium">CAPA.CREATE</span> at this plant,
          which you don&apos;t hold — ask an admin to grant it in Configuration → Roles, or escalate
          the finding instead.
        </p>
      )}
    </div>
  );
}

function PmDecision({ auditId, r, canCreateCapa, onChanged }: { auditId: string; r: CheckpointResponse; canCreateCapa: boolean; onChanged: () => void }) {
  const { toast } = useToast();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  async function act(action: string) {
    setBusy(action);
    const res = await postTransition(auditId, r.id, { action, comment });
    setBusy(null);
    if (res.ok) { toast({ variant: "success", title: "Decision recorded" }); onChanged(); }
    else toast({ variant: "error", title: "Action failed", description: res.detail ?? "Please try again." });
  }
  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-800">Plant manager decision</div>
      <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Decision comments…" className="mb-2 h-8 text-xs" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="success" size="sm" onClick={() => act("PM_ACCEPT")} disabled={!!busy}><CheckCircle2 size={14} /> Accept</Button>
        {canCreateCapa && (
          <Button type="button" variant="outline" size="sm" onClick={() => act("PM_RAISE_CAPA")} disabled={!!busy}><FileWarning size={14} /> Raise CAPA</Button>
        )}
        <Button type="button" variant="destructive" size="sm" onClick={() => act("PM_SEND_BACK")} disabled={!!busy}><RotateCcw size={14} /> Send back</Button>
      </div>
    </div>
  );
}

function ReopenAction({ auditId, r, onChanged }: { auditId: string; r: CheckpointResponse; onChanged: () => void }) {
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!show) return <Button type="button" variant="ghost" size="sm" className="text-slate-400" onClick={() => setShow(true)}><RotateCcw size={13} /> Reopen</Button>;
  async function go() {
    if (reason.trim().length < 3) { toast({ variant: "error", title: "Reason required", description: "Explain why you're reopening." }); return; }
    setBusy(true);
    const res = await postTransition(auditId, r.id, { action: "REOPEN", comment: reason });
    setBusy(false);
    if (res.ok) { toast({ variant: "success", title: "Checkpoint reopened" }); onChanged(); }
    else toast({ variant: "error", title: "Couldn't reopen", description: res.detail ?? "Please try again." });
  }
  return (
    <div className="flex items-center gap-2">
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason to reopen…" className="h-8 text-xs" />
      <Button type="button" size="sm" onClick={go} disabled={busy}>{busy && <Loader2 size={13} className="animate-spin" />} Reopen</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setShow(false)}>Cancel</Button>
    </div>
  );
}

function FinalizeBanner({ auditId, fin }: { auditId: string; fin: Finalizability }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  async function close() {
    setBusy(true);
    const res = await fetch(`/api/audit-compliance/${auditId}/close`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ closingRemarks: "All findings resolved. Audit finalized." }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { toast({ variant: "success", title: "Audit finalized", description: `Final compliance ${j.score?.overall_score_pct ?? "—"}%.` }); router.refresh(); }
    else toast({ variant: "error", title: "Couldn't finalize", description: apiErrorMessage(j, res.status) });
  }
  if (fin.finalizable) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm">
        <ShieldCheck size={16} className="text-emerald-600" />
        <span className="font-medium text-emerald-900">All {fin.total} checkpoints resolved — ready to finalize.</span>
        <Button type="button" variant="success" size="sm" className="ml-auto" onClick={close} disabled={busy}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} Close & Finalize
        </Button>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm">
      <div className="flex items-center gap-2 font-medium text-amber-900">
        <FileWarning size={16} /> {fin.blockerCount} of {fin.total} checkpoint(s) still in review — resolve them before finalizing.
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {fin.blockers.slice(0, 12).map((b) => (
          <span key={b.checkpointCode} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] text-amber-800 ring-1 ring-amber-200">
            <span className="font-mono">{b.checkpointCode}</span>
            <span className="text-amber-500">{WORKFLOW_STATE_META[b.workflowState]?.label ?? b.workflowState}</span>
          </span>
        ))}
        {fin.blockers.length > 12 && <span className="text-[10px] text-amber-600">+{fin.blockers.length - 12} more</span>}
      </div>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="text-sm"><div className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>{children}</div>;
}

/** The auditor's evidence on a finding — photographs and documents alike, which
 *  is why it delegates to the shared tile rather than assuming an `<img>`. */
function PhotoStrip({ photos }: { photos?: StoredPhoto[] | null }) {
  if (!photos || photos.length === 0) return null;
  return <AttachmentStrip attachments={photos} size={16} className="mt-1.5" />;
}

// A-07 — report generation + history.
/**
 * The audit's reports, and the buttons that issue them.
 *
 * A department audit issues TWO — an IMS report (ISO 9001/14001/45001) and an
 * EnMS one (ISO 50001) — because Page's own workbook is two sheets read by two
 * different certification scopes. That is expressed as one interim/final pair
 * PER STREAM rather than a single pair with a dropdown, so both documents are
 * visible as things that exist and can be seen to be missing.
 *
 * `streams` comes from the audit's own materialised rows, not from the library:
 * an audit scoped to departments that happen to hold no EnMS checkpoint must
 * not offer an EnMS report with nothing in it.
 */
function ReportsPanel({ auditId, reports, userMap, canInterim, canFinal, finalizable, streams = [] }: {
  auditId: string; reports: AuditReport[]; userMap: Record<string, string>;
  canInterim: boolean; canFinal: boolean; finalizable: boolean;
  streams?: StreamRollup[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const isDeptAudit = streams.length > 0;

  async function generate(reportType: "INTERIM" | "FINAL", stream?: StreamCode) {
    const key = `${reportType}:${stream ?? ""}`;
    setBusy(key);
    // No signOffs are sent. This used to post a hardcoded lead-auditor +
    // plant-manager pair, which was never on the sign-off WRITE path (that is
    // the signature panel, POST /assurance/audits/{id}/signoff) — it was an
    // assertion by the client about who had signed, and the server froze it
    // verbatim into an immutable report. Two nameless, timeless stubs are how
    // "LEAD_AUDITOR: -  -" reached an issued PDF.
    //
    // The generator now reads the recorded sign-offs itself, so a client cannot
    // claim a signature that was never captured.
    const res = await fetch(`/api/audit-compliance/${auditId}/reports`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ reportType, ...(stream ? { stream } : {}) }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) {
      const what = `${stream ? `${STREAM_META[stream].label} ` : ""}${reportType === "FINAL" ? "final" : "interim"}`;
      toast({ variant: "success", title: `${what.charAt(0).toUpperCase()}${what.slice(1)} report generated`, description: j.reportCode });
      router.refresh();
      router.push(`/cams/audits/${auditId}/reports/${j.id}`);
    } else {
      toast({ variant: "error", title: "Couldn't generate report", description: apiErrorMessage(j, res.status) });
    }
  }

  if (!canInterim && reports.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <FileText size={16} className="text-primary-700" />
        <h3 className="text-sm font-semibold text-slate-800">Audit reports</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{reports.length}</span>
        {!isDeptAudit && (
          <div className="ml-auto flex gap-2">
            {canInterim && (
              <Button type="button" variant="outline" size="sm" onClick={() => generate("INTERIM")} disabled={!!busy}>
                {busy === "INTERIM:" ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Generate interim
              </Button>
            )}
            <Button type="button" size="sm" onClick={() => generate("FINAL")} disabled={!!busy || !canFinal}
              title={!finalizable ? "Resolve every checkpoint to issue a final report" : undefined}>
              {busy === "FINAL:" ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Generate final
            </Button>
          </div>
        )}
      </div>

      {/* One row per report this audit issues. Each names its standards, so a
          reader can see at a glance that the IMS document and the EnMS one are
          two separate certification scopes rather than two copies. */}
      {isDeptAudit && (
        <div className="divide-y divide-slate-100 border-b border-slate-100 bg-slate-50/60">
          {streams.map((s) => {
            const issued = reports.filter((r) => r.reportStream === s.code && !r.isSuperseded);
            return (
              <div key={s.code} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className={cn("size-2 shrink-0 rounded-full", STREAM_META[s.code].dot)} />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-slate-800">{s.reportTitle}</div>
                  <div className="text-[11px] text-slate-400">
                    {s.standards} · {s.answered}/{s.total} answered
                    {issued.length > 0 && ` · ${issued.length} current`}
                  </div>
                </div>
                <div className="ml-auto flex gap-2">
                  {canInterim && (
                    <Button type="button" variant="outline" size="sm" onClick={() => generate("INTERIM", s.code)} disabled={!!busy}>
                      {busy === `INTERIM:${s.code}` ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Interim
                    </Button>
                  )}
                  <Button type="button" size="sm" onClick={() => generate("FINAL", s.code)} disabled={!!busy || !canFinal}
                    title={!finalizable ? "Resolve every checkpoint to issue a final report" : undefined}>
                    {busy === `FINAL:${s.code}` ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Final
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {reports.length === 0 ? (
        <div className="p-5 text-center text-xs text-slate-400">No reports yet. Generate a provisional interim report any time, or a final report once every checkpoint is resolved.</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {reports.map((rep) => (
            <Link key={rep.id} href={`/cams/audits/${auditId}/reports/${rep.id}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", rep.reportType === "FINAL" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800")}>{rep.reportType}</span>
              {rep.reportStream && STREAM_META[rep.reportStream] && (
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STREAM_META[rep.reportStream].chip)}>
                  {STREAM_META[rep.reportStream].label}
                </span>
              )}
              <span className="font-mono text-[12px] text-slate-600">{rep.reportCode}</span>
              {rep.isSuperseded && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">superseded</span>}
              <span className="text-[11px] text-slate-400">{fmtDateTime(rep.generatedAt)} · {userMap[rep.generatedById] ?? "—"}</span>
              <span className="ml-auto text-[11px] font-medium text-primary-700">{rep.snapshot.overallScorePct == null ? "—" : `${rep.snapshot.overallScorePct}%`} · {rep.snapshot.overallResult.replace(/_/g, " ")}</span>
              <Download size={14} className="text-slate-400" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function RespondForm({ auditId, r, routedToMe, onChanged }: { auditId: string; r: CheckpointResponse; routedToMe?: boolean; onChanged: () => void }) {
  const { toast } = useToast();
  const code = r.checkpointCode;
  const [actionTaken, setActionTaken] = useState("");
  const [actionDate, setActionDate] = useState(new Date().toISOString().slice(0, 10));
  const [photos, setPhotos] = useState<StoredPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const isDoc = !file.type.startsWith("image/");
    setUploading(true);
    const res = await uploadAuditAttachment(file, { auditId, checkpointCode: code });
    setUploading(false);
    if (!res.ok) {
      toast({ variant: "error", title: isDoc ? "Document upload failed" : "Photo upload failed", description: res.error });
      return;
    }
    setPhotos((p) => [...p, res.attachment]);
    toast({ variant: "success", title: "Evidence uploaded", description: isDoc ? res.attachment.fileName : undefined });
  }

  function removePhoto(i: number) {
    const removed = photos[i];
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));
    void deleteAuditAttachment(removed?.storagePath);
    // Annotated attachments carry the unmarked original too — drop both, or it
    // is orphaned in storage with no record pointing at it.
    void deleteAuditAttachment(removed?.originalStoragePath);
  }

  async function submit() {
    if (actionTaken.trim().length < 3) { toast({ variant: "error", title: "Action required", description: "Describe the action taken (min 3 characters)." }); return; }
    setBusy(true);
    const res = await postTransition(auditId, r.id, {
      action: "AUDITEE_RESPOND", comment: actionTaken, actionTaken, actionDate,
      photos, evidenceIds: photos.map((p) => p.storagePath).filter(Boolean),
    });
    setBusy(false);
    if (res.ok) { toast({ variant: "success", title: "Response submitted", description: "Routed to the auditor for review." }); onChanged(); }
    else toast({ variant: "error", title: "Couldn't submit response", description: res.detail ?? "Please try again." });
  }
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-amber-800">Respond to this finding {routedToMe && <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[9px] normal-case">assigned to you</span>}</div>
      <Textarea value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} rows={2} placeholder="Action taken to remediate…" className="min-h-[56px]" />
      <AttachmentStrip attachments={photos} onRemove={removePhoto} className="mt-2" />
      {/* Remediation proof is more often paperwork than a photograph — a renewed
          licence, a training record, a calibration certificate. Two pickers for
          the same reason as the conduct screen: the photo input keeps
          `capture` so a phone opens the camera, and documents must not be
          made to travel through a viewfinder. */}
      <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} capture="environment" className="hidden" onChange={onFile} />
      <input ref={docRef} type="file" accept={DOCUMENT_ACCEPT} className="hidden" onChange={onFile} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input type="date" value={actionDate} onChange={(e) => setActionDate(e.target.value)} className="h-8 w-auto text-xs" />
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />} {uploading ? "Uploading…" : "Photo"}</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => docRef.current?.click()} disabled={uploading}
          title="Attach a PDF, Word, Excel, CSV or text file as proof of remediation">
          <Paperclip size={13} /> Document
        </Button>
        {photos.length > 0 && (
          <span className="text-[11px] text-slate-500">{photos.length} attached</span>
        )}
        <Button type="button" size="sm" className="ml-auto" onClick={submit} disabled={busy}>{busy && <Loader2 size={13} className="animate-spin" />} Submit response</Button>
      </div>
    </div>
  );
}

