import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { backendFetch } from "@/lib/backend/fetch";
import { getPlantAreas } from "@/lib/masters/plants";
import { can } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/page-header";
import { ObservationEditForm } from "../../observation-edit-form";

export const dynamic = "force-dynamic";

export default async function EditObservationPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id ?? "";

  // The GET already enforces OBSERVATION.READ for this record, so a caller who
  // cannot see it gets null here and lands on not-found.
  const o = await backendFetch<any>(`/api/observations/${params.id}`).catch(() => null);
  if (!o) notFound();
  // The area picker is scoped to the observation's own plant.
  const areas = await getPlantAreas(o.plantId).catch(() => []);

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
          department: o.department ?? null,
          // backendFetch returns parsed JSON, so this is already an ISO
          // string, not a Prisma Date — .toISOString() on it threw and took
          // the whole server render down ("This page didn't load"). Passing
          // the raw string through is also the correct fix for the date
          // itself: the form slices the first 10 chars, so re-parsing it into
          // a Date here would risk shifting the calendar day across the
          // IST/UTC boundary.
          targetDate: o.targetDate ?? null
        }}
        areas={areas}
      />
    </div>
  );
}
