import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can, invalidateUserPermissions } from "@/lib/auth/permissions";
import { backendFetch } from "@/lib/backend/fetch";

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

  // ...and the FastAPI process's cache, which is a SEPARATE five-minute
  // snapshot map in a different process. Clearing only the TypeScript one was
  // the reason a permission edit appeared to do nothing: every screen that
  // reaches the Python backend (the whole audit engine) kept serving the old
  // grants until the TTL expired, and on a multi-instance deployment it looked
  // intermittent — whichever instance answered decided which grants you saw.
  //
  // Best-effort: the grants are already committed, so a backend that is briefly
  // unreachable must not turn a successful save into an error. The cost of a
  // miss is the old five-minute delay, not a lost edit.
  // Clear it WHOLESALE, not just for the users currently in this role. A role
  // edit can change what a user sees through a second role, and the userRole
  // list is a snapshot that misses anyone assigned a moment later. Permission
  // edits are rare and the cache refills on the next request, so a full clear
  // costs one uncached page render and removes an entire class of "I changed it
  // and nothing happened".
  let backendCacheCleared = true;
  try {
    await backendFetch("/api/auth/permissions/invalidate", {
      method: "POST",
      body: {}
    });
  } catch (e) {
    backendCacheCleared = false;
    console.error("[rbac] backend permission cache not cleared:", e);
  }

  return NextResponse.json({
    ok: true,
    count: grants.filter((g) => g.scope !== null).length,
    // Surfaced so the admin screen can say "may take up to 5 minutes" rather
    // than implying the change is already live everywhere.
    backendCacheCleared
  });
}
