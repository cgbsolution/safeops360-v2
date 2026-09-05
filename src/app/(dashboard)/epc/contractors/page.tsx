import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { HardHat, Users, Plus, Star } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type Contractor = {
  id: string;
  companyCode: string;
  companyName: string;
  tradeCategories: string[];
  prequalificationStatus: string;
  prequalificationScore: number | null;
  activeWorkerCount: number;
};

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "approved") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "conditionally_approved") return "bg-amber-100 text-amber-800 border-amber-200";
  if (s === "not_applied") return "bg-slate-100 text-slate-600 border-slate-200";
  if (s === "suspended") return "bg-rose-100 text-rose-800 border-rose-200";
  if (s === "blacklisted") return "bg-rose-200 text-rose-900 border-rose-300";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function humanizeStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function tierLabel(score: number | null): { label: string; cls: string } | null {
  if (score === null) return null;
  if (score >= 80) return { label: "Gold", cls: "bg-yellow-100 text-yellow-800 border-yellow-200" };
  if (score >= 60) return { label: "Silver", cls: "bg-slate-100 text-slate-700 border-slate-200" };
  if (score >= 40) return { label: "Bronze", cls: "bg-orange-100 text-orange-800 border-orange-200" };
  return { label: "Watch", cls: "bg-rose-100 text-rose-800 border-rose-200" };
}

export default async function ContractorsPage() {
  const data = await backendFetch<{ contractors: Contractor[] }>("/api/epc/contractors").catch(() => null);
  const contractors = data?.contractors ?? [];

  return (
    <div>
      <PageHeader
        title="Contractor Companies"
        description="Registered EPC sub-contractors and their qualification status"
        breadcrumbs={[{ label: "EPC", href: "/epc" }, { label: "Contractors" }]}
        action={
          <Button asChild size="sm">
            <Link href="/epc/contractors/new">
              <Plus size={16} className="mr-1" /> Register Contractor
            </Link>
          </Button>
        }
      />

      {contractors.length === 0 ? (
        <Card className="rounded-xl border bg-white p-12 text-center shadow-none">
          <HardHat size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600 mb-1">No contractor companies registered</p>
          <p className="text-xs text-slate-400 mb-4">Register your first contractor company to begin the prequalification process.</p>
          <Button asChild size="sm">
            <Link href="/epc/contractors/new"><Plus size={14} className="mr-1" /> Register Contractor</Link>
          </Button>
        </Card>
      ) : (
        <Card className="rounded-xl border bg-white overflow-hidden shadow-sm">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow className="border-b bg-slate-50 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                <TableHead className="px-4 py-3">Code</TableHead>
                <TableHead className="px-4 py-3">Company Name</TableHead>
                <TableHead className="px-4 py-3">Trade Categories</TableHead>
                <TableHead className="px-4 py-3">Prequalification</TableHead>
                <TableHead className="px-4 py-3">Score</TableHead>
                <TableHead className="px-4 py-3">Tier</TableHead>
                <TableHead className="px-4 py-3 text-right">Workers</TableHead>
                <TableHead className="px-4 py-3"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contractors.map((c, i) => {
                const tier = tierLabel(c.prequalificationScore);
                return (
                  <TableRow
                    key={c.id}
                    className={`border-b last:border-0 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}
                  >
                    <TableCell className="px-4 py-3 font-mono text-xs text-slate-500">{c.companyCode}</TableCell>
                    <TableCell className="px-4 py-3 font-semibold text-slate-900">{c.companyName}</TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(c.tradeCategories ?? []).slice(0, 3).map((t) => (
                          <Badge variant="neutral" key={t} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                            {t}
                          </Badge>
                        ))}
                        {(c.tradeCategories ?? []).length > 3 && (
                          <Badge variant="neutral" className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                            +{c.tradeCategories.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(c.prequalificationStatus)}`}>
                        {humanizeStatus(c.prequalificationStatus)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 tabular-nums text-slate-700">
                      {c.prequalificationScore !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                c.prequalificationScore >= 80 ? "bg-yellow-400"
                                : c.prequalificationScore >= 60 ? "bg-slate-400"
                                : c.prequalificationScore >= 40 ? "bg-orange-400"
                                : "bg-rose-400"
                              }`}
                              style={{ width: `${c.prequalificationScore}%` }}
                            />
                          </div>
                          <span className="text-xs">{c.prequalificationScore}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {tier ? (
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tier.cls}`}>
                          <Star size={10} /> {tier.label}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right tabular-nums">
                      <span className="flex items-center justify-end gap-1 text-slate-700">
                        <Users size={12} /> {c.activeWorkerCount}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Link
                        href={`/epc/contractors/${c.id}`}
                        className="text-xs font-medium text-cyan-700 hover:underline"
                      >
                        View &rarr;
                      </Link>
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
