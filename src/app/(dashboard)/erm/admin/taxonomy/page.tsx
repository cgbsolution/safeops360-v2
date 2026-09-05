import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { TaxonomyEditor } from "./taxonomy-editor";
import type { Category } from "@/app/(dashboard)/erm/lib";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function TaxonomyAdminPage() {
  let categories: Category[] = [];
  let error: string | null = null;
  try {
    categories = await backendFetch<Category[]>("/api/erm/categories");
  } catch (e: any) {
    error = e?.message ?? "Failed to load risk taxonomy";
  }

  return (
    <div>
      <PageHeader
        title="Risk Taxonomy"
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "Admin" }, { label: "Taxonomy" }]}
        description="The enterprise risk taxonomy — categories and sub-categories that classify every risk. System categories are locked and may only be deactivated. CRO / System Admin only."
      />
      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}. Ensure the ERM seed has been run and you hold the ERM.TAXONOMY_ADMIN permission.
        </Alert>
      ) : (
        <TaxonomyEditor categories={categories} />
      )}
    </div>
  );
}
