import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import type { CoverageGap, InsuranceDashboard } from "@/app/(dashboard)/erm/lib-t3";
import { GapView } from "./gap-view";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function CoverageGapPage() {
  let gaps: CoverageGap[] = [];
  let dashboard: InsuranceDashboard | null = null;
  let error: string | null = null;
  try {
    gaps = await backendFetch<CoverageGap[]>("/api/erm/insurance/coverage-gap");
    // Open-claims log is sourced from the dashboard (claims live on policy detail).
    try {
      dashboard = await backendFetch<InsuranceDashboard>("/api/erm/insurance/dashboard");
    } catch {
      dashboard = null;
    }
  } catch (e: any) {
    error = e?.message ?? "Failed to load coverage gap assessment";
  }

  return (
    <div>
      <PageHeader
        title="Coverage Gap & Risk Transfer"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Insurance & Transfer", href: "/erm/insurance" },
          { label: "Coverage Gap" },
        ]}
        description="Critical risks mapped against insurance cover — what is fully transferred, partially covered, uncovered or accepted as uninsurable. Raise transfer treatments for the gaps."
      />

      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}. Ensure the ERM Tier 3 seed has been run, and you are logged in with an insurance role.
        </Alert>
      ) : (
        <GapView gaps={gaps} openClaims={dashboard?.openClaims ?? []} />
      )}
    </div>
  );
}
