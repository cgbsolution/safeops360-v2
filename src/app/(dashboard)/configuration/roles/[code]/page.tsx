import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Users } from "lucide-react";
import { requirePermission } from "@/lib/auth/server";
import { RolePermissionMatrix } from "../role-permission-matrix";

export const dynamic = "force-dynamic";

const USER_LIST_LIMIT = 50;

export default async function RoleDetailPage(props: { params: Promise<{ code: string }> }) {
  await requirePermission("CONFIGURATION.ROLES");
  const params = await props.params;

  const role = await prisma.role.findUnique({
    where: { code: params.code },
    include: {
      permissions: { include: { permission: true } }
    }
  });
  if (!role) return notFound();

  // One entry per PERSON, not per UserRole row. A user who holds this role
  // across the whole group has one PLANT-scoped row per plant (that is what
  // named-users-sync.ts grants so OWN_PLANT reaches every site), so listing
  // assignment rows repeated the same few names down the panel, inflated the
  // count badge, and pushed everyone else past the 50-row cut-off.
  const userWhere = { userRoles: { some: { roleId: role.id } } };
  const [users, userCount] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }],
      take: USER_LIST_LIMIT
    }),
    prisma.user.count({ where: userWhere })
  ]);
  const truncated = userCount > users.length;

  const allPermissions = await prisma.permission.findMany({
    orderBy: [{ module: "asc" }, { action: "asc" }]
  });

  // Group permissions by module
  const grouped = new Map<string, typeof allPermissions>();
  for (const p of allPermissions) {
    const list = grouped.get(p.module) ?? [];
    list.push(p);
    grouped.set(p.module, list);
  }

  // Build current grants map
  const grants = new Map<string, string>();
  for (const rp of role.permissions) {
    grants.set(rp.permissionId, rp.scope);
  }

  return (
    <div>
      <PageHeader
        title={role.name}
        description={role.description ?? "Configure what users with this role can do."}
        breadcrumbs={[
          { label: "Configuration", href: "/configuration" },
          { label: "Roles", href: "/configuration/roles" },
          { label: role.name }
        ]}
        action={
          <div className="flex gap-2 items-center">
            {role.isSystem && (
              <Badge className="bg-primary-50 text-primary-700 border-primary-200">
                <Shield size={10} /> SYSTEM
              </Badge>
            )}
            <Badge className="bg-blue-50 text-blue-700">
              <Users size={10} className="mr-1" /> {userCount} {userCount === 1 ? "user" : "users"}
            </Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Permission Matrix</CardTitle>
              <CardDescription>
                Toggle a cell to grant or revoke a permission. Choose the scope: ALL_PLANTS / OWN_PLANT / OWN_DEPARTMENT / OWN_RECORDS.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RolePermissionMatrix
                roleId={role.id}
                roleCode={role.code}
                modules={[...grouped.entries()].map(([module, perms]) => ({
                  module,
                  permissions: perms.map((p) => ({
                    id: p.id,
                    code: p.code,
                    action: p.action,
                    description: p.description ?? null,
                    currentScope: grants.get(p.id) ?? null
                  }))
                }))}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Users with this role</CardTitle>
            <CardDescription>
              {userCount} assigned{truncated ? ` (showing first ${USER_LIST_LIMIT})` : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <p className="text-sm text-slate-500">No users currently hold this role.</p>
            ) : (
              <div className="space-y-1">
                {users.map((u) => (
                  <Link
                    key={u.id}
                    href={`/configuration/users/${u.id}`}
                    className="block text-sm hover:text-primary-700 hover:bg-slate-50 px-2 py-1 rounded"
                  >
                    {u.name} <span className="text-xs text-slate-500">({u.email})</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
