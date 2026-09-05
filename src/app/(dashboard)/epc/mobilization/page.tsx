import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ClipboardList, Plus, CheckCircle2, XCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
                <Label className="text-xs text-slate-500 block mb-1 font-medium">Site</Label>
                <SelectField
                  name="siteId"
                  defaultValue={sp.siteId ?? ""}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600"
                  placeholder="All Sites"
                  options={sites.map((s) => ({ value: String(s.id), label: s.siteName }))}
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500 block mb-1 font-medium">Status</Label>
                <SelectField
                  name="status"
                  defaultValue={sp.status ?? ""}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600"
                  placeholder="All Statuses"
                  options={STATUS_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500 block mb-1 font-medium">Contractor</Label>
                <SelectField
                  name="contractorCompanyId"
                  defaultValue={sp.contractorCompanyId ?? ""}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600"
                  placeholder="All Contractors"
                  options={contractors.map((c) => ({ value: String(c.id), label: c.companyName }))}
                />
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
          {sp.siteId && <Badge variant="info" className="rounded-full bg-cyan-50 border border-cyan-200 px-2 py-0.5 text-cyan-700">{sites.find((s) => s.id === sp.siteId)?.siteName ?? sp.siteId}</Badge>}
          {sp.status && <Badge variant="neutral" className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5">{humanizeStatus(sp.status)}</Badge>}
          {sp.contractorCompanyId && <Badge variant="violet" className="rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-violet-700">{contractors.find((c) => c.id === sp.contractorCompanyId)?.companyName ?? sp.contractorCompanyId}</Badge>}
          <span className="text-slate-400">&mdash; {mobilizations.length} record{mobilizations.length !== 1 ? "s" : ""}</span>
        </div>
      )}

      {mobilizations.length === 0 ? (
        <Card className="rounded-xl border bg-white p-12 text-center shadow-none">
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
        </Card>
      ) : (
        <Card className="rounded-xl border bg-white overflow-hidden shadow-sm">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow className="border-b bg-slate-50 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                <TableHead className="px-4 py-3">Mob. No.</TableHead>
                <TableHead className="px-4 py-3">Worker</TableHead>
                <TableHead className="px-4 py-3">Site</TableHead>
                <TableHead className="px-4 py-3">Trade</TableHead>
                <TableHead className="px-4 py-3">Contractor</TableHead>
                <TableHead className="px-4 py-3">Status</TableHead>
                <TableHead className="px-4 py-3">Mob. Date</TableHead>
                <TableHead className="px-4 py-3">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mobilizations.map((m, i) => {
                const isPending =
                  m.status === "pending_checks" ||
                  m.status === "checks_complete_pending_approval";
                const isActive = m.status === "active";
                return (
                  <TableRow
                    key={m.id}
                    className={`border-b last:border-0 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}
                  >
                    <TableCell className="px-4 py-3 font-mono text-xs text-slate-500">{m.mobilizationNumber}</TableCell>
                    <TableCell className="px-4 py-3 font-semibold text-slate-900">
                      <Link href={`/epc/workers/${m.workerId}`} className="hover:text-cyan-700 hover:underline">
                        {m.workerName}
                      </Link>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Link href={`/epc/sites/${m.siteId}`} className="hover:text-cyan-700 hover:underline text-slate-700">
                        {m.siteName}
                      </Link>
                      <span className="block text-xs font-mono text-slate-400">{m.siteCode}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-slate-600">{m.trade}</TableCell>
                    <TableCell className="px-4 py-3 text-slate-600">
                      <Link href={`/epc/contractors/${m.contractorCompanyId}`} className="hover:text-cyan-700 hover:underline">
                        {m.contractorCompanyName}
                      </Link>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(m.status)}`}>
                        {humanizeStatus(m.status)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-slate-600">{fmtDate(m.mobilisationDate)}</TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {isPending && (
                          <Button variant="success" className="gap-1 rounded-md px-2 py-1 text-[11px] transition-colors"
                            title="Approve mobilization">
                            <CheckCircle2 size={11} /> Approve
                          </Button>
                        )}
                        {isActive && (
                          <Button variant="destructive" className="gap-1 rounded-md px-2 py-1 text-[11px] transition-colors"
                            title="Demobilise worker">
                            <XCircle size={11} /> Demobilise
                          </Button>
                        )}
                        <Link
                          href={`/epc/workers/${m.workerId}`}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-50 border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          View
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
