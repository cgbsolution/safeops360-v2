import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { InspectionTypeForm } from "../../inspection-type-form";
import { requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditInspectionTypePage(props: { params: Promise<{ id: string }> }) {
  await requirePermission("INSPECTION_TYPE.UPDATE");
  const params = await props.params;
  const t = await prisma.inspectionType.findUnique({ where: { id: params.id } });
  if (!t) return notFound();
  const trainingPrograms = await prisma.trainingProgram.findMany({
    where: { isActive: true },
    select: { code: true, programCode: true, name: true, isStatutory: true },
    orderBy: { name: "asc" }
  });
  return (
    <div className="max-w-4xl">
      <PageHeader
        title={`Edit: ${t.name}`}
        breadcrumbs={[
          { label: "Inspections", href: "/inspections" },
          { label: "Types", href: "/inspections/types" },
          { label: t.code, href: `/inspections/types/${t.id}` },
          { label: "Edit" }
        ]}
      />
      <InspectionTypeForm
        initial={t}
        trainingPrograms={trainingPrograms.map((p) => ({
          code: p.programCode ?? p.code,
          name: p.name,
          isStatutory: p.isStatutory
        }))}
      />
    </div>
  );
}
