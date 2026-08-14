import { backendFetch } from "@/lib/backend/fetch";
import { getPlants } from "@/lib/masters/plants";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { SlaMatrixEditor, type SlaConfig, type CategoryGroupRow } from "./sla-matrix-editor";

export const dynamic = "force-dynamic";

export default async function ObservationSlaPage(props: {
  searchParams: Promise<{ plantId?: string }>;
}) {
  const searchParams = await props.searchParams;
  await requirePermission("CONFIGURATION.MASTERS");

  // Scope: no plantId = the global default; a plantId = that plant's overrides
  // layered on top. There is no Tenant table in this schema, so the spec's
  // "tenant-scoped" config resolves to plant-scoped with a global fallback.
  const plantId = searchParams?.plantId || "";
  const [config, categoryGroups, plants] = await Promise.all([
    backendFetch<SlaConfig>(
      `/api/observations/sla-config${plantId ? `?plantId=${encodeURIComponent(plantId)}` : ""}`
    ),
    // The STOP category → Behavioural/Physical mapping is global, not
    // plant-scoped: it classifies the taxonomy itself, while the day counts
    // are what a plant overrides.
    backendFetch<CategoryGroupRow[]>("/api/observations/sla-config/category-groups").catch(
      () => [] as CategoryGroupRow[]
    ),
    getPlants()
  ]);

  return (
    <div>
      <PageHeader
        title="Observation SLA Matrix"
        description="Target closure dates are calculated from this matrix at submission. Changes apply to new observations only — every existing record keeps a frozen copy of the policy it was held to."
      />
      <SlaMatrixEditor
        initial={config}
        categoryGroups={categoryGroups}
        plants={plants}
        plantId={plantId}
      />
    </div>
  );
}
