"use client";

/**
 * PIL/MR/F04-R1 — Internal Audit Non Conformance Report, on screen.
 *
 * The paper form is the specification, including its colours: the workbook
 * carries a legend reading "To be filled by Auditor" (yellow) and "To be filled
 * by Auditee" (accent), and every field is shaded one or the other. That legend
 * is the workflow, so this screen renders the two halves as two visibly
 * different zones and lets you edit exactly the one you currently hold.
 *
 * The form changes hands twice:
 *
 *    auditor writes the yellow half ──issue──▶ auditee writes the analysis,
 *    Correction and Preventive Action ──return──▶ auditor verifies effective
 *    closure and signs ──▶ M.R. signs and it closes.
 *
 * Editing is gated server-side (services/nc_rca_capa custody rules); this
 * screen mirrors those rules so a field you cannot save is never presented as
 * editable in the first place. A disabled control with a stated reason beats a
 * rejected save every time.
 *
 * The methodology is NOT offered as a choice. Revision R1 of the form replaced
 * its preventive-action box with a Root Cause Analysis and prints a worked
 * Why-Why ladder; the client uses that technique and no other.
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronRight, Loader2, Lock, Send, ShieldCheck, Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { apiErrorMessage, fmtDate } from "../lib";

// The form's own colours. Yellow is the auditor's half on the workbook; the
// auditee's half is the accented one. Kept as constants because they appear on
// the zone header, the field backgrounds and the legend, and three drifting
// copies of "which colour means auditor" is how a form stops being the form.
const AUDITOR_ZONE = "border-amber-300 bg-amber-50/70";
const AUDITEE_ZONE = "border-emerald-300 bg-emerald-50/60";

type WhyRow = { question: string; answer: string };

export type NcReport = {
  formNo: string;
  findingId: string;
  stage: string;
  auditorHalf: {
    auditNumber: string | null; department: string | null; date: string | null;
    managementSystem: string | null; standardClauses: { standard?: string; clause?: string }[];
    ncrNumber: string | null; clauseNo: string | null; requirements: string | null;
    observedNonconformity: string | null; evidenceNote: string | null; evidence: string[];
    grade: string | null; gradeOptions: { value: string; label: string }[];
    severity: string; leadAuditor: string | null; auditor: string | null;
    organizationRepresentative: string | null; toBeCompletedBefore: string | null;
    editable: boolean;
  };
  auditeeHalf: {
    rootCauseAnalysis: {
      rcaId: string | null; rcaCode: string | null; status: string | null;
      prompt: string; minLevels: number; methodology: string;
      problemStatement: string | null; whys: WhyRow[]; rootCause: string | null;
      dueDate: string | null; locked: boolean; problems: string[];
      suggestedFirstWhy?: string | null;
    };
    correction: { prompt: string; items: NcAction[] };
    preventiveAction: { prompt: string; items: NcAction[] };
    actionsLocked: boolean; actionsLockedReason: string | null;
  };
  closure: {
    verificationDetails: string | null; verificationResult: string | null;
    auditorSignature: string | null; auditorSignedAt: string | null;
    closedOn: string | null; mrSignature: string | null; mrSignedAt: string | null;
  };
  capa: { capaId: string | null; capaNumber: string | null; state: string | null };
  // Server's verdict on what THIS caller may edit. Rendering from the stage
  // alone offered the auditee's section to the auditor.
  viewer: {
    isAuditor: boolean; isAuditee: boolean;
    canEditAuditorHalf: boolean; canEditAuditeeHalf: boolean;
    auditeeLockReason: string | null; auditorLockReason: string | null;
  } | null;
};

export type NcAction = {
  id: string; description: string; responsibility: string | null;
  targetDate: string | null; completedOn: string | null;
  hodSignature: string | null; status: string; evidence: string | null;
};

export function NcReportForm({
  findingId, userMap, onClose, onChanged,
}: {
  findingId: string;
  userMap: Record<string, string>;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [rep, setRep] = useState<NcReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/audit-compliance/nc-reports/${findingId}`, {
        cache: "no-store",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(j, res.status));
      setRep(j as NcReport);
    } catch (e) {
      toast({
        title: "Could not load the NC report",
        description: (e as Error).message, variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [findingId, toast]);

  useEffect(() => { void load(); }, [load]);

  async function act(path: string, body?: unknown, method: "POST" | "PATCH" = "POST") {
    setBusy(path);
    try {
      const res = await fetch(`/api/audit-compliance/nc-reports/${findingId}/${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiErrorMessage(j, res.status));
      await load();
      onChanged();
      return true;
    } catch (e) {
      // The server's refusal text IS the guidance — it names the missing form
      // field or the custody rule that blocked the action, so it is surfaced
      // verbatim rather than replaced with a generic message.
      toast({ title: "Action refused", description: (e as Error).message, variant: "error" });
      return false;
    } finally {
      setBusy(null);
    }
  }

  const name = (id: string | null) => (id ? userMap[id] ?? id : "—");
  const users = Object.entries(userMap).map(([id, n]) => ({ id, name: n }));

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Internal Audit Non Conformance Report
            {rep?.auditorHalf.ncrNumber && (
              <span className="text-slate-500">· NCR {rep.auditorHalf.ncrNumber}</span>
            )}
          </DialogTitle>
          <DialogDescription>
            Format No.: {rep?.formNo ?? "PIL/MR/F04-R1"} — the auditor completes the
            yellow section and issues it; the auditee completes the analysis and
            actions; the auditor verifies effective closure.
          </DialogDescription>
        </DialogHeader>

        {loading || !rep ? (
          <div className="flex items-center gap-2 py-16 justify-center text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Loading the report…
          </div>
        ) : (
          <div className="space-y-4">
            <CustodyStrip stage={rep.stage} />
            <AuditorSection rep={rep} name={name} busy={busy} act={act} onReload={load} />
            <AuditeeSection rep={rep} name={name} busy={busy} act={act}
                            findingId={findingId} users={users} onReload={load} />
            <ClosureSection rep={rep} name={name} busy={busy} act={act} />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── custody strip: whose desk is this on ─────────────────────────── */

