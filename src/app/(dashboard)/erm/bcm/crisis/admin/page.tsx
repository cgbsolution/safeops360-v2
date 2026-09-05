import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { AdminView } from "./admin-view";
import type { TeamRole, CallTree } from "@/app/(dashboard)/erm/lib-p3";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

type Plant = { id: string; code: string; name: string };

export default async function CrisisAdminPage() {
  let roster: TeamRole[] = [];
  let callTrees: CallTree[] = [];
  let plants: Plant[] = [];
  let error: string | null = null;

  try {
    [roster, callTrees, plants] = await Promise.all([
      backendFetch<TeamRole[]>("/api/erm/bcm/crisis-team"),
      backendFetch<CallTree[]>("/api/erm/bcm/call-trees"),
      backendFetch<Plant[]>("/api/plants").catch(() => [] as Plant[]),
    ]);
  } catch (e: any) {
    error = e?.message ?? "Failed to load the crisis team & call trees.";
  }

  return (
    <div>
      <PageHeader
        title="Crisis Team & Call Tree"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Business Continuity", href: "/erm/bcm" },
          { label: "Crisis", href: "/erm/bcm/crisis" },
          { label: "Team & Call Tree" },
        ]}
        description="The crisis roster (per site and corporate) and the published call trees that drive notification cascades. Every role must have a named alternate — no single-person crisis dependencies."
      />
      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</Alert>
      ) : (
        <AdminView roster={roster} callTrees={callTrees} plants={plants} />
      )}
    </div>
  );
}
