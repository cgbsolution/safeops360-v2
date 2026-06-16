import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { EaiStudyCreateForm } from "./study-create-form";

export const dynamic = "force-dynamic";

type ImpactMatrix = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  likelihoodLevels: number;
  magnitudeLevels: number;
  isDefault: boolean;
};

type Plant = {
  id: string;
  code: string;
  name: string;
  departments: { id: string; name: string }[];
  areas: { id: string; name: string }[];
};

type UserOption = {
  id: string;
  name: string;
  email: string;
  plantId: string | null;
};

type Regulation = {
  id: string;
  code: string;
  name: string;
};

export default async function EaiNewStudyPage(props: {
  searchParams: Promise<{ plantId?: string }>;
}) {
  const sp = await props.searchParams;

  // Reuse the HIRA wizard options endpoint — same shape (plants + users
  // with plant scope) so no new backend endpoint needed.
  const [matrices, wizardOpts, regulations] = await Promise.all([
    backendFetch<ImpactMatrix[]>("/api/eai/impact-matrices").catch(
      () => [] as ImpactMatrix[]
    ),
    backendFetch<{ plants: Plant[]; users: UserOption[] }>(
      "/api/hira/wizard/study-options"
    ).catch(() => ({ plants: [] as Plant[], users: [] as UserOption[] })),
    backendFetch<Regulation[]>("/api/eai/regulations").catch(
      () => [] as Regulation[]
    )
  ]);

  const plants = wizardOpts?.plants ?? [];
  const users = wizardOpts?.users ?? [];

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Create EAI Study"
        description="Define the scope and team for a new environmental aspect & impact assessment study."
      />

      <EaiStudyCreateForm
        defaultPlantId={sp.plantId ?? null}
        plants={plants}
        impactMatrices={matrices ?? []}
        users={users}
        regulations={regulations ?? []}
      />
    </div>
  );
}
