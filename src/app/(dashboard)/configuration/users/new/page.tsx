import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { UserForm } from "../user-form";
import { requirePermission } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  await requirePermission("CONFIGURATION.USERS");
  const [plants, roles] = await Promise.all([
    prisma.plant.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.role.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } })
  ]);
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="New User"
        description="Create a user account. Default role can be changed any time after creation."
        breadcrumbs={[
          { label: "Configuration", href: "/configuration" },
          { label: "Users", href: "/configuration/users" },
          { label: "New" }
        ]}
      />
      <UserForm plants={plants} roles={roles} />
    </div>
  );
}
