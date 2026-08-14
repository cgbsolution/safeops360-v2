import { backendFetch } from "@/lib/backend/fetch";
import { getPlants } from "@/lib/masters/plants";
import { PageHeader } from "@/components/page-header";
import { ScheduleForm } from "../schedule-form";
import { requirePermission } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function NewTrainingSchedulePage() {
  await requirePermission("TRAINING.CREATE");
  const [plants, programs] = await Promise.all([
    getPlants(),
    // Only APPROVED + ACTIVE programmes can be scheduled — the endpoint's
    // default "workable set" is exactly that, so no filter is needed here.
    backendFetch<{ items: any[] }>("/api/training/programs")
      .then((r) => r.items)
      .catch(() => [] as any[])
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
