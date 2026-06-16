import { PageHeader } from "@/components/page-header";
import { ChecklistBuilder } from "../checklist-builder";
import { requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewChecklistPage(props: {
  searchParams: Promise<{ inspectionTypeId?: string }>;
}) {
  await requirePermission("CHECKLIST_TEMPLATE.CREATE");
  const sp = await props.searchParams;
  const types = await prisma.inspectionType.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, isStatutory: true },
    orderBy: { name: "asc" }
  });
  return (
    <div className="max-w-5xl">
      <PageHeader
        title="New Checklist Template"
        description="Build a typed-item checklist. Items can be Pass/Fail, numeric with thresholds, measurement, select, photo, signature, or section header."
        breadcrumbs={[
          { label: "Inspections", href: "/inspections" },
          { label: "Checklists", href: "/inspections/checklists" },
          { label: "New" }
        ]}
      />
      <ChecklistBuilder inspectionTypes={types} preselectedTypeId={sp.inspectionTypeId} />
    </div>
  );
}
