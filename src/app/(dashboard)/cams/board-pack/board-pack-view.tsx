"use client";

import type { BoardPack } from "../lib-cams";
import { PrintButton } from "@/components/ui/print-button";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="mb-3 border-b border-slate-300 pb-1 text-sm font-bold uppercase tracking-wide text-slate-700">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, tone = "text-slate-900" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 print:bg-white">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-0.5 text-xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

const SEV_LABEL: Record<string, string> = {
  OBSERVATION: "Observations",
  OPPORTUNITY_FOR_IMPROVEMENT: "OFIs",
  MINOR_NC: "Minor NC",
  MAJOR_NC: "Major NC",
  CRITICAL_NC: "Critical NC",
};

export function BoardPackView({ pack }: { pack: BoardPack }) {
  const prog = pack.programme;
  const generated = pack.generatedAt ? new Date(pack.generatedAt).toLocaleString() : "—";
  const worstClauses = [...pack.clauseConformance].sort((a, b) => a.conformancePct - b.conformancePct).slice(0, 8);

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 print:p-0">
      {/* Cover / header */}
      <header className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Management Review &amp; Certification-Readiness Pack</div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">CAMS Board Pack — {pack.periodLabel}</h1>
          <div className="mt-1 text-sm text-slate-600">Meridian Manufacturing Limited · Compliance &amp; Audit Management System</div>
        </div>
        <PrintButton label="Print / Save PDF" />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>Generated: {generated}</span>
        <span>Obligations register: {pack.compliance.obligationsSource ?? "—"}</span>
        {pack.snapshotHash && <span className="font-mono">Integrity: {pack.snapshotHash.slice(0, 16)}…</span>}
      </div>

      <Section title="1 · Audit Programme Completion">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Planned" value={prog.total} />
          <Stat label="Completion" value={`${prog.completionRatePct}%`} tone={prog.completionRatePct >= 80 ? "text-emerald-700" : "text-amber-600"} />
          <Stat label="Overdue" value={prog.overdue} tone={prog.overdue ? "text-rose-700" : "text-emerald-700"} />
          <Stat label="Coverage" value={`${pack.programmeCoveragePct}%`} tone={pack.programmeCoveragePct >= 80 ? "text-emerald-700" : "text-amber-600"} />
        </div>
        {pack.programmeGaps.length > 0 && (
          <p className="mt-2 text-xs text-rose-700">{pack.programmeGaps.length} coverage gap(s): {pack.programmeGaps.map((g) => `${g.auditTypeName} @ ${g.siteName ?? g.siteId}`).join("; ")}</p>
        )}
      </Section>

      <Section title="2 · Findings Profile">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(["OBSERVATION", "MINOR_NC", "MAJOR_NC", "CRITICAL_NC", "OPPORTUNITY_FOR_IMPROVEMENT"] as const).map((s) => (
            <Stat key={s} label={SEV_LABEL[s]} value={pack.findingsBySeverity[s] ?? 0} tone={s === "CRITICAL_NC" || s === "MAJOR_NC" ? "text-rose-700" : "text-slate-900"} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Repeat-finding rate" value={`${pack.repeatFindingRatePct}%`} tone={pack.repeatFindingRatePct > 20 ? "text-rose-700" : "text-amber-600"} />
          <Stat label="Open findings" value={pack.openFindingCount} />
          <Stat label="Avg closure (days)" value={pack.avgClosureDays ?? "—"} />
        </div>
        <p className="mt-2 text-xs text-slate-500">Repeat findings are the certification-readiness red flag — recurrence of the same clause at the same site across periods.</p>
      </Section>

      <Section title="3 · Clause Conformance (lowest 8)">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="py-1.5">Clause</th><th className="py-1.5 text-right">Assessments</th><th className="py-1.5 text-right">NCs</th><th className="py-1.5 text-right">Conformance</th>
            </tr>
          </thead>
          <tbody>
            {worstClauses.map((c) => (
              <tr key={c.clause} className="border-b border-slate-100">
                <td className="py-1.5 font-medium text-slate-700">{c.clause}</td>
                <td className="py-1.5 text-right">{c.assessments}</td>
                <td className="py-1.5 text-right">{c.nonConformances}</td>
                <td className={`py-1.5 text-right font-semibold ${c.conformancePct >= 90 ? "text-emerald-700" : c.conformancePct >= 70 ? "text-amber-600" : "text-rose-700"}`}>{c.conformancePct}%</td>
              </tr>
            ))}
            {worstClauses.length === 0 && <tr><td colSpan={4} className="py-2 text-slate-400">No clause-mapped assessments in scope.</td></tr>}
          </tbody>
        </table>
      </Section>

      <Section title="4 · CAPA & Compliance Assurance">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="CAPA overdue" value={`${pack.capaOverduePct}%`} tone={pack.capaOverduePct ? "text-rose-700" : "text-emerald-700"} />
          <Stat label="Obligations" value={pack.compliance.totalObligations} />
          <Stat label="Verified by audit" value={`${pack.compliance.verifiedPct}%`} tone={pack.compliance.verifiedPct >= 80 ? "text-emerald-700" : "text-amber-600"} />
          <Stat label="Open NC vs obligations" value={pack.compliance.openNcCount} tone={pack.compliance.openNcCount ? "text-rose-700" : "text-emerald-700"} />
        </div>
        <p className="mt-2 text-sm text-slate-600">{pack.compliance.verifiedByAuditCount} of {pack.compliance.totalObligations} statutory obligations verified by an audit in the last 12 months; {pack.compliance.openNcCount} with an open non-conformance.</p>
      </Section>

      <Section title="5 · Benchmarking — site vs site">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="py-1.5">Site</th><th className="py-1.5 text-right">Conducted</th><th className="py-1.5 text-right">Avg score</th><th className="py-1.5 text-right">Finding density</th><th className="py-1.5 text-right">Repeats</th>
            </tr>
          </thead>
          <tbody>
            {pack.benchmarkingBySite.map((b) => (
              <tr key={b.siteId ?? "none"} className="border-b border-slate-100">
                <td className="py-1.5 font-medium text-slate-700">{b.siteName ?? "—"}</td>
                <td className="py-1.5 text-right">{b.auditsConducted}/{b.auditsPlanned}</td>
                <td className="py-1.5 text-right">{b.avgScorePct ?? "—"}{b.avgScorePct != null ? "%" : ""}</td>
                <td className="py-1.5 text-right">{b.findingDensity}</td>
                <td className={`py-1.5 text-right ${b.repeatCount ? "font-semibold text-rose-700" : ""}`}>{b.repeatCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <footer className="border-t border-slate-200 pt-3 text-[11px] text-slate-400">
        Generated by SafeOps360 CAMS. Source provenance — {Object.entries(pack.bySourceModule).map(([k, v]) => `${k}: ${v}`).join(" · ")}.
      </footer>
    </div>
  );
}
