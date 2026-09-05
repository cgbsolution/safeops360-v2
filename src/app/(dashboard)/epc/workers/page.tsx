import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Users, Plus, HardHat, Upload } from "lucide-react";
import { RosterStatusBadge } from "@/components/workforce/roster-status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Worker = {
  id: string;
  workerCode: string;
  fullName: string;
  primaryTrade: string;
  contractorCompanyName: string;
  status: string;
  // HSE safety hold — separate axis from the EPC employment status above.
  rosterStatus?: string;
  activeMobilizations: number;
};

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "suspended") return "bg-amber-100 text-amber-800 border-amber-200";
  if (s === "blacklisted") return "bg-rose-100 text-rose-800 border-rose-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function humanizeStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function WorkersPage(
  props: { searchParams: Promise<{ contractorCompanyId?: string; q?: string }> }
) {
  const sp = await props.searchParams;

  const query: Record<string, string> = {};
  if (sp.contractorCompanyId) query.contractorCompanyId = sp.contractorCompanyId;
  if (sp.q) query.q = sp.q;

  const data = await backendFetch<{ workers: Worker[] }>("/api/epc/workers", { query }).catch(() => null);
  const workers = data?.workers ?? [];

  const title = sp.contractorCompanyId
    ? "Workers (Filtered by Company)"
    : "Construction Workers";

  return (
    <div>
      <PageHeader
        title={title}
        description="Registered construction workers and mobilization status"
        breadcrumbs={[{ label: "EPC", href: "/epc" }, { label: "Workers" }]}
        action={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/epc/workers/bulk">
                <Upload size={14} className="mr-1" /> Bulk Import
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/epc/workers/new">
                <Plus size={16} className="mr-1" /> Register Worker
              </Link>
            </Button>
          </div>
        }
      />

      {/* Filter hint */}
      {sp.contractorCompanyId && (
        <Alert variant="info" className="mb-4 flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm text-cyan-800">
          <HardHat size={14} />
          Filtered by contractor company ID: <code className="font-mono">{sp.contractorCompanyId}</code>
          <Link href="/epc/workers" className="ml-auto text-xs text-cyan-700 hover:underline">Clear filter</Link>
        </Alert>
      )}

      {workers.length === 0 ? (
        <Card className="rounded-xl border bg-white p-12 text-center shadow-none">
          <Users size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600 mb-1">No workers found</p>
          <p className="text-xs text-slate-400 mb-4">Register construction workers to manage mobilization and gate clearance.</p>
          <Button asChild size="sm">
            <Link href="/epc/workers/new"><Plus size={14} className="mr-1" /> Register Worker</Link>
          </Button>
        </Card>
      ) : (
        <Card className="rounded-xl border bg-white overflow-hidden shadow-sm">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow className="border-b bg-slate-50 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                <TableHead className="px-4 py-3">Worker Code</TableHead>
                <TableHead className="px-4 py-3">Name</TableHead>
                <TableHead className="px-4 py-3">Trade</TableHead>
                <TableHead className="px-4 py-3">Contractor Company</TableHead>
                <TableHead className="px-4 py-3">Status</TableHead>
                <TableHead className="px-4 py-3 text-right">Mobilizations</TableHead>
                <TableHead className="px-4 py-3"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers.map((w, i) => (
                <TableRow
                  key={w.id}
                  className={`border-b last:border-0 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}
                >
                  <TableCell className="px-4 py-3 font-mono text-xs text-slate-500">{w.workerCode}</TableCell>
                  <TableCell className="px-4 py-3 font-semibold text-slate-900">{w.fullName}</TableCell>
                  <TableCell className="px-4 py-3 text-slate-600">{w.primaryTrade}</TableCell>
                  <TableCell className="px-4 py-3 text-slate-600">{w.contractorCompanyName}</TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(w.status ?? "")}`}>
                        {humanizeStatus(w.status ?? "unknown")}
                      </span>
                      <RosterStatusBadge status={w.rosterStatus} />
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {w.activeMobilizations}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Link
                      href={`/epc/workers/${w.id}`}
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
