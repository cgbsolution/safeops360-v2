import { PageHeader } from "@/components/page-header";
import { NearMissForm } from "../near-miss-form";
import { requirePermission } from "@/lib/auth/server";
import { getPlants } from "@/lib/masters/plants";

export const dynamic = "force-dynamic";

export default async function NewNearMissPage() {
  await requirePermission("NEAR_MISS.CREATE");
  // Areas are no longer offered on the form — the site enters its location
  // by block and building as free text — so the plain plant list is enough.
  const plants = await getPlants();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Report Near Miss"
        description="An unplanned event that did not result in injury but could have"
        breadcrumbs={[{ label: "Near Miss", href: "/near-miss" }, { label: "New" }]}
      />
      <NearMissForm plants={plants.map((p) => ({ id: p.id, name: p.name }))} />
    </div>
  );
}
