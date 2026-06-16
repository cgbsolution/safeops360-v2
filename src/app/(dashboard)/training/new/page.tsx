import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { TrainingForm } from "../training-form";
import { requirePermission } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function NewTrainingPage() {
  await requirePermission("TRAINING.CREATE");
  const programs = await prisma.trainingProgram.findMany({ orderBy: { name: "asc" } });
  const employees = await prisma.user.findMany({
    where: { role: { not: "ADMIN" } },
    select: { id: true, name: true, designation: true, department: true },
    orderBy: { name: "asc" }
  });

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Schedule / Record Training"
        description="Enrol an employee in a training program with attendance and assessment"
        breadcrumbs={[{ label: "Training", href: "/training" }, { label: "New" }]}
      />
      <TrainingForm programs={programs} employees={employees} />
    </div>
  );
}
