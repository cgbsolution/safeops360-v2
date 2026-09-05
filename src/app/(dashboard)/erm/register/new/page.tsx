import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { type Category, type ScoringMatrix } from "../../lib";
import { NewRiskWizard } from "./wizard";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function NewRiskPage() {
  let categories: Category[] = [];
  let matrix: ScoringMatrix | null = null;
  let error: string | null = null;

  try {
    [categories, matrix] = await Promise.all([
      backendFetch<Category[]>("/api/erm/categories"),
      backendFetch<ScoringMatrix>("/api/erm/matrix"),
    ]);
  } catch (e: any) {
    error = e?.message ?? "Failed to load categories / scoring matrix";
  }

  return (
    <div>
      <PageHeader
        title="New Enterprise Risk"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Register", href: "/erm/register" },
          { label: "New" },
        ]}
        description="Identify, contextualise, assign ownership and capture the initial assessment for a new enterprise risk."
      />

      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</Alert>
      ) : (
        <NewRiskWizard categories={categories ?? []} matrix={matrix} />
      )}
    </div>
  );
}
