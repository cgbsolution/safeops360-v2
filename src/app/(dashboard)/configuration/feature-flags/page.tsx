import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { resolvePlantContext } from "@/lib/plant-context";
import { FeatureFlagsGrid, type PlantFlags } from "./feature-flags-grid";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type FeatureFlag = {
  plantId: string;
  eaiRegisterEnabled: boolean;
  combinedRegisterEnabled: boolean;
  riskDashboardEnabled: boolean;
  hiraAssistantV2Enabled: boolean;
};

export default async function FeatureFlagsPage(props: {
  searchParams: Promise<{ plantId?: string }>;
}) {
  const sp = await props.searchParams;
  const { plants } = await resolvePlantContext(sp.plantId);

  // One flag fetch per accessible plant. The GET endpoint returns an
  // all-disabled default when no row exists, so every plant resolves.
  const rows: PlantFlags[] = await Promise.all(
    plants.map(async (p) => {
      const flag = await backendFetch<FeatureFlag>(
        `/api/eai/feature-flag/${p.id}`
      ).catch(() => null);
      return {
        plantId: p.id,
        plantCode: p.code,
        plantName: p.name,
        eaiRegisterEnabled: flag?.eaiRegisterEnabled ?? false,
        combinedRegisterEnabled: flag?.combinedRegisterEnabled ?? false,
        riskDashboardEnabled: flag?.riskDashboardEnabled ?? false,
        hiraAssistantV2Enabled: flag?.hiraAssistantV2Enabled ?? false
      };
    })
  );

  return (
    <div>
      <PageHeader
        title="Feature Flags"
        description="Enable HIRA Phase 2/3 modules per plant — EAI Environmental Register, Combined Risk Register, Risk Aggregation Dashboard, and the HIRA AI Assistant v2."
        breadcrumbs={[
          { label: "Configuration", href: "/configuration" },
          { label: "Feature Flags" }
        ]}
      />

      {plants.length === 0 ? (
        <Card className="rounded-xl border bg-white p-8 text-sm text-slate-600 shadow-none">
          No plants are accessible to your account, so there are no feature
          flags to manage. Contact a System Administrator.
        </Card>
      ) : (
        <FeatureFlagsGrid rows={rows} highlightPlantId={sp.plantId ?? null} />
      )}
    </div>
  );
}
