import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string; capaId: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const body = await req.json();
  const data: any = {};
  if (body.description !== undefined) data.description = body.description;
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.ownerId !== undefined) data.ownerId = body.ownerId;
  if (body.evidenceNote !== undefined) data.evidenceNote = body.evidenceNote;
  if (body.evidenceUrls !== undefined) data.evidenceUrls = body.evidenceUrls;

  if (body.status === "COMPLETED") {
    const allowed = await can(userId, "INSPECTION_FINDING.UPDATE");
    if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });
    data.status = "COMPLETED";
    data.completedById = userId;
    data.completedAt = new Date();
  } else if (body.status === "VERIFIED") {
    const allowed = await can(userId, "INSPECTION_FINDING.VERIFY");
    if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });
    data.status = "VERIFIED";
    data.verifiedById = userId;
    data.verifiedAt = new Date();
  } else if (body.status === "OPEN" || body.status === "IN_PROGRESS" || body.status === "REJECTED") {
    data.status = body.status;
  }

  const updated = await prisma.inspectionFindingCapa.update({ where: { id: params.capaId }, data });
  return NextResponse.json(updated);
}
