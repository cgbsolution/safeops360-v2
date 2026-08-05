"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, ListChecks, AlertTriangle, FileText, Loader2, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ENGAGEMENT_STATUS_CHIP, RESULT_CHIP, SEVERITY_CHIP, FINDING_STATUS_CHIP,
  fmtDate, labelize, engagementTypeLabel,
  type Engagement, type ChecklistRunner, type Finding, type Template, type RunnerQuestion,
} from "../../lib-cams";

type Perms = { schedule: boolean; execute: boolean; close: boolean; findingManage: boolean };
type Answer = { value?: unknown; conformance?: string | null; note?: string; ncSeverity?: string | null; evidenceAttachmentIds?: string[] };

const NC_SEVERITIES = ["OBSERVATION", "MINOR_NC", "MAJOR_NC", "CRITICAL_NC"];

export function EngagementWorkspace({
  engagement, runner, findings, approvedTemplates, perms,
}: {
  engagement: Engagement;
  runner: ChecklistRunner | null;
  findings: Finding[];
  approvedTemplates: Template[];
  perms: Perms;
}) {
  const [tab, setTab] = useState<"plan" | "execute" | "findings" | "capa">(
    engagement.status === "IN_PROGRESS" ? "execute" : findings.length ? "findings" : "plan"
  );

  const tabs = [
    { key: "plan" as const, label: "Plan", icon: ClipboardList },
    { key: "execute" as const, label: "Execute", icon: ListChecks },
    { key: "findings" as const, label: `Findings (${findings.length})`, icon: AlertTriangle },
    { key: "capa" as const, label: "Report / CAPA", icon: FileText },
  ];

  return (
    <div>
      <EngagementHeader engagement={engagement} perms={perms} />
      <div className="mt-4 flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <Button key={t.key} type="button" variant="ghost" onClick={() => setTab(t.key)}
            className={cn(
              "h-auto flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key ? "border-primary-700 text-primary-700" : "border-transparent text-slate-500 hover:text-slate-800"
            )}>
            <t.icon size={15} /> {t.label}
          </Button>
        ))}
      </div>

      <div className="py-5">
        {tab === "plan" && <PlanTab engagement={engagement} approvedTemplates={approvedTemplates} perms={perms} />}
        {tab === "execute" && <ExecuteTab engagement={engagement} runner={runner} perms={perms} />}
        {tab === "findings" && <FindingsTab engagement={engagement} findings={findings} perms={perms} />}
        {tab === "capa" && <CapaTab engagement={engagement} findings={findings} />}
      </div>
    </div>
  );
}

// ── header + transitions ──────────────────────────────────────────────────
function EngagementHeader({ engagement, perms }: { engagement: Engagement; perms: Perms }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function transition(toStatus: string) {
    setBusy(true); setErr(null);
    const res = await fetch(`/api/cams/engagements/${engagement.id}/transition`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ toStatus }),
    });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.detail || j.error || `Failed (${res.status})`); return; }
    router.refresh();
  }

  // Status → the transitions surfaced as buttons here (matches backend _TRANSITIONS).
  const actions: { to: string; label: string; show: boolean; tone?: string }[] = [
    { to: "SCHEDULED", label: "Confirm schedule", show: engagement.status === "PLANNED" && perms.schedule },
    { to: "IN_PROGRESS", label: "Start fieldwork", show: engagement.status === "SCHEDULED" && perms.execute },
    { to: "FINDINGS_REVIEW", label: "Move to findings review", show: engagement.status === "FIELDWORK_COMPLETE" && perms.close },
    { to: "REPORT_ISSUED", label: "Issue report", show: engagement.status === "FINDINGS_REVIEW" && perms.close },
    { to: "CLOSED", label: "Close engagement", show: engagement.status === "REPORT_ISSUED" && perms.close, tone: "emerald" },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      {err && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <span className={"rounded border px-2 py-0.5 text-xs " + (ENGAGEMENT_STATUS_CHIP[engagement.status] ?? "")}>{labelize(engagement.status)}</span>
        <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">{engagementTypeLabel(engagement.engagementType)}</span>
        {engagement.overallResult && (
          <span className={"rounded border px-2 py-0.5 text-xs " + (RESULT_CHIP[engagement.overallResult] ?? "")}>
            {labelize(engagement.overallResult)}{engagement.scorePercent != null ? ` · ${engagement.scorePercent}%` : ""}
          </span>
        )}
        {engagement.sourceModule && <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">raised via {engagement.sourceModule}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          {actions.filter((a) => a.show).map((a) => (
            <Button key={a.to} type="button" variant={a.tone === "emerald" ? "success" : "default"} disabled={busy} onClick={() => transition(a.to)}
              className="inline-flex items-center gap-1.5 text-sm font-medium disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {a.label}
            </Button>
          ))}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <Meta label="Site" value={engagement.siteName} />
        <Meta label="Lead auditor" value={engagement.leadAuditorName} />
        <Meta label="Auditee owner" value={engagement.auditeeOwnerName} />
        <Meta label="Planned" value={fmtDate(engagement.plannedDate)} />
        <Meta label="Template" value={engagement.templateName ? `${engagement.templateName}${engagement.templateVersionUsed ? ` (v${engagement.templateVersionUsed})` : ""}` : "—"} />
        <Meta label="Standards" value={engagement.standardRefs.map((s) => s.replace("_", " ")).join(", ") || "—"} />
        <Meta label="Conducted" value={fmtDate(engagement.conductedDate)} />
        <Meta label="Findings" value={`${engagement.openFindingCount}/${engagement.findingCount} open`} />
      </dl>
      {engagement.scopeStatement && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{engagement.scopeStatement}</p>}
    </div>
  );
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="text-slate-700">{value || "—"}</dd>
    </div>
  );
}

