import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ChecklistBuilder } from "../../checklist-builder";
import { requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function EditChecklistPage(props: { params: Promise<{ id: string }> }) {
  await requirePermission("CHECKLIST_TEMPLATE.UPDATE");
  const params = await props.params;
  const t = await prisma.checklistTemplate.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { sequence: "asc" } } }
  });
  if (!t) return notFound();
  if (t.approvalStatus === "APPROVED" || t.approvalStatus === "RETIRED") {
    return (
      <div className="max-w-3xl">
        <PageHeader
          title="Cannot edit"
          description="Approved or retired templates are immutable. Create a new version instead."
          breadcrumbs={[
            { label: "Inspections", href: "/inspections" },
            { label: "Checklists", href: "/inspections/checklists" },
            { label: t.code, href: `/inspections/checklists/${t.id}` },
            { label: "Edit" }
          ]}
        />
        <Alert variant="warning" className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          To change an approved template, create a new version (bumped version number, links back to this template).
        </Alert>
      </div>
    );
  }
  const types = await prisma.inspectionType.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, isStatutory: true },
    orderBy: { name: "asc" }
  });
  return (
    <div className="max-w-5xl">
      <PageHeader
        title={`Edit: ${t.name}`}
        description="Edit the items, save as draft, or submit for approval."
        breadcrumbs={[
          { label: "Inspections", href: "/inspections" },
          { label: "Checklists", href: "/inspections/checklists" },
          { label: t.code, href: `/inspections/checklists/${t.id}` },
          { label: "Edit" }
        ]}
      />
      <ChecklistBuilder initial={t} inspectionTypes={types} />
    </div>
  );
}
