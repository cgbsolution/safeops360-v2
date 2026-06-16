import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { EquipmentForm } from "./equipment-form";

export const dynamic = "force-dynamic";

export default async function NewEquipmentPage() {
  await requirePermission("EQUIPMENT_MASTER.CREATE");

  const [plants, categoryRows] = await Promise.all([
    prisma.plant.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.equipment.findMany({
      where: { active: true },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" }
    })
  ]);

  const categories = categoryRows.map((c) => c.category).filter(Boolean);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Register Equipment"
        description="Add a new item to the Equipment Master. Code and plant are required; inspection regimens can be attached afterwards."
        breadcrumbs={[
          { label: "Inspections", href: "/inspections" },
          { label: "Equipment", href: "/inspections/equipment" },
          { label: "New" }
        ]}
      />
      <EquipmentForm plants={plants} categories={categories} />
    </div>
  );
}
