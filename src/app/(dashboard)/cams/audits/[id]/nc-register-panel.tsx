"use client";

/**
 * PIL/MR/F04-R1 — Internal Audit Non Conformance Report register.
 *
 * Page issue one numbered NC report per non-conformity, and revision R1 of the
 * form replaced its preventive-action box with a Root Cause Analysis. So this
 * panel does two things the findings list cannot: it RAISES the RCA + CAPA pair
 * for every open NC in one action, and it tracks each NC through the form's own
 * lifecycle to a two-signature closure.
 *
 * The stage column is the point of the screen. An NC's real position is spread
 * across three records (the finding, its RCA, its CAPA) and nobody running a
 * closure review wants to open three tabs per row to find out whether the ball
 * is with the auditee or the auditor.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, CheckCircle2, ClipboardList, Loader2, PenLine, PlayCircle, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { usePermission } from "@/components/auth/can";
import { Chip, fmtDate, apiErrorMessage, STREAM_META, type StreamCode } from "../lib";
import { NcReportForm } from "./nc-report-form";

// Mirrors services/nc_rca_capa.NC_STAGES. Ordered as the work flows, so the
// summary strip reads left-to-right as a pipeline rather than as a legend.
//
// The label answers "who is holding this form", not "which child record
// exists". PIL/MR/F04-R1 is a document that changes hands twice, and at a
// closure review the only question asked of each row is whose desk it is on —
// a stage called "Actions pending" reads the same whether the auditee has never
// seen the report or has had it for three weeks.
const STAGE_META: Record<string, { label: string; chip: string; who: string }> = {
  NOT_RAISED: { label: "Not raised", chip: "bg-slate-100 text-slate-600", who: "No NC report raised yet" },
  WITH_AUDITOR_DRAFT: { label: "Drafting", chip: "bg-amber-100 text-amber-800", who: "With the auditor — not yet issued" },
  WITH_AUDITEE: { label: "With auditee", chip: "bg-orange-100 text-orange-800", who: "Auditee: root cause, correction, preventive action" },
  WITH_AUDITOR_VERIFY: { label: "To verify", chip: "bg-violet-100 text-violet-800", who: "Auditor: verify effective closure" },
  WITH_MR: { label: "With M.R.", chip: "bg-teal-100 text-teal-800", who: "Management Representative to sign" },
  CLOSED: { label: "Closed", chip: "bg-emerald-100 text-emerald-800", who: "Closed" },
};
const STAGE_CHIPS = Object.fromEntries(
  Object.entries(STAGE_META).map(([k, v]) => [k, v.chip]),
) as Record<string, string>;

const SEVERITY_CHIPS: Record<string, string> = {
  CRITICAL_NC: "bg-rose-100 text-rose-800",
  MAJOR_NC: "bg-orange-100 text-orange-800",
  MINOR_NC: "bg-amber-100 text-amber-800",
  OBSERVATION: "bg-slate-100 text-slate-600",
};

export type NcRow = {
  findingId: string; findingCode: string; ncrNumber: string | null;
  checkpointCode: string | null; requirement: string | null;
  department: string | null; streamCode: string | null; clauseRef: string | null;
  grade: string | null; severity: string; nonconformity: string | null;
  ownerId: string | null; stage: string;
  rcaId: string | null; rcaStatus: string | null;
  rcaDueDate: string | null; rcaOverdue: boolean;
  capaId: string | null; capaNumber: string | null; capaState: string | null;
  correctionCount: number; preventiveCount: number; openActionCount: number;
  dueDate: string | null; isOverdue: boolean; isRepeatFinding: boolean;
  verificationResult: string | null;
  auditorSignedAt: string | null; mrSignedAt: string | null; closedAt: string | null;
};

export type NcRegister = {
  auditId: string; auditNumber: string; auditTitle: string; formNo: string;
  total: number; triggered: number; closed: number; overdue: number;
  byStage: Record<string, number>;
  items: NcRow[];
};

export function NcRegisterPanel({
  auditId, userMap, canTrigger, canVerify, canSign,
}: {
  auditId: string;
  userMap: Record<string, string>;
  canTrigger: boolean;
  canVerify: boolean;
  canSign: boolean;
}) {
  // Auditees hold no CAPA.READ, so the number is a link for the audit team
  // and plain text for them — a link into a 403 is worse than no link.
  const canOpenCapa = usePermission("CAPA.READ");
  const { toast } = useToast();
  const [reg, setReg] = useState<NcRegister | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<NcRow | null>(null);
  const [openReport, setOpenReport] = useState<NcRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // no-store: this panel is re-read straight after a trigger or a signature,
      // and a replayed cache response is indistinguishable from "nothing happened".
      const res = await fetch(`/api/audit-compliance/${auditId}/nc-register`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(j, res.status));
      setReg(j as NcRegister);
    } catch (e) {
      toast({ title: "Could not load the NC register", description: (e as Error).message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auditId, toast]);

  useEffect(() => { void load(); }, [load]);

  async function trigger() {
    setBusy("trigger");
    try {
      const res = await fetch(`/api/audit-compliance/${auditId}/nc-reports/trigger`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(j, res.status));
      const parts = [`${j.created} NC report${j.created === 1 ? "" : "s"} raised`];
      if (j.skipped) parts.push(`${j.skipped} already had one`);
      if (j.failed) parts.push(`${j.failed} failed`);
      toast({
        title: parts.join(" · "),
        // Never silent about a partial failure: an audit closing with a
        // non-conformity that never got its CAPA is the failure this reports.
        description: j.failed
          ? (j.failures ?? []).map((f: { findingCode: string; reason: string }) => `${f.findingCode}: ${f.reason}`).join(" · ")
          : "Each non-conformity now has a Why-Why analysis and a CAPA. Complete the auditor section, then issue each report to its auditee.",
        variant: j.failed ? "error" : undefined,
      });
      await load();
    } catch (e) {
      toast({ title: "Could not raise the NC reports", description: (e as Error).message, variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function mrSign(row: NcRow) {
    setBusy(row.findingId);
    try {
      const res = await fetch(`/api/audit-compliance/nc-reports/${row.findingId}/mr-sign`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(j, res.status));
      toast({ title: `NCR ${row.ncrNumber} closed`, description: "M.R. signature recorded." });
      await load();
    } catch (e) {
      toast({ title: "Could not sign off", description: (e as Error).message, variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  const untriggered = (reg?.items ?? []).filter((r) => !r.ncrNumber).length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-4 text-violet-600" />
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Non Conformance Reports</h3>
            <p className="text-[11px] text-slate-500">
              {reg?.formNo ?? "PIL/MR/F04-R1"} · root cause analysis, correction and preventive action per NC
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("mr-1.5 size-3.5", loading && "animate-spin")} /> Refresh
          </Button>
          {canTrigger && untriggered > 0 && (
            <Button size="sm" onClick={() => void trigger()} disabled={busy === "trigger"}>
              {busy === "trigger"
                ? <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                : <PlayCircle className="mr-1.5 size-3.5" />}
              Raise {untriggered} NC report{untriggered === 1 ? "" : "s"}
            </Button>
          )}
        </div>
      </header>

      {loading && !reg ? (
        <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" /> Loading the register…
        </div>
      ) : !reg || reg.total === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-500">
          <CheckCircle2 className="mx-auto mb-2 size-6 text-emerald-500" />
          {/* Only ever shown when the audit genuinely has no failed checkpoint.
              It used to show whenever no NC REPORT existed yet, which on an
              audit full of non-conformities was simply false. */}
          No checkpoint was answered Non-Conformance in this audit.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-4">
            <Tile label="Non-conformities" value={reg.total} />
            <Tile label="NC reports raised" value={reg.triggered} tone={reg.triggered < reg.total ? "text-amber-600" : undefined} />
            <Tile label="Closed" value={reg.closed} tone="text-emerald-600" />
            <Tile label="Overdue" value={reg.overdue} tone={reg.overdue ? "text-rose-600" : undefined} />
          </div>

          {untriggered > 0 && (
            <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-900">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {untriggered} non-conformit{untriggered === 1 ? "y has" : "ies have"} no NC report.
                {canTrigger
                  ? " Trigger raises a Why-Why analysis and a CAPA for each — safe to press again, already-raised NCs are skipped."
                  : " Ask the lead auditor to raise them."}
              </span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-[12px]">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">NCR</th>
                  <th className="px-3 py-2 font-semibold">Department · Clause</th>
                  <th className="px-3 py-2 font-semibold">Nonconformity</th>
                  <th className="px-3 py-2 font-semibold">Stage</th>
                  <th className="px-3 py-2 font-semibold">RCA</th>
                  <th className="px-3 py-2 font-semibold">Correction / Preventive</th>
                  <th className="px-3 py-2 font-semibold">Complete before</th>
                  <th className="px-3 py-2 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reg.items.map((r) => {
                  const stage = STAGE_META[r.stage] ?? { label: r.stage, chip: "bg-slate-100 text-slate-600", who: "" };
                  return (
                    <tr key={r.findingId} className="align-top hover:bg-slate-50/70">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="font-semibold tabular-nums text-slate-800">
                          {r.ncrNumber ? `NCR ${r.ncrNumber}` : "—"}
                        </div>
                        <div className="text-[10px] text-slate-400">{r.findingCode}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Chip map={SEVERITY_CHIPS} value={r.severity} />
                          {r.isRepeatFinding && (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-800">
                              Repeat
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-slate-700">{r.department ?? "—"}</div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {r.streamCode && (
                            <span className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                              STREAM_META[r.streamCode as StreamCode]?.chip ?? "bg-slate-100 text-slate-600",
                            )}>
                              {STREAM_META[r.streamCode as StreamCode]?.label ?? r.streamCode}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-500">{r.clauseRef ?? "—"}</span>
                        </div>
                      </td>
                      <td className="max-w-[280px] px-3 py-2.5">
                        <p className="line-clamp-3 text-slate-600">{r.nonconformity || r.requirement || "—"}</p>
                        <div className="mt-0.5 text-[10px] text-slate-400">
                          {r.checkpointCode} · owner {r.ownerId ? (userMap[r.ownerId] ?? "—") : "unassigned"}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Chip map={STAGE_CHIPS} value={r.stage} label={stage.label} />
                        <div className="mt-1 text-[10px] text-slate-400">{stage.who}</div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {r.rcaId ? (
                          <>
                            {/* Deliberately NOT a link. RCA.READ is held by no
                                auditee-class role, so linking here offered half
                                the register's readers a 403. The NC report is
                                the one door into this record. */}
                            <span className="font-medium text-violet-700">
                              {r.rcaStatus?.replace(/_/g, " ").toLowerCase() ?? "draft"}
                            </span>
                            <div className={cn("mt-0.5 text-[10px]", r.rcaOverdue ? "font-semibold text-rose-600" : "text-slate-400")}>
                              due {fmtDate(r.rcaDueDate)}
                            </div>
                          </>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {r.capaId ? (
                          <>
                            {/* Linked only for people who can actually open it.
                                CAPA.READ excludes SUPERVISOR, SAFETY_OFFICER and
                                WORKER, so for an auditee this stays a plain
                                reference rather than a link into a 403. */}
                            {canOpenCapa ? (
                              <Link
                                href={`/capa/${r.capaId}`}
                                className="font-medium text-sky-700 hover:underline"
                              >
                                {r.capaNumber}
                              </Link>
                            ) : (
                              <span className="font-medium text-sky-700">{r.capaNumber}</span>
                            )}
                            <div className="mt-0.5 text-[10px] text-slate-500 tabular-nums">
                              {r.correctionCount} correction · {r.preventiveCount} preventive
                              {r.openActionCount > 0 && (
                                <span className="ml-1 font-semibold text-amber-600">({r.openActionCount} open)</span>
                              )}
                            </div>
                          </>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={cn(r.isOverdue && "font-semibold text-rose-600")}>{fmtDate(r.dueDate)}</span>
                        {r.closedAt && (
                          <div className="mt-0.5 text-[10px] text-emerald-600">closed {fmtDate(r.closedAt)}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {/* One door. Every stage of PIL/MR/F04-R1 is worked on
                            the form itself, which shows both halves and enables
                            only the one whose turn it is — so the register does
                            not have to grow a different button per stage, and a
                            reader is never asked to know that "Verify closure"
                            and "Open analysis" are two ends of one document. */}
                        {r.ncrNumber ? (
                          <Button size="sm" variant="outline" onClick={() => setOpenReport(r)}>
                            Open NC report
                          </Button>
                        ) : (
                          <span className="text-[11px] text-slate-400">Raise the NC report first</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {openReport && (
        <NcReportForm
          findingId={openReport.findingId}
          userMap={userMap}
          onClose={() => setOpenReport(null)}
          onChanged={() => void load()}
        />
      )}

      {verifying && (
        <VerifyDialog
          row={verifying}
          onClose={() => setVerifying(null)}
          onDone={async () => { setVerifying(null); await load(); }}
        />
      )}
    </section>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <div className={cn("text-lg font-extrabold tabular-nums text-slate-800", tone)}>{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

/**
 * Form row 26 — "Verification Details for effective closure", the auditor's half.
 *
 * INEFFECTIVE is offered as a first-class outcome rather than hidden behind a
 * "reject" link: a re-check that found the nonconformity still there is a
 * normal result, and it reopens the CAPA instead of closing the NC.
 */
function VerifyDialog({
  row, onClose, onDone,
}: { row: NcRow; onClose: () => void; onDone: () => Promise<void> }) {
  const { toast } = useToast();
  const [details, setDetails] = useState("");
  const [result, setResult] = useState("EFFECTIVE");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/audit-compliance/nc-reports/${row.findingId}/verify`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ verificationDetails: details, result }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(j, res.status));
      toast({
        title: j.reopened ? `NCR ${row.ncrNumber} reopened` : `NCR ${row.ncrNumber} verified`,
        description: j.reopened
          ? "The CAPA is back with the auditee for further action."
          : "Awaiting the M.R. signature to close.",
      });
      await onDone();
    } catch (e) {
      toast({ title: "Could not record verification", description: (e as Error).message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Verification of effective closure — NCR {row.ncrNumber}</DialogTitle>
          <DialogDescription>
            PIL/MR/F04-R1 row 26. Your signature is recorded against this verification;
            the M.R. signs afterwards to close the non-conformity.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Result</label>
            <Select value={result} onChange={(e) => setResult(e.target.value)}>
              <option value="EFFECTIVE">Effective — the nonconformity has not recurred</option>
              <option value="PARTIALLY_EFFECTIVE">Partially effective</option>
              <option value="INCONCLUSIVE">Inconclusive</option>
              <option value="INEFFECTIVE">Ineffective — reopens the CAPA</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Verification details</label>
            <Textarea
              rows={4} value={details} onChange={(e) => setDetails(e.target.value)}
              placeholder="What you re-checked, when, and what you saw. e.g. Re-checked the FY26 objective register on 12 Aug; objectives updated and approved in the July MRM."
            />
            <p className="mt-1 text-[11px] text-slate-400">{details.trim().length}/10 characters minimum</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={saving || details.trim().length < 10}>
            {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            Record verification
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
