import { PageHeader } from "@/components/page-header";
import { IncidentForm } from "../incident-form";
import { requirePermission } from "@/lib/auth/server";
import { getPlantsWithAreas } from "@/lib/masters/plants";

export const dynamic = "force-dynamic";

export default async function NewIncidentPage() {
  await requirePermission("INCIDENT.CREATE");
  const plants = await getPlantsWithAreas();

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Report Incident"
        description="Initiate formal incident investigation"
        breadcrumbs={[{ label: "Incidents", href: "/incidents" }, { label: "New" }]}
      />
      <IncidentForm plants={plants.map((p) => ({ id: p.id, name: p.name, areas: p.areas.map((a) => ({ id: a.id, name: a.name })) }))} />
    </div>
  );
}
