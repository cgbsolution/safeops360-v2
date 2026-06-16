import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const allowed = await can(userId, "INSPECTION_TYPE.READ");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const it = await prisma.inspectionType.findUnique({
    where: { id: params.id },
    include: {
      checklistTemplates: { orderBy: { version: "desc" } },
      defaultChecklistTemplate: true,
      _count: { select: { equipmentLinks: true, inspections: true } }
    }
  });
  if (!it) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(it);
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const allowed = await can(userId, "INSPECTION_TYPE.UPDATE");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const body = await req.json();
  const data: any = {};
  for (const key of [
    "name", "description", "category", "defaultFrequency", "applicableEquipmentCategories",
    "isStatutory", "statutoryReference", "regulatoryAuthority", "statutoryFormType",
    "retentionYears", "requiresCertifiedInspector", "requiredCertificationCodes",
    "defaultChecklistTemplateId", "workflowDefinitionCode", "isActive"
  ]) {
    if (key in body) data[key] = body[key];
  }
  try {
    const updated = await prisma.inspectionType.update({ where: { id: params.id }, data });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const allowed = await can(userId, "INSPECTION_TYPE.DELETE");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  // Soft delete via isActive — preserves referential integrity
  // for already-generated inspections.
  const it = await prisma.inspectionType.update({
    where: { id: params.id },
    data: { isActive: false }
  });
  return NextResponse.json(it);
}
