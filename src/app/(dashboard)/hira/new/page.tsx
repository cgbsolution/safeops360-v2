import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { StudyCreateForm } from "./study-create-form";

export const dynamic = "force-dynamic";

type WizardOptions = {
  plants: {
    id: string;
    code: string;
    name: string;
    departments: { id: string; name: string }[];
    areas: { id: string; name: string }[];
  }[];
  users: {
    id: string;
    name: string;
    email: string;
    department: string | null;
    plantId: string | null;
  }[];
  riskMatrices: {
    id: string;
    code: string;
    name: string;
    likelihoodLevels: number;
    severityLevels: number;
    isDefault: boolean;
    controlHierarchyEnforced: boolean;
  }[];
};

export default async function NewHiraStudyPage() {
  await requirePermission("HIRA.CREATE");

  const opts = await backendFetch<WizardOptions>("/api/hira/wizard/study-options");

  return (
    <div>
      <PageHeader
        title="New HIRA Study"
        description="Scope the study, pick the methodology, name the team. Entries are added next."
      />
      <StudyCreateForm
        plants={opts.plants}
        riskMatrices={opts.riskMatrices}
        users={opts.users}
      />
    </div>
  );
}
