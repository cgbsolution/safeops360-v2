import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ClipboardList, Plus, CheckCircle2, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

type MobilizationRecord = {
  id: string;
  mobilizationNumber: string;
  workerName: string;
  workerId: string;
  siteName: string;
  siteCode: string;
  siteId: string;
  trade: string;
  contractorCompanyName: string;
  contractorCompanyId: string;
  status: string;
  mobilisationDate: string | null;
  demobilisationDate: string | null;
  approvedAt: string | null;
};

type Site = { id: string; siteName: string; siteCode: string };
type Contractor = { id: string; companyName: string };

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "pending_checks") return "bg-amber-100 text-amber-800 border-amber-200";
  if (s === "checks_complete_pending_approval") return "bg-blue-100 text-blue-800 border-blue-200";
  if (s === "demobilised") return "bg-slate-100 text-slate-600 border-slate-200";
  if (s === "suspended") return "bg-rose-100 text-rose-800 border-rose-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function humanizeStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default async function MobilizationPage(
  props: {
    searchParams: Promise<{
      siteId?: string;
      status?: string;
      contractorCompanyId?: string;
    }>;
  }
) {
  const sp = await props.searchParams;

  const query: Record<string, string> = {};
  if (sp.siteId) query.siteId = sp.siteId;
  if (sp.status) query.status = sp.status;
  if (sp.contractorCompanyId) query.contractorCompanyId = sp.contractorCompanyId;

  const [mobData, sitesData, contractorsData] = await Promise.all([
    backendFetch<{ mobilizations: MobilizationRecord[] }>("/api/epc/mobilization", { query }).catch(() => null),
    backendFetch<{ sites: Site[] }>("/api/epc/sites").catch(() => null),
    backendFetch<{ contractors: Contractor[] }>("/api/epc/contractors").catch(() => null),
  ]);

  const mobilizations = mobData?.mobilizations ?? [];
  const sites = sitesData?.sites ?? [];
  const contractors = contractorsData?.contractors ?? [];

  const STATUS_OPTIONS = [
    { value: "active", label: "Active" },
    { value: "pending_checks", label: "Pending Checks" },
    { value: "checks_complete_pending_approval", label: "Pending Approval" },
    { value: "demobilised", label: "Demobilised" },
    { value: "suspended", label: "Suspended" },
  ];

  function filterHref(overrides: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    const merged = { siteId: sp.siteId, status: sp.status, contractorCompanyId: sp.contractorCompanyId, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    const s = params.toString();
    return `/epc/mobilization${s ? `?${s}` : ""}`;
  }

  return (
    <div>
      <PageHeader
        title="Mobilization Management"
        description="Worker deployment and site mobilization records"
        breadcrumbs={[{ label: "EPC", href: "/epc" }, { label: "Mobilization" }]}
        action={
          <Button asChild size="sm">
            <Link href="/epc/mobilization/new">
              <Plus size={16} className="mr-1" /> New Mobilization
            </Link>
          </Button>
        }
      />

      {/* Filter row */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* Site filter */}
        <div>
          <form method="get" action="/epc/mobilization">
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="text-xs text-slate-500 block mb-1 font-medium">Site</label>
                <select
                  name="siteId"
                  defaultValue={sp.siteId ?? ""}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600"
                >
                  <option value="">All Sites</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>{s.siteName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1 font-medium">Status</label>
                <select
                  name="status"
                  defaultValue={sp.status ?? ""}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600"
                >
                  <option value="">All Statuses</option>
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1 font-medium">Contractor</label>
                <select
                  name="contractorCompanyId"
                  defaultValue={sp.contractorCompanyId ?? ""}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600"
                >
                  <option value="">All Contractors</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
              </div>
              <Button type="submit" variant="outline" size="sm">Apply</Button>
              {(sp.siteId || sp.status || sp.contractorCompanyId) && (
                <Link href="/epc/mobilization" className="text-xs text-slate-500 hover:text-slate-700 hover:underline self-center">
                  Clear filters
                </Link>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Active filters summary */}
      {(sp.siteId || sp.status || sp.contractorCompanyId) && (
        <div className="mb-3 flex items-center gap-2 flex-wrap text-xs text-slate-600">
          <span className="font-medium">Filtered by:</span>
          {sp.siteId && <span className="rounded-full bg-cyan-50 border border-cyan-200 px-2 py-0.5 text-cyan-700">{sites.find((s) => s.id === sp.siteId)?.siteName ?? sp.siteId}</span>}
          {sp.status && <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5">{humanizeStatus(sp.status)}</span>}
          {sp.contractorCompanyId && <span className="rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-violet-700">{contractors.find((c) => c.id === sp.contractorCompanyId)?.companyName ?? sp.contractorCompanyId}</span>}
          <span className="text-slate-400">&mdash; {mobilizations.length} record{mobilizations.length !== 1 ? "s" : ""}</span>
        </div>
      )}

      {mobilizations.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center">
          <ClipboardList size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600 mb-1">No mobilization records found</p>
          <p className="text-xs text-slate-400 mb-4">
            {sp.siteId || sp.status || sp.contractorCompanyId
              ? "Try adjusting the filters above."
              : "Create a new mobilization to deploy workers to a site."}
          </p>
          <Button asChild size="sm">
            <Link href="/epc/mobilization/new"><Plus size={14} className="mr-1" /> New Mobilization</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                <th className="px-4 py-3">Mob. No.</th>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Trade</th>
                <th className="px-4 py-3">Contractor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Mob. Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mobilizations.map((m, i) => {
                const isPending =
                  m.status === "pending_checks" ||
                  m.status === "checks_complete_pending_approval";
                const isActive = m.status === "active";
                return (
                  <tr
                    key={m.id}
                    className={`border-b last:border-0 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{m.mobilizationNumber}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <Link href={`/epc/workers/${m.workerId}`} className="hover:text-cyan-700 hover:underline">
                        {m.workerName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/epc/sites/${m.siteId}`} className="hover:text-cyan-700 hover:underline text-slate-700">
                        {m.siteName}
                      </Link>
                      <span className="block text-xs font-mono text-slate-400">{m.siteCode}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.trade}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <Link href={`/epc/contractors/${m.contractorCompanyId}`} className="hover:text-cyan-700 hover:underline">
                        {m.contractorCompanyName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(m.status)}`}>
                        {humanizeStatus(m.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{fmtDate(m.mobilisationDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {isPending && (
                          <button
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                            title="Approve mobilization"
                          >
                            <CheckCircle2 size={11} /> Approve
                          </button>
                        )}
                        {isActive && (
                          <button
                            className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
                            title="Demobilise worker"
                          >
                            <XCircle size={11} /> Demobilise
                          </button>
                        )}
                        <Link
                          href={`/epc/workers/${m.workerId}`}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-50 border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
