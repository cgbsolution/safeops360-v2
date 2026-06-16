import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { getAccessiblePlantIds } from "@/lib/dashboard/scope";
import { NewSubmissionForm } from "./new-submission-form";

export const dynamic = "force-dynamic";

export default async function NewManhoursPage() {
  await requirePermission("MANHOURS.CREATE");
  const accessibleIds = await getAccessiblePlantIds();
  const plants = await prisma.plant.findMany({
    where: accessibleIds ? { id: { in: accessibleIds } } : undefined,
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true }
  });
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="New Manhours Submission"
        description="Pick the plant and reporting month — we'll create or open the matching submission and drop you into the wizard."
        breadcrumbs={[{ label: "Manhours", href: "/manhours" }, { label: "New" }]}
      />
      <NewSubmissionForm plants={plants} />
    </div>
  );
}
