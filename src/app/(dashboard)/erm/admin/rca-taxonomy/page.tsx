import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import type { CategoryOut } from "../../rca/lib";
import { RcaTaxonomyView } from "./rca-taxonomy-view";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function RcaTaxonomyAdminPage() {
  let categories: CategoryOut[] = [];
  let error: string | null = null;
  try {
    categories = await backendFetch<CategoryOut[]>("/api/erm/rca/categories");
  } catch (e: any) {
    error = e?.message ?? "Failed to load the cause taxonomy";
  }

  return (
    <div>
      <PageHeader
        title="RCA Cause Taxonomy"
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "RCA Cause Taxonomy" }]}
        description="The two-layer controlled vocabulary: ~7 enterprise categories common to all domains, with domain-scoped sub-causes that each roll up to exactly one category."
      />
      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</Alert>
      ) : (
        <RcaTaxonomyView categories={categories} />
      )}
    </div>
  );
}
