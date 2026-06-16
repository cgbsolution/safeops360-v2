"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { uploadAuditPhoto, deleteAuditPhoto } from "../upload-photo";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  PlayCircle, CheckCircle2, XCircle, AlertTriangle, ClipboardCheck, Lock,
  ChevronDown, ChevronRight, Camera, Loader2, ShieldCheck, Trash2, Send, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { usePermission } from "@/components/auth/can";
import {
  AuditDetail, AuditDashboard, CheckpointResponse, PlantUser,
  STATUS_CHIP, STATUS_LABEL, CRITICALITY_CHIP, VALUE_META, Chip, fmtDate, complianceColor, complianceBg, INDUSTRY_LABEL,
} from "../lib";

export function AuditDetailView({ audit, dashboard, userMap, users }: { audit: AuditDetail; dashboard: AuditDashboard | null; userMap: Record<string, string>; users: PlantUser[] }) {
  const router = useRouter();
  const { data: session } = useSession();
  const me = (session?.user as any)?.id as string | undefined;
  const canExecute = usePermission("AUDIT_COMPLIANCE.EXECUTE");
  const canApprove = usePermission("AUDIT_COMPLIANCE.APPROVE");
  const canClose = usePermission("AUDIT_COMPLIANCE.CLOSE");
  const canUpdate = usePermission("AUDIT_COMPLIANCE.UPDATE");

  const name = (id: string | null | undefined) => (id ? userMap[id] ?? "—" : "—");

  // Actor affordances — the workflow surfaces each step's action to the right
  // person; the backend enforces state + permission.
  const iAmPlantHead = !!me && me === audit.plantManagerUserId;
  const iAmAuditor = !!me && (me === audit.leadAuditorUserId || me === audit.createdByUserId);

  const isConductable = ["scheduled", "in_progress"].includes(audit.status);
  const isReviewable = ["auditee_response", "auditor_review", "submitted_pending_response", "response_in_progress", "under_review"].includes(audit.status);
  const canDispatch = audit.status === "pending_plant_head" && (canApprove || iAmPlantHead);
  const canAccept = audit.status === "pending_acceptance" && (canApprove || canClose || iAmPlantHead);

  // Findings = failed/partial checkpoints (they carry the auditee/auditor flow).
  const findings = useMemo(() => audit.responses.filter((r) => ["pending_assignment", "pending_auditee", "response_submitted", "response_accepted"].includes(r.overallStatus)), [audit.responses]);
  const allFindingsAccepted = findings.length > 0 && findings.every((r) => r.overallStatus === "response_accepted");
  const canRequestAcceptance = ["auditee_response", "auditor_review"].includes(audit.status) && allFindingsAccepted && (canExecute || iAmAuditor);

  // Full checkpoint list (all results), filterable + grouped by category.
  const [filter, setFilter] = useState<"all" | "pass" | "partial" | "fail" | "na" | "unanswered">("all");
  const ordered = useMemo(() => [...audit.responses].sort((a, b) => a.sequence - b.sequence), [audit.responses]);
  const counts = useMemo(() => {
    const c = { all: ordered.length, pass: 0, partial: 0, fail: 0, na: 0, unanswered: 0 };
    for (const r of ordered) {
      const v = r.auditorResponse?.value;
      if (v === "pass" || v === "yes") c.pass++;
      else if (v === "partial") c.partial++;
      else if (v === "fail" || v === "no") c.fail++;
      else if (v === "na") c.na++;
      else c.unanswered++;
    }
    return c;
  }, [ordered]);
  const groups = useMemo(() => {
    const keep = (r: CheckpointResponse) => {
      if (filter === "all") return true;
      const v = r.auditorResponse?.value;
      if (filter === "pass") return v === "pass" || v === "yes";
      if (filter === "partial") return v === "partial";
      if (filter === "fail") return v === "fail" || v === "no";
      if (filter === "na") return v === "na";
      return !v;
    };
    const map = new Map<string, { categoryId: string; categoryName: string; items: CheckpointResponse[] }>();
    for (const r of ordered) {
      if (!keep(r)) continue;
      let g = map.get(r.categoryId);
      if (!g) { g = { categoryId: r.categoryId, categoryName: r.categoryName, items: [] }; map.set(r.categoryId, g); }
      g.items.push(r);
    }
    return [...map.values()];
  }, [ordered, filter]);

  return (
    <div className="space-y-5">
      {/* Status + meta strip */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <Chip map={STATUS_CHIP} value={audit.status} label={STATUS_LABEL[audit.status] ?? audit.status} className="text-xs" />
        <Meta label="Industry" value={INDUSTRY_LABEL[audit.industryCode] ?? audit.industryCode} />
        <Meta label="Lead auditor" value={name(audit.leadAuditorUserId)} />
        <Meta label="Plant Head" value={name(audit.plantManagerUserId)} />
        <Meta label="Scheduled" value={fmtDate(audit.scheduledDate)} />
        <Meta label="Checkpoints" value={`${audit.answeredCheckpoints}/${audit.totalCheckpoints ?? "—"}`} />
        <div className="ml-auto flex gap-2">
          {isConductable && canExecute && (
            <Button asChild size="sm">
              <Link href={`/audit-compliance/${audit.id}/conduct`}>
                <PlayCircle size={16} /> {audit.status === "scheduled" ? "Start Audit" : "Continue Audit"}
              </Link>
            </Button>
          )}
          {canRequestAcceptance && <RequestAcceptanceButton auditId={audit.id} onChanged={() => router.refresh()} />}
        </div>
      </div>

      {/* Workflow stepper */}
      <WorkflowStepper status={audit.status} />

      {/* Plant Head: assign an auditee per discipline, then dispatch findings */}
      {canDispatch && (
        <DispatchPanel auditId={audit.id} responses={audit.responses} users={users} onChanged={() => router.refresh()} />
      )}

      {/* Plant Head: final acceptance of the closed audit report */}
      {canAccept && (
        <AcceptancePanel auditId={audit.id} score={dashboard?.score.overall_score_pct ?? audit.overallCompliancePct ?? null} onChanged={() => router.refresh()} />
      )}

      {/* Auditor waiting on auditees / acceptance — contextual hint */}
      {audit.status === "auditee_response" && !allFindingsAccepted && (iAmAuditor || canExecute) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Findings are with the auditees. Verify each response below as it comes in; once all are accepted you can send the report to the Plant Head for acceptance.
        </div>
      )}
      {audit.status === "pending_plant_head" && !canDispatch && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
          Submitted. Awaiting the Plant Head ({name(audit.plantManagerUserId)}) to assign auditees and dispatch the findings.
        </div>
      )}
      {audit.status === "pending_acceptance" && !canAccept && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
          All findings verified. Awaiting the Plant Head ({name(audit.plantManagerUserId)}) to accept the final audit report.
        </div>
      )}

      {/* Dashboard */}
      {dashboard && audit.answeredCheckpoints > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Overall compliance</div>
            <div className="mt-3 flex items-center gap-4">
              <Gauge pct={dashboard.score.overall_score_pct} />
              <div>
                <div className={cn("text-3xl font-extrabold tabular-nums", complianceColor(dashboard.score.overall_score_pct))}>{dashboard.score.overall_score_pct}%</div>
                {audit.auditPassed != null && (
                  <span className={cn("mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", audit.auditPassed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700")}>
                    {audit.auditPassed ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {audit.auditPassed ? "PASS" : "CONDITIONAL / FAIL"}
                  </span>
                )}
              </div>
            </div>
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

      {/* Category scores */}
      {dashboard && dashboard.score.category_scores.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Category-wise compliance</h3>
          <div className="space-y-2.5">
            {dashboard.score.category_scores.map((c) => (
              <div key={c.category_id}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-600">{c.category_name}</span>
                  <span className={cn("font-semibold tabular-nums", complianceColor(c.score_pct))}>{c.score_pct}% <span className="font-normal text-slate-400">({c.passed}✓ {c.failed}✗ of {c.total})</span></span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={cn("h-full rounded-full", complianceBg(c.score_pct))} style={{ width: `${c.score_pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checkpoint results — ALL checkpoints (pass / partial / fail / N/A),
          grouped by category, filterable. Fail/partial keep the auditee +
          plant-manager workflow inline (only while the audit is reviewable). */}
      {ordered.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-800">
              Checkpoint results <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{counts.all}</span>
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">Every checkpoint and the auditor&apos;s response. Failed / partial become findings — the Plant Head assigns an auditee, the auditee responds, and the auditor verifies.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <FilterChip label="All" count={counts.all} tone="slate" active={filter === "all"} onClick={() => setFilter("all")} />
              <FilterChip label="Pass" count={counts.pass} tone="emerald" active={filter === "pass"} onClick={() => setFilter("pass")} />
              <FilterChip label="Partial" count={counts.partial} tone="amber" active={filter === "partial"} onClick={() => setFilter("partial")} />
              <FilterChip label="Fail" count={counts.fail} tone="rose" active={filter === "fail"} onClick={() => setFilter("fail")} />
              <FilterChip label="N/A" count={counts.na} tone="slate" active={filter === "na"} onClick={() => setFilter("na")} />
              {counts.unanswered > 0 && <FilterChip label="Not assessed" count={counts.unanswered} tone="slate" active={filter === "unanswered"} onClick={() => setFilter("unanswered")} />}
            </div>
          </div>
          {groups.map((g) => (
            <div key={g.categoryId}>
              <div className="flex items-center justify-between bg-slate-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <span>{g.categoryName}</span><span className="text-slate-400">{g.items.length}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {g.items.map((r) => (
                  <FindingRow key={r.id} auditId={audit.id} r={r} me={me} userMap={userMap} canReview={(canExecute || iAmAuditor) && isReviewable} canUpdate={canUpdate && isReviewable} onChanged={() => router.refresh()} />
                ))}
              </div>
            </div>
          ))}
          {groups.length === 0 && <div className="p-6 text-center text-sm text-slate-400">No checkpoints match this filter.</div>}
        </div>
      )}

      {audit.status === "closed" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="flex items-center gap-2 font-semibold"><Lock size={15} /> Audit accepted and closed on {fmtDate(audit.closedAt)}</div>
          {audit.plantHeadAcceptance?.reviewer_user_id && (
            <p className="mt-1 text-emerald-800">Accepted by {name(audit.plantHeadAcceptance.reviewer_user_id)} (Plant Head){audit.plantHeadAcceptance.comments ? ` — ${audit.plantHeadAcceptance.comments}` : ""}.</p>
          )}
          {audit.closingRemarks && <p className="mt-1 text-emerald-800">{audit.closingRemarks}</p>}
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="font-medium text-slate-700">{value}</div>
    </div>
  );
}

function FilterChip({ label, count, tone, active, onClick }: { label: string; count: number; tone: string; active: boolean; onClick: () => void }) {
  const idle: Record<string, string> = {
    slate: "border-slate-300 text-slate-600", emerald: "border-emerald-300 text-emerald-700",
    amber: "border-amber-300 text-amber-700", rose: "border-rose-300 text-rose-700",
  };
  const on: Record<string, string> = {
    slate: "border-slate-700 bg-slate-700 text-white", emerald: "border-emerald-600 bg-emerald-600 text-white",
    amber: "border-amber-500 bg-amber-500 text-white", rose: "border-rose-600 bg-rose-600 text-white",
  };
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition", active ? on[tone] : cn("bg-white hover:bg-slate-50", idle[tone]))}>
      {label} <span className={cn("rounded-full px-1.5 text-[10px] font-bold", active ? "bg-white/25" : "bg-slate-100 text-slate-500")}>{count}</span>
    </button>
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

const WORKFLOW_STEPS = ["Conduct", "Plant Head", "Auditees", "Auditor review", "Acceptance"];
const STATUS_STEP: Record<string, number> = {
  scheduled: 0, in_progress: 0,
  pending_plant_head: 1,
  auditee_response: 2, submitted_pending_response: 2, response_in_progress: 2,
  auditor_review: 3, under_review: 3,
  pending_acceptance: 4,
  closed: 5,
};

function WorkflowStepper({ status }: { status: string }) {
  const cur = STATUS_STEP[status] ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px]">
      {WORKFLOW_STEPS.map((label, i) => {
        const done = cur > i || status === "closed";
        const active = cur === i && status !== "closed";
        return (
          <div key={label} className="flex items-center gap-1.5">
            <span className={cn("flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
              done ? "bg-emerald-500 text-white" : active ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-400")}>
              {done ? <CheckCircle2 size={12} /> : i + 1}
            </span>
            <span className={cn("font-medium", done ? "text-emerald-700" : active ? "text-violet-700" : "text-slate-400")}>{label}</span>
            {i < WORKFLOW_STEPS.length - 1 && <ChevronRight size={13} className="text-slate-300" />}
          </div>
        );
      })}
    </div>
  );
}

function RequestAcceptanceButton({ auditId, onChanged }: { auditId: string; onChanged: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    const res = await fetch(`/api/audit-compliance/${auditId}/request-acceptance`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { toast({ variant: "success", title: "Sent for acceptance", description: "The Plant Head will accept the final audit report." }); onChanged(); }
    else { toast({ variant: "error", title: "Couldn't send", description: j.detail ?? "Please try again." }); }
  }
  return (
    <Button type="button" size="sm" onClick={go} disabled={busy}>
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send for Plant Head acceptance
    </Button>
  );
}

function DispatchPanel({ auditId, responses, users, onChanged }: {
  auditId: string; responses: CheckpointResponse[]; users: PlantUser[]; onChanged: () => void;
}) {
  const { toast } = useToast();
  const findingCats = useMemo(() => {
    const m = new Map<string, { categoryId: string; categoryName: string; count: number }>();
    for (const r of responses) {
      if (r.overallStatus !== "pending_assignment") continue;
      const g = m.get(r.categoryId) ?? { categoryId: r.categoryId, categoryName: r.categoryName, count: 0 };
      g.count += 1;
      m.set(r.categoryId, g);
    }
    return [...m.values()];
  }, [responses]);
  const [assign, setAssign] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function dispatch() {
    const assignments = findingCats
      .filter((c) => assign[c.categoryId])
      .map((c) => ({ userId: assign[c.categoryId], responsibleCategories: [c.categoryId] }));
    if (!assignments.length) { toast({ variant: "error", title: "Assign at least one discipline to an auditee." }); return; }
    setBusy(true);
    const res = await fetch(`/api/audit-compliance/${auditId}/dispatch`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assignments }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { toast({ variant: "success", title: "Findings dispatched", description: `${j.routed} finding(s) routed to auditees.` }); onChanged(); }
    else { toast({ variant: "error", title: "Couldn't dispatch", description: j.detail ?? "Please try again." }); }
  }

  if (findingCats.length === 0) {
    return (
      <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 text-sm text-violet-900">
        No failed/partial findings to dispatch. You can accept this audit directly below.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-violet-900"><Users size={16} /> Assign auditees by discipline</div>
      <p className="mb-3 text-xs text-violet-700">Pick the auditee responsible for each discipline that has findings, then dispatch.</p>
      <div className="space-y-2">
        {findingCats.map((c) => (
          <div key={c.categoryId} className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-100 bg-white px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-slate-800">{c.categoryName}</div>
              <div className="text-[11px] text-slate-400">{c.count} finding{c.count > 1 ? "s" : ""}</div>
            </div>
            <Select value={assign[c.categoryId] ?? ""} onChange={(e) => setAssign((a) => ({ ...a, [c.categoryId]: e.target.value }))} className="h-9 w-56">
              <option value="">— select auditee —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role.replace(/_/g, " ")})</option>)}
            </Select>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <Button type="button" size="sm" onClick={dispatch} disabled={busy}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Dispatch findings
        </Button>
      </div>
    </div>
  );
}

function AcceptancePanel({ auditId, score, onChanged }: { auditId: string; score: number | null; onChanged: () => void }) {
  const { toast } = useToast();
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState<"accepted" | "rejected" | null>(null);
  async function decide(decision: "accepted" | "rejected") {
    setBusy(decision);
    const res = await fetch(`/api/audit-compliance/${auditId}/accept`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, comments, closingRemarks: decision === "accepted" ? "Audit report accepted by Plant Head." : "" }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) {
      toast({ variant: "success", title: decision === "accepted" ? "Audit accepted and closed" : "Sent back to the auditor", description: decision === "accepted" ? `Final compliance ${score ?? "—"}%.` : "The auditor will rework the findings." });
      onChanged();
    } else {
      toast({ variant: "error", title: "Action failed", description: j.detail ?? "Please try again." });
    }
  }
  return (
    <div className="rounded-xl border border-violet-300 bg-violet-50 p-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-violet-900"><ShieldCheck size={16} /> Plant Head — final acceptance</div>
      <p className="mb-2 text-xs text-violet-700">All findings have been verified by the auditor. Accept to close the audit, or send it back for rework.</p>
      <Input value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Acceptance comments (optional)…" />
      <div className="mt-2 flex gap-2">
        <Button type="button" variant="success" size="sm" onClick={() => decide("accepted")} disabled={!!busy}>{busy === "accepted" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Accept &amp; close</Button>
        <Button type="button" variant="destructive" size="sm" onClick={() => decide("rejected")} disabled={!!busy}>{busy === "rejected" ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Send back</Button>
      </div>
    </div>
  );
}

function FindingRow({ auditId, r, me, userMap, canReview, canUpdate, onChanged }: {
  auditId: string; r: CheckpointResponse; me: string | undefined; userMap: Record<string, string>;
  canReview: boolean; canUpdate: boolean; onChanged: () => void;
}) {
  const [open, setOpen] = useState(r.overallStatus === "pending_auditee" || r.overallStatus === "response_submitted");
  const val = r.auditorResponse?.value ?? null;
  const meta = (val && VALUE_META[val]) || { label: "Not assessed", chip: "bg-slate-100 text-slate-500", dot: "bg-slate-300" };
  const routedToMe = r.routedToUserId === me;

  return (
    <div className="px-4 py-3">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 text-left">
        <span className={cn("mt-0.5 size-2.5 shrink-0 rounded-full", meta.dot)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-slate-500">{r.checkpointCode}</span>
            {r.isCustom && <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">Added</span>}
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase", CRITICALITY_CHIP[r.criticality])}>{r.criticality}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.chip)}>{meta.label}</span>
            <span className="text-[11px] text-slate-400">{r.categoryName}</span>
            <StatusPill status={r.overallStatus} />
            {r.capa?.capa_number && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800"><AlertTriangle size={10} /> {r.capa.capa_number}</span>}
          </div>
          <div className="mt-1 text-sm text-slate-800">{r.checkpointQuestion}</div>
        </div>
        {open ? <ChevronDown size={16} className="mt-1 text-slate-400" /> : <ChevronRight size={16} className="mt-1 text-slate-400" />}
      </button>

      {open && (
        <div className="ml-5 mt-3 space-y-3 border-l-2 border-slate-100 pl-4">
          {(r.auditorResponse?.text_observation || (r.auditorResponse?.photos?.length ?? 0) > 0) && (
            <Block label="Auditor observation">
              {r.auditorResponse?.text_observation && <p className="text-slate-600">{r.auditorResponse.text_observation}</p>}
              <PhotoStrip photos={r.auditorResponse?.photos} />
            </Block>
          )}

          {r.auditeeResponse?.response_text || (r.auditeeResponse?.photos?.length ?? 0) > 0 ? (
            <Block label={`Auditee response — ${userMap[r.auditeeResponse?.respondent_user_id ?? ""] ?? ""}`}>
              <p className="text-slate-700">{r.auditeeResponse?.action_taken || r.auditeeResponse?.response_text}</p>
              <PhotoStrip photos={r.auditeeResponse?.photos} />
              {r.auditeeResponse?.action_date && <p className="mt-0.5 text-xs text-slate-400">Action date: {fmtDate(r.auditeeResponse.action_date)}</p>}
              {r.auditeeResponse?.status === "rejected" && <span className="mt-1 inline-block rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">Rejected — re-response required</span>}
            </Block>
          ) : null}

          {(r.auditorReview?.decision || r.plantManagerReview?.decision) && (() => {
            const review = r.auditorReview?.decision ? r.auditorReview : r.plantManagerReview!;
            return (
              <Block label="Auditor review">
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", review.decision === "accepted" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700")}>
                  {review.decision === "accepted" ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {review.decision}
                </span>
                {review.comments && <p className="mt-1 text-slate-600">{review.comments}</p>}
              </Block>
            );
          })()}

          {/* Auditee respond form — shown to privileged responders (canUpdate) for
              checkpoints awaiting an auditee response; the backend enforces the
              pending_auditee state. routedToMe drives the "assigned to you" hint. */}
          {canUpdate && r.overallStatus === "pending_auditee" && (
            <AuditeeForm auditId={auditId} code={r.checkpointCode} routedToMe={routedToMe} onChanged={onChanged} />
          )}

          {/* Auditor verifies the auditee response */}
          {canReview && r.overallStatus === "response_submitted" && (
            <AuditorReview auditId={auditId} code={r.checkpointCode} onChanged={onChanged} />
          )}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending_auditee: { label: "Awaiting auditee", cls: "bg-amber-100 text-amber-800" },
    response_submitted: { label: "Awaiting review", cls: "bg-sky-100 text-sky-800" },
    response_accepted: { label: "Accepted", cls: "bg-emerald-100 text-emerald-800" },
    response_rejected: { label: "Rejected", cls: "bg-rose-100 text-rose-700" },
  };
  const m = map[status];
  if (!m) return null;
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", m.cls)}>{m.label}</span>;
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="text-sm"><div className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>{children}</div>;
}

function PhotoStrip({ photos }: { photos?: { url: string; caption?: string }[] | null }) {
  if (!photos || photos.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {photos.map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <a key={i} href={p.url} target="_blank" rel="noreferrer" className="block size-16 overflow-hidden rounded-lg border border-slate-200 hover:ring-2 hover:ring-violet-300">
          <img src={p.url} alt={p.caption || `photo ${i + 1}`} className="size-full object-cover" />
        </a>
      ))}
    </div>
  );
}

function AuditeeForm({ auditId, code, routedToMe, onChanged }: { auditId: string; code: string; routedToMe?: boolean; onChanged: () => void }) {
  const { toast } = useToast();
  const [actionTaken, setActionTaken] = useState("");
  const [actionDate, setActionDate] = useState(new Date().toISOString().slice(0, 10));
  const [photos, setPhotos] = useState<{ url: string; storagePath: string; caption?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const res = await uploadAuditPhoto(file, { auditId, checkpointCode: code });
    setUploading(false);
    if (!res.ok) { toast({ variant: "error", title: "Photo upload failed", description: res.error }); return; }
    setPhotos((p) => [...p, res.photo]);
    toast({ variant: "success", title: "Evidence uploaded" });
  }

  function removePhoto(i: number) {
    const removed = photos[i];
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));
    void deleteAuditPhoto(removed?.storagePath);
  }

  async function submit() {
    if (actionTaken.trim().length < 3) { toast({ variant: "error", title: "Action required", description: "Describe the action taken (min 3 characters)." }); return; }
    setBusy(true);
    const res = await fetch(`/api/audit-compliance/${auditId}/auditee-respond`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ checkpointCode: code, responseText: actionTaken, actionTaken, actionDate, photos }),
    });
    setBusy(false);
    if (res.ok) { toast({ variant: "success", title: "Response submitted", description: "Sent to the auditor for verification." }); onChanged(); }
    else { const j = await res.json().catch(() => ({})); toast({ variant: "error", title: "Couldn't submit response", description: j.detail ?? "Please try again." }); }
  }
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-amber-800">Respond to this finding {routedToMe && <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[9px] normal-case">assigned to you</span>}</div>
      <Textarea value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} rows={2} placeholder="Action taken to remediate…" className="min-h-[56px]" />
      {photos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative size-14 overflow-hidden rounded-lg border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a href={p.url} target="_blank" rel="noreferrer" className="block size-full"><img src={p.url} alt={`evidence ${i + 1}`} className="size-full object-cover" /></a>
              <button type="button" onClick={() => removePhoto(i)} title="Remove / replace" className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-rose-600 text-white shadow ring-1 ring-white hover:bg-rose-700"><Trash2 size={10} /></button>
            </div>
          ))}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input type="date" value={actionDate} onChange={(e) => setActionDate(e.target.value)} className="h-8 w-auto text-xs" />
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />} {uploading ? "Uploading…" : `Add evidence${photos.length ? ` (${photos.length})` : ""}`}</Button>
        <Button type="button" size="sm" className="ml-auto" onClick={submit} disabled={busy}>{busy && <Loader2 size={13} className="animate-spin" />} Submit response</Button>
      </div>
    </div>
  );
}

function AuditorReview({ auditId, code, onChanged }: { auditId: string; code: string; onChanged: () => void }) {
  const { toast } = useToast();
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  async function decide(decision: "accepted" | "rejected") {
    setBusy(true);
    const res = await fetch(`/api/audit-compliance/${auditId}/auditor-review`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ checkpointCode: code, decision, comments }),
    });
    setBusy(false);
    if (res.ok) {
      toast({ variant: "success", title: decision === "accepted" ? "Response accepted" : "Response rejected", description: decision === "accepted" ? "Finding marked resolved." : "Routed back to the auditee for re-work." });
      onChanged();
    } else {
      const j = await res.json().catch(() => ({}));
      toast({ variant: "error", title: "Review failed", description: j.detail ?? "Please try again." });
    }
  }
  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-800">Auditor review — verify the auditee response</div>
      <Input value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Review comments (optional)…" />
      <div className="mt-2 flex gap-2">
        <Button type="button" variant="success" size="sm" onClick={() => decide("accepted")} disabled={busy}><CheckCircle2 size={14} /> Accept</Button>
        <Button type="button" variant="destructive" size="sm" onClick={() => decide("rejected")} disabled={busy}><XCircle size={14} /> Reject</Button>
      </div>
    </div>
  );
}
