"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Printer, Loader2, ChevronDown, FileDown,
  XCircle, AlertCircle, CheckCircle2, MinusCircle, HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AuditReport, ReportRegisterEntry, ReportRegisterPage, REPORT_RESULT_META, WORKFLOW_STATE_META, INTERACTION_LABEL,
  GRADE_META, STATUS_META, RISK_META, REQUIREMENT_TYPE_META,
  CRITICALITY_CHIP, CRITICALITY_FALLBACK, ragBar, ragText, complianceColor, fmtDate, fmtDateTime, apiErrorMessage,
} from "../../../lib";
import { useToast } from "@/components/ui/toast";
import { ReportIntegrity } from "@/components/assurance/report-integrity";
import { InsightSummary } from "./insight-summary";
import { EvidenceStrip } from "../../../evidence-strip";
import { usePermission } from "@/components/auth/can";
import type { Erratum } from "../../../../lib-assurance";

export function ReportView({
  report, userMap, auditId, errata = [],
}: {
  report: AuditReport;
  userMap: Record<string, string>;
  auditId: string;
  errata?: Erratum[];
}) {
  const s = report.snapshot;
  const isFinal = report.reportType === "FINAL";
  const canGovern = usePermission("AUDIT_COMPLIANCE.CLOSE");
  const name = (id: string | null | undefined) => (id ? userMap[id] ?? "—" : "—");
  const result = REPORT_RESULT_META[s.overallResult] ?? { label: s.overallResult, chip: "bg-slate-100 text-slate-600" };
  const pctLabel = s.overallScorePct == null ? "—" : `${s.overallScorePct}%`;
  // Server-computed (scoring_rules.grade_visibility). Absent on snapshots frozen
  // before this shipped — those keep the old rendering rather than crashing.
  const grade = s.grade;

  return (
    <div className="bg-slate-100 pb-16">
      {/* Toolbar — hidden when printing */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 print:hidden">
        <Link href={`/cams/audits/${auditId}`} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><ArrowLeft size={18} /></Link>
        <div className="text-sm font-semibold text-slate-700">{report.reportCode}</div>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", isFinal ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800")}>{report.reportType}</span>
        {report.isSuperseded && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">superseded</span>}
        {/* WP-12: the server-side PDF endpoint existed but was orphaned — the
            button print()ed the browser view instead. The generated PDF carries
            the certification-grade sections (methodology, independence,
            meetings, clause index, distribution, revision history, integrity
            digest) and the PROVISIONAL watermark on every interim page. */}
        <a
          href={`/api/audit-compliance/reports/${report.id}/pdf`}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md bg-primary-700 px-3 text-xs font-medium text-white shadow-sm hover:bg-primary-800"
        >
          <FileDown size={14} /> Download PDF
        </a>
        <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
          <Printer size={14} /> Print
        </Button>
      </div>

      {/* Record integrity — verify the snapshot hash, add an erratum, or reopen.
          Screen-only: it is a control surface, not part of the document. */}
      <div className="mx-auto mt-4 max-w-[820px] px-4 print:hidden sm:px-0">
        <ReportIntegrity
          reportId={report.id}
          auditId={auditId}
          auditClosed={!!s.closedAt}
          errata={errata}
          canGovern={canGovern}
        />
      </div>

      {/* A4 sheet */}
      <div className="report-sheet relative mx-auto my-6 max-w-[820px] bg-white p-10 shadow-sm print:my-0 print:max-w-none print:p-0 print:shadow-none">
        {!isFinal && <div className="watermark print:flex">PROVISIONAL</div>}

        {/* Header / cover */}
        <div className="border-b-2 border-primary-700 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-primary-700">SafeOps360 · Audit {isFinal ? "Final" : "Interim"} Report</div>
              <h1 className="mt-1 text-2xl font-extrabold text-slate-900">{s.title}</h1>
              <div className="mt-1 font-mono text-xs text-slate-500">{s.auditCode} · {report.reportCode}</div>
            </div>
            {/* Headline verdict — or an honest refusal to give one.
                Below the coverage floor NO grade and NO percentage render:
                "100.0% CONFORMING" over 1 of 82 checkpoints is the
                78.9%-over-0-of-82 defect with a caveat nobody reading the cover
                will see. The replacement holds the same position and weight —
                stated plainly, not visually demoted. The decision comes from
                `services/scoring_rules.grade_visibility`, server-side, so the
                cover, the PDF and the audit screen cannot disagree. */}
            <div className="text-right">
              {grade && !grade.showGrade ? (
                <>
                  <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">
                    No grade issued
                  </span>
                  <div className="mt-2 text-3xl font-extrabold tabular-nums text-slate-400">
                    {grade.assessed}<span className="text-xl font-semibold text-slate-400"> of {grade.applicable}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">assessed</div>
                </>
              ) : (
                <>
                  <span className={cn("inline-block rounded-full px-3 py-1 text-sm font-bold", result.chip)}>{result.label}</span>
                  <div className={cn("mt-2 text-3xl font-extrabold tabular-nums", complianceColor(s.overallScorePct))}>{pctLabel}</div>
                  {/* Appendix C: the assessed fraction sits AT the number, not
                      one screen down in the summary. */}
                  {grade && (
                    <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      {grade.assessed} of {grade.applicable} assessed
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-[12px] sm:grid-cols-3">
            {/* Mirrors report_pdf.py — the on-screen report and the PDF must
                name the same site, and neither prints the cuid. */}
            <Meta label="Factory / Site" value={s.plantName ?? "Unknown site"} />
            <Meta label="Audit type" value={s.auditType.replace(/_/g, " ")} />
            <Meta label="Lead auditor" value={name(s.leadAuditorId)} />
            <Meta label="Plant manager" value={name(s.plantManagerId)} />
            <Meta label="Planned date" value={fmtDate(s.plannedDate)} />
            <Meta label="Disciplines in scope" value={s.disciplinesInScopeLabel ?? `${s.disciplinesInScope.length}`} />
            <Meta label="Generated" value={fmtDateTime(s.generatedAt)} />
            {s.scopePresetUsed && <Meta label="Scope preset" value={s.scopePresetUsed} />}
          </div>
        </div>

        {/* Section 1 — insight layer, read off the frozen snapshot. Placed
            ahead of the executive summary: the register below is the record,
            but a reader who only takes in one screenful should get the one that
            says what the audit found. Absent on reports issued before the layer
            shipped — an immutable snapshot cannot be backfilled. */}
        {s.insights && <InsightSummary insights={s.insights} />}

        {/* Executive summary */}
        <Section title={isFinal ? "Executive summary" : "Provisional summary"}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Overall score" value={pctLabel} tone={complianceColor(s.overallScorePct)} />
            <Stat label="Checkpoints" value={`${s.checkpointsAssessed}/${s.checkpointsTotal}`} />
            <Stat label="Critical NCs" value={`${s.criticalFailures}`} tone={s.criticalFailures ? "text-rose-600" : "text-slate-700"} />
            <Stat label="Major NCs" value={`${s.majorFailures}`} tone={s.majorFailures ? "text-amber-600" : "text-slate-700"} />
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
            {isFinal
              ? `The audit assessed ${s.checkpointsAssessed} of ${s.checkpointsTotal} checkpoints across ${s.disciplinesInScopeLabel ?? `${s.disciplinesInScope.length} discipline(s)`}, with an overall conformance of ${pctLabel} (${result.label}). ${s.criticalFailures} critical and ${s.majorFailures} major non-conformities were identified${s.adHocCount ? `, including ${s.adHocCount} ad-hoc checkpoint(s) added during the audit` : ""}.`
              : `Provisional snapshot: ${s.checkpointsAssessed} of ${s.checkpointsTotal} checkpoints assessed. ${s.openIterationsCount} finding(s) awaiting response${s.notAssessedCount ? `, ${s.notAssessedCount} checkpoint(s) not yet assessed` : ""}. Figures are subject to change until the audit is finalized.`}
          </p>
        </Section>

        {/* Per-discipline RAG bars. Ten "Not assessed" rows is a zero-state
            chart (Appendix D bans them) — one sentence until there is data. */}
        <Section title="Discipline compliance">
          {s.categoryScores.every((c) => c.passed + c.partial + c.failed === 0) ? (
            <p className="text-[13px] italic text-slate-500">
              Category-level compliance will appear once assessment begins.
            </p>
          ) : (
          <div className="space-y-2">
            {s.categoryScores.map((c) => {
              // assessable===0 (all-NA / nothing assessed) → neutral "Not assessed",
              // not a red 0% — consistent with the live overview.
              const assessable = c.passed + c.partial + c.failed;
              const pct = assessable === 0 ? null : c.score_pct;
              return (
                <div key={c.category_id}>
                  <div className="mb-0.5 flex justify-between text-[12px]">
                    <span className="text-slate-600">{c.category_name}</span>
                    {pct == null ? (
                      <span className="font-medium text-slate-400">Not assessed <span className="font-normal">(0 of {c.total})</span></span>
                    ) : (
                      // Full outcome split, not just pass/fail: a partial earns
                      // points toward the percentage, so hiding it left the
                      // counts unable to sum to the total.
                      <span className={cn("font-semibold tabular-nums", ragText(pct))}>{pct}% <span className="font-normal text-slate-400">({c.score_obtained}/{c.score_allotted} pts · {c.passed}P {c.partial}Ptl {c.failed}F{c.na ? ` ${c.na}NA` : ""} of {c.total})</span></span>
                    )}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full", ragBar(pct))} style={{ width: pct == null ? "100%" : `${pct}%`, opacity: pct == null ? 0.4 : 1 }} /></div>
                </div>
              );
            })}
          </div>
          )}
          {/* The raw figures, kept and not cut — the chart above re-presents
              them, it does not replace them. Collapsed on screen because an
              assessor wants them and a reader scanning does not; always open
              when printing, where nothing is expandable. */}
          {s.categoryScores.some((c) => c.passed + c.partial + c.failed > 0) && (
            <Collapse label="Underlying figures" className="mt-2">
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="text-left text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="py-1 pr-2 font-medium">Discipline</th>
                      <th className="px-1 text-center font-medium">Pass</th>
                      <th className="px-1 text-center font-medium">Partial</th>
                      <th className="px-1 text-center font-medium">Fail</th>
                      <th className="px-1 text-center font-medium">N/A</th>
                      <th className="px-1 text-center font-medium">Assessed</th>
                      <th className="px-1 text-center font-medium">Points</th>
                      <th className="px-1 text-center font-medium">Score %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.categoryScores.map((c) => {
                      const assessable = c.passed + c.partial + c.failed;
                      const pct = assessable === 0 ? null : c.score_pct;
                      return (
                        <tr key={c.category_id} className="border-b border-slate-100">
                          <td className="py-1 pr-2 text-slate-700">{c.category_name}</td>
                          <td className="px-1 text-center tabular-nums">{c.passed}</td>
                          <td className="px-1 text-center tabular-nums">{c.partial}</td>
                          <td className={cn("px-1 text-center tabular-nums", c.failed ? "font-semibold text-rose-700" : "")}>{c.failed}</td>
                          <td className="px-1 text-center tabular-nums text-slate-400">{c.na}</td>
                          <td className="px-1 text-center tabular-nums">{assessable}/{c.total}</td>
                          <td className="px-1 text-center tabular-nums text-slate-500">{c.score_obtained}/{c.score_allotted}</td>
                          <td className={cn("px-1 text-center font-semibold tabular-nums", ragText(pct))}>
                            {pct == null ? "n/a" : pct}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Collapse>
          )}
        </Section>

        {/* Standards rollup (final) */}
        {isFinal && (s.standardsRollup?.length ?? 0) > 0 && (
          <Section title="Standard / clause conformance">
            <table className="w-full text-[12px]">
              <thead><tr className="border-b text-left text-slate-400"><th className="py-1 font-medium">Standard</th><th className="font-medium">Pass</th><th className="font-medium">Partial</th><th className="font-medium">Fail</th><th className="font-medium">Conformance</th></tr></thead>
              <tbody>
                {s.standardsRollup!.map((r) => (
                  <tr key={r.standard} className="border-b border-slate-50">
                    <td className="py-1 text-slate-700">{r.standard}</td><td>{r.pass}</td><td>{r.partial}</td><td>{r.fail}</td>
                    <td className={cn("font-semibold", complianceColor(r.scorePct))}>{r.scorePct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Findings register — grouped by severity, worst tier first. Same
            content as before, re-laid-out: a flat list made a reader scan every
            row to find the two that fail the audit. An unrecognised severity
            gets its own group under its own name rather than falling into a
            default bucket, so a value the grading vocabulary grows later still
            renders instead of silently vanishing. */}
        <Section title={`Findings (${s.findings.length})`}>
          {s.findings.length === 0 ? <p className="text-[13px] text-slate-400">No non-conformities recorded.</p> : (
            <div className="space-y-3">
              {groupBySeverity(s.findings).map(([sev, group]) => (
                <div key={sev} className="break-inside-avoid">
                  <div className={cn("mb-1.5 flex items-center gap-2 rounded border-l-4 px-2 py-1", SEVERITY_GROUP[sev] ?? SEVERITY_GROUP_FALLBACK)}>
                    <span className="text-[11px] font-bold uppercase tracking-wide">{sev}</span>
                    <span className="text-[11px] opacity-70">{group.length} finding{group.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="space-y-2">
              {group.map((f) => (
                <div key={f.checkpointCode} className="break-inside-avoid rounded-lg border border-slate-200 p-2.5 text-[12px]">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* State icon — FAIL/PARTIAL are what the register holds
                        today (PASS/NA raise no finding), but the map is keyed
                        off whatever the row carries rather than assuming that. */}
                    <StateMark status={f.assessmentStatus} />
                    <span className="font-mono text-slate-500">{f.checkpointCode}</span>
                    {f.requirementType && (
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase", REQUIREMENT_TYPE_META[f.requirementType].chip)}
                        title={REQUIREMENT_TYPE_META[f.requirementType].label}>
                        {REQUIREMENT_TYPE_META[f.requirementType].short}
                      </span>
                    )}
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase", CRITICALITY_CHIP[f.severity] ?? CRITICALITY_FALLBACK)}>{f.severity}</span>
                    {/* The grade and the points it cost. Absent on reports
                        frozen before this vocabulary existed — a snapshot is
                        immutable, so those rows show what they always showed
                        rather than a backfilled guess. */}
                    {f.gradeAwarded && (
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", GRADE_META[f.gradeAwarded].chip)}>
                        {GRADE_META[f.gradeAwarded].label}
                        {f.scoreAllotted != null && f.scoreObtained != null && (
                          <span className="ml-1 tabular-nums opacity-70">{f.scoreObtained}/{f.scoreAllotted}</span>
                        )}
                      </span>
                    )}
                    {f.complianceStatus && (
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", STATUS_META[f.complianceStatus].chip)}>
                        {STATUS_META[f.complianceStatus].label}
                      </span>
                    )}
                    {f.riskGrade && (
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", RISK_META[f.riskGrade].chip)}>
                        {RISK_META[f.riskGrade].label} risk
                      </span>
                    )}
                    {f.isAdHoc && <span className="rounded bg-violet-100 px-1 text-[10px] font-semibold uppercase text-violet-700">custom</span>}
                    <span className="text-slate-400">{f.discipline}</span>
                    {WORKFLOW_STATE_META[f.workflowState] && <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", WORKFLOW_STATE_META[f.workflowState].chip)}>{WORKFLOW_STATE_META[f.workflowState].label}{f.round > 0 ? ` · R${f.round}` : ""}</span>}
                    {f.capaNumber && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">{f.capaNumber}</span>}
                    {f.isRepeat && (
                      <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700">repeat</span>
                    )}
                  </div>
                  <div className="mt-1 text-slate-700">{f.question}</div>
                  {/* The observation, collapsed on screen and always open in
                      print. Collapsed by DEFAULT, never dropped: what the
                      auditor actually saw is the finding. */}
                  {f.observation && (
                    <Collapse label="Audit findings" className="mt-0.5">
                      <div className="text-slate-500">{f.observation}</div>
                    </Collapse>
                  )}
                  {(f.standard || f.requirementReference) && <div className="mt-0.5 text-[11px] text-slate-400">{[f.requirementReference, f.standard].filter(Boolean).join(" · ")}</div>}
                </div>
              ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Open iterations (interim) */}
        {!isFinal && s.openIterations.length > 0 && (
          <Section title={`Open items in iteration (${s.openIterations.length})`}>
            <div className="space-y-1 text-[12px]">
              {s.openIterations.map((o) => (
                <div key={o.checkpointCode} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-slate-500">{o.checkpointCode}</span>
                  <span className="text-slate-400">{o.discipline}</span>
                  {WORKFLOW_STATE_META[o.workflowState] && <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", WORKFLOW_STATE_META[o.workflowState].chip)}>{WORKFLOW_STATE_META[o.workflowState].label}{o.round > 0 ? ` · R${o.round}` : ""}</span>}
                  <span className="text-slate-500">→ {o.unassigned ? <span className="font-medium text-amber-600">unassigned</span> : name(o.ownerId)}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* CAPA snapshot */}
        <Section title="CAPA snapshot">
          <div className="flex gap-6 text-[13px]">
            <Stat label="Total" value={`${s.capaSummary.total}`} />
            <Stat label="Open" value={`${s.capaSummary.open}`} tone={s.capaSummary.open ? "text-amber-600" : "text-slate-700"} />
            <Stat label="Overdue" value={`${s.capaSummary.overdue}`} tone={s.capaSummary.overdue ? "text-rose-600" : "text-slate-700"} />
          </div>
        </Section>

        {/* Full checkpoint register with iteration history (final) — lazy-loaded
            (not in the snapshot, so a 1500-checkpoint report stays light). */}
        {isFinal && s.hasFullRegister && (
          <FinalRegister reportId={report.id} userMap={userMap} />
        )}

        {/* Sign-offs (final) — the RECORDED signatures, frozen at issue. A name
            with no timestamp and no signature kind is not a sign-off, so each
            entry prints all three, and roles that have not signed are named
            rather than left as an absence a reader has to notice. */}
        {isFinal && ((report.signOffs?.length ?? 0) > 0 || s.signOffSummary) && (
          <Section title="Sign-off">
            {(report.signOffs?.length ?? 0) === 0 ? (
              <p className="text-[12px] text-slate-500">No sign-off has been recorded for this audit.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {report.signOffs!.map((so, i) => (
                  <div key={i} className="border-t border-slate-300 pt-1.5 text-[12px]">
                    <div className="font-semibold text-slate-800">{so.name ?? so.typedName ?? name(so.userId)}</div>
                    <div className="text-slate-500">
                      {so.role.replace(/_/g, " ")}
                      {so.disciplineCode ? ` · ${so.disciplineCode}` : ""}
                      {so.designation ? ` · ${so.designation}` : ""}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {so.signedAt ? `Signed ${fmtDateTime(so.signedAt)}` : "Signature time not recorded"}
                      {so.signatureKind === "DRAWN" ? " · drawn signature on file"
                        : so.signatureKind === "TYPED" ? ` · typed: ${so.typedName ?? so.name ?? "—"}` : ""}
                    </div>
                    {so.statement && (
                      <div className="mt-0.5 text-[11px] italic text-slate-500">&ldquo;{so.statement}&rdquo;</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {(s.signOffSummary?.missingRequiredRoles?.length ?? 0) > 0 ? (
              <p className="mt-2 text-[11px] font-medium text-rose-700">
                Outstanding required sign-off:{" "}
                {s.signOffSummary!.missingRequiredRoles.map((r) => r.replace(/_/g, " ").toLowerCase()).join(", ")}.
              </p>
            ) : (report.signOffs?.length ?? 0) > 0 ? (
              <p className="mt-2 text-[11px] text-slate-400">
                All sign-offs required for closure were recorded.
              </p>
            ) : null}
            {(s.signOffSummary?.unsignedDisciplines?.length ?? 0) > 0 && (
              <p className="mt-1 text-[11px] text-amber-700">
                Discipline sign-off outstanding ({s.signOffSummary!.disciplinesSigned} of{" "}
                {s.signOffSummary!.disciplinesTotal} signed):{" "}
                {s.signOffSummary!.unsignedDisciplines.join(", ")}.
              </p>
            )}
          </Section>
        )}

        {/* Scope, methodology & limitations (WP-12). A certification body reads
            this BEFORE the numbers, and the limitations list is what earns
            trust — a report that states what it could not establish is more
            credible than one implying total coverage. */}
        {s.methodology && (
          <Section title="Scope, methodology & limitations">
            <dl className="space-y-1.5 text-[11px] leading-relaxed text-slate-600">
              <div>
                <dt className="inline font-semibold text-slate-700">Audit criteria: </dt>
                <dd className="inline">{s.methodology.criteria.join(", ")}</dd>
              </div>
              {s.methodology.scopeDescription && (
                <div>
                  <dt className="inline font-semibold text-slate-700">Scope: </dt>
                  <dd className="inline">{s.methodology.scopeDescription}</dd>
                </div>
              )}
              <div>
                <dt className="inline font-semibold text-slate-700">Method: </dt>
                <dd className="inline">{s.methodology.method}</dd>
              </div>
            </dl>
            <div className="mt-2">
              <div className="text-[11px] font-semibold text-slate-700">Limitations</div>
              <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-[11px] leading-relaxed text-slate-600">
                {s.methodology.limitations.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          </Section>
        )}

        {/* Independence — asserts absence explicitly (docs/cams/09 §2.1.6).
            A reader must be able to tell "no waivers were issued" from "this
            product does not track waivers". Only a sentence does that. */}
        {s.independence && (
          <Section title="Auditor independence">
            <p className="text-[11px] leading-relaxed text-slate-600">{s.independence.statement}</p>
            {s.independence.waivers?.length > 0 && (
              <div className="mt-2 space-y-2">
                {s.independence.waivers.map((w) => (
                  <div key={w.id} className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
                    <div className="font-semibold">{w.subject} — waiver granted</div>
                    {w.conflict && <div className="mt-0.5">Conflict: {w.conflict}</div>}
                    <div className="mt-0.5">Justification: {w.justification}</div>
                    <div className="mt-0.5 text-amber-700">
                      Approved by {w.approvedBy} · {fmtDateTime(w.approvedAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* Meeting records — rendered from data, or the absence stated. */}
        {s.meetings && (
          <Section title="Opening & closing meetings">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(["opening", "closing"] as const).map((k) => {
                const m = s.meetings![k];
                return (
                  <div key={k} className="text-[11px] leading-relaxed text-slate-600">
                    <div className="font-semibold text-slate-700">
                      {k === "opening" ? "Opening meeting" : "Closing meeting"}
                    </div>
                    {!m.recorded ? (
                      <div className="mt-0.5 text-slate-500">
                        No {k} meeting was recorded.
                      </div>
                    ) : (
                      <>
                        <div className="mt-0.5">{fmtDateTime(m.heldAt)}</div>
                        <div className="mt-0.5">
                          Attendees: {(m.attendees ?? []).map((a) => a.name).join(", ") || "—"}
                        </div>
                        {k === "opening" && m.scopeConfirmed && (
                          <div className="mt-0.5">Scope and criteria confirmed with the auditee.</div>
                        )}
                        {k === "closing" && (
                          <div className="mt-0.5">
                            {m.auditeeAcknowledged
                              ? `Findings acknowledged by ${m.auditeeAcknowledgedBy ?? "the auditee"}.`
                              : "Auditee acknowledgement was not recorded."}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Audit team competence at assignment. */}
        {s.competence && s.competence.length > 0 && (
          <Section title="Audit team competence">
            <ul className="space-y-0.5 text-[11px] leading-relaxed text-slate-600">
              {s.competence.map((c, i) => (
                <li key={i}>
                  {c.userName ?? c.userId} — {c.competencyName || c.competencyCode}:{" "}
                  <span className={c.held ? "text-emerald-700" : "text-rose-700"}>
                    {c.held ? "held" : "not held"}
                  </span>
                  {c.validUntil ? ` (valid to ${fmtDate(c.validUntil)})` : ""}
                  {c.externalCertificateReference ? ` · ref ${c.externalCertificateReference}` : ""}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[10px] text-slate-400">
              Recorded at assignment. Later Skill-Matrix changes do not alter this record.
            </p>
          </Section>
        )}

        {/* Reopen history — a reopened audit says so. */}
        {s.reopenHistory && (
          <Section title="Reopen history">
            <p className="text-[11px] leading-relaxed text-slate-600">
              {s.reopenHistory.statement} Last reopened {fmtDateTime(s.reopenHistory.lastReopenedAt)}
              {s.reopenHistory.lastReason ? ` — ${s.reopenHistory.lastReason}` : ""}
            </p>
          </Section>
        )}

        {/* Methodology / integrity */}
        <Section title="Methodology & integrity">
          <div className="text-[11px] leading-relaxed text-slate-500">
            {/* WP-50 / F-30: `disciplinesInScope == []` is a SENTINEL meaning
                "the full library". Rendering its raw length printed "0
                discipline(s)" on a full-scope audit. The backend now supplies a
                label derived from the materialised rows; the length fallback is
                only for reports generated before that change. */}
            Scope: {s.disciplinesInScopeLabel ?? `${s.disciplinesInScope.length} discipline(s)`}
            {s.templateId ? " · template-based" : ""}{s.adHocCount ? ` · ${s.adHocCount} ad-hoc checkpoint(s)` : ""}.
            {s.samplingApproach && s.samplingApproach !== "FULL" && (
              <> {" "}Sampling basis: {s.samplingApproach.replace(/_/g, " ").toLowerCase()}
                {s.samplingJustification ? ` — ${s.samplingJustification}` : ""}.</>
            )}
            {" "}Snapshot hash <span className="font-mono">{s.snapshotHash}</span> · generated {fmtDateTime(s.generatedAt)}.
            {!isFinal && " This is a PROVISIONAL interim report; figures are subject to change until the audit is finalized."}
          </div>
        </Section>

        {/* Data-integrity flags — a closed audit with non-terminal checkpoints is
            a defect in the RECORD, not outstanding work. Naming it honestly
            beats the old "82 open items" on a closed report (F-29). */}
        {s.dataIntegrityFlags?.length ? (
          <Section title="Data integrity">
            {s.dataIntegrityFlags.map((flag, i) => (
              <p key={i} className="text-[11px] leading-relaxed text-amber-800">
                {flag.message}
              </p>
            ))}
          </Section>
        ) : null}

        {/* Clause index (WP-12) — the index an assessor navigates by, worst
            clauses first. String-grouped on the free-text standard + clause
            pair; exact clause coverage needs WP-20's ClauseRef catalogue. */}
        {s.clauseIndex && s.clauseIndex.length > 0 && (
          <Section title="Clause index">
            {/* Provenance caveat, ABOVE the table. Most of this library's
                citations are AI drafts and the index cannot distinguish them
                from sourced ones — a reader who takes the clause column as
                verified fact has already been misled by the time they reach a
                note underneath it. */}
            {s.citationProvenance?.footnote && (
              <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-900">
                {s.citationProvenance.footnote.statement}
                {s.citationProvenance.footnote.priorityReviewCount > 0 && (
                  <>
                    {" "}
                    <strong>{s.citationProvenance.footnote.priorityReviewCount}</strong>{" "}
                    are flagged for priority review.
                  </>
                )}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="text-left text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="py-1 pr-2 font-medium">Standard</th>
                    <th className="py-1 pr-2 font-medium">Clause</th>
                    <th className="py-1 px-1 text-center font-medium">CPs</th>
                    <th className="py-1 px-1 text-center font-medium">Pass</th>
                    <th className="py-1 px-1 text-center font-medium">Fail</th>
                    <th className="py-1 px-1 text-center font-medium">Partial</th>
                    <th className="py-1 px-1 text-center font-medium">N/A</th>
                  </tr>
                </thead>
                <tbody>
                  {s.clauseIndex.slice(0, 60).map((e, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1 pr-2 text-slate-700">{e.standard}</td>
                      <td className="py-1 pr-2 text-slate-600">{e.clause}</td>
                      <td className="py-1 px-1 text-center tabular-nums">{e.total}</td>
                      <td className="py-1 px-1 text-center tabular-nums">{e.pass}</td>
                      <td className={cn("py-1 px-1 text-center tabular-nums", e.fail ? "font-semibold text-rose-700" : "")}>{e.fail}</td>
                      <td className="py-1 px-1 text-center tabular-nums">{e.partial}</td>
                      <td className="py-1 px-1 text-center tabular-nums text-slate-400">{e.na}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {s.clauseIndex.length > 60 && (
              <p className="mt-1 text-[10px] text-slate-400">
                {s.clauseIndex.length - 60} further clause row(s) in the register.
              </p>
            )}
          </Section>
        )}

        {/* Distribution list (WP-12) — who this report is issued to. */}
        {s.distributionList && s.distributionList.length > 0 && (
          <Section title="Distribution">
            <ul className="space-y-0.5 text-[11px] leading-relaxed text-slate-600">
              {s.distributionList.map((d, i) => (
                <li key={i}>
                  <span className="font-medium text-slate-700">{d.role}:</span>{" "}
                  {d.name ?? name(d.userId)}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Revision history (WP-12) — which issue this is, and what preceded it. */}
        {s.revisionHistory && s.revisionHistory.length > 0 && (
          <Section title="Revision history">
            <p className="text-[11px] text-slate-600">
              This is issue {s.revision ?? 1} of this audit&rsquo;s reports.
            </p>
            <ul className="mt-1 space-y-0.5 text-[11px] leading-relaxed text-slate-500">
              {s.revisionHistory.map((r, i) => (
                <li key={i}>
                  {r.reportCode} ({r.reportType.toLowerCase()}) — {fmtDateTime(r.generatedAt)} — superseded
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Errata — appended corrections; the snapshot above is untouched. */}
        {errata.length > 0 && (
          <Section title="Errata">
            <ol className="space-y-1.5 text-[11px] leading-relaxed text-slate-700">
              {errata.map((e) => (
                <li key={e.id}>
                  <span className="font-semibold">Erratum {e.sequence}</span> ·{" "}
                  {fmtDateTime(e.createdAt)} — {e.text}
                  <span className="text-slate-500">
                    {" "}(raised by {e.raisedBy}, approved by {e.approvedBy})
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        )}

        <div className="mt-8 border-t border-slate-200 pt-2 text-center text-[10px] text-slate-400">Confidential — SafeOps360 · {s.auditCode}</div>
      </div>

      <style jsx global>{`
        .watermark {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          font-size: 7rem; font-weight: 800; color: rgba(245, 158, 11, 0.08);
          transform: rotate(-30deg); pointer-events: none; z-index: 0;
        }
        @media print {
          @page { size: A4; margin: 14mm; }
          body { background: white; }
          .report-sheet { box-shadow: none; }
        }
      `}</style>
    </div>
  );
}

// ── Severity grouping (findings register) ────────────────────────────────
// Known tiers first, worst first; anything else keeps its own name and sorts
// after them. A default bucket would make a severity the grading vocabulary
// grows later disappear from the register, which is the one thing a
// record-of-truth may not do.
const SEVERITY_ORDER = ["critical", "major", "minor"];
const SEVERITY_GROUP: Record<string, string> = {
  critical: "border-l-rose-500 bg-rose-50 text-rose-800",
  major: "border-l-amber-500 bg-amber-50 text-amber-800",
  minor: "border-l-primary-400 bg-primary-50 text-primary-800",
};
const SEVERITY_GROUP_FALLBACK = "border-l-slate-400 bg-slate-50 text-slate-700";

function groupBySeverity<T extends { severity: string }>(items: T[]): [string, T[]][] {
  const buckets = new Map<string, T[]>();
  for (const it of items) {
    const key = (it.severity ?? "unspecified").toLowerCase();
    const list = buckets.get(key);
    if (list) list.push(it);
    else buckets.set(key, [it]);
  }
  const known = SEVERITY_ORDER.filter((k) => buckets.has(k)).map((k) => [k, buckets.get(k)!] as [string, T[]]);
  const rest = [...buckets.keys()].filter((k) => !SEVERITY_ORDER.includes(k)).sort()
    .map((k) => [k, buckets.get(k)!] as [string, T[]]);
  return [...known, ...rest];
}

// Result state as a glyph. Keyed off whatever the row carries, so a status the
// findings register does not produce today still renders if it ever does.
const STATE_MARK: Record<string, { icon: typeof XCircle; className: string; label: string }> = {
  FAIL: { icon: XCircle, className: "text-rose-600", label: "Fail" },
  PARTIAL: { icon: AlertCircle, className: "text-amber-600", label: "Partial" },
  PASS: { icon: CheckCircle2, className: "text-emerald-600", label: "Pass" },
  NA: { icon: MinusCircle, className: "text-slate-400", label: "Not applicable" },
  NOT_ASSESSED: { icon: HelpCircle, className: "text-slate-400", label: "Not assessed" },
};

function StateMark({ status }: { status: string }) {
  const meta = STATE_MARK[status];
  if (!meta) return <span className="text-[10px] uppercase text-slate-400">{status}</span>;
  const Icon = meta.icon;
  return <Icon size={13} className={cn("shrink-0", meta.className)} aria-label={meta.label} />;
}

/**
 * Collapsed on screen, always open in print.
 *
 * Deliberately NOT `<details>`: a closed `<details>` is hidden by the browser's
 * own shadow slot, which no print stylesheet on the child can override — the
 * observation text would silently vanish from every printed report. Keeping the
 * content in the DOM and toggling `display` is the only version of this that
 * prints.
 */
function Collapse({ label, className, children }: {
  label: string; className?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 print:hidden"
      >
        <ChevronDown size={11} className={cn("transition-transform", open && "rotate-180")} />
        {label}
      </button>
      <div className={cn("mt-0.5", !open && "hidden print:block")}>{children}</div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div><div className="font-medium text-slate-700">{value}</div></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="relative z-10 mt-5 break-inside-avoid">
      <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-primary-800">{title}</h2>
      {children}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={cn("text-lg font-extrabold tabular-nums", tone ?? "text-slate-800")}>{value}</div>
    </div>
  );
}

// Lazy, paginated full checkpoint register (FINAL reports). The register is not
// in the immutable snapshot — load it on demand so the report stays light even
// at 1500 checkpoints. Whatever has been loaded is included when printing.
function FinalRegister({ reportId, userMap }: { reportId: string; userMap: Record<string, string> }) {
  const { toast } = useToast();
  const name = (id: string | null | undefined) => (id ? userMap[id] ?? "—" : "—");
  const [entries, setEntries] = useState<ReportRegisterEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (cur: string | null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (cur) params.set("cursor", cur);
      const res = await fetch(`/api/audit-compliance/reports/${reportId}/register?${params.toString()}`);
      if (!res.ok) { const j = await res.json().catch(() => ({})); toast({ variant: "error", title: "Couldn't load register", description: apiErrorMessage(j, res.status) }); return; }
      const j: ReportRegisterPage = await res.json();
      setEntries((prev) => [...prev, ...j.register]);
      setCursor(j.nextCursor);
      setTotal(j.total);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [reportId, toast]);

  return (
    <Section title={`Checkpoint register${loaded ? ` (${entries.length}/${total})` : ""}`}>
      {!loaded ? (
        <Button type="button" variant="outline" size="sm" className="print:hidden" onClick={() => load(null)} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />} Load full register
        </Button>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.checkpointCode} className="break-inside-avoid rounded-lg border border-slate-200 p-2.5 text-[12px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-slate-500">{e.checkpointCode}</span>
                {e.requirementType && (
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase", REQUIREMENT_TYPE_META[e.requirementType].chip)}
                    title={REQUIREMENT_TYPE_META[e.requirementType].label}>
                    {REQUIREMENT_TYPE_META[e.requirementType].short}
                  </span>
                )}
                {/* Grade + points where the row carries them; the engine's own
                    verdict where it does not (a report frozen before the
                    grading vocabulary shipped). */}
                {e.gradeAwarded ? (
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", GRADE_META[e.gradeAwarded].chip)}>
                    {GRADE_META[e.gradeAwarded].label}
                    {e.scoreAllotted != null && e.scoreObtained != null && (
                      <span className="ml-1 tabular-nums opacity-70">{e.scoreObtained}/{e.scoreAllotted}</span>
                    )}
                  </span>
                ) : (
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase", e.assessmentStatus === "PASS" ? "bg-emerald-100 text-emerald-800" : e.assessmentStatus === "FAIL" ? "bg-rose-100 text-rose-700" : e.assessmentStatus === "PARTIAL" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500")}>{e.assessmentStatus}</span>
                )}
                {e.complianceStatus && (
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", STATUS_META[e.complianceStatus].chip)}>
                    {STATUS_META[e.complianceStatus].label}
                  </span>
                )}
                {e.riskGrade && (
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", RISK_META[e.riskGrade].chip)}>
                    {RISK_META[e.riskGrade].label} risk
                  </span>
                )}
                {e.isAdHoc && <span className="rounded bg-violet-100 px-1 text-[10px] font-semibold uppercase text-violet-700">custom</span>}
                <span className="text-slate-400">{e.discipline}</span>
                {WORKFLOW_STATE_META[e.workflowState] && <span className="text-[11px] text-slate-400">{WORKFLOW_STATE_META[e.workflowState].label}</span>}
              </div>
              <div className="mt-0.5 text-slate-700">{e.question}</div>
              {/* Collapsed by default on screen, so 120 checkpoints read as a
                  scannable index rather than one continuous block — and open in
                  full when printed, where nothing is expandable.
                  NOTHING is dropped: the observation, both evidence strips and
                  the complete iteration thread are all inside. This section is
                  the audit-trail record of truth and the redesign only changes
                  how it is laid out. */}
              {(e.observation
                || (e.auditorEvidenceIds?.length ?? 0) > 0
                || (e.auditeeEvidenceIds?.length ?? 0) > 0
                || e.interactions.length > 0) && (
                <Collapse
                  className="mt-1"
                  label={`Detail${e.interactions.length ? ` · ${e.interactions.length} iteration${e.interactions.length === 1 ? "" : "s"}` : ""}`}
                >
                  {/* What the auditor actually saw, and the photographs that
                      back it. The register printed the question and the verdict
                      and stopped, so the one thing a reader opens a register
                      FOR — the evidence behind an adverse finding — was the one
                      thing it omitted. */}
                  {e.observation && (
                    <div className="text-[11px] italic text-slate-500">{e.observation}</div>
                  )}
                  {(e.auditorEvidenceIds?.length ?? 0) > 0 && (
                    <EvidenceStrip evidenceIds={e.auditorEvidenceIds} label="Auditor evidence" size={12} />
                  )}
                  {(e.auditeeEvidenceIds?.length ?? 0) > 0 && (
                    <EvidenceStrip evidenceIds={e.auditeeEvidenceIds} label="Auditee evidence" size={12} />
                  )}
                  {e.interactions.length > 0 && (
                    <ol className="mt-1 space-y-0.5 border-l-2 border-slate-100 pl-2 text-[11px] text-slate-500">
                      {e.interactions.map((i) => (
                        <li key={i.id}>
                          <span className="font-medium text-slate-600">{INTERACTION_LABEL[i.action] ?? i.action}</span>
                          {" · "}{name(i.actorId)}{i.round > 0 ? ` · R${i.round}` : ""}{" · "}{fmtDateTime(i.timestamp)}
                          {i.comment && <span className="text-slate-400"> — {i.comment}</span>}
                        </li>
                      ))}
                    </ol>
                  )}
                </Collapse>
              )}
            </div>
          ))}
          {cursor && (
            <Button type="button" variant="outline" size="sm" className="w-full print:hidden" onClick={() => load(cursor)} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />} Load more ({total - entries.length} remaining)
            </Button>
          )}
        </div>
      )}
    </Section>
  );
}
