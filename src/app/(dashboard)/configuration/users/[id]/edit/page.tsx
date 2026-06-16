import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { UserForm } from "../../user-form";
import { requirePermission } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function EditUserPage(props: { params: Promise<{ id: string }> }) {
  await requirePermission("CONFIGURATION.USERS");
  const params = await props.params;
  const u = await prisma.user.findUnique({ where: { id: params.id } });
  if (!u) return notFound();
  const [plants, roles] = await Promise.all([
    prisma.plant.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.role.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } })
  ]);
  return (
    <div className="max-w-2xl">
      <PageHeader
        title={`Edit: ${u.name}`}
        breadcrumbs={[
          { label: "Configuration", href: "/configuration" },
          { label: "Users", href: "/configuration/users" },
          { label: u.name, href: `/configuration/users/${u.id}` },
          { label: "Edit" }
        ]}
      />
      <UserForm initial={u} plants={plants} roles={roles} />
    </div>
  );
}
