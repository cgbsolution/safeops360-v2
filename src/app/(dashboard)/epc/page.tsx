import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Users,
  HardHat,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  ExternalLink,
} from "lucide-react";

export const dynamic = "force-dynamic";

type SiteSummary = {
  id: string;
  siteCode: string;
  siteName: string;
  clientName: string;
  state: string;
  status: string;
  currentWorkforceCount: number;
  activeContractorCompanies: number;
  pendingMobilizations: number;
  healthIndicator: "green" | "amber" | "red";
  healthReason: string;
};

type DashboardData = {
  summary: {
    activeSites: number;
    totalActiveWorkers: number;
    totalContractorCompanies: number;
    openGatePasses: number;
  };
  sites: SiteSummary[];
  contractorPerformance: {
    id: string;
    companyName: string;
    prequalificationStatus: string;
    prequalificationScore: number | null;
  }[];
};

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "suspended") return "bg-rose-100 text-rose-800 border-rose-200";
  if (s === "demobilising" || s === "demobilizing") return "bg-amber-100 text-amber-800 border-amber-200";
  if (s === "planning") return "bg-blue-100 text-blue-800 border-blue-200";
  if (s === "completed") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function healthBorderClass(health: "green" | "amber" | "red"): string {
  if (health === "green") return "border-l-4 border-l-emerald-500";
  if (health === "amber") return "border-l-4 border-l-amber-500";
  return "border-l-4 border-l-rose-500";
}

function healthIconClass(health: "green" | "amber" | "red") {
  if (health === "green") return <CheckCircle2 size={14} className="text-emerald-500" />;
  if (health === "amber") return <AlertTriangle size={14} className="text-amber-500" />;
  return <XCircle size={14} className="text-rose-500" />;
}

function prequaliColor(status: string): string {
  const s = status.toLowerCase();
  if (s === "approved") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "conditionally_approved") return "bg-amber-100 text-amber-800 border-amber-200";
  if (s === "suspended") return "bg-rose-100 text-rose-800 border-rose-200";
  if (s === "blacklisted") return "bg-rose-200 text-rose-900 border-rose-300";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function humanizeStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function EpcDashboardPage() {
  const data = await backendFetch<DashboardData>("/api/epc/dashboard").catch(() => null);

  const summary = data?.summary ?? {
    activeSites: 0,
    totalActiveWorkers: 0,
    totalContractorCompanies: 0,
    openGatePasses: 0,
  };
  const sites: SiteSummary[] = Array.isArray(data?.sites) ? data.sites : [];
  const contractors: DashboardData["contractorPerformance"] = Array.isArray(data?.contractorPerformance)
    ? data.contractorPerformance
    : [];

  return (
    <div>
      <PageHeader
        title="Multi-Site Dashboard"
        description="Corporate EPC operations overview"
        breadcrumbs={[{ label: "EPC" }, { label: "Dashboard" }]}
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/epc/sites/new">+ New Site</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/epc/gate">Gate Clearance</Link>
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          label="Active Sites"
          value={summary.activeSites}
          icon={<Building2 size={20} className="text-cyan-700" />}
          href="/epc/sites"
          bg="bg-cyan-50"
        />
        <SummaryCard
          label="Total Active Workers"
          value={summary.totalActiveWorkers}
          icon={<Users size={20} className="text-blue-700" />}
          href="/epc/workers"
          bg="bg-blue-50"
        />
        <SummaryCard
          label="Contractor Companies"
          value={summary.totalContractorCompanies}
          icon={<HardHat size={20} className="text-violet-700" />}
          href="/epc/contractors"
          bg="bg-violet-50"
        />
        <SummaryCard
          label="Gate Passes Today"
          value={summary.openGatePasses}
          icon={<ClipboardCheck size={20} className="text-emerald-700" />}
          href="/epc/gate"
          bg="bg-emerald-50"
        />
      </div>

      {/* Site Health Grid */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-800">Site Health</h2>
          <Link href="/epc/sites" className="text-xs text-cyan-700 hover:underline flex items-center gap-1">
            All sites <ExternalLink size={12} />
          </Link>
        </div>

        {sites.length === 0 ? (
          <div className="rounded-xl border bg-white p-10 text-center text-slate-500">
            <Building2 size={36} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No sites found. <Link href="/epc/sites/new" className="text-cyan-700 hover:underline">Register a site</Link> to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {sites.map((site) => (
              <Link
                key={site.id}
                href={`/epc/sites/${site.id}`}
                className={`group block rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow ${healthBorderClass(site.healthIndicator)}`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {healthIconClass(site.healthIndicator)}
                      <span className="text-xs font-mono text-slate-500">{site.siteCode}</span>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(site.status)}`}
                    >
                      {humanizeStatus(site.status)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-900 group-hover:text-cyan-700 transition-colors leading-snug mb-0.5">
                    {site.siteName}
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">{site.clientName} &middot; {site.state}</p>

                  <div className="flex items-center gap-4 text-xs text-slate-600 border-t pt-3">
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {site.currentWorkforceCount} workers
                    </span>
                    <span className="flex items-center gap-1">
                      <HardHat size={12} /> {site.activeContractorCompanies} contractors
                    </span>
                    {site.pendingMobilizations > 0 && (
                      <span className="flex items-center gap-1 text-amber-600 font-medium">
                        <AlertTriangle size={12} /> {site.pendingMobilizations} pending
                      </span>
                    )}
                  </div>

                  {site.healthReason && (
                    <p className="mt-2 text-[11px] text-slate-500 italic truncate">{site.healthReason}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Contractor Performance Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <TrendingUp size={16} className="text-slate-500" /> Contractor Performance
          </h2>
          <Link href="/epc/contractors" className="text-xs text-cyan-700 hover:underline flex items-center gap-1">
            All contractors <ExternalLink size={12} />
          </Link>
        </div>
        <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
          {contractors.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No contractor data available.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Prequalification Status</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {contractors.map((c, i) => {
                  const score = c.prequalificationScore;
                  const tier =
                    score === null ? null
                    : score >= 80 ? { label: "Gold", cls: "bg-yellow-100 text-yellow-800 border-yellow-200" }
                    : score >= 60 ? { label: "Silver", cls: "bg-slate-100 text-slate-700 border-slate-200" }
                    : score >= 40 ? { label: "Bronze", cls: "bg-orange-100 text-orange-800 border-orange-200" }
                    : { label: "Watch", cls: "bg-rose-100 text-rose-800 border-rose-200" };

                  return (
                    <tr key={c.id} className={`border-b last:border-0 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                      <td className="px-4 py-3 font-medium text-slate-900">{c.companyName}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${prequaliColor(c.prequalificationStatus)}`}>
                          {humanizeStatus(c.prequalificationStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">
                        {score !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${score >= 80 ? "bg-yellow-400" : score >= 60 ? "bg-slate-400" : score >= 40 ? "bg-orange-400" : "bg-rose-400"}`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium">{score}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {tier ? (
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tier.cls}`}>
                            {tier.label}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/epc/contractors/${c.id}`} className="text-xs text-cyan-700 hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  href,
  bg,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  href: string;
  bg: string;
}) {
  return (
    <Link href={href} className="group block rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <p className="text-xs text-slate-500 font-medium leading-snug">{label}</p>
      </div>
      <p className="text-3xl font-bold text-slate-900 tabular-nums">{value.toLocaleString()}</p>
    </Link>
  );
}
