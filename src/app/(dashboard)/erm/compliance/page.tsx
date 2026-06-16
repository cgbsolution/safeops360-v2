import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { KpiTile } from "@/components/erm/shared";
import { fmtDate } from "../lib";
import { OBLIGATION_STATUS_CHIP, type ComplianceDashboard } from "../lib-p2";
import { ComplianceCharts } from "./dashboard-charts";

export const dynamic = "force-dynamic";

const fallback: ComplianceDashboard = {
  totalObligations: 0,
  compliantPct: 0,
  dueSoon: 0,
  overdue: 0,
  underRenewal: 0,
  typeCounts: {},
  siteSplit: {},
  renewalCalendar: [],
  overdueTable: [],
};

function expiryTone(status: string): string {
  return OBLIGATION_STATUS_CHIP[status] ?? "bg-slate-100 text-slate-600 border-slate-200";
}

export default async function ComplianceDashboardPage() {
  let data = fallback;
  let error: string | null = null;
  try {
    data = await backendFetch<ComplianceDashboard>("/api/erm/compliance/dashboard");
  } catch (e: any) {
    error = e?.message ?? "Failed to load compliance dashboard";
  }

  const renewals = [...data.renewalCalendar].sort(
    (a, b) => (a.daysToExpiry ?? 99999) - (b.daysToExpiry ?? 99999),
  );

  return (
    <div>
      <PageHeader
        title="Compliance & Obligations"
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "Compliance" }]}
        description="The statutory & regulatory obligation register — licences, consents, returns and renewals, traffic-lit against validity and lead-time, with an attestation trail and auto-CAPA on breach."
        action={
          <Link
            href="/erm/compliance/register"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800"
          >
            View register <ArrowRight size={16} />
          </Link>
        }
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}. Ensure the ERM Phase 2 seed has been run and you are logged in with an ERM role.
        </div>
      ) : (
        <div className="space-y-5">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <KpiTile label="Total Obligations" value={data.totalObligations} href="/erm/compliance/register" />
            <KpiTile label="Compliant %" value={`${Math.round(data.compliantPct)}%`} tone="good" href="/erm/compliance/register?status=COMPLIANT" />
            <KpiTile label="Due Soon" value={data.dueSoon} tone="warn" href="/erm/compliance/register?status=DUE_SOON" />
            <KpiTile label="Overdue" value={data.overdue} tone="critical" href="/erm/compliance/register?status=OVERDUE" />
            <KpiTile label="Under Renewal" value={data.underRenewal} tone="neutral" href="/erm/compliance/register?status=UNDER_RENEWAL" />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            {/* Renewal calendar */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Renewal Calendar</h2>
                  <p className="text-xs text-slate-500">60-day horizon — soonest expiry first</p>
                </div>
                <Link href="/erm/compliance/register" className="text-xs font-medium text-primary-700 hover:underline">
                  Open register →
                </Link>
              </div>
              {renewals.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-400">No obligations expiring within the horizon.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {renewals.map((r) => (
                    <li
                      key={r.obligationCode}
                      className={"flex items-center justify-between gap-2 rounded-lg border px-3 py-2 " + expiryTone(r.status)}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold">{r.obligationCode}</div>
                        <div className="truncate text-[11px] opacity-80">{r.title}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs font-semibold tabular-nums">
                          {r.daysToExpiry != null ? (r.daysToExpiry < 0 ? `${Math.abs(r.daysToExpiry)}d overdue` : `${r.daysToExpiry}d`) : "—"}
                        </div>
                        <div className="text-[10px] opacity-70">{fmtDate(r.validUntil)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Obligation-type donut */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-1 text-sm font-semibold text-slate-900">Obligations by Type</h2>
              <p className="mb-2 text-xs text-slate-500">Distribution across the register</p>
              <ComplianceCharts typeCounts={data.typeCounts} siteSplit={data.siteSplit} chart="donut" />
            </div>
          </div>

          {/* Site split */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Obligations by Site</h2>
            <ComplianceCharts typeCounts={data.typeCounts} siteSplit={data.siteSplit} chart="site" />
          </div>

          {/* Overdue table */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Overdue Obligations</h2>
              <Link href="/erm/compliance/register?status=OVERDUE" className="text-xs font-medium text-primary-700 hover:underline">
                View all →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-2 py-2">Code</th>
                    <th className="px-2 py-2">Title</th>
                    <th className="px-2 py-2">Owner</th>
                    <th className="px-2 py-2">Site</th>
                    <th className="px-2 py-2">Valid Until</th>
                  </tr>
                </thead>
                <tbody>
                  {data.overdueTable.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-8 text-center text-sm text-slate-400">
                        No overdue obligations — the register is current.
                      </td>
                    </tr>
                  ) : (
                    data.overdueTable.map((o) => (
                      <tr key={o.obligationCode} className="border-b border-slate-100 hover:bg-slate-50/70">
                        <td className="px-2 py-2 font-medium text-primary-700">{o.obligationCode}</td>
                        <td className="max-w-[320px] truncate px-2 py-2 text-slate-700">{o.title}</td>
                        <td className="px-2 py-2 text-xs text-slate-600">{o.owner ?? "—"}</td>
                        <td className="px-2 py-2 text-xs text-slate-600">{o.siteName ?? "—"}</td>
                        <td className="px-2 py-2 text-xs tabular-nums text-rose-600">{fmtDate(o.validUntil)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
