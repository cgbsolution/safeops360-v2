import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import {
  Building2,
  Users,
  HardHat,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
} from "lucide-react";

export const dynamic = "force-dynamic";

type Site = {
  id: string;
  siteCode: string;
  siteName: string;
  clientName: string;
  state: string;
  status: string;
  currentWorkforceCount: number;
  activeContractorCompanies: number;
  healthIndicator: "green" | "amber" | "red";
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

function humanizeStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function HealthBadge({ health }: { health: "green" | "amber" | "red" }) {
  if (health === "green")
    return <span title="Healthy"><CheckCircle2 size={15} className="text-emerald-500" /></span>;
  if (health === "amber")
    return <span title="Attention needed"><AlertTriangle size={15} className="text-amber-500" /></span>;
  return <span title="Issues detected"><XCircle size={15} className="text-rose-500" /></span>;
}

export default async function SitesPage() {
  const data = await backendFetch<{ sites: Site[] }>("/api/epc/sites").catch(() => null);
  const sites = data?.sites ?? [];

  return (
    <div>
      <PageHeader
        title="Construction Sites"
        description="All registered EPC project sites"
        breadcrumbs={[{ label: "EPC", href: "/epc" }, { label: "Sites" }]}
        action={
          <Button asChild size="sm">
            <Link href="/epc/sites/new">
              <Plus size={16} className="mr-1" /> New Site
            </Link>
          </Button>
        }
      />

      {sites.length === 0 ? (
        <Card className="rounded-xl border bg-white p-12 text-center shadow-none">
          <Building2 size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600 mb-1">No sites registered</p>
          <p className="text-xs text-slate-400 mb-4">Register your first construction site to begin managing operations.</p>
          <Button asChild size="sm">
            <Link href="/epc/sites/new"><Plus size={14} className="mr-1" /> Register Site</Link>
          </Button>
        </Card>
      ) : (
        <Card className="rounded-xl border bg-white overflow-hidden shadow-sm">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow className="border-b bg-slate-50 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                <TableHead className="px-4 py-3">Site Code</TableHead>
                <TableHead className="px-4 py-3">Site Name</TableHead>
                <TableHead className="px-4 py-3">Client</TableHead>
                <TableHead className="px-4 py-3">State</TableHead>
                <TableHead className="px-4 py-3">Status</TableHead>
                <TableHead className="px-4 py-3 text-right">Workers</TableHead>
                <TableHead className="px-4 py-3 text-right">Contractors</TableHead>
                <TableHead className="px-4 py-3 text-center">Health</TableHead>
                <TableHead className="px-4 py-3"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.map((site, i) => (
                <TableRow
                  key={site.id}
                  className={`border-b last:border-0 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}
                >
                  <TableCell className="px-4 py-3 font-mono text-xs text-slate-600">{site.siteCode}</TableCell>
                  <TableCell className="px-4 py-3 font-semibold text-slate-900">{site.siteName}</TableCell>
                  <TableCell className="px-4 py-3 text-slate-600">{site.clientName}</TableCell>
                  <TableCell className="px-4 py-3 text-slate-600">{site.state}</TableCell>
                  <TableCell className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(site.status)}`}>
                      {humanizeStatus(site.status)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">
                    <span className="flex items-center justify-end gap-1 text-slate-700">
                      <Users size={12} /> {site.currentWorkforceCount}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">
                    <span className="flex items-center justify-end gap-1 text-slate-700">
                      <HardHat size={12} /> {site.activeContractorCompanies}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center">
                      <HealthBadge health={site.healthIndicator} />
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Link
                      href={`/epc/sites/${site.id}`}
                      className="text-xs font-medium text-cyan-700 hover:underline"
                    >
                      View &rarr;
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
