import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { PlantSwitcher } from "@/components/plant-switcher";
import { resolvePlantContext } from "@/lib/plant-context";
import type { RuleConfigResponse } from "@/lib/training-engine";
import { RulesForm } from "./rules-form";

export const dynamic = "force-dynamic";

export default async function RulesConfigPage(props: {
  searchParams: Promise<{ plantId?: string }>;
}) {
  const searchParams = await props.searchParams;
  const { plantId, plants } = await resolvePlantContext(searchParams.plantId);

  let data: RuleConfigResponse | null = null;
  let error: string | null = null;
  try {
    data = await backendFetch<RuleConfigResponse>("/api/training-engine/config", {
      query: { plantId: plantId ?? null }
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load rule configuration";
  }

  return (
    <div>
      <PageHeader
        title="Training Config — Rule Thresholds"
        description="Tune the thresholds and windows the competency engine uses to raise assignments. A plant-specific value overrides the global default."
        breadcrumbs={[
          { label: "People & Competency" },
          { label: "Skill Matrix", href: "/skill-matrix" },
          { label: "Rule Thresholds" }
        ]}
        action={<PlantSwitcher plants={plants} currentPlantId={plantId} />}
      />

      {error || !data ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "No configuration available."}
        </div>
      ) : (
        <RulesForm effective={data.effective} plantId={plantId} />
      )}
    </div>
  );
}
