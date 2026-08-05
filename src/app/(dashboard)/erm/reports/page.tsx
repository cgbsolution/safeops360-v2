import { FileDown, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

type ReportCard = {
  kind: string;
  title: string;
  description: string;
  icon?: string; // emoji shown on the card
  emphasis?: boolean;
  base?: string; // path prefix; defaults to /api/erm/reports/
};

const PHASE2_REPORTS: ReportCard[] = [
  { kind: "kri-readings", base: "/api/erm/reports-p2/", title: "KRI Readings", description: "All KRI readings with period, value, status and source — for early-warning trend analysis." },
  { kind: "appetite-breaches", base: "/api/erm/reports-p2/", title: "Appetite Breach Log", description: "Every tolerance-band breach with observed vs threshold, committee decision and status." },
  { kind: "obligations", base: "/api/erm/reports-p2/", title: "Obligations Register", description: "Statutory licences, consents and filings with regulator, status and validity." },
  { kind: "compliance-tasks", base: "/api/erm/reports-p2/", title: "Compliance Task History", description: "Attestation / verification / waiver trail across all compliance tasks.", emphasis: true },
  { kind: "loss-events", base: "/api/erm/reports-p2/", title: "Loss Event Register", description: "Quantified loss events — gross, recovered, net by category and source." },
];

const REPORTS: ReportCard[] = [
  {
    kind: "register",
    icon: "📋",
    title: "Risk Register",
    description: "Every active enterprise risk with inherent / residual scores, owner and next review date.",
  },
  {
    kind: "heatmap",
    icon: "🔥",
    title: "Risk Heat Map Report",
    description: "Likelihood × impact distribution across the portfolio — residual band counts by cell.",
  },
  {
    kind: "treatments",
    icon: "🛠️",
    title: "Mitigation Action Tracker",
    description: "Risk treatment CAPAs with strategy, owner, due date and expected residual reduction.",
  },
  {
    kind: "overdue",
    icon: "⏰",
    title: "Overdue Action Report",
    description: "Mitigation actions past their due date — owner, days overdue and the risk they protect.",
  },
  {
    kind: "department",
    icon: "🏢",
    title: "Department-wise Risk Report",
    description: "Risk counts and residual exposure rolled up by department for accountability reviews.",
  },
  {
    kind: "assessments",
    icon: "📈",
    title: "Assessment History",
    description: "All inherent and residual assessments — likelihood, impact, score and band over time.",
  },
  {
    kind: "escalations",
    icon: "🚨",
    title: "Escalation Log",
    description: "Risks escalated above appetite — code, title, residual band and escalation timestamp.",
  },
  {
    kind: "acceptances",
    icon: "✅",
    title: "Risk Acceptance Log",
    description: "Formally accepted risks with justification, approver and acceptance date.",
    emphasis: true,
  },
];

export default function ErmReportsPage() {
  return (
    <div>
      <PageHeader
        title="ERM Reports & Exports"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Reports" },
        ]}
        description="Canned CSV, Excel and PDF exports of the enterprise risk register for audit, board and offline analysis. Each export reflects the risks within your access scope."
      />

      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Register, Mitigation &amp; Logs</h2>
      <ReportGrid cards={REPORTS} />

      <h2 className="mb-3 mt-6 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Monitoring, Appetite &amp; Compliance (Phase 2)</h2>
      <ReportGrid cards={PHASE2_REPORTS} />
    </div>
  );
}

function ReportGrid({ cards }: { cards: ReportCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((r) => (
        <div
          key={r.kind}
          className={
            "flex flex-col gap-3 rounded-xl border bg-white p-5 transition-shadow hover:shadow-md " +
            (r.emphasis ? "border-primary-200 ring-1 ring-primary-100" : "border-slate-200")
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-lg " + (r.emphasis ? "bg-primary-50 text-primary-700" : "bg-slate-100 text-slate-600")}>
              {r.icon ? <span className="text-lg leading-none">{r.icon}</span> : <FileDown size={18} />}
            </div>
            {r.emphasis && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700">
                <ShieldCheck size={12} /> Auditors ask for this one
              </span>
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-slate-900">{r.title}</h2>
            <p className="mt-1 text-xs text-slate-500">{r.description}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <a
              href={`${r.base ?? "/api/erm/reports/"}${r.kind}.csv`}
              download
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary-700 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-800"
            >
              <FileDown size={14} /> CSV
            </a>
            <a
              href={`${r.base ?? "/api/erm/reports/"}${r.kind}.xlsx`}
              download
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <FileDown size={14} /> Excel
            </a>
            <a
              href={`${r.base ?? "/api/erm/reports/"}${r.kind}.pdf`}
              download
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <FileDown size={14} /> PDF
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
