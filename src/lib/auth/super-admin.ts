// Super Admin identity — the organisation owner.
//
// Mirrors _is_super_admin() in the Python licensing router, deliberately. Three
// independent paths, any of which suffices, so an RBAC edit can never orphan the
// organisation with nobody able to reach the module screen:
//   1. the ORGANISATION.MODULES permission (the canonical grant),
//   2. the SUPER_ADMIN role code on the user record or any of their role rows,
//   3. the configured anchor email (SUPER_ADMIN_EMAIL) — break-glass.
//
// Keep the two implementations in step: the Python API is the real boundary, so
// a Next-side guard that were stricter would lock the Super Admin out of a
// screen the API would happily serve, and one that were looser would render a
// page whose every request 403s.

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";

export const SUPER_ADMIN_ROLE_CODE = "SUPER_ADMIN";
export const SUPER_ADMIN_PERMISSION = "ORGANISATION.MODULES";

/** The anchor account, from SUPER_ADMIN_EMAIL. Must match the Python setting. */
export function superAdminAnchorEmail(): string {
  return (process.env.SUPER_ADMIN_EMAIL ?? "info@cgbindia.com").trim().toLowerCase();
}

export async function isSuperAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return false;
  const user = session.user as any;

  if (user.id) {
    const result = await can(user.id, SUPER_ADMIN_PERMISSION, {});
    if (result.allowed) return true;
  }
  if ((user.role ?? "").toUpperCase() === SUPER_ADMIN_ROLE_CODE) return true;

  const email = (user.email ?? "").trim().toLowerCase();
  if (email && email === superAdminAnchorEmail()) return true;

  // Role rows, in case the denormalised User.role column is stale.
  if (user.id) {
    const assigned = await prisma.userRole.findFirst({
      where: {
        userId: user.id,
        role: { code: SUPER_ADMIN_ROLE_CODE, isActive: true },
        OR: [{ validTo: null }, { validTo: { gt: new Date() } }]
      },
      select: { id: true }
    });
    if (assigned) return true;
  }
  return false;
}
