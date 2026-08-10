import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Can } from "@/components/auth/can";
import { requirePermission } from "@/lib/auth/server";
import { UsersTable, type UserRow } from "./users-table";

export const dynamic = "force-dynamic";

const ADMIN_LIKE_ROLES = new Set(["ADMIN", "CORPORATE_HSE", "PLANT_HEAD"]);

export default async function UsersPage(props: {
  searchParams: Promise<{ q?: string; role?: string; plant?: string }>;
}) {
  await requirePermission("CONFIGURATION.USERS");
  const sp = await props.searchParams;

  const where: any = {};
  if (sp.q) {
    where.OR = [
      { name: { contains: sp.q, mode: "insensitive" } },
      { email: { contains: sp.q, mode: "insensitive" } }
    ];
  }
  if (sp.role) where.role = sp.role;
  if (sp.plant) where.plantId = sp.plant;

  const [users, plants, roles] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        designation: true,
        department: true,
        plantId: true,
        plant: { select: { name: true, code: true } },
        userRoles: {
          where: { OR: [{ validTo: null }, { validTo: { gt: new Date() } }] },
          select: { role: { select: { code: true, name: true, isActive: true } } }
        }
      },
      orderBy: [{ name: "asc" }],
      take: 200
    }),
    prisma.plant.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.role.findMany({ where: { isActive: true }, select: { code: true, name: true }, orderBy: { sortOrder: "asc" } })
  ]);

  const rows: UserRow[] = users.map((u) => {
    const isAdminLike = ADMIN_LIKE_ROLES.has(u.role) || u.userRoles.some((r) => ADMIN_LIKE_ROLES.has(r.role.code));
    const additional = u.userRoles
      .map((r) => r.role)
      .filter((r) => r.code !== u.role && r.isActive)
      .map((r) => r.name);
    return {
      id: u.id,
      name: u.name,
      designation: u.designation ?? null,
      email: u.email,
      primaryRole: u.role,
      additionalRoles: additional,
      isAdminLike,
      plantName: u.plant?.name ?? null,
      department: u.department ?? null
    };
  });

  const adminLikeCount = rows.filter((r) => r.isAdminLike).length;

  return (
    <div>
      <PageHeader
        title="Users"
        description="View, create, edit, and deactivate user accounts. Assign roles, override plant / department, monitor permissions."
        breadcrumbs={[{ label: "Configuration", href: "/configuration" }, { label: "Users" }]}
        action={
          <Can permission="CONFIGURATION.USERS">
            <Button asChild>
              <Link href="/configuration/users/new">
                <Plus size={16} /> New user
              </Link>
            </Button>
          </Can>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total users" value={users.length} />
        <Stat label="Admin-like" value={adminLikeCount} tone="rose" />
        <Stat label="Active roles" value={roles.length} />
        <Stat label="Plants covered" value={new Set(users.map((u) => u.plantId)).size} />
      </div>

      <form className="mb-4 flex flex-wrap gap-2" action="/configuration/users">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search by name or email…"
          className="w-72 rounded-md border border-slate-200 px-3 py-2 text-sm"
        />
        <select name="role" defaultValue={sp.role ?? ""} className="rounded-md border border-slate-200 px-2 py-2 text-sm">
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>
        <select name="plant" defaultValue={sp.plant ?? ""} className="rounded-md border border-slate-200 px-2 py-2 text-sm">
          <option value="">All plants</option>
          {plants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button type="submit" variant="ghost">Filter</Button>
      </form>

      <UsersTable data={rows} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "rose" | "emerald" }) {
  const cls: Record<string, string> = {
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900"
  };
  return (
    <div className={["rounded-md border p-3", tone ? cls[tone] : "border-slate-200 bg-white"].join(" ")}>
      <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
