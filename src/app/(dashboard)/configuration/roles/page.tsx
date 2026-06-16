import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { RolesTable, type RoleRow } from "./roles-table";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  await requirePermission("CONFIGURATION.ROLES");

  const roles = await prisma.role.findMany({
    orderBy: [{ isSystem: "desc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      isSystem: true,
      isActive: true,
      _count: { select: { users: true, permissions: true } }
    }
  });

  const rows: RoleRow[] = roles.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description ?? null,
    isSystem: r.isSystem,
    usersCount: r._count.users,
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
