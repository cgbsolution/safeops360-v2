import { PageHeader } from "@/components/page-header";
import { NearMissForm } from "../near-miss-form";
import { requirePermission } from "@/lib/auth/server";
import { getPlantsWithAreas } from "@/lib/masters/plants";

export const dynamic = "force-dynamic";

export default async function NewNearMissPage() {
  await requirePermission("NEAR_MISS.CREATE");
  const plants = await getPlantsWithAreas();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Report Near Miss"
        description="An unplanned event that did not result in injury but could have"
        breadcrumbs={[{ label: "Near Miss", href: "/near-miss" }, { label: "New" }]}
      />
      <NearMissForm plants={plants.map((p) => ({ id: p.id, name: p.name, areas: p.areas.map((a) => ({ id: a.id, name: a.name })) }))} />
    </div>
  );
}
