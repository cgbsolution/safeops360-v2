import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can, invalidateUserPermissions } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const callerId = (session.user as any).id;
  const allowed = await can(callerId, "CONFIGURATION.USERS");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const body = await req.json();
  if (!body.roleId) return NextResponse.json({ error: "roleId is required" }, { status: 400 });

  const role = await prisma.role.findUnique({ where: { id: body.roleId } });
  if (!role || !role.isActive) {
    return NextResponse.json({ error: "Role not found or inactive" }, { status: 400 });
  }

  // De-dupe — if assignment already exists, return it
  const existing = await prisma.userRole.findFirst({
    where: { userId: params.id, roleId: body.roleId }
  });
  if (existing) {
    return NextResponse.json(existing);
  }

  const created = await prisma.userRole.create({
    data: {
      userId: params.id,
      roleId: body.roleId,
      scopeType: body.scopeType ?? null,
      scopeValue: body.scopeValue ?? null,
      assignedById: callerId,
      validTo: body.validTo ? new Date(body.validTo) : null
    } as any
  });
  invalidateUserPermissions(params.id);
  return NextResponse.json(created, { status: 201 });
}
