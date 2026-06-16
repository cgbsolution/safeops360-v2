import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { NewStatementForm } from "./new-form";
import type { AppetiteDashRow } from "@/app/(dashboard)/erm/lib-p2";

export const dynamic = "force-dynamic";

export default async function NewAppetiteStatementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = sp["categoryId"];
  const categoryId = Array.isArray(raw) ? raw[0] : raw;

  let rows: AppetiteDashRow[] = [];
  let error: string | null = null;
  try {
    rows = await backendFetch<AppetiteDashRow[]>("/api/erm/appetite/dashboard");
  } catch (e: any) {
    error = e?.message ?? "Failed to load appetite categories";
  }

  const row = categoryId ? rows.find((r) => r.categoryId === categoryId) ?? null : null;

  if (error || !categoryId || !row) {
    return (
      <div>
        <PageHeader
          title="New Appetite Statement"
          breadcrumbs={[
            { label: "Enterprise Risk", href: "/erm" },
            { label: "Appetite", href: "/erm/appetite" },
          ]}
        />
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "No category selected for the new statement"}.{" "}
          <Link href="/erm/appetite" className="underline">
            Back to appetite dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Draft appetite — ${row.categoryName ?? row.categoryCode ?? ""}`}
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Appetite", href: "/erm/appetite" },
          { label: "New statement" },
        ]}
        description="Create the first appetite statement for this category. It starts as a draft and follows the approval workflow."
      />
      <NewStatementForm row={row} />
    </div>
  );
}
