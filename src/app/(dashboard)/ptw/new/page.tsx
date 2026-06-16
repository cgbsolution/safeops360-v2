import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { PermitForm } from "../permit-form";
import { requirePermission } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function NewPermitPage() {
  await requirePermission("PTW.CREATE");
  const plants = await prisma.plant.findMany({ include: { areas: true }, orderBy: { name: "asc" } });

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="New Permit to Work"
        description="Initiate a permit request for high-risk work"
        breadcrumbs={[{ label: "Permits", href: "/ptw" }, { label: "New" }]}
      />
      <PermitForm plants={plants.map((p) => ({ id: p.id, name: p.name, areas: p.areas.map((a) => ({ id: a.id, name: a.name })) }))} />
    </div>
  );
}
