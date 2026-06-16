import { PageHeader } from "@/components/page-header";
import { InspectionTypeForm } from "../inspection-type-form";
import { requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewInspectionTypePage() {
  await requirePermission("INSPECTION_TYPE.CREATE");
  const trainingPrograms = await prisma.trainingProgram.findMany({
    where: { isActive: true },
    select: { code: true, programCode: true, name: true, isStatutory: true },
    orderBy: { name: "asc" }
  });
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="New Inspection Type"
        description="Define a new inspection regimen — its category, default frequency, statutory awareness, and inspector competency gate."
        breadcrumbs={[
          { label: "Inspections", href: "/inspections" },
          { label: "Types", href: "/inspections/types" },
          { label: "New" }
        ]}
      />
      <InspectionTypeForm
        trainingPrograms={trainingPrograms.map((p) => ({
          code: p.programCode ?? p.code,
          name: p.name,
          isStatutory: p.isStatutory
        }))}
      />
    </div>
  );
}
