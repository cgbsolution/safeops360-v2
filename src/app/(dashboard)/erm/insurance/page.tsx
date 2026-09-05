import Link from "next/link";
import { AlertTriangle, FileText, ShieldAlert } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { KpiTile } from "@/components/erm/shared";
import {
  CLAIM_STATUS_CHIP,
  POLICY_STATUS_CHIP,
  inrCompact,
  type InsuranceDashboard,
} from "@/app/(dashboard)/erm/lib-t3";
import { fmtDate } from "@/app/(dashboard)/erm/lib";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { CoverageByTypeChart } from "./coverage-chart";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function statusChip(status: string) {
  return (
    <span className={"inline-block rounded border px-2 py-0.5 text-[11px] " + (POLICY_STATUS_CHIP[status] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default async function InsuranceDashboardPage() {
  let data: InsuranceDashboard | null = null;
  let error: string | null = null;
  try {
    data = await backendFetch<InsuranceDashboard>("/api/erm/insurance/dashboard");
  } catch (e: any) {
    error = e?.message ?? "Failed to load insurance dashboard";
  }

  const renewalDue = (data?.renewalCalendar ?? []).some((r) => r.status === "EXPIRING_SOON" || r.status === "EXPIRED");

  return (
    <div>
      <PageHeader
        title="Insurance & Risk Transfer"
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "Insurance & Transfer" }]}
        description="Risk-transfer cockpit — policy portfolio, sum insured, premium spend, renewal calendar, open claims and the coverage gap against critical risks."
        action={
          <div className="flex gap-2">
            <Link
              href="/erm/insurance/policies"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <FileText size={16} /> Policy Register
            </Link>
            <Link
              href="/erm/insurance/coverage-gap"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-800"
            >
              <ShieldAlert size={16} /> Coverage Gap
            </Link>
          </div>
        }
      />

      {error || !data ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "No dashboard data"}. Ensure the ERM Tier 3 seed has been run, and you are logged in with an insurance role.
        </Alert>
      ) : (
        <div className="space-y-5">
          {renewalDue && (
            <Alert variant="destructive" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
              <AlertTriangle size={16} className="flex-shrink-0" />
              Renewal due — one or more policies are expiring soon or have lapsed. Review the renewal calendar below.
            </Alert>
          )}

          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiTile label="Active Policies" value={data.activePolicies} href="/erm/insurance/policies?status=ACTIVE" />
            <KpiTile label="Total Sum Insured" value={inrCompact(data.totalSumInsured)} />
            <KpiTile label="Annual Premium" value={inrCompact(data.annualPremium)} />
            <KpiTile label="Expiring (90d)" value={data.expiringSoon} tone="warn" href="/erm/insurance/policies?status=EXPIRING_SOON" />
            <KpiTile label="Open Claims Value" value={inrCompact(data.openClaimsValue)} />
            <KpiTile label="Uncovered Critical Risks" value={data.uncoveredCriticalRisks} tone="critical" href="/erm/insurance/coverage-gap" />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {/* Renewal calendar */}
            <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
              <h2 className="mb-1 text-sm font-semibold text-slate-900">Renewal Calendar (next 90 days)</h2>
              <p className="mb-3 text-xs text-slate-500">Policies approaching expiry — red rows need renewal action.</p>
              {(data.renewalCalendar ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">No policies expiring in the next 90 days.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[460px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-3 py-2">Code</TableHead>
                        <TableHead className="px-3 py-2">Policy</TableHead>
                        <TableHead className="px-3 py-2">Coverage end</TableHead>
                        <TableHead className="px-3 py-2 text-right">Days</TableHead>
                        <TableHead className="px-3 py-2">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.renewalCalendar.map((r) => {
                        const danger = r.status === "EXPIRING_SOON" || r.status === "EXPIRED";
                        return (
                          <TableRow key={r.policyCode} className={danger ? "bg-rose-50" : ""}>
                            <TableCell className="px-3 py-2 font-medium text-primary-700">{r.policyCode}</TableCell>
                            <TableCell className="max-w-[200px] truncate px-3 py-2 text-slate-700">{r.policyName}</TableCell>
                            <TableCell className="px-3 py-2 text-xs text-slate-500">{fmtDate(r.coverageEndDate)}</TableCell>
                            <TableCell className={"px-3 py-2 text-right text-xs tabular-nums " + (danger ? "font-semibold text-rose-700" : "text-slate-600")}>
                              {r.daysToExpiry}
                            </TableCell>
                            <TableCell className="px-3 py-2">{statusChip(r.status)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>

            {/* Coverage by type */}
            <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
              <h2 className="mb-1 text-sm font-semibold text-slate-900">Coverage Map by Policy Type</h2>
              <p className="mb-3 text-xs text-slate-500">Sum insured concentrated by line of cover.</p>
              <CoverageByTypeChart data={data.coverageByType ?? []} />
            </Card>
          </div>

          {/* Open claims */}
          <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
            <h2 className="mb-1 text-sm font-semibold text-slate-900">Open Claims</h2>
            <p className="mb-3 text-xs text-slate-500">Claims not yet settled or repudiated — manage on the relevant policy.</p>
            {(data.openClaims ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No open claims.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[520px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-3 py-2">Claim</TableHead>
                      <TableHead className="px-3 py-2">Policy</TableHead>
                      <TableHead className="px-3 py-2 text-right">Claimed</TableHead>
                      <TableHead className="px-3 py-2">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.openClaims.map((c) => (
                      <TableRow key={c.claimCode}>
                        <TableCell className="px-3 py-2 font-medium text-slate-800">{c.claimCode}</TableCell>
                        <TableCell className="px-3 py-2 text-xs text-slate-600">{c.policyCode ?? "—"}</TableCell>
                        <TableCell className="px-3 py-2 text-right text-xs tabular-nums text-slate-700">{inrCompact(c.claimedAmountInr)}</TableCell>
                        <TableCell className="px-3 py-2">
                          <span className={"inline-block rounded border px-2 py-0.5 text-[11px] " + (CLAIM_STATUS_CHIP[c.status] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
                            {c.status.replace(/_/g, " ")}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
