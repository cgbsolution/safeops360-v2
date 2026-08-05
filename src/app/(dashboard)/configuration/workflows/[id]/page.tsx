import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WorkflowEditor } from "@/components/workflow/builder/editor";
import { requirePermission } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function WorkflowEditorPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requirePermission("CONFIGURATION.WORKFLOWS");

  const def = await prisma.workflowDefinition.findUnique({
    where: { id: params.id },
    include: {
      steps: {
        orderBy: { sequence: "asc" },
        include: { approverUser: { select: { id: true, name: true, designation: true } } }
      },
      _count: { select: { instances: true, versions: true } }
    }
  });
  if (!def) notFound();

  const dto = {
    id: def.id,
    module: def.module,
    recordType: def.recordType,
    name: def.name,
    description: def.description,
    isActive: def.isActive,
    instanceCount: def._count.instances,
    versionCount: def._count.versions,
    steps: def.steps.map((s) => ({
      id: s.id,
      sequence: s.sequence,
      stepType: s.stepType,
      name: s.name,
      approverRole: s.approverRole,
      approverField: s.approverField,
      approverUserId: s.approverUserId,
      approverUser: s.approverUser
        ? { id: s.approverUser.id, name: s.approverUser.name, designation: s.approverUser.designation }
        : null,
      approverGroupRoles: s.approverGroupRoles,
      slaHours: s.slaHours,
      slaUnit: s.slaUnit,
      escalationRole: s.escalationRole,
      isOptional: s.isOptional,
      conditionExpr: s.conditionExpr,
      notes: s.notes,
      // Not editable in the builder, but the editor must send them back on
      // save or the API's step-replace wipes them. See EditorStep in types.ts.
      parallelStrategy: s.parallelStrategy,
      slaBySeverity: s.slaBySeverity as Record<string, number> | null
    }))
  };

  return <WorkflowEditor initial={dto} />;
}
