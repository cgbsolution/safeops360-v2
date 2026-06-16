import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const allowed = await can(userId, "CHECKLIST_TEMPLATE.READ");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const templates = await prisma.checklistTemplate.findMany({
    where: { isActive: true, approvalStatus: { in: ["APPROVED"] } },
    include: { _count: { select: { items: true } } },
    orderBy: { name: "asc" }
  });
  return NextResponse.json({ items: templates });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const allowed = await can(userId, "CHECKLIST_TEMPLATE.CREATE");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const body = await req.json();
  if (!body.code || !body.name || !body.inspectionTypeId) {
    return NextResponse.json({ error: "Code, name and inspection type are required" }, { status: 400 });
  }
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
  }

  try {
    const created = await prisma.checklistTemplate.create({
      data: {
        code: body.code,
        name: body.name,
        description: body.description ?? null,
        inspectionTypeId: body.inspectionTypeId,
        version: body.version ?? 1,
        applicableEquipmentCategories: body.applicableEquipmentCategories ?? [],
        approvalStatus: body.approvalStatus ?? "DRAFT",
        createdById: userId,
        items: {
          create: items.map((it: any, idx: number) => ({
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
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "A template with this code already exists. Use a new code or bump version." }, { status: 409 });
    }
    return NextResponse.json({ error: e.message ?? "Create failed" }, { status: 500 });
  }
}
