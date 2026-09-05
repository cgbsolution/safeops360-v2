import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { AppetiteEditor } from "./editor";
import type { AppetiteStatement, AppetiteDashRow } from "@/app/(dashboard)/erm/lib-p2";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function AppetiteStatementPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  let statements: AppetiteStatement[] = [];
  let dashRows: AppetiteDashRow[] = [];
  let error: string | null = null;
  try {
    [statements, dashRows] = await Promise.all([
      backendFetch<AppetiteStatement[]>("/api/erm/appetite/statements"),
      backendFetch<AppetiteDashRow[]>("/api/erm/appetite/dashboard").catch(
        () => [] as AppetiteDashRow[],
      ),
    ]);
  } catch (e: any) {
    error = e?.message ?? "Failed to load appetite statements";
  }

  const current = statements.find((s) => s.id === id) ?? null;

  if (error || !current) {
    return (
      <div>
        <PageHeader
          title="Appetite Statement"
          breadcrumbs={[
            { label: "Enterprise Risk", href: "/erm" },
            { label: "Appetite", href: "/erm/appetite" },
          ]}
        />
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "Appetite statement not found"}.{" "}
          <Link href="/erm/appetite" className="underline">
            Back to appetite dashboard
          </Link>
        </Alert>
      </div>
    );
  }

  // All versions for this category (the version-history panel).
  const versions = statements
    .filter((s) => s.categoryId === current.categoryId)
    .sort((a, b) => b.version - a.version);

  // Live observed values for this category, keyed by bandType.
  const dashRow = dashRows.find((r) => r.categoryId === current.categoryId) ?? null;

  return (
    <div>
      <PageHeader
        title={current.categoryName ?? current.categoryCode ?? "Appetite Statement"}
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Appetite", href: "/erm/appetite" },
          { label: `v${current.version} · ${current.status.replace(/_/g, " ")}` },
        ]}
        description="Edit the board appetite statement, tolerance bands, and run the approval workflow."
      />
      <AppetiteEditor statement={current} versions={versions} dashRow={dashRow} />
    </div>
  );
}
