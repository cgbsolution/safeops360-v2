import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ScheduleForm } from "../schedule-form";
import { requirePermission } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function NewTrainingSchedulePage() {
  await requirePermission("TRAINING.CREATE");
  const [plants, programs] = await Promise.all([
    prisma.plant.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.trainingProgram.findMany({
      where: { approvalStatus: "APPROVED", isActive: true },
      select: {
        id: true,
        programCode: true,
        code: true,
        programName: true,
        name: true,
        category: true,
        durationHours: true,
        durationSessions: true,
        maxParticipantsPerBatch: true,
        language: true,
        isStatutory: true,
      },
      orderBy: [{ isStatutory: "desc" }, { name: "asc" }],
    }),
  ]);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Schedule Training"
        description="Pick a program, set the date and venue, assign trainer, and bulk-nominate participants."
        breadcrumbs={[
          { label: "Training", href: "/training" },
          { label: "Schedules", href: "/training/schedules" },
          { label: "New" },
        ]}
      />
      <ScheduleForm plants={plants} programs={programs} />
    </div>
  );
}
