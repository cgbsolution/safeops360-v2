import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import type { Analytics } from "../lib-cams";
import { AnalyticsView } from "./analytics-view";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await requirePermission("CAMS.ANALYTICS");
  let data: Analytics | null = null;
  let error: string | null = null;
  try {
    data = await backendFetch<Analytics>("/api/cams/analytics");
  } catch (e: any) {
    error = e?.message ?? "Failed to load audit analytics";
  }

  return (
    <div>
      <PageHeader
        title="Audit Analytics & Benchmarking"
        description="Programme health, findings Pareto, clause conformance, and site-vs-site benchmarking — the certification-readiness view. Repeat findings are surfaced here, not left for the external auditor to find."
        breadcrumbs={[{ label: "CAMS", href: "/cams" }, { label: "Analytics" }]}
      />
      {error || !data ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error ?? "No data"}</div>
      ) : (
        <AnalyticsView a={data} />
      )}
    </div>
  );
}
