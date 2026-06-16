import Link from "next/link";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { KpiTile } from "@/components/erm/shared";
import {
  CRITICALITY_CHIP,
  fmtRto,
  type ProcessListResponse,
} from "@/app/(dashboard)/erm/lib-p3";
import { fmtDate } from "@/app/(dashboard)/erm/lib";
import { NewProcessButton } from "./new-process-form";

export const dynamic = "force-dynamic";

const BIA_STATUS_CHIP: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  ASSESSED: "bg-blue-100 text-blue-800 border-blue-200",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REVIEW_DUE: "bg-amber-100 text-amber-800 border-amber-200",
};

const CRIT_FILTERS = ["VITAL", "ESSENTIAL", "IMPORTANT", "DEFERRABLE"] as const;

export default async function ProcessesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  const critRaw = sp.criticality;
  const criticality = Array.isArray(critRaw) ? critRaw[0] : critRaw;

  let data: ProcessListResponse = { items: [], total: 0, criticalityCounts: {} };
  let error: string | null = null;
  try {
    data = await backendFetch<ProcessListResponse>("/api/erm/bcm/processes", {
      query: { criticality: criticality ?? undefined },
    });
  } catch (e: any) {
    error = e?.message ?? "Failed to load business processes";
  }

  const counts = data.criticalityCounts ?? {};
  const uncovered = data.items.filter((p) => !p.isCovered).length;

  const critChip = (c: string) => {
    const next = new URLSearchParams();
    if (criticality !== c) next.set("criticality", c);
    const active = criticality === c;
    return (
      <Link
        key={c}
        href={`/erm/bcm/processes${next.toString() ? `?${next.toString()}` : ""}`}
        className={
          "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
          (active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")
        }
      >
        {c} <span className="tabular-nums opacity-70">{counts[c] ?? 0}</span>
      </Link>
    );
  };

  return (
    <div>
      <PageHeader
        title="Business Impact Analysis"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Business Continuity", href: "/erm/bcm" },
          { label: "Processes (BIA)" },
        ]}
        description="The business-impact register: critical processes, RTO/RPO/MTPD targets, dependencies, single points of failure and plan coverage."
        action={<NewProcessButton />}
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}. Ensure the ERM Phase 3 (BCM) seed has been run and you are logged in with a BCM role.
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiTile label="Processes" value={data.total} />
            <KpiTile label="Vital" value={counts.VITAL ?? 0} tone="critical" href="/erm/bcm/processes?criticality=VITAL" />
            <KpiTile label="Essential" value={counts.ESSENTIAL ?? 0} tone="high" href="/erm/bcm/processes?criticality=ESSENTIAL" />
            <KpiTile label="Uncovered (shown)" value={uncovered} tone={uncovered > 0 ? "warn" : "good"} />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Criticality</span>
            {CRIT_FILTERS.map(critChip)}
            <span className="ml-auto text-xs text-slate-500">{data.items.length} shown</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-slate-50/95">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Code</th>
                  <th className="px-3 py-2.5">Process</th>
                  <th className="px-3 py-2.5">Site</th>
                  <th className="px-3 py-2.5">Owner</th>
                  <th className="px-3 py-2.5">Criticality</th>
                  <th className="px-3 py-2.5 text-right">RTO</th>
                  <th className="px-3 py-2.5 text-right">MTPD</th>
                  <th className="px-3 py-2.5">BIA</th>
                  <th className="px-3 py-2.5 text-center">SPOF</th>
                  <th className="px-3 py-2.5 text-center">Covered</th>
                  <th className="px-3 py-2.5">Next review</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-10 text-center text-sm text-slate-400">
                      No processes match the current filter. Use “New Process” to add one.
                    </td>
                  </tr>
                ) : (
                  data.items.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                      <td className="px-3 py-2.5">
                        <Link href={`/erm/bcm/processes/${p.id}`} className="font-medium text-primary-700 hover:underline">
                          {p.processCode}
                        </Link>
                      </td>
                      <td className="max-w-[260px] px-3 py-2.5">
                        <span className="text-slate-800">{p.name}</span>
                        <span className="block text-[11px] text-slate-400">{p.departmentName}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{p.siteName ?? "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{p.ownerName ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        <span className={"rounded border px-2 py-0.5 text-[11px] " + (CRITICALITY_CHIP[p.criticality] ?? "")}>
                          {p.criticality}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-700">{fmtRto(p.rtoHours)}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-500">{fmtRto(p.mtpdHours)}</td>
                      <td className="px-3 py-2.5">
                        <span className={"rounded border px-2 py-0.5 text-[11px] " + (BIA_STATUS_CHIP[p.biaStatus] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
                          {p.biaStatus}
                        </span>
                        {p.reviewOverdue && <span className="ml-1 text-[10px] font-semibold text-rose-600">overdue</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {p.unmitigatedSpofCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-800">
                            <AlertTriangle size={11} /> {p.unmitigatedSpofCount}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {p.isCovered ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600" title={`${p.planCoverageCount} plan(s)`}>
                            <CheckCircle2 size={15} />
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-500" title="No approved plan">
                            <XCircle size={15} />
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{p.nextBiaReviewDate ? fmtDate(p.nextBiaReviewDate) : "—"}</td>
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
