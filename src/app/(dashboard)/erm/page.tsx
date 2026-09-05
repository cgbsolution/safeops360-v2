import Link from "next/link";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { ErmHomeView } from "./home-view";
import type { DashboardSummary, EnterpriseExposure } from "./lib";
import { fmtInr } from "./lib";
import type { BcmDashboard } from "./lib-p3";
import type { Tier3Summary } from "./lib-t3";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

const fallback: DashboardSummary = {
  totalActiveRisks: 0,
  criticalResidual: 0,
  highResidual: 0,
  mediumResidual: 0,
  lowResidual: 0,
  overdueReviews: 0,
  openTreatments: 0,
  overdueTreatments: 0,
  mitigationProgressPct: 0,
  escalatedThisQuarter: 0,
  inherentHeatMap: [],
  residualHeatMap: [],
  categoryBars: [],
  departmentBars: [],
  topRootCauses: [],
  topRisks: [],
  movement: [],
};

function quarterStart(d: Date) {
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
}

export default async function ErmHomePage() {
  let summary = fallback;
  let error: string | null = null;
  try {
    summary = await backendFetch<DashboardSummary>("/api/erm/dashboard/summary");
  } catch (e: any) {
    error = e?.message ?? "Failed to load ERM dashboard";
  }

  // Phase 2 KPIs — degrade gracefully if Phase 2 data isn't seeded.
  const noop = <T,>(v: T) => () => v;
  const [kriList, appetiteBreaches, lossList, bcm] = await Promise.all([
    backendFetch<{ statusCounts: Record<string, number>; breachesOpen: number }>("/api/erm/kris").catch(noop({ statusCounts: {} as Record<string, number>, breachesOpen: 0 })),
    backendFetch<any[]>("/api/erm/appetite/breaches", { query: { openOnly: true } }).catch(noop([] as any[])),
    backendFetch<{ items: { eventDate: string; netLossInr: number; isNearMiss: boolean; status: string }[] }>("/api/erm/loss/events").catch(noop({ items: [] as any[] })),
    backendFetch<BcmDashboard>("/api/erm/bcm/dashboard").catch(noop(null as BcmDashboard | null)),
  ]);
  // Tier 3 (Controls / Vendor / Insurance) — degrade gracefully if not licensed/seeded.
  const tier3 = await backendFetch<Tier3Summary>("/api/erm/tier3-summary").catch(noop(null as Tier3Summary | null));
  // ADVANCED — enterprise ₹ exposure headline (degrades if no ₹ data seeded).
  const exposure = await backendFetch<EnterpriseExposure>("/api/erm/exposure").catch(noop(null as EnterpriseExposure | null));
  const qStart = quarterStart(new Date());
  const netLossQtd = (lossList.items ?? [])
    .filter((e) => !e.isNearMiss && ["QUANTIFIED", "CLOSED"].includes(e.status) && new Date(e.eventDate) >= qStart)
    .reduce((s, e) => s + (e.netLossInr ?? 0), 0);
  const phase2 = {
    redKris: kriList.statusCounts?.RED ?? 0,
    openAppetiteBreaches: Array.isArray(appetiteBreaches) ? appetiteBreaches.length : 0,
    netLossQtd,
  };

  return (
    <div>
      <PageHeader
        title="Enterprise Risk Dashboard"
        breadcrumbs={[{ label: "Enterprise Risk" }, { label: "Dashboard" }]}
        description="Board-grade view of the enterprise risk register — fed live from the shop floor. Toggle inherent ↔ residual to see control effectiveness."
      />
      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}. Ensure the ERM seed has been run and you are logged in as a user with an ERM role
          (e.g. <code>anand.krishnan@safeops360.in</code>).
        </Alert>
      ) : (
        <>
          {/* ADVANCED — enterprise ₹ exposure headline banner */}
          {exposure && exposure.totalExpectedLossInr > 0 && (
            <Link
              href="/erm/exposure"
              className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-700 px-5 py-3 text-white transition-shadow hover:shadow-md"
            >
              <span className="inline-flex items-center gap-2 text-sm font-semibold">Enterprise Risk Exposure</span>
              <span className="text-sm"><span className="text-xl font-bold tabular-nums">{fmtInr(exposure.totalExpectedLossInr)}</span><span className="ml-1 text-xs opacity-80">expected loss / yr</span></span>
              <span className="text-xs opacity-90">top-5 drive <span className="font-semibold">{exposure.top5SharePct}%</span></span>
              <span className="text-xs opacity-90">concentration HHI <span className="font-semibold">{exposure.portfolioConcentrationIndex.toFixed(3)}</span></span>
              <span className="ml-auto text-xs font-medium uppercase tracking-wider opacity-90">Exposure & VaR →</span>
            </Link>
          )}
          {/* E-01 — BCM integration: active-crisis banner + continuity coverage */}
          {bcm && bcm.activeCrises > 0 && (
            <Link
              href="/erm/bcm/crisis"
              className="mb-4 flex items-center gap-3 rounded-xl border border-rose-300 bg-rose-600 px-5 py-3 text-white shadow-sm transition-colors hover:bg-rose-700"
            >
              <AlertTriangle size={20} className="shrink-0" />
              <span className="text-sm font-semibold">
                {bcm.activeCrises} active crisis{bcm.activeCrises > 1 ? "es" : ""} in progress — open the crisis workspace
              </span>
              <span className="ml-auto text-xs font-medium uppercase tracking-wider opacity-90">View →</span>
            </Link>
          )}
          {bcm && (
            <Link
              href="/erm/bcm"
              className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-white px-5 py-3 transition-shadow hover:shadow-md"
            >
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                <ShieldCheck size={16} className="text-primary-600" /> Business Continuity
              </span>
              <span className="text-sm">
                <span className={"text-lg font-bold tabular-nums " + (bcm.coveragePct >= 90 ? "text-emerald-600" : bcm.coveragePct >= 75 ? "text-amber-600" : "text-rose-600")}>{bcm.coveragePct}%</span>
                <span className="ml-1 text-xs text-slate-500">critical coverage ({bcm.coveredCritical}/{bcm.totalCritical})</span>
              </span>
              {bcm.unmitigatedSpofs > 0 && <span className="text-xs text-slate-600"><span className="font-semibold text-orange-600">{bcm.unmitigatedSpofs}</span> unmitigated SPOFs</span>}
              {bcm.coverageGaps.length > 0 && <span className="text-xs text-slate-600"><span className="font-semibold text-rose-600">{bcm.coverageGaps.length}</span> coverage gaps</span>}
              {bcm.exercisesOverdue > 0 && <span className="text-xs text-slate-600"><span className="font-semibold text-amber-600">{bcm.exercisesOverdue}</span> exercises overdue</span>}
              <span className="ml-auto text-xs font-medium text-primary-700">Open BCM →</span>
            </Link>
          )}
          {/* E-01 — Tier 3 board cards: material weaknesses · uncovered critical risks · lagging-ESG spend */}
          {tier3 && (tier3.controls || tier3.insurance || tier3.vendor) && (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {tier3.controls && (
                <Link href="/erm/controls/deficiencies?severity=MATERIAL_WEAKNESS" className="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Material Weaknesses</span>
                  <div className={"text-2xl font-bold tabular-nums " + (tier3.controls.materialWeaknesses > 0 ? "text-rose-600" : "text-emerald-600")}>{tier3.controls.materialWeaknesses}</div>
                  <span className="text-[11px] text-slate-400">{tier3.controls.openDeficiencies} open deficiencies · {tier3.controls.effectivePct}% effective</span>
                </Link>
              )}
              {tier3.insurance && (
                <Link href="/erm/insurance/coverage-gap" className="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Uncovered Critical Risks</span>
                  <div className={"text-2xl font-bold tabular-nums " + (tier3.insurance.uncoveredCriticalRisks > 0 ? "text-orange-600" : "text-emerald-600")}>{tier3.insurance.uncoveredCriticalRisks}</div>
                  <span className="text-[11px] text-slate-400">{tier3.insurance.expiringSoon} policies expiring · {tier3.insurance.activePolicies} active</span>
                </Link>
              )}
              {tier3.vendor && (
                <Link href="/erm/vendors/esg" className="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">LAGGING-ESG Spend</span>
                  <div className={"text-2xl font-bold tabular-nums " + (tier3.vendor.spendWeightedLaggingPct > 5 ? "text-rose-600" : "text-amber-600")}>{tier3.vendor.spendWeightedLaggingPct}%</div>
                  <span className="text-[11px] text-slate-400">{tier3.vendor.laggingEsg} LAGGING vendors · {tier3.vendor.highCriticalRisk} HIGH/CRITICAL risk</span>
                </Link>
              )}
            </div>
          )}
          <ErmHomeView summary={summary} phase2={phase2} />
        </>
      )}
    </div>
  );
}
