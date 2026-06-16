// Server-side route guard. Call from a server-component page/layout to
// redirect unauthorised users to /access-denied.
//
//   await requirePermission("PTW.CREATE");
//
// Returns the resolved user when allowed; redirects (throws) when not.
// Use in app router pages, layouts, server actions.

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can, type PermissionContext } from "@/lib/auth/permissions";

export async function requirePermission(
  permissionCode: string,
  context?: PermissionContext
) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session.user as any).id as string;
  const result = await can(userId, permissionCode, context ?? {});
  if (!result.allowed) {
    const params = new URLSearchParams({
      code: permissionCode,
      reason: result.reason ?? ""
    });
    redirect(`/access-denied?${params.toString()}`);
  }
  return session.user;
}
