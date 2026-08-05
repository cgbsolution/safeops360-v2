import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { HeatmapExplorer } from "./heatmap-view";
import type { DashboardSummary, RiskListResponse } from "../lib";

export const dynamic = "force-dynamic";

const summaryFallback: DashboardSummary = {
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

const risksFallback: RiskListResponse = {
  items: [],
  total: 0,
  categoryCounts: {},
  bandCounts: {},
  stateCounts: {},
};

export default async function ErmHeatmapPage() {
  let summary = summaryFallback;
  let risks = risksFallback;
  let error: string | null = null;
  try {
    [summary, risks] = await Promise.all([
      backendFetch<DashboardSummary>("/api/erm/dashboard/summary"),
      backendFetch<RiskListResponse>("/api/erm/risks"),
    ]);
  } catch (e: any) {
    error = e?.message ?? "Failed to load heat map";
  }

  return (
    <div>
      <PageHeader
        title="Heat Map Explorer"
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "Heat Map Explorer" }]}
        description="The enterprise 5×5 — inherent vs residual. Click any cell to see the risks sitting on it. Board-pack quality, ready to export."
      />
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}. Ensure the ERM seed has been run and you are logged in with an ERM role.
        </div>
      ) : (
        <HeatmapExplorer summary={summary} risks={risks} />
      )}
    </div>
  );
}
