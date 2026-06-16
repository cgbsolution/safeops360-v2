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
  const allowed = await can(userId, "INSPECTION_TYPE.READ");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const types = await prisma.inspectionType.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" }
  });
  return NextResponse.json({ items: types });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const allowed = await can(userId, "INSPECTION_TYPE.CREATE");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const body = await req.json();
  if (!body.code || !body.name) {
    return NextResponse.json({ error: "Code and name are required" }, { status: 400 });
  }

  try {
    const created = await prisma.inspectionType.create({
      data: {
        code: body.code,
        name: body.name,
        description: body.description ?? null,
        category: body.category ?? "ROUTINE",
        defaultFrequency: body.defaultFrequency ?? "MONTHLY",
        applicableEquipmentCategories: body.applicableEquipmentCategories ?? [],
        isStatutory: !!body.isStatutory,
        statutoryReference: body.statutoryReference ?? null,
        regulatoryAuthority: body.regulatoryAuthority ?? null,
        statutoryFormType: body.statutoryFormType ?? null,
        retentionYears: body.retentionYears ?? 7,
        requiresCertifiedInspector: !!body.requiresCertifiedInspector,
        requiredCertificationCodes: body.requiredCertificationCodes ?? [],
        isActive: body.isActive ?? true
      }
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "An inspection type with this code already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: e.message ?? "Create failed" }, { status: 500 });
  }
}
