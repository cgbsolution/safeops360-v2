import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { ActivateFlow, type ActivatablePlan, type ActivatableSite } from "./activate-flow";
import type { PlanListResponse } from "@/app/(dashboard)/erm/lib-p3";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

type Plant = { id: string; code: string; name: string };

export default async function CrisisActivatePage() {
  let plans: ActivatablePlan[] = [];
  let plants: ActivatableSite[] = [];
  let error: string | null = null;

  try {
    const [planResp, plantResp] = await Promise.all([
      backendFetch<PlanListResponse>("/api/erm/bcm/plans", { query: { status: "APPROVED" } }),
      backendFetch<Plant[]>("/api/plants").catch(() => [] as Plant[]),
    ]);
    plans = (planResp.items ?? []).map((p: any) => ({
      id: p.id,
      planCode: p.planCode,
      title: p.title,
      planType: p.planType,
      siteId: p.siteId ?? null,
      siteName: p.siteName ?? null,
      activationCriteria: Array.isArray(p.activationCriteria) ? p.activationCriteria : [],
    }));
    plants = plantResp.map((p) => ({ id: p.id, name: p.name }));
  } catch (e: any) {
    error = e?.message ?? "Failed to load approved continuity plans.";
  }

  return (
    <div>
      <PageHeader
        title="Activate Crisis"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Business Continuity", href: "/erm/bcm" },
          { label: "Crisis", href: "/erm/bcm/crisis" },
          { label: "Activate" },
        ]}
      />
      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</Alert>
      ) : (
        <ActivateFlow plans={plans} sites={plants} />
      )}
    </div>
  );
}
