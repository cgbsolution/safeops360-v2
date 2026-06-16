import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { MatrixEditor } from "./matrix-editor";
import type { ScoringMatrix } from "@/app/(dashboard)/erm/lib";

export const dynamic = "force-dynamic";

export default async function MatrixAdminPage() {
  let matrix: ScoringMatrix | null = null;
  let error: string | null = null;
  try {
    matrix = await backendFetch<ScoringMatrix>("/api/erm/matrix");
  } catch (e: any) {
    error = e?.message ?? "Failed to load scoring matrix";
  }

  return (
    <div>
      <PageHeader
        title="Scoring Matrix"
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "Admin" }, { label: "Scoring Matrix" }]}
        description="The enterprise 5×5 likelihood × impact matrix — likelihood guides, per-dimension impact descriptors and rating bands. Editing band thresholds re-bands existing assessments."
      />
      {error || !matrix ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "No active scoring matrix found"}. Ensure the ERM seed has been run and you hold ERM.MATRIX_ADMIN.
        </div>
      ) : (
        <MatrixEditor matrix={matrix} />
      )}
    </div>
  );
}
