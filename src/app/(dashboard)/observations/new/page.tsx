import { PageHeader } from "@/components/page-header";
import { ObservationForm } from "../observation-form";
import { requirePermission } from "@/lib/auth/server";
import { getPlantsWithAreas } from "@/lib/masters/plants";

export const dynamic = "force-dynamic";

export default async function NewObservationPage() {
  await requirePermission("OBSERVATION.CREATE");
  const plants = await getPlantsWithAreas();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New Safety Observation"
        description="Report a safe or unsafe act/condition for review and action"
        breadcrumbs={[{ label: "Observations", href: "/observations" }, { label: "New" }]}
      />
      <ObservationForm plants={plants.map((p) => ({ id: p.id, name: p.name, areas: p.areas.map((a) => ({ id: a.id, name: a.name })) }))} />
    </div>
  );
}
