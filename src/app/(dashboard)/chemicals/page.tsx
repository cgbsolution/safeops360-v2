// Screen 1 — Chemical Master Register (§7 #1), with the module's KPI row on top.
//
// Searchable by CAS / hazard class / status, plus the SDS-overdue filter the
// Daily Brief card links into.

import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import type { Chemical, ChemicalDashboard } from "@/lib/chemicals/types";
import { fmtDate, daysUntil } from "@/lib/chemicals/types";
import {
  Chip, EmptyState, ErrorState, HazardChips, Kpi, StatusChip, SubNav, TILE,
} from "./_components";

export const dynamic = "force-dynamic";

type ListResponse = { total: number; items: Chemical[]; hazardClasses: string[] };

export default async function ChemicalRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; hazardClass?: string; status?: string; sdsOverdue?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.q) qs.set("q", sp.q);
  if (sp.hazardClass) qs.set("hazardClass", sp.hazardClass);
  if (sp.status) qs.set("status", sp.status);
  if (sp.sdsOverdue) qs.set("sdsOverdue", "true");

  let data: ListResponse | null = null;
  let dash: ChemicalDashboard | null = null;
  let error: string | null = null;
  try {
    [data, dash] = await Promise.all([
      backendFetch<ListResponse>(`/api/chemicals/masters?${qs.toString()}`),
      backendFetch<ChemicalDashboard>("/api/chemicals/dashboard"),
    ]);
  } catch (e: any) {
    error = e?.message ?? "Failed to load the chemical register";
  }

  return (
    <div>
      <PageHeader
        title="Chemical & Hazmat Management"
        breadcrumbs={[{ label: "Operational Safety" }, { label: "Chemical & Hazmat" }]}
        description="Chemical master data, site inventory ledger, storage compatibility and regulatory threshold tracking — with an automatic MOC when a site crosses a statutory limit."
      />

      {error ? (
        <ErrorState message={error} />
      ) : (
        <>
          {dash && (
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Kpi
                label="Thresholds breached"
                value={dash.thresholds.breached}
                tone={dash.thresholds.breached ? "critical" : "good"}
                sub="statutory obligation engaged"
                href="/chemicals/thresholds"
              />
              <Kpi
                label="Approaching"
                value={dash.thresholds.approaching}
                tone={dash.thresholds.approaching ? "warn" : "good"}
                sub="still avoidable"
                href="/chemicals/thresholds"
              />
              <Kpi
                label="Failed MOC triggers"
                value={dash.failedTriggers.count}
                tone={dash.failedTriggers.count ? "critical" : "good"}
                sub="unacknowledged"
                href="/chemicals/trigger-log?status=FAILED"
              />
              <Kpi
                label="SDS review overdue"
                value={dash.sdsOverdue.count}
                tone={dash.sdsOverdue.count ? "warn" : "good"}
                sub="chemical stays usable"
                href="/chemicals?sdsOverdue=1"
              />
              <Kpi
                label="Co-storage overrides"
                value={dash.pendingStorageOverrides}
                tone={dash.pendingStorageOverrides ? "warn" : "good"}
                sub="awaiting review"
                href="/chemicals/storage"
              />
            </div>
          )}

          <SubNav current="/chemicals" />

          {/* Filters. A plain GET form — no client JS needed for a list filter,
              and it keeps the URL shareable, which is what the Daily Brief
              cards deep-link into. */}
          <form className="mb-4 flex flex-wrap items-end gap-2" action="/chemicals" method="get">
            <div>
              <label className="block text-[11px] font-medium text-slate-500">Search</label>
              <input
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="Name, CAS or UN number"
                className="w-64 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500">Hazard class</label>
              <select
                name="hazardClass"
                defaultValue={sp.hazardClass ?? ""}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">All</option>
                {(data?.hazardClasses ?? []).map((h) => (
                  <option key={h} value={h}>{h.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500">Status</label>
              <select
                name="status"
                defaultValue={sp.status ?? ""}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">All</option>
                <option value="ACTIVE">Active</option>
                <option value="PENDING_SDS">Pending SDS</option>
                <option value="RESTRICTED">Restricted</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <label className="flex items-center gap-1.5 pb-1.5 text-xs text-slate-600">
              <input type="checkbox" name="sdsOverdue" value="1" defaultChecked={!!sp.sdsOverdue} />
              SDS review overdue only
            </label>
            <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
              Apply
            </button>
            <Link href="/chemicals" className="px-2 py-1.5 text-sm text-slate-500 hover:text-slate-800">
              Clear
            </Link>
          </form>

          {!data || data.items.length === 0 ? (
            <EmptyState
              title="No chemicals match these filters"
              hint="A chemical starts as PENDING_SDS and becomes ACTIVE only once its Safety Data Sheet is attached and reviewed."
            />
          ) : (
            <div className={TILE + " overflow-x-auto p-0"}>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Chemical</th>
                    <th className="px-4 py-2.5 font-semibold">CAS / UN</th>
                    <th className="px-4 py-2.5 font-semibold">Hazard classification</th>
                    <th className="px-4 py-2.5 font-semibold">State</th>
                    <th className="px-4 py-2.5 font-semibold">SDS review</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((c) => {
                    const days = daysUntil(c.sdsReviewDueDate);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5">
                          <Link href={`/chemicals/${c.id}`} className="font-medium text-slate-900 hover:underline">
                            {c.name}
                          </Link>
                          {c.commonName && <div className="text-[11px] text-slate-400">{c.commonName}</div>}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-slate-600">
                          {c.casNumber ?? "—"}
                          {c.unNumber && <div className="text-[11px] text-slate-400">UN {c.unNumber}</div>}
                        </td>
                        <td className="px-4 py-2.5"><HazardChips classes={c.hazardClasses} /></td>
                        <td className="px-4 py-2.5 text-slate-600">{c.physicalState.toLowerCase()}</td>
                        <td className="px-4 py-2.5">
                          {!c.sdsAttachmentId ? (
                            <span className="text-[11px] font-medium text-amber-700">No SDS attached</span>
                          ) : c.sdsReviewOverdue ? (
                            <span className="text-[11px] font-medium text-rose-600">
                              Overdue since {fmtDate(c.sdsReviewDueDate)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500">
                              Due {fmtDate(c.sdsReviewDueDate)}
                              {days !== null && days <= 60 && (
                                <span className="ml-1 text-amber-600">({days}d)</span>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5"><StatusChip status={c.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
                Showing {data.items.length} of {data.total}. Hazard classification is entered by a
                person reading the SDS; the sheet is attached as evidence and is not parsed.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
