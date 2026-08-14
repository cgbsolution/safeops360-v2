import { getPlants } from "@/lib/masters/plants";
import { PageHeader } from "@/components/page-header";
import { ProgramForm } from "../program-form";
import { requirePermission } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function NewTrainingProgramPage() {
  await requirePermission("TRAINING.CREATE");
  const plants = await getPlants();

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="New Training Program"
        description="10-step setup. Saved as DRAFT — submit for HSE Manager review when ready."
        breadcrumbs={[
          { label: "Training", href: "/training" },
          { label: "Programs", href: "/training/programs" },
          { label: "New" }
        ]}
      />
      <ProgramForm plants={plants} />
    </div>
  );
}