const FLOW = [
  { key: "WITH_AUDITOR_DRAFT", label: "Auditor drafts" },
  { key: "WITH_AUDITEE", label: "Auditee responds" },
  { key: "WITH_AUDITOR_VERIFY", label: "Auditor verifies" },
  { key: "WITH_MR", label: "M.R. signs" },
  { key: "CLOSED", label: "Closed" },
];

function CustodyStrip({ stage }: { stage: string }) {
  const at = FLOW.findIndex((f) => f.key === stage);
  return (
    <div className="flex items-center gap-1 flex-wrap rounded-lg border bg-slate-50 px-3 py-2 text-xs">
      {FLOW.map((f, i) => (
        <span key={f.key} className="flex items-center gap-1">
          <span
            className={cn(
              "rounded px-2 py-1 font-medium",
              i < at && "bg-emerald-100 text-emerald-800",
              i === at && "bg-violet-600 text-white",
              i > at && "bg-white text-slate-400 border",
            )}
          >
            {f.label}
          </span>
          {i < FLOW.length - 1 && <ChevronRight size={12} className="text-slate-300" />}
        </span>
      ))}
    </div>
  );
}

function ZoneHeader({ title, subtitle, tone }: { title: string; subtitle: string; tone: "auditor" | "auditee" }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <span
          className={cn(
            "inline-block h-3 w-3 rounded-sm border",
            tone === "auditor" ? "bg-amber-200 border-amber-400" : "bg-emerald-200 border-emerald-400",
          )}
        />
        {title}
      </div>
      <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
    </div>
  );
}