// ── Plan tab ────────────────────────────────────────────────────────────────
function PlanTab({ engagement, approvedTemplates, perms }: { engagement: Engagement; approvedTemplates: Template[]; perms: Perms }) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(engagement.templateId ?? "");
  const [busy, setBusy] = useState(false);
  const editable = ["PLANNED", "SCHEDULED"].includes(engagement.status) && perms.schedule;

  async function saveTemplate() {
    setBusy(true);
    await fetch(`/api/cams/engagements/${engagement.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ templateId: templateId || null }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">Checklist template</h3>
        <p className="mb-3 text-xs text-slate-500">The approved template snapshots onto the engagement when fieldwork starts; later template edits never alter a conducted audit.</p>
        {editable ? (
          <div className="flex items-center gap-2">
            <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="flex-1">
              <option value="">— none —</option>
              {approvedTemplates.map((t) => <option key={t.id} value={t.id}>{t.templateCode} · {t.name} (v{t.version})</option>)}
            </Select>
            <Button type="button" variant="default" disabled={busy} onClick={saveTemplate} className="text-sm font-medium disabled:opacity-50">Save</Button>
          </div>
        ) : (
          <p className="text-sm text-slate-700">{engagement.templateName ?? "No template assigned."}</p>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Team & scope</h3>
        <p><span className="text-slate-400">Lead:</span> {engagement.leadAuditorName ?? "—"} · <span className="text-slate-400">Auditee owner:</span> {engagement.auditeeOwnerName ?? "—"}</p>
        <p className="mt-1">{engagement.scopeStatement || "No scope statement recorded."}</p>
      </div>
    </div>
  );
}

// ── Execute tab (Checklist Runner — C-06) ────────────────────────────────────
function ExecuteTab({ engagement, runner, perms }: { engagement: Engagement; runner: ChecklistRunner | null; perms: Perms }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => {
    const init: Record<string, Answer> = {};
    runner?.sections.forEach((s) => s.questions.forEach((q) => {
      init[q.id] = {
        value: q.value, conformance: q.conformance ?? null, note: q.note ?? "",
        ncSeverity: null, evidenceAttachmentIds: q.evidenceAttachmentIds ?? [],
      };
    }));
    return init;
  });
  const [busy, setBusy] = useState<null | "save" | "complete">(null);
  const [err, setErr] = useState<string | null>(null);

  if (!runner) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Assign an approved template on the Plan tab, then start fieldwork to execute the checklist.</div>;
  }
  const canExecute = perms.execute && engagement.status === "IN_PROGRESS";
  const readOnly = !canExecute;

  function setAns(qid: string, patch: Partial<Answer>) {
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));
  }

  async function save(complete: boolean) {
    setBusy(complete ? "complete" : "save"); setErr(null);
    const payload = {
      complete,
      answers: Object.entries(answers).map(([questionId, a]) => ({
        questionId, value: a.value ?? null, conformance: a.conformance ?? null,
        note: a.note ?? "", ncSeverity: a.conformance === "NC" ? (a.ncSeverity ?? "MINOR_NC") : null,
        evidenceAttachmentIds: a.evidenceAttachmentIds ?? [],
      })),
    };
    const res = await fetch(`/api/cams/engagements/${engagement.id}/checklist`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    });
    setBusy(null);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.detail || j.error || `Failed (${res.status})`); return; }
    router.refresh();
  }

  const answered = Object.values(answers).filter((a) => a.conformance || a.value != null && a.value !== "").length;
  const total = runner.sections.reduce((n, s) => n + s.questions.length, 0);

  return (
    <div className="space-y-4">
      {err && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <span className="font-medium text-slate-700">{runner.templateName}</span>
        <span className="text-slate-400">·</span>
        <span className="tabular-nums text-slate-600">{answered}/{total} answered</span>
        {runner.scorePercent != null && <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs">Score {runner.scorePercent}%</span>}
        {canExecute && (
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="outline" disabled={!!busy} onClick={() => save(false)} className="text-sm disabled:opacity-50">
              {busy === "save" ? "Saving…" : "Save progress"}
            </Button>
            <Button type="button" variant="success" disabled={!!busy} onClick={() => save(true)} className="text-sm font-medium disabled:opacity-50">
              {busy === "complete" ? "Finalising…" : "Complete fieldwork"}
            </Button>
          </div>
        )}
        {readOnly && <span className="ml-auto text-xs text-slate-400">Read-only ({labelize(engagement.status)})</span>}
      </div>

      {runner.sections.map((s) => (
        <div key={s.id} className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800">
            {s.title} {s.weightPct != null && <span className="ml-1 text-xs font-normal text-slate-400">weight {s.weightPct}%</span>}
          </div>
          <div className="divide-y divide-slate-100">
            {s.questions.map((q) => (
              <QuestionRow key={q.id} q={q} ans={answers[q.id] ?? {}} readOnly={readOnly} onChange={(p) => setAns(q.id, p)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function QuestionRow({ q, ans, readOnly, onChange }: { q: RunnerQuestion; ans: Answer; readOnly: boolean; onChange: (p: Partial<Answer>) => void }) {
  const conformanceMode = q.questionType === "CONFORM_NC_NA" || q.questionType === "YES_NO_NA";
  const labels = q.questionType === "YES_NO_NA" ? { CONFORM: "Yes", NC: "No", NA: "N/A" } : { CONFORM: "Conform", NC: "NC", NA: "N/A" };
  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-800">{q.text}{q.isMandatory && <span className="ml-1 text-rose-500">*</span>}</p>
          <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-slate-400">
            {q.standardClauseRef && <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700">{q.standardClauseRef}</span>}
            {q.guidance && <span className="italic">{q.guidance}</span>}
          </div>
        </div>
        {conformanceMode && (
          <div className="flex shrink-0 gap-1">
            {(["CONFORM", "NC", "NA"] as const).map((c) => (
              <Button key={c} type="button" variant="ghost" disabled={readOnly} onClick={() => onChange({ conformance: c })}
                className={cn(
                  "h-auto rounded border px-2 py-1 text-xs font-medium disabled:opacity-60",
                  ans.conformance === c
                    ? (c === "CONFORM" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : c === "NC" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-400 bg-slate-100 text-slate-600")
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-400"
                )}>
                {labels[c]}
              </Button>
            ))}
          </div>
        )}
      </div>

      {!conformanceMode && (
        <div className="mt-2">
          {q.questionType === "NUMERIC" || q.questionType === "RATING_SCALE" ? (
            <Input type="number" disabled={readOnly} value={(ans.value as number) ?? ""} onChange={(e) => onChange({ value: e.target.value === "" ? null : Number(e.target.value) })}
              className="w-32" placeholder="value" />
          ) : q.questionType === "SINGLE_SELECT" || q.questionType === "MULTI_SELECT" ? (
            <Select disabled={readOnly} value={(ans.value as string) ?? ""} onChange={(e) => onChange({ value: e.target.value })}>
              <option value="">— select —</option>
              {(q.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          ) : (
            <Textarea disabled={readOnly} value={(ans.value as string) ?? ""} onChange={(e) => onChange({ value: e.target.value })} rows={2}
              placeholder={q.questionType.includes("PHOTO") || q.questionType === "SIGNATURE" ? "Capture stubbed — record a note" : "Response"} />
          )}
        </div>
      )}

      {ans.conformance === "NC" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-rose-50/60 p-2">
          <span className="text-[11px] font-medium text-rose-700">NC severity</span>
          <Select disabled={readOnly} value={ans.ncSeverity ?? "MINOR_NC"} onChange={(e) => onChange({ ncSeverity: e.target.value })} className="border-rose-200 text-xs">
            {NC_SEVERITIES.map((s) => <option key={s} value={s}>{labelize(s)}</option>)}
          </Select>
          {q.ncTriggersFinding && <span className="text-[11px] text-rose-600">→ a finding will be raised on completion{q.evidenceRequiredOnNc ? " (evidence required)" : ""}</span>}
        </div>
      )}

      {(ans.conformance === "NC" || conformanceMode) && (
        <Input disabled={readOnly} value={ans.note ?? ""} onChange={(e) => onChange({ note: e.target.value })}
          className="mt-2 border-slate-200 text-xs" placeholder="Note / observation" />
      )}
    </div>
  );
}

// ── Findings tab ──────────────────────────────────────────────────────────
function FindingsTab({ engagement, findings, perms }: { engagement: Engagement; findings: Finding[]; perms: Perms }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function raiseCapa(id: string) {
    setBusy(id);
    await fetch(`/api/cams/findings/${id}/raise-capa`, { method: "POST" });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {findings.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          No findings yet. Non-conforming checklist answers raise findings automatically when fieldwork completes.
        </div>
      ) : (
        findings.map((f) => (
          <div key={f.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/cams/findings/${f.id}`} className="font-medium text-primary-700 hover:underline">{f.findingCode}</Link>
              <span className={"rounded border px-2 py-0.5 text-[11px] " + (SEVERITY_CHIP[f.severity] ?? "")}>{labelize(f.severity)}</span>
              <span className={"rounded border px-2 py-0.5 text-[11px] " + (FINDING_STATUS_CHIP[f.status] ?? "")}>{labelize(f.status)}</span>
              {f.standardClauseRef && <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-700">{f.standardClauseRef}</span>}
              {f.isRepeatFinding && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">Repeat</span>}
              <div className="ml-auto flex items-center gap-2">
                {f.capaNumber ? (
                  <Link href="/capa" className="rounded bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 hover:underline">{f.capaNumber} · {labelize(f.capaState ?? "")}</Link>
                ) : perms.findingManage ? (
                  <Button type="button" variant="default" disabled={busy === f.id} onClick={() => raiseCapa(f.id)}
                    className="text-xs font-medium disabled:opacity-50">
                    {busy === f.id ? "Raising…" : "Raise CAPA"}
                  </Button>
                ) : null}
              </div>
            </div>
            <p className="mt-1.5 text-sm font-medium text-slate-800">{f.title}</p>
            {f.description && <p className="text-sm text-slate-600">{f.description}</p>}
            {f.capaRequired && !f.capaId && <p className="mt-1 text-[11px] text-rose-600">A CAPA is required before this {labelize(f.severity)} finding (and the engagement) can close.</p>}
          </div>
        ))
      )}
    </div>
  );
}

// ── Report / CAPA tab ─────────────────────────────────────────────────────
function CapaTab({ engagement, findings }: { engagement: Engagement; findings: Finding[] }) {
  const withCapa = findings.filter((f) => f.capaId);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Corrective actions (AUDIT source)</h3>
        {withCapa.length === 0 ? (
          <p className="text-slate-500">No CAPAs raised from this engagement yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {withCapa.map((f) => (
              <li key={f.id} className="flex items-center gap-3 py-2">
                <Link href={`/cams/findings/${f.id}`} className="text-primary-700 hover:underline">{f.findingCode}</Link>
                <span className="min-w-0 flex-1 truncate text-slate-600">{f.title}</span>
                <Link href="/capa" className="rounded bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 hover:underline">{f.capaNumber} · {labelize(f.capaState ?? "")}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">Closure gate</h3>
        <p>An engagement can only reach <strong>Closed</strong> once every Major/Critical finding carries a CAPA and all findings are resolved. The same eight-source CAPA engine that runs incidents and risk treatments owns these actions — finding → root cause → corrective action → verification, one chain.</p>
      </div>
    </div>
  );
}
