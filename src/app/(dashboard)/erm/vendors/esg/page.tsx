import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import {
  ESG_BAND_CHIP,
  inrCompact,
  type EsgPortfolio,
} from "@/app/(dashboard)/erm/lib-t3";
import { ExportButton, SpendByBandChart } from "./esg-charts";

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
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "No portfolio data"}. Ensure the ERM Tier 3 seed has been run, and you are logged in with a vendor role.
        </div>
      ) : (
        <div className="space-y-5">
          {/* Headline lagging-spend number */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">Spend with LAGGING vendors</span>
              <div className="mt-1 text-4xl font-bold tabular-nums text-rose-700">
                {(data.laggingSpendPct ?? 0).toFixed(1)}%
              </div>
              <p className="mt-1 text-xs text-rose-600">The headline supply-chain ESG exposure number.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total tracked spend</span>
              <div className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{inrCompact(data.totalSpend)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">LAGGING vendors on watch</span>
              <div className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{data.laggingWatchlist.length}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Spend-by-band bar */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-1 text-sm font-semibold text-slate-900">Spend by ESG Band</h2>
              <p className="mb-3 text-xs text-slate-500">Annual spend distributed across supplier ESG posture bands.</p>
              <SpendByBandChart spendByBand={data.spendByBand ?? []} />
            </div>

            {/* Spend-by-category table */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Spend by Category</h2>
              {data.spendByCategory.length === 0 ? (
                <p className="text-xs text-slate-400">No category spend data.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="px-2 py-2">Category</th>
                      <th className="px-2 py-2 text-right">Spend</th>
                      <th className="px-2 py-2 text-right">% of total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.spendByCategory.map((c) => (
                      <tr key={c.category} className="border-b border-slate-100">
                        <td className="px-2 py-2 text-slate-700">{c.category}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-slate-700">{inrCompact(c.spend)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-slate-500">{(c.pct ?? 0).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* LAGGING watchlist */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-900">LAGGING Watchlist</h2>
              <span
                className={"rounded border px-2 py-0.5 text-[11px] font-semibold " + (ESG_BAND_CHIP.LAGGING ?? "")}
              >
                LAGGING
              </span>
            </div>
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50/95">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Code</th>
                  <th className="px-3 py-2.5">Legal name</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5 text-right">Annual spend</th>
                  <th className="px-3 py-2.5 text-right">ESG score</th>
                </tr>
              </thead>
              <tbody>
                {data.laggingWatchlist.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-sm text-slate-400">
                      No LAGGING vendors — supplier ESG posture is healthy.
                    </td>
                  </tr>
                ) : (
                  data.laggingWatchlist.map((w) => (
                    <tr key={w.vendorCode} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="px-3 py-2.5 font-medium text-slate-700">{w.vendorCode}</td>
                      <td className="px-3 py-2.5 text-slate-700">{w.legalName}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{w.category}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{inrCompact(w.annualSpendInr)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-rose-600">
                        {w.esgScore != null ? w.esgScore : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

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
