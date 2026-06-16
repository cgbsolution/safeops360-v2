import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { RollupAdminView } from "./rollup-view";
import type { RollupRule } from "@/app/(dashboard)/erm/lib";

export const dynamic = "force-dynamic";

export default async function RollupAdminPage() {
  let rules: RollupRule[] = [];
  let error: string | null = null;
  try {
    rules = await backendFetch<RollupRule[]>("/api/erm/rollup-rules");
  } catch (e: any) {
    error = e?.message ?? "Failed to load rollup rules";
  }

  return (
    <div>
      <PageHeader
        title="Rollup Rules"
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "Admin" }, { label: "Rollup Rules" }]}
        description="Auto-aggregate operational entries (HIRA / EAI / Quality NCR) into enterprise risks. Preview matches before running; running creates and refreshes the linked enterprise risks."
      />
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}. Ensure the ERM seed has been run and you hold ERM.ROLLUP_ADMIN.
        </div>
      ) : (
        <RollupAdminView rules={rules} />
      )}
    </div>
  );
}
