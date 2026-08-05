import { PageHeader } from "@/components/page-header";
import { backendFetch } from "@/lib/backend/fetch";
import { requirePermission } from "@/lib/auth/server";
import { KriBanner } from "./ui";
import { MaturityView } from "./maturity-view";
import type { EnterpriseRollup, MaturityProfile } from "./lib";

export const dynamic = "force-dynamic";

export default async function SafetyCulturePage(props: {
  searchParams: Promise<{ site?: string }>;
}) {
  await requirePermission("SAFETY_CULTURE.READ");
  const sp = await props.searchParams;

  let rollup: EnterpriseRollup = { enterpriseScore: 0, siteCount: 0, stageCounts: {}, sites: [] };
  let error: string | null = null;
  try {
    rollup = await backendFetch<EnterpriseRollup>("/api/culture/maturity/enterprise");
  } catch (e: any) {
    error = e?.message ?? "Failed to load culture maturity";
  }

  let siteDetail: MaturityProfile | null = null;
  if (sp.site) {
    siteDetail = await backendFetch<MaturityProfile>(`/api/culture/maturity/${sp.site}`).catch(() => null);
  }

  return (
    <div>
      <PageHeader
        title="Safety Culture Maturity"
        breadcrumbs={[{ label: "Safety Culture" }, { label: "Culture Maturity" }]}
        description="A live maturity engine across every site — Reactive → Interdependent — computed from leadership engagement, worker participation, leading/lagging balance, BBS quality and worker perception. Recalculated nightly and on demand."
      />
      <KriBanner />
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>
      ) : (
        <MaturityView rollup={rollup} siteDetail={siteDetail} selectedSite={sp.site ?? null} />
      )}
    </div>
  );
}