function gradeLabel(
  code: string | null,
  options: { value: string; label: string }[] | undefined,
): string {
  if (!code) return "";
  const hit = (options ?? []).find((o) => o.value === code);
  // Fall back to title-casing the code so a legacy or unknown grade still
  // reads as words rather than as an enum. No regex: this expression has
  // already lost its escapes twice in transit.
  return (
    hit?.label ??
    code
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ")
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function ReadOnly({ value }: { value: React.ReactNode }) {
  return (
    <div className="rounded border bg-white/70 px-2.5 py-1.5 text-sm text-slate-800 min-h-[34px]">
      {value || <span className="text-slate-400">—</span>}
    </div>
  );
}

/* ── the auditor's half (yellow on the workbook) ──────────────────── */

function AuditorSection({
  rep, name, busy, act, onReload,
}: {
  rep: NcReport;
  name: (id: string | null) => string;
  busy: string | null;
  act: (p: string, b?: unknown, m?: "POST" | "PATCH") => Promise<boolean>;
  onReload: () => void;
}) {
  const a = rep.auditorHalf;
  // Server-decided, for the same reason as the auditee half: an auditee
  // must never be offered the yellow section as editable.
  const editable = rep.viewer?.canEditAuditorHalf ?? false;
  const [draft, setDraft] = useState({
    requirementText: a.requirements ?? "",
    observedNonconformity: a.observedNonconformity ?? "",
    evidenceNote: a.evidenceNote ?? "",
    gradeText: a.grade ?? "",
    clauseNo: a.clauseNo ?? "",
    dueDate: a.toBeCompletedBefore ?? "",
  });
  const [recalling, setRecalling] = useState(false);
  const [reason, setReason] = useState("");

  async function save() {
    await act("auditor-section", { ...draft, dueDate: draft.dueDate || null }, "PATCH");
  }

  return (
    <section className={cn("rounded-xl border p-4", AUDITOR_ZONE)}>
      <ZoneHeader
        tone="auditor"
        title="To be filled by Auditor"
        subtitle={
          editable
            ? "Complete this section, then issue the report to the auditee. It locks on issue."
            : "Issued — locked. Recall the report to correct anything here."
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Audit Number"><ReadOnly value={a.auditNumber} /></Field>
        <Field label="Department"><ReadOnly value={a.department} /></Field>
        <Field label="Date"><ReadOnly value={fmtDate(a.date)} /></Field>
        <Field label="NCR Number"><ReadOnly value={a.ncrNumber} /></Field>
        <Field label="QMS / EMS / OHSMS / EnMS"><ReadOnly value={a.managementSystem} /></Field>
        <Field label="Clause No">
          {editable ? (
            <Input
              value={draft.clauseNo}
              onChange={(e) => setDraft({ ...draft, clauseNo: e.target.value })}
            />
          ) : <ReadOnly value={a.clauseNo} />}
        </Field>
      </div>

      <div className="grid gap-3 mt-3">
        <Field label="Requirements">
          {editable ? (
            <Textarea
              rows={2} value={draft.requirementText}
              onChange={(e) => setDraft({ ...draft, requirementText: e.target.value })}
            />
          ) : <ReadOnly value={a.requirements} />}
        </Field>
        <Field label="Observed Nonconformity">
          {editable ? (
            <Textarea
              rows={3} value={draft.observedNonconformity}
              onChange={(e) => setDraft({ ...draft, observedNonconformity: e.target.value })}
            />
          ) : <ReadOnly value={a.observedNonconformity} />}
        </Field>
        <Field label={`Evidence${a.evidence.length ? ` — ${a.evidence.length} photograph(s) attached` : ""}`}>
          {editable ? (
            <Textarea
              rows={2} value={draft.evidenceNote}
              onChange={(e) => setDraft({ ...draft, evidenceNote: e.target.value })}
            />
          ) : <ReadOnly value={a.evidenceNote} />}
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 mt-3">
        <Field label="Grade">
          {/* A controlled vocabulary, not free text. This was an open input
              showing the raw enum, which invited a typed value that no report,
              score or export could read back. */}
          {editable ? (
            <Select
              value={draft.gradeText}
              onChange={(e) => setDraft({ ...draft, gradeText: e.target.value })}
            >
              <option value="">— select —</option>
              {(a.gradeOptions ?? []).map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </Select>
          ) : (
            <ReadOnly value={gradeLabel(a.grade, a.gradeOptions)} />
          )}
        </Field>
        <Field label="Lead Auditor"><ReadOnly value={name(a.leadAuditor)} /></Field>
        <Field label="Organization Representative"><ReadOnly value={name(a.organizationRepresentative)} /></Field>
        <Field label="To be completed before">
          {editable ? (
            <Input
              type="date" value={draft.dueDate?.slice(0, 10) ?? ""}
              onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
            />
          ) : <ReadOnly value={fmtDate(a.toBeCompletedBefore)} />}
        </Field>
        <Field label="Auditor"><ReadOnly value={name(a.auditor)} /></Field>
      </div>

      <div className="flex items-center gap-2 mt-4">
        {editable ? (
          <>
            <Button variant="outline" size="sm" onClick={() => void save()} disabled={!!busy}>
              Save section
            </Button>
            <Button
              size="sm"
              onClick={async () => { if (await act("auditor-section", { ...draft, dueDate: draft.dueDate || null }, "PATCH")) void act("issue"); }}
              disabled={!!busy}
            >
              {busy ? <Loader2 size={14} className="animate-spin mr-1" /> : <Send size={14} className="mr-1" />}
              Issue to auditee
            </Button>
          </>
        ) : rep.stage !== "CLOSED" ? (
          <>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Lock size={12} /> Locked since issue — the auditee is answering this wording.
            </span>
            <Button variant="ghost" size="sm" onClick={() => setRecalling(true)} disabled={!!busy}>
              <Undo2 size={14} className="mr-1" /> Recall
            </Button>
          </>
        ) : null}
      </div>

      {recalling && (
        <Dialog open onOpenChange={(o) => { if (!o) setRecalling(false); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Recall NCR {a.ncrNumber}</DialogTitle>
              <DialogDescription>
                This takes the report back from the auditee so the auditor section can be
                corrected. Anything they have already written is kept. The reason is recorded.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              rows={3} value={reason} placeholder="Why is this being recalled?"
              onChange={(e) => setReason(e.target.value)}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRecalling(false)}>Cancel</Button>
              <Button
                disabled={reason.trim().length < 5 || !!busy}
                onClick={async () => {
                  if (await act("recall", { reason })) { setRecalling(false); setReason(""); onReload(); }
                }}
              >
                Recall report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}

/* ── the auditee's half (accented on the workbook) ────────────────── */

function AuditeeSection({
  rep, name, busy, act, findingId, users, onReload,
}: {
  rep: NcReport;
  name: (id: string | null) => string;
  busy: string | null;
  act: (p: string, b?: unknown, m?: "POST" | "PATCH") => Promise<boolean>;
  findingId: string;
  users: { id: string; name: string }[];
  onReload: () => void;
}) {
  const h = rep.auditeeHalf;
  const rca = h.rootCauseAnalysis;
  // Both tests, and the server did them: is this half open, AND is this
  // caller the party it belongs to. `stage === "WITH_AUDITEE"` alone showed
  // the auditee's analysis to the auditor as an editable form.
  const mine = rep.viewer?.canEditAuditeeHalf ?? false;
  const notYet = rep.stage === "WITH_AUDITOR_DRAFT";
  const lockReason = rep.viewer?.auditeeLockReason ?? null;

  // The ladder is edited HERE, not on /erm/rca/<id>. RCA.CREATE and RCA.READ are
  // held by HSE_MANAGER, CRO, RISK_OWNER and the admin roles — and by no
  // auditee-class role at all. Linking out sent the auditee to a screen they
  // cannot open, on the one section of the form that is theirs to fill.
  const [whys, setWhys] = useState<WhyRow[]>(
    rca.whys.length
      ? rca.whys
      : Array.from({ length: rca.minLevels }, () => ({ question: "", answer: "" })),
  );
  const [rootCause, setRootCause] = useState(rca.rootCause ?? "");
  const answered = whys.filter((w) => w.answer.trim()).length;

  async function saveAnalysis() {
    await act("analysis", { problemStatement: rca.problemStatement, whys, rootCause }, "PATCH");
    onReload();
  }

  return (
    <section className={cn("rounded-xl border p-4", AUDITEE_ZONE)}>
      <ZoneHeader
        tone="auditee"
        title="To be filled by Auditee"
        subtitle={
          notYet
            ? "Not yet issued — this opens once the auditor releases the report."
            : mine
              ? "Complete the root cause analysis, then the Correction and Preventive Action."
              : "Returned to the auditor — locked while effectiveness is verified."
        }
      />

      {!mine && lockReason && (
        <p className="flex items-center gap-2 rounded border border-dashed bg-white/60 px-3 py-4 text-sm text-slate-600">
          <Lock size={14} className="shrink-0" /> {lockReason}
        </p>
      )}

      {!notYet && (
        <>
          <div className="rounded-lg border bg-white/70 p-3">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-slate-800">Root Cause Analysis</h4>
              {/* Not a picker. The form prescribes one technique. */}
              <span className="text-[11px] rounded bg-violet-100 text-violet-800 px-1.5 py-0.5 font-medium">
                Why-Why — the only method this form accepts
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {rca.prompt} · at least {rca.minLevels} levels · {answered} answered
              {rca.dueDate ? ` · due ${fmtDate(rca.dueDate)}` : ""}
            </p>

            <div className="mt-3 space-y-2">
              <Field label="Nonconformity being analysed">
                <ReadOnly value={rca.problemStatement} />
              </Field>

              {whys.map((w, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr] items-start">
                  {mine ? (
                    <>
                      <Input
                        placeholder={i === 0 ? (rca.suggestedFirstWhy ?? "Why ...?") : `Why ${i + 1}?`}
                        value={w.question}
                        onChange={(e) => {
                          const n = [...whys];
                          n[i] = { ...n[i], question: e.target.value };
                          setWhys(n);
                        }}
                      />
                      <Input
                        placeholder="Because ..."
                        value={w.answer}
                        onChange={(e) => {
                          const n = [...whys];
                          n[i] = { ...n[i], answer: e.target.value };
                          setWhys(n);
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <ReadOnly value={w.question || `Why ${i + 1}?`} />
                      <ReadOnly value={w.answer} />
                    </>
                  )}
                </div>
              ))}

              {mine && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWhys([...whys, { question: "", answer: "" }])}
                >
                  + Add another Why
                </Button>
              )}

              <Field label="Root cause (what failed in the system)">
                {mine ? (
                  <Textarea
                    rows={2}
                    value={rootCause}
                    placeholder="Name the system that allowed this — a procedure, a control, or a review that does not exist."
                    onChange={(e) => setRootCause(e.target.value)}
                  />
                ) : (
                  <ReadOnly value={rca.rootCause} />
                )}
              </Field>
            </div>

            {rca.problems.length > 0 && mine && (
              <ul className="mt-3 space-y-1 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                {rca.problems.map((p, i) => (
                  <li key={i} className="flex gap-1.5">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {p}
                  </li>
                ))}
              </ul>
            )}

            {mine && (
              <Button size="sm" className="mt-3" onClick={() => void saveAnalysis()} disabled={!!busy}>
                {busy ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                Save analysis
              </Button>
            )}
          </div>

          <ActionBlock
            title="Correction"
            kind="CORRECTION"
            prompt={h.correction.prompt}
            items={h.correction.items}
            name={name}
            users={users}
            locked={h.actionsLocked}
            lockedReason={h.actionsLockedReason}
            editable={mine}
            findingId={findingId}
            act={act}
            busy={busy}
            onReload={onReload}
          />
          <ActionBlock
            title="Preventive Action"
            kind="PREVENTIVE"
            prompt={h.preventiveAction.prompt}
            items={h.preventiveAction.items}
            name={name}
            users={users}
            locked={h.actionsLocked}
            lockedReason={h.actionsLockedReason}
            editable={mine}
            findingId={findingId}
            act={act}
            busy={busy}
            onReload={onReload}
          />

          {mine && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <Button size="sm" onClick={() => void act("submit")} disabled={!!busy}>
                {busy ? <Loader2 size={14} className="animate-spin mr-1" /> : <Send size={14} className="mr-1" />}
                Return the completed report to the auditor
              </Button>
              <span className="text-xs text-slate-500">
                Requires the analysis, a Correction and a Preventive Action, all complete.
              </span>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ActionBlock({
  title, kind, prompt, items, name, users, locked, lockedReason,
  editable, findingId, act, busy, onReload,
}: {
  title: string;
  kind: "CORRECTION" | "PREVENTIVE";
  prompt: string;
  items: NcAction[];
  name: (id: string | null) => string;
  users: { id: string; name: string }[];
  locked: boolean;
  lockedReason: string | null;
  editable: boolean;
  findingId: string;
  act: (p: string, b?: unknown, m?: "POST" | "PATCH") => Promise<boolean>;
  busy: string | null;
  onReload: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    description: "", ownerUserId: users[0]?.id ?? "", dueDate: "", completedOn: "",
  });

  async function save() {
    const ok = await act("actions", {
      actionType: kind,
      description: draft.description,
      ownerUserId: draft.ownerUserId,
      dueDate: draft.dueDate,
      completedOn: draft.completedOn ? draft.completedOn + "T00:00:00Z" : null,
    });
    if (ok) {
      setAdding(false);
      setDraft({ description: "", ownerUserId: users[0]?.id ?? "", dueDate: "", completedOn: "" });
      onReload();
    }
  }

  return (
    <div className="rounded-lg border bg-white/70 p-3 mt-3">
      <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      <p className="text-xs text-slate-500 mt-0.5">({prompt})</p>

      {locked ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-800">
          <Lock size={12} /> {lockedReason}
        </p>
      ) : (
        <>
          {items.length === 0 ? (
            <p className="mt-2 text-xs text-slate-400">Nothing recorded yet.</p>
          ) : (
            <table className="mt-2 w-full text-xs">
              <thead className="text-slate-500">
                <tr className="text-left">
                  <th className="py-1 font-medium">Action</th>
                  <th className="py-1 font-medium">Responsibility</th>
                  <th className="py-1 font-medium">Target date</th>
                  <th className="py-1 font-medium">Completed on</th>
                  {editable ? <th className="py-1" /> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t align-top">
                    <td className="py-1.5 pr-2 text-slate-800">{it.description}</td>
                    <td className="py-1.5 pr-2">{name(it.responsibility)}</td>
                    <td className="py-1.5 pr-2">{fmtDate(it.targetDate)}</td>
                    <td className="py-1.5 pr-2">{fmtDate(it.completedOn)}</td>
                    {editable ? (
                      <td className="py-1.5 text-right">
                        <button
                          className="text-[11px] text-rose-600 hover:underline"
                          disabled={!!busy}
                          onClick={async () => {
                            await fetch(
                              `/api/audit-compliance/nc-reports/${findingId}/actions/${it.id}`,
                              { method: "DELETE" },
                            );
                            onReload();
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {editable && !adding && (
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setAdding(true)}>
              + Add {title.toLowerCase()}
            </Button>
          )}

          {editable && adding && (
            <div className="mt-2 space-y-2 rounded border bg-slate-50 p-2">
              <Field label={title + " — " + prompt}>
                <Textarea
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </Field>
              <div className="grid gap-2 sm:grid-cols-3">
                <Field label="Responsibility">
                  <Select
                    value={draft.ownerUserId}
                    onChange={(e) => setDraft({ ...draft, ownerUserId: e.target.value })}
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Target date">
                  <Input
                    type="date"
                    value={draft.dueDate}
                    onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                  />
                </Field>
                <Field label="Completed on">
                  <Input
                    type="date"
                    value={draft.completedOn}
                    onChange={(e) => setDraft({ ...draft, completedOn: e.target.value })}
                  />
                </Field>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!!busy || draft.description.trim().length < 5 || !draft.dueDate}
                  onClick={() => void save()}
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── closure: the form's last two rows ────────────────────────────── */

function ClosureSection({
  rep, name, busy, act,
}: {
  rep: NcReport;
  name: (id: string | null) => string;
  busy: string | null;
  act: (p: string, b?: unknown, m?: "POST" | "PATCH") => Promise<boolean>;
}) {
  const c = rep.closure;
  const toVerify = rep.stage === "WITH_AUDITOR_VERIFY";
  const toSign = rep.stage === "WITH_MR";
  const [details, setDetails] = useState("");
  const [result, setResult] = useState("EFFECTIVE");

  return (
    <section className={cn("rounded-xl border p-4", AUDITOR_ZONE)}>
      <ZoneHeader
        tone="auditor"
        title="Verification Details for effective closure"
        subtitle="The auditor re-checks, then signs. The M.R. signature closes the NC."
      />

      {toVerify ? (
        <div className="space-y-2">
          <Textarea
            rows={3} value={details}
            placeholder="What was re-checked, what was found, and whether the system change has held."
            onChange={(e) => setDetails(e.target.value)}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              className="w-auto"
              value={result} onChange={(e) => setResult(e.target.value)}
            >
              <option value="EFFECTIVE">Effective</option>
              <option value="PARTIALLY_EFFECTIVE">Partially effective</option>
              <option value="INEFFECTIVE">Ineffective — send back to the auditee</option>
              <option value="INCONCLUSIVE">Inconclusive</option>
            </Select>
            <Button
              size="sm" disabled={details.trim().length < 10 || !!busy}
              onClick={() => void act("verify", { verificationDetails: details, result })}
            >
              <ShieldCheck size={14} className="mr-1" /> Record verification &amp; sign
            </Button>
          </div>
          {result === "INEFFECTIVE" && (
            <p className="text-xs text-amber-800">
              This does not close the NC. The report goes back to the auditee with its
              NCR number intact, and the actions reopen.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Verification details"><ReadOnly value={c.verificationDetails} /></Field>
          <Field label="Result"><ReadOnly value={c.verificationResult} /></Field>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3 mt-3">
        <Field label="Auditor Signature">
          <ReadOnly value={c.auditorSignedAt ? `${name(c.auditorSignature)} · ${fmtDate(c.auditorSignedAt)}` : null} />
        </Field>
        <Field label="Closed On"><ReadOnly value={fmtDate(c.closedOn)} /></Field>
        <Field label="M.R. Signature">
          <ReadOnly value={c.mrSignedAt ? `${name(c.mrSignature)} · ${fmtDate(c.mrSignedAt)}` : null} />
        </Field>
      </div>

      {toSign && (
        <Button size="sm" className="mt-3" disabled={!!busy} onClick={() => void act("mr-sign")}>
          {busy ? <Loader2 size={14} className="animate-spin mr-1" /> : <CheckCircle2 size={14} className="mr-1" />}
          M.R. sign and close this NC
        </Button>
      )}
    </section>
  );
}
