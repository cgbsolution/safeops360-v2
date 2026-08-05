import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { ExposureView } from "./exposure-view";
import type { EnterpriseExposure, CorrelatedExposure, FrameworkCoverage } from "../lib";

export const dynamic = "force-dynamic";

export default async function ExposurePage() {
  let exposure: EnterpriseExposure | null = null;
  let correlated: CorrelatedExposure | null = null;
  let frameworks: FrameworkCoverage | null = null;
  let error: string | null = null;
  try {
    [exposure, correlated, frameworks] = await Promise.all([
      backendFetch<EnterpriseExposure>("/api/erm/exposure"),
      backendFetch<CorrelatedExposure>("/api/erm/portfolio/correlated-exposure").catch(() => null),
      backendFetch<FrameworkCoverage>("/api/erm/frameworks/coverage").catch(() => null),
    ]);
  } catch (e: any) {
    error = e?.message ?? "Failed to load exposure";
  }

  return (
    <div>
      <PageHeader
        title="Enterprise Exposure & Value-at-Risk"
        description="Quantified ₹ exposure, concentration, correlated contagion and a Monte-Carlo loss distribution"
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "Exposure & VaR" }]}
      />
      {error || !exposure ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error ?? "No exposure data."}</div>
      ) : (
        <ExposureView exposure={exposure} correlated={correlated} frameworks={frameworks} />
      )}
    </div>
  );
}
