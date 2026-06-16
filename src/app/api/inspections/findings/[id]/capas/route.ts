import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const allowed = await can(userId, "INSPECTION_FINDING.UPDATE");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const body = await req.json();
  if (!body.description) return NextResponse.json({ error: "Description required" }, { status: 400 });

  const created = await prisma.inspectionFindingCapa.create({
    data: {
      findingId: params.id,
      capaType: body.capaType ?? "CORRECTIVE_ACTION",
      description: body.description,
      ownerId: body.ownerId ?? userId,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      status: "OPEN"
    }
  });
  return NextResponse.json(created, { status: 201 });
}
