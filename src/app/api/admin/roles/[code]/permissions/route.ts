import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can, invalidateUserPermissions } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

const VALID_SCOPES = new Set(["ALL_PLANTS", "OWN_PLANT", "OWN_DEPARTMENT", "OWN_RECORDS"]);

export async function PUT(req: NextRequest, props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const callerId = (session.user as any).id;
  const allowed = await can(callerId, "CONFIGURATION.PERMISSIONS");
  if (!allowed.allowed) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const role = await prisma.role.findUnique({ where: { code: params.code } });
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });

  const body = await req.json();
  const grants: { permissionId: string; scope: string | null }[] = body.grants ?? [];

  // Validate scopes
  for (const g of grants) {
    if (g.scope !== null && !VALID_SCOPES.has(g.scope)) {
      return NextResponse.json({ error: `Invalid scope: ${g.scope}` }, { status: 400 });
    }
  }

  await prisma.$transaction(async (tx) => {
    // Replace strategy: drop all existing rows for this role, then re-create
    // for the granted ones. Simpler than diffing and matches the matrix-edit
    // mental model.
    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
    const inserts = grants
      .filter((g) => g.scope !== null)
      .map((g) => ({
        roleId: role.id,
        permissionId: g.permissionId,
        scope: g.scope as any
      }));
    if (inserts.length > 0) {
      await tx.rolePermission.createMany({ data: inserts });
    }
  });

  // Invalidate the in-memory permission cache for every user in this role
  // so the next request re-reads from DB.
  const users = await prisma.userRole.findMany({
    where: { roleId: role.id },
    select: { userId: true }
  });
  for (const u of users) invalidateUserPermissions(u.userId);

  return NextResponse.json({ ok: true, count: grants.filter((g) => g.scope !== null).length });
}
