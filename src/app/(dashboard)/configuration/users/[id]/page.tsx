import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, Pencil, Mail, Building2, Briefcase } from "lucide-react";
import { Can } from "@/components/auth/can";
import { requirePermission } from "@/lib/auth/server";
import { UserRoleManager } from "../user-role-manager";
import { UserActions } from "../user-actions";

export const dynamic = "force-dynamic";

export default async function UserDetailPage(props: { params: Promise<{ id: string }> }) {
  await requirePermission("CONFIGURATION.USERS");
  const params = await props.params;
  const u = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      plant: true,
      userRoles: {
        include: { role: true },
        orderBy: { assignedAt: "desc" }
      } as any
    }
  });
  if (!u) return notFound();

  const allRoles = await prisma.role.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" }
  });

  // Resolve effective permissions (union across all active role grants)
  const activeUserRoles = (u.userRoles as any[]).filter((r) => !r.validTo || new Date(r.validTo) > new Date());
  const allRolePermissions = await prisma.rolePermission.findMany({
    where: { roleId: { in: activeUserRoles.map((r) => r.roleId) } },
    include: { permission: true }
  });
  const permGrouped = new Map<string, { code: string; module: string; action: string; scopes: Set<string> }>();
  for (const rp of allRolePermissions) {
    const k = rp.permission.code;
    const prev = permGrouped.get(k) ?? {
      code: rp.permission.code,
      module: rp.permission.module,
      action: rp.permission.action,
      scopes: new Set<string>()
    };
    prev.scopes.add(rp.scope);
    permGrouped.set(k, prev);
  }
  const effectivePermissions = [...permGrouped.values()].sort((a, b) => a.code.localeCompare(b.code));
  const permsByModule = new Map<string, typeof effectivePermissions>();
  for (const p of effectivePermissions) {
    const list = permsByModule.get(p.module) ?? [];
    list.push(p);
    permsByModule.set(p.module, list);
  }

  return (
    <div>
      <PageHeader
        title={u.name}
        description={u.email}
        breadcrumbs={[
          { label: "Configuration", href: "/configuration" },
          { label: "Users", href: "/configuration/users" },
          { label: u.name }
        ]}
        action={
          <div className="flex gap-2">
            <Can permission="CONFIGURATION.USERS">
              <Button asChild variant="ghost">
                <Link href={`/configuration/users/${u.id}/edit`}>
                  <Pencil size={14} /> Edit profile
                </Link>
              </Button>
            </Can>
            <UserActions userId={u.id} userName={u.name} userEmail={u.email} />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <Field icon={<Mail size={12} />} label="Email" value={u.email} />
            <Field icon={<Briefcase size={12} />} label="Designation" value={u.designation ?? "—"} />
            <Field icon={<Building2 size={12} />} label="Plant" value={u.plant ? `${u.plant.name} (${u.plant.code})` : "—"} />
            <Field icon={<Building2 size={12} />} label="Department" value={u.department ?? "—"} />
            <Field icon={null} label="Joined" value={new Date(u.createdAt).toLocaleDateString()} />
            <div className="pt-2 border-t mt-2">
              <span className="text-slate-500 text-xs uppercase tracking-wide">Primary role</span>
              <div className="mt-1">
                <Badge className="bg-primary-50 text-primary-700 border-primary-200">{u.role}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-primary-600" /> Role assignments
            </CardTitle>
            <CardDescription>
              Add or remove roles. Multiple roles are unioned — the user gets every permission from every active role.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserRoleManager
              userId={u.id}
              currentAssignments={(u.userRoles as any[]).map((r) => ({
                id: r.id,
                roleId: r.roleId,
                roleName: r.role.name,
                roleCode: r.role.code,
                scopeType: r.scopeType,
                scopeValue: r.scopeValue,
                validTo: r.validTo
              }))}
              allRoles={allRoles.map((r) => ({ id: r.id, code: r.code, name: r.name, isSystem: r.isSystem }))}
              primaryRole={u.role}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-amber-600" />
              Effective permissions ({effectivePermissions.length})
            </CardTitle>
            <CardDescription>
              The union of permissions from all active role assignments. Read-only — to change, edit the underlying roles or assignments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {effectivePermissions.length === 0 ? (
              <p className="text-sm text-slate-500">No permissions yet — assign at least one active role.</p>
            ) : (
              <div className="space-y-3">
                {[...permsByModule.entries()].map(([module, perms]) => (
                  <div key={module}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{module}</div>
                    <div className="flex flex-wrap gap-1">
                      {perms.map((p) => {
                        const widest = pickWidestScope([...p.scopes]);
                        return (
                          <Badge key={p.code} className={SCOPE_BADGE[widest]} title={p.code}>
                            {p.action}
                            <span className="opacity-60 ml-1">{SCOPE_LABEL[widest]}</span>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const SCOPE_RANK: Record<string, number> = {
  ALL_PLANTS: 4, OWN_PLANT: 3, OWN_DEPARTMENT: 2, OWN_RECORDS: 1
};
function pickWidestScope(scopes: string[]): string {
  return scopes.sort((a, b) => (SCOPE_RANK[b] ?? 0) - (SCOPE_RANK[a] ?? 0))[0] ?? "OWN_RECORDS";
}
const SCOPE_LABEL: Record<string, string> = {
  ALL_PLANTS: "ALL", OWN_PLANT: "PLANT", OWN_DEPARTMENT: "DEPT", OWN_RECORDS: "OWN"
};
const SCOPE_BADGE: Record<string, string> = {
  ALL_PLANTS: "bg-rose-50 text-rose-700 border-rose-200",
  OWN_PLANT: "bg-amber-50 text-amber-700 border-amber-200",
  OWN_DEPARTMENT: "bg-blue-50 text-blue-700 border-blue-200",
  OWN_RECORDS: "bg-slate-100 text-slate-700 border-slate-200"
};

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="text-slate-500 text-xs uppercase tracking-wide flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
