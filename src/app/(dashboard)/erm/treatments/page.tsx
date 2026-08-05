import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { BandBadge, KpiTile } from "@/components/erm/shared";
import { TreatmentProgressCell } from "@/components/erm/treatment-progress-cell";
import { STATE_CHIP, fmtDate, fmtInr, type TreatmentTrackerRow } from "../lib";

export const dynamic = "force-dynamic";

type TreatmentTrackerResponse = {
  items: TreatmentTrackerRow[];
  total: number;
  openCount: number;
  overdueCount: number;
  closedThisQuarter: number;
  avgClosureDays: number | null;
  totalExpectedLossReductionInr?: number;
  totalTreatmentCostInr?: number;
  portfolioRiskReductionPerRupee?: number | null;
};

const STRATEGIES = ["TREAT", "TOLERATE", "TRANSFER", "TERMINATE"] as const;
const STATES = ["DRAFT", "SUBMITTED", "TREATMENT_ACTIVE", "MONITORING", "CLOSED"] as const;

export default async function TreatmentTrackerPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const query: Record<string, string> = {};
  for (const k of ["strategy", "state"]) {
    if (sp[k]) query[k] = sp[k]!;
  }

  let data: TreatmentTrackerResponse = {
    items: [],
    total: 0,
    openCount: 0,
    overdueCount: 0,
    closedThisQuarter: 0,
    avgClosureDays: null,
  };
  let error: string | null = null;
  try {
    data = await backendFetch<TreatmentTrackerResponse>("/api/erm/treatments", { query });
  } catch (e: any) {
    error = e?.message ?? "Failed to load treatment tracker";
  }

  // Sort overdue first, then by due date.
  const rows = [...data.items].sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    const da = a.closureTargetDate ? new Date(a.closureTargetDate).getTime() : Infinity;
    const db = b.closureTargetDate ? new Date(b.closureTargetDate).getTime() : Infinity;
    return da - db;
  });

  const chipLink = (key: "strategy" | "state", value: string, label: string) => {
    const next = new URLSearchParams(sp as Record<string, string>);
    const active = sp[key] === value;
    if (active) next.delete(key);
    else next.set(key, value);
    return (
      <Link
        key={`${key}-${value}`}
        href={`/erm/treatments?${next.toString()}`}
        className={
          "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
          (active
            ? "border-slate-900 bg-slate-900 text-white"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")
        }
      >
        {label}
      </Link>
    );
  };

  return (
    <div>
      <PageHeader
        title="Treatment Tracker"
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "Treatments" }]}
        description="Every risk treatment runs on the universal CAPA engine — one action universe, one overdue report. Track strategy, ownership, closure and the residual reduction it actually delivered."
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <KpiTile label="Open Treatments" value={data.openCount} />
            <KpiTile label="Overdue" value={data.overdueCount} tone="critical" />
            <KpiTile label="Closed This Quarter" value={data.closedThisQuarter} tone="good" />
            <KpiTile label="₹ Exposure Removed" value={fmtInr(data.totalExpectedLossReductionInr ?? 0)} tone="good" sub={`spend ${fmtInr(data.totalTreatmentCostInr ?? 0)}`} />
            <KpiTile label="Risk-Reduction / ₹" value={data.portfolioRiskReductionPerRupee != null ? `${data.portfolioRiskReductionPerRupee}×` : "—"} tone="neutral" sub="₹ exposure cut per ₹ spent" />
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Strategy</span>
            {STRATEGIES.map((s) => chipLink("strategy", s, s))}
            <span className="ml-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">State</span>
            {STATES.map((s) => chipLink("state", s, s.replace(/_/g, " ")))}
            <span className="ml-auto text-xs text-slate-500">{data.total} treatment(s)</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50/95">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Strategy</th>
                  <th className="px-3 py-2.5">Risk</th>
                  <th className="px-3 py-2.5">CAPA</th>
                  <th className="px-3 py-2.5">Parent Residual</th>
                  <th className="px-3 py-2.5">State</th>
                  <th className="px-3 py-2.5">Owner</th>
                  <th className="px-3 py-2.5">Progress</th>
                  <th className="px-3 py-2.5">Due</th>
                  <th className="px-3 py-2.5">Residual Reduction</th>
                  <th className="px-3 py-2.5">Cost-Benefit</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-10 text-center text-sm text-slate-400">
                      No treatments match the current filter.
                    </td>
                  </tr>
                ) : (
                  rows.map((t) => (
                    <tr key={t.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                      <td className="px-3 py-2.5">
                        <span className="rounded bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-800">
                          {t.treatmentStrategy}
                        </span>
                      </td>
                      <td className="max-w-[280px] px-3 py-2.5">
                        <Link
                          href={`/erm/register/${t.riskId}`}
                          className="font-medium text-primary-700 hover:underline"
                        >
                          {t.riskCode}
                        </Link>
                        <span className="block truncate text-xs text-slate-500">{t.riskTitle}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <Link href={`/capa/${t.id}`} className="font-medium text-primary-700 hover:underline">
                          {t.capaNumber}
                        </Link>
                        <span className="block max-w-[220px] truncate text-xs text-slate-500">{t.title}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <BandBadge band={t.parentResidualBand} />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={"inline-block rounded border px-2 py-0.5 text-[11px] " + (STATE_CHIP[t.state] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
                          {t.state.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{t.primaryOwnerName ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        <TreatmentProgressCell id={t.id} completionPercent={t.completionPercent} />
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <span className="text-slate-500">{fmtDate(t.closureTargetDate)}</span>
                        {t.overdue && (
                          <span className="ml-1 rounded bg-rose-100 px-1 text-[10px] font-semibold text-rose-700">
                            OVERDUE
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs tabular-nums">
                        <span className="text-slate-500">exp</span>{" "}
                        <span className="font-medium text-slate-700">{t.expectedResidualReduction ?? "—"}</span>
                        <span className="mx-1 text-slate-300">/</span>
                        <span className="text-slate-500">ach</span>{" "}
                        <span
                          className={
                            "font-medium " +
                            (t.achievedResidualReduction != null ? "text-emerald-700" : "text-amber-600")
                          }
                        >
                          {t.achievedResidualReduction ?? "pending"}
                        </span>
                        {t.reductionShortfall && (
                          <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700">SHORT</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs tabular-nums">
                        {t.costInr != null ? (
                          <>
                            <span className="text-slate-700">{fmtInr(t.costInr)}</span>
                            {t.riskReductionPerRupee != null && (
                              <span className="block text-[10px] text-emerald-600">{t.riskReductionPerRupee}× / ₹</span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
