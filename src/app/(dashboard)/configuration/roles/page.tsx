import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { RolesTable, type RoleRow } from "./roles-table";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  await requirePermission("CONFIGURATION.ROLES");

  const [roles, assignments] = await Promise.all([
    prisma.role.findMany({
      orderBy: [{ isSystem: "desc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
        isActive: true,
        _count: { select: { permissions: true } }
      }
    }),
    // Counted here rather than via `_count: { users: true }`, which counts
    // UserRole ROWS: someone holding a role across the group has one
    // PLANT-scoped row per plant, so the column read several times the real
    // headcount. Tallied in JS because Prisma's `_count` has no DISTINCT.
    prisma.userRole.findMany({ select: { roleId: true, userId: true } })
  ]);

  const usersByRole = new Map<string, Set<string>>();
  for (const a of assignments) {
    const seen = usersByRole.get(a.roleId) ?? new Set<string>();
    seen.add(a.userId);
    usersByRole.set(a.roleId, seen);
  }

  const rows: RoleRow[] = roles.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description ?? null,
    isSystem: r.isSystem,
    usersCount: usersByRole.get(r.id)?.size ?? 0,
    permissionsCount: r._count.permissions,
    isActive: r.isActive
  }));

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        description="Each role bundles a set of permissions across modules. Edit the permission matrix to change what every user with that role can do."
        breadcrumbs={[{ label: "Configuration", href: "/configuration" }, { label: "Roles" }]}
      />

      <RolesTable data={rows} />
    </div>
  );
}
