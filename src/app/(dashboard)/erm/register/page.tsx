import Link from "next/link";
import { Plus } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { BandBadge } from "@/components/erm/shared";
import { STATE_CHIP, VELOCITY_LABEL, fmtDate, fmtInr, type RiskListResponse } from "../lib";
import { RegisterFilters } from "./register-filters";

export const dynamic = "force-dynamic";

const SOURCE_ICON: Record<string, string> = { MANUAL: "✎", HSE_ROLLUP: "⬆", INCIDENT_TRIGGERED: "⚡" };

export default async function RegisterPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const query: Record<string, string> = {};
  for (const k of [
    "category",
    "band",
    "state",
    "orgLevel",
    "siteId",
    "owner",
    "source",
    "likelihood",
    "impact",
    "businessUnit",
    "search",
  ]) {
    if (sp[k]) query[k] = sp[k]!;
  }
  if (sp.overdueOnly === "1") query.overdueOnly = "true";

  let data: RiskListResponse = { items: [], total: 0, categoryCounts: {}, bandCounts: {}, stateCounts: {} };
  let businessUnits: string[] = [];
  let error: string | null = null;
  try {
    [data, businessUnits] = await Promise.all([
      backendFetch<RiskListResponse>("/api/erm/risks", { query }),
      backendFetch<string[]>("/api/erm/business-units").catch(() => [] as string[]),
    ]);
  } catch (e: any) {
    error = e?.message ?? "Failed to load register";
  }

  const bandFilter = (b: string, label: string) => {
    const next = new URLSearchParams(sp as Record<string, string>);
    if (sp.band === b) next.delete("band");
    else next.set("band", b);
    const active = sp.band === b;
    return (
      <Link
        key={b}
        href={`/erm/register?${next.toString()}`}
        className={
          "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
          (active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")
        }
      >
        {label} {data.bandCounts[b] != null && <span className="tabular-nums opacity-70">{data.bandCounts[b] ?? 0}</span>}
      </Link>
    );
  };

  return (
    <div>
      <PageHeader
        title="Enterprise Risk Register"
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "Register" }]}
        description="The full-spectrum enterprise risk register — strategic, financial, operational, cyber, ESG and more, fed live from HIRA/EAI via rollup."
        action={
          <Link
            href="/erm/register/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800"
          >
            <Plus size={16} /> New Risk
          </Link>
        }
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>
      ) : (
        <>
          <div className="mb-3">
            <RegisterFilters businessUnits={businessUnits} />
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Band</span>
            {bandFilter("CRITICAL", "Critical")}
            {bandFilter("HIGH", "High")}
            {bandFilter("MEDIUM", "Medium")}
            {bandFilter("LOW", "Low")}
            <span className="ml-auto text-xs text-slate-500">{data.total} risk(s)</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50/95">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Code</th>
                  <th className="px-3 py-2.5">Title</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5">Level / Site</th>
                  <th className="px-3 py-2.5">Owner</th>
                  <th className="px-3 py-2.5">Inherent</th>
                  <th className="px-3 py-2.5">Residual</th>
                  <th className="px-3 py-2.5">₹ Exposure</th>
                  <th className="px-3 py-2.5">State</th>
                  <th className="px-3 py-2.5">Next Review</th>
                  <th className="px-3 py-2.5">Src</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-10 text-center text-sm text-slate-400">
                      No risks match the current filter.
                    </td>
                  </tr>
                ) : (
                  data.items.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                      <td className="px-3 py-2.5">
                        <Link href={`/erm/register/${r.id}`} className="font-medium text-primary-700 hover:underline">
                          {r.riskCode}
                        </Link>
                      </td>
                      <td className="max-w-[260px] px-3 py-2.5 text-slate-700">{r.title}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                          style={{ backgroundColor: r.categoryColor ?? "#64748b" }}
                        >
                          {r.categoryCode}
                        </span>
                        {r.subCategoryCode && <span className="ml-1 text-[10px] text-slate-400">{r.subCategoryCode}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">
                        {r.orgLevel}
                        {r.plantName && <span className="block text-[11px] text-slate-400">{r.plantName}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{r.riskOwnerName ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        <BandBadge band={r.inherentBand} score={r.inherentScore} />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <BandBadge band={r.residualBand} score={r.residualScore} />
                          {r.residualIsOverride && (
                            <span title={`Asserted residual overrides control-derived by ${r.residualOverrideVariance}`} className="rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-700">⚑</span>
                          )}
                          {r.controlAlert && (
                            <span title="Deficient mapped control — reassess" className="rounded bg-rose-100 px-1 text-[9px] font-bold text-rose-700">C</span>
                          )}
                          {r.kriAlert && (
                            <span title="RED linked KRI — reassess" className="rounded bg-rose-100 px-1 text-[9px] font-bold text-rose-700">K</span>
                          )}
                          {r.incidentAlert && (
                            <span title="LTI/Critical incident at this site — review recommended" className="rounded bg-orange-100 px-1 text-[9px] font-bold text-orange-700">I</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs tabular-nums text-slate-600">
                        {fmtInr(r.residualExpectedLossInr)}
                        {r.targetExpectedLossInr != null && (
                          <span className="block text-[10px] text-emerald-600">→ {fmtInr(r.targetExpectedLossInr)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={"inline-block rounded border px-2 py-0.5 text-[11px] " + (STATE_CHIP[r.lifecycleState] ?? "")}>
                          {r.lifecycleState.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <span className="text-slate-500">{fmtDate(r.nextReviewDate)}</span>
                        {r.reviewBadge === "AMBER" && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700">{r.reviewOverdueDays}d</span>}
                        {r.reviewBadge === "RED" && <span className="ml-1 rounded bg-rose-100 px-1 text-[10px] font-semibold text-rose-700">{r.reviewOverdueDays}d</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center text-base text-slate-500" title={r.sourceType}>
                        {SOURCE_ICON[r.sourceType] ?? "•"}
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
