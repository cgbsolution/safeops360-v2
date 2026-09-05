import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import type { ComplianceTask } from "../../lib-p2";
import { ComplianceTasksView } from "./tasks-view";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function MyComplianceTasksPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  const rawView = Array.isArray(sp.view) ? sp.view[0] : sp.view;
  const view: "mine" | "verify" = rawView === "verify" ? "verify" : "mine";

  const query = view === "verify" ? { verifyQueue: true } : { mine: true };

  let tasks: ComplianceTask[] = [];
  let error: string | null = null;
  try {
    tasks = await backendFetch<ComplianceTask[]>("/api/erm/compliance/tasks", { query });
  } catch (e: any) {
    error = e?.message ?? "Failed to load compliance tasks";
  }

  return (
    <div>
      <PageHeader
        title="My Compliance Tasks"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Compliance", href: "/erm/compliance" },
          { label: "Tasks" },
        ]}
        description="Your attestation inbox and — for Compliance Officers — the verification queue. Add evidence, attest, verify or waive against statutory obligations."
      />
      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</Alert>
      ) : (
        <ComplianceTasksView tasks={tasks} view={view} />
      )}
    </div>
  );
}
