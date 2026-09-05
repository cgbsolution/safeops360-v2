import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  ESG_BAND_CHIP,
  inrCompact,
  type EsgPortfolio,
} from "@/app/(dashboard)/erm/lib-t3";
import { ExportButton, SpendByBandChart } from "./esg-charts";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function EsgPortfolioPage() {
  let data: EsgPortfolio | null = null;
  let error: string | null = null;
  try {
    data = await backendFetch<EsgPortfolio>("/api/erm/vendors/esg-portfolio");
  } catch (e: any) {
    error = e?.message ?? "Failed to load ESG portfolio";
  }

  return (
    <div>
      <PageHeader
        title="Supplier ESG Portfolio"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Vendor Risk", href: "/erm/vendors" },
          { label: "ESG Portfolio" },
        ]}
        description="Qualitative supplier ESG posture — not Scope 3 carbon accounting. Where does our spend concentrate by ESG band?"
        action={<ExportButton />}
      />

      {error || !data ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "No portfolio data"}. Ensure the ERM Tier 3 seed has been run, and you are logged in with a vendor role.
        </Alert>
      ) : (
        <div className="space-y-5">
          {/* Headline lagging-spend number */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">Spend with LAGGING vendors</span>
              <div className="mt-1 text-4xl font-bold tabular-nums text-rose-700">
                {(data.laggingSpendPct ?? 0).toFixed(1)}%
              </div>
              <p className="mt-1 text-xs text-rose-600">The headline supply-chain ESG exposure number.</p>
            </Alert>
            <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total tracked spend</span>
              <div className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{inrCompact(data.totalSpend)}</div>
            </Card>
            <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">LAGGING vendors on watch</span>
              <div className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{data.laggingWatchlist.length}</div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Spend-by-band bar */}
            <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
              <h2 className="mb-1 text-sm font-semibold text-slate-900">Spend by ESG Band</h2>
              <p className="mb-3 text-xs text-slate-500">Annual spend distributed across supplier ESG posture bands.</p>
              <SpendByBandChart spendByBand={data.spendByBand ?? []} />
            </Card>

            {/* Spend-by-category table */}
            <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Spend by Category</h2>
              {data.spendByCategory.length === 0 ? (
                <p className="text-xs text-slate-400">No category spend data.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                      <TableHead className="px-2 py-2">Category</TableHead>
                      <TableHead className="px-2 py-2 text-right">Spend</TableHead>
                      <TableHead className="px-2 py-2 text-right">% of total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.spendByCategory.map((c) => (
                      <TableRow key={c.category} className="border-b border-slate-100">
                        <TableCell className="px-2 py-2 text-slate-700">{c.category}</TableCell>
                        <TableCell className="px-2 py-2 text-right tabular-nums text-slate-700">{inrCompact(c.spend)}</TableCell>
                        <TableCell className="px-2 py-2 text-right tabular-nums text-slate-500">{(c.pct ?? 0).toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </div>

          {/* LAGGING watchlist */}
          <Card className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-none">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-900">LAGGING Watchlist</h2>
              <span
                className={"rounded border px-2 py-0.5 text-[11px] font-semibold " + (ESG_BAND_CHIP.LAGGING ?? "")}
              >
                LAGGING
              </span>
            </div>
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <TableHead>Code</TableHead>
                  <TableHead>Legal name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Annual spend</TableHead>
                  <TableHead className="text-right">ESG score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.laggingWatchlist.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-3 py-10 text-center text-sm text-slate-400">
                      No LAGGING vendors — supplier ESG posture is healthy.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.laggingWatchlist.map((w) => (
                    <TableRow key={w.vendorCode} className="border-t border-slate-100">
                      <TableCell className="px-3 py-2.5 font-medium text-slate-700">{w.vendorCode}</TableCell>
                      <TableCell className="px-3 py-2.5 text-slate-700">{w.legalName}</TableCell>
                      <TableCell className="px-3 py-2.5 text-xs text-slate-600">{w.category}</TableCell>
                      <TableCell className="px-3 py-2.5 text-right tabular-nums text-slate-700">{inrCompact(w.annualSpendInr)}</TableCell>
                      <TableCell className="px-3 py-2.5 text-right tabular-nums font-semibold text-rose-600">
                        {w.esgScore != null ? w.esgScore : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          <p className="text-center text-[11px] text-slate-400">
            <Link href="/erm/vendors" className="text-primary-700 underline">
              Back to vendor dashboard
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
