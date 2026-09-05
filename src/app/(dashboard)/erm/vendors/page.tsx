import Link from "next/link";
import { ClipboardList, Leaf, PlusCircle } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { KpiTile } from "@/components/erm/shared";
import { ONBOARDING_CHIP, type VendorDashboard } from "@/app/(dashboard)/erm/lib-t3";
import { DualBandDonuts } from "./dashboard-charts";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const PIPELINE_ORDER = [
  "PROSPECT",
  "DUE_DILIGENCE",
  "APPROVED",
  "CONDITIONAL",
  "SUSPENDED",
  "OFFBOARDED",
] as const;

function pipelineLabel(token: string): string {
  return token.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function VendorDashboardPage() {
  let data: VendorDashboard | null = null;
  let error: string | null = null;
  try {
    data = await backendFetch<VendorDashboard>("/api/erm/vendors/dashboard");
  } catch (e: any) {
    error = e?.message ?? "Failed to load vendor dashboard";
  }

  return (
    <div>
      <PageHeader
        title="Vendor / Third-Party Risk"
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "Vendor Risk" }]}
        description="One vendor, two lenses — third-party RISK exposure and supplier ESG posture, scored and tracked together. Twin badges everywhere."
        action={
          <div className="flex gap-2">
            <Link
              href="/erm/vendors/register"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <ClipboardList size={16} /> Vendor Register
            </Link>
            <Link
              href="/erm/vendors/esg"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-800"
            >
              <Leaf size={16} /> ESG Portfolio
            </Link>
          </div>
        }
      />

      {error || !data ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "No dashboard data"}. Ensure the ERM Tier 3 seed has been run, and you are logged in with a vendor role.
        </Alert>
      ) : (
        <div className="space-y-5">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiTile label="Active Vendors" value={data.activeVendors} href="/erm/vendors/register?status=active" />
            <KpiTile label="Strategic / Critical" value={data.strategicCritical} tone="high" href="/erm/vendors/register?criticality=STRATEGIC" />
            <KpiTile label="High / Critical Risk" value={data.highCriticalRisk} tone="high" href="/erm/vendors/register?riskBand=CRITICAL" sub="Third-party risk band" />
            <KpiTile label="LAGGING ESG" value={data.laggingEsg} tone="critical" href="/erm/vendors/register?esgBand=LAGGING" sub="Worst ESG posture" />
            <KpiTile label="Single-Source" value={data.singleSource} tone="warn" href="/erm/vendors/register?singleSource=1" />
            <KpiTile label="Overdue Reviews" value={data.overdueReviews} tone="warn" href="/erm/vendors/register" />
          </div>

          {/* THE SIGNATURE — twin donuts */}
          <DualBandDonuts
            riskBandDistribution={data.riskBandDistribution ?? {}}
            esgBandDistribution={data.esgBandDistribution ?? {}}
          />

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            {/* Spend-weighted exposure */}
            <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
              <h2 className="mb-1 text-sm font-semibold text-slate-900">Spend-Weighted ESG Exposure</h2>
              <p className="mb-4 text-xs text-slate-500">% of annual spend committed to LAGGING-ESG vendors.</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold tabular-nums text-rose-600">
                  {(data.spendWeightedLaggingPct ?? 0).toFixed(1)}%
                </span>
                <Link href="/erm/vendors/esg" className="text-xs font-semibold text-primary-700 underline">
                  ESG portfolio →
                </Link>
              </div>
              <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-rose-500"
                  style={{ width: `${Math.min(100, Math.max(0, data.spendWeightedLaggingPct ?? 0))}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Spend concentration with the worst ESG performers — the headline supply-chain ESG risk number.
              </p>
            </Card>

            {/* Onboarding pipeline */}
            <Card className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-2 shadow-none">
              <h2 className="mb-1 text-sm font-semibold text-slate-900">Onboarding Pipeline</h2>
              <p className="mb-4 text-xs text-slate-500">Vendors by onboarding stage.</p>
              {(() => {
                const pipeline = data!.onboardingPipeline ?? {};
                const max = Math.max(1, ...PIPELINE_ORDER.map((s) => pipeline[s] ?? 0));
                return (
                  <ul className="space-y-2.5">
                    {PIPELINE_ORDER.map((s) => {
                      const v = pipeline[s] ?? 0;
                      return (
                        <li key={s} className="flex items-center gap-3">
                          <span
                            className={
                              "inline-block w-32 flex-shrink-0 rounded border px-2 py-0.5 text-center text-[11px] font-medium " +
                              (ONBOARDING_CHIP[s] ?? "border-slate-200 bg-slate-100 text-slate-600")
                            }
                          >
                            {pipelineLabel(s)}
                          </span>
                          <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
                            <div
                              className="h-full rounded bg-primary-500"
                              style={{ width: `${(v / max) * 100}%` }}
                            />
                          </div>
                          <span className="w-8 flex-shrink-0 text-right text-sm font-semibold tabular-nums text-slate-700">{v}</span>
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
              <div className="mt-4 flex justify-end">
                <Link
                  href="/erm/vendors/register"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:underline"
                >
                  <PlusCircle size={14} /> Onboard a vendor
                </Link>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
