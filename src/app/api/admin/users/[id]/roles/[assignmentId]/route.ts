import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can, invalidateUserPermissions } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string; assignmentId: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const callerId = (session.user as any).id;
  const allowed = await can(callerId, "CONFIGURATION.USERS");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  // Don't allow deleting a UserRole that mirrors the user's primary role —
  // that would leave the user without their declared primary. Caller can
  // change primary first via PATCH /users/[id].
  const ur = await prisma.userRole.findUnique({
    where: { id: params.assignmentId },
    include: { role: { select: { code: true } }, user: { select: { role: true, id: true } } }
  });
  if (!ur) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ur.user.id !== params.id) return NextResponse.json({ error: "Mismatched user" }, { status: 400 });
  if (ur.role.code === ur.user.role) {
    return NextResponse.json(
      { error: "Cannot remove the assignment that backs the user's primary role. Change primary first." },
      { status: 409 }
    );
  }

  await prisma.userRole.delete({ where: { id: params.assignmentId } });
  invalidateUserPermissions(params.id);
  return NextResponse.json({ ok: true });
}
