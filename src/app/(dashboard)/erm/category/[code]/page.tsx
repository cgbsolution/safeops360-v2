import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { CategoryDrilldownView, type CategoryDrilldown } from "./category-view";

export const dynamic = "force-dynamic";

export default async function ErmCategoryPage(props: { params: Promise<{ code: string }> }) {
  const { code } = await props.params;

  let data: CategoryDrilldown | null = null;
  let error: string | null = null;
  try {
    data = await backendFetch<CategoryDrilldown>(`/api/erm/dashboard/category/${encodeURIComponent(code)}`);
  } catch (e: any) {
    error = e?.message ?? "Failed to load category drilldown";
  }

  return (
    <div>
      <PageHeader
        title={data?.category?.name ? `${data.category.name} Risks` : `Category ${code}`}
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Register", href: "/erm/register" },
          { label: data?.category?.name ?? code },
        ]}
        description={data?.category?.description || "Category drilldown — sub-category mix, band distribution, heat map and the underlying risks."}
        action={
          <Link
            href={`/erm/register?category=${encodeURIComponent(code)}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:border-slate-400"
          >
            View in register
          </Link>
        }
      />
      {error || !data ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "No data for this category."} Ensure the ERM seed has been run and you are logged in with an ERM role.
        </div>
      ) : (
        <CategoryDrilldownView data={data} />
      )}
    </div>
  );
}
