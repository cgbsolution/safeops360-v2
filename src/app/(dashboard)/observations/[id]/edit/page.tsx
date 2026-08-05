import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/page-header";
import { ObservationEditForm } from "../../observation-edit-form";

export const dynamic = "force-dynamic";

export default async function EditObservationPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id ?? "";

  const o = await prisma.observation.findUnique({
    where: { id: params.id },
    include: { plant: { include: { areas: { orderBy: { name: "asc" } } } } }
  });
  if (!o) notFound();

  // Gate: must hold OBSERVATION.UPDATE for this record. Pass plantId so the
  // OWN_PLANT scope can resolve (canUpdate() omits it). Backend re-checks.
  const check = await can(userId, "OBSERVATION.UPDATE", { plantId: o.plantId, recordId: o.id, record: o });
  if (!check.allowed) redirect(`/observations/${o.id}`);
  // Edit is only allowed while the observation is still open.
  if (o.status === "CLOSED") redirect(`/observations/${o.id}`);

  return (
    <div>
      <PageHeader
        title={`Edit ${o.number}`}
        description="Update the observation details. The reporter and original date stay locked."
        breadcrumbs={[
          { label: "Safety Observation", href: "/observations" },
          { label: o.number, href: `/observations/${o.id}` },
          { label: "Edit" }
        ]}
      />
      <ObservationEditForm
        observation={{
          id: o.id,
          number: o.number,
          plantId: o.plantId,
          type: o.type,
          category: o.category,
          categoryCode: o.categoryCode,
          subCategoryCode: o.subCategoryCode,
          severity: o.severity,
          description: o.description,
          areaId: o.areaId,
          targetDate: o.targetDate ? o.targetDate.toISOString() : null
        }}
        areas={o.plant?.areas ?? []}
      />
    </div>
  );
}
