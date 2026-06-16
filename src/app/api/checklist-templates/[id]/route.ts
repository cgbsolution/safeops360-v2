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
  const allowed = await can(userId, "CHECKLIST_TEMPLATE.READ");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const t = await prisma.checklistTemplate.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { sequence: "asc" } }, inspectionType: true }
  });
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(t);
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const allowed = await can(userId, "CHECKLIST_TEMPLATE.UPDATE");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const existing = await prisma.checklistTemplate.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ((existing.approvalStatus === "APPROVED" || existing.approvalStatus === "RETIRED") && existing.approvalStatus !== "APPROVED") {
    return NextResponse.json({ error: "Approved or retired templates are immutable" }, { status: 409 });
  }

  const body = await req.json();
  const data: any = {};
  for (const key of ["name", "description", "applicableEquipmentCategories", "approvalStatus", "version"]) {
    if (key in body) data[key] = body[key];
  }
  // Allow status flip to RETIRED on APPROVED templates
  if (existing.approvalStatus === "APPROVED" && body.approvalStatus !== "RETIRED" && Object.keys(data).length > 0) {
    return NextResponse.json({ error: "Approved templates can only be retired" }, { status: 409 });
  }

  // Items replacement: only allowed in DRAFT/UNDER_REVIEW
  if (Array.isArray(body.items) && existing.approvalStatus !== "APPROVED" && existing.approvalStatus !== "RETIRED") {
    const result = await prisma.$transaction(async (tx) => {
      await tx.checklistItem.deleteMany({ where: { templateId: params.id } });
      const updated = await tx.checklistTemplate.update({
        where: { id: params.id },
        data: {
          ...data,
          items: {
            create: body.items.map((it: any, idx: number) => ({
              sequence: it.sequence ?? idx + 1,
              sectionTitle: it.sectionTitle ?? null,
              itemText: it.itemText,
              itemType: it.itemType ?? "PASS_FAIL",
              options: it.options ?? null,
              units: it.units ?? null,
              minValue: it.minValue ?? null,
              maxValue: it.maxValue ?? null,
              expectedValue: it.expectedValue ?? null,
              isCritical: !!it.isCritical,
              requiresPhoto: !!it.requiresPhoto,
              requiresComment: !!it.requiresComment,
              guidanceText: it.guidanceText ?? null
            }))
          }
        }
      });
      return updated;
    });
    return NextResponse.json(result);
  }

  const updated = await prisma.checklistTemplate.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const allowed = await can(userId, "CHECKLIST_TEMPLATE.DELETE");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const updated = await prisma.checklistTemplate.update({
    where: { id: params.id },
    data: { approvalStatus: "RETIRED", isActive: false }
  });
  return NextResponse.json(updated);
}
