import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { InspectionForm } from "../inspection-form";
import { requirePermission } from "@/lib/auth/server";
import { getAccessiblePlants } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function NewInspectionPage() {
  await requirePermission("INSPECTION.CREATE");
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const userId = (session.user as any).id as string;

  // Restrict the equipment picker to plants the caller can actually create
  // inspections in. Without this the user could pick equipment from another
  // plant and only learn it's denied AFTER hitting Submit — which is exactly
  // the 403 path that prompted this fix.
  const accessiblePlants = await getAccessiblePlants(userId);
  const equipment = await prisma.equipment.findMany({
    where: {
      active: true,
      ...(accessiblePlants === null ? {} : { plantId: { in: accessiblePlants } })
    },
    select: {
      id: true,
      code: true,
      name: true,
      plantId: true,
      frequency: true,
      checklistTemplate: true,
      plant: { select: { id: true, name: true } }
    },
    orderBy: { name: "asc" }
  });

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Schedule / Conduct Inspection"
        description="Schedule a new equipment inspection or record completion of one"
        breadcrumbs={[{ label: "Inspections", href: "/inspections" }, { label: "New" }]}
      />
      {equipment.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <div className="mb-2 font-semibold">No equipment available in your scope</div>
          <p className="mb-3">
            You have permission to schedule inspections, but none of the equipment in the system
            belongs to a plant you can act in. Ask your administrator to either widen your
            <code className="mx-1 rounded bg-white px-1 py-0.5 font-mono text-xs">INSPECTION.CREATE</code>
            scope or register equipment at your plant.
          </p>
          <Link href="/inspections" className="font-medium text-primary-700 hover:underline">
            ← Back to inspections
          </Link>
        </div>
      ) : (
        <InspectionForm equipment={equipment} />
      )}
    </div>
  );
}
