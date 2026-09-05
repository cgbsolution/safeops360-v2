import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { LossView } from "./loss-view";
import type { Category, RiskListResponse } from "@/app/(dashboard)/erm/lib";
import type { LossListResponse, LossAnalytics } from "@/app/(dashboard)/erm/lib-p2";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

const emptyList: LossListResponse = {
  items: [],
  total: 0,
  statusCounts: {},
  netLossTotal: 0,
  nearMissPotentialTotal: 0,
};

const emptyAnalytics: LossAnalytics = {
  netLossByCategory: [],
  lossTrendByQuarter: [],
  topLosses: [],
  nearMissPotential: [],
  calibration: [],
};

export default async function LossRegisterPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const tab = sp.tab === "analytics" ? "analytics" : "register";

  const query: Record<string, string> = {};
  for (const k of ["category", "status", "source"]) {
    if (sp[k]) query[k] = sp[k]!;
  }

  let list = emptyList;
  let analytics: LossAnalytics | null = null;
  let categories: Category[] = [];
  let risks: RiskListResponse = { items: [], total: 0, categoryCounts: {}, bandCounts: {}, stateCounts: {} };
  let error: string | null = null;

  try {
    const tasks: Promise<unknown>[] = [
      backendFetch<LossListResponse>("/api/erm/loss/events", { query }),
      backendFetch<Category[]>("/api/erm/categories"),
      backendFetch<RiskListResponse>("/api/erm/risks"),
    ];
    if (tab === "analytics") {
      tasks.push(backendFetch<LossAnalytics>("/api/erm/loss/analytics"));
    }
    const results = await Promise.all(tasks);
    list = results[0] as LossListResponse;
    categories = results[1] as Category[];
    risks = results[2] as RiskListResponse;
    if (tab === "analytics") analytics = (results[3] as LossAnalytics) ?? emptyAnalytics;
  } catch (e: any) {
    error = e?.message ?? "Failed to load the loss event register";
  }

  return (
    <div>
      <PageHeader
        title="Loss Event Register & Analytics"
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "Loss Events" }]}
        description="Every realised loss and near-miss — quantified in rupees, attributed to a risk category, and calibrated against the residual register. The feedback loop that keeps scoring honest."
      />
      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</Alert>
      ) : (
        <LossView
          tab={tab}
          filters={{ category: sp.category ?? null, status: sp.status ?? null, source: sp.source ?? null }}
          list={list}
          analytics={analytics}
          categories={categories}
          risks={risks.items}
        />
      )}
    </div>
  );
}
