import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import type { DependencyMap } from "@/app/(dashboard)/erm/lib-p3";
import { DepMapView } from "./dep-map-view";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function DependencyMapPage() {
  let map: DependencyMap = { nodes: [], edges: [] };
  let error: string | null = null;
  try {
    map = await backendFetch<DependencyMap>("/api/erm/bcm/dependency-map");
  } catch (e: any) {
    error = e?.message ?? "Failed to load dependency map";
  }

  return (
    <div>
      <PageHeader
        title="Dependency Map"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Business Continuity", href: "/erm/bcm" },
          { label: "Dependency Map" },
        ]}
        description="How critical processes depend on shared systems, equipment, vendors, utilities and people. Red nodes are unmitigated single points of failure; shared dependencies fan in from multiple processes."
      />
      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}. Ensure the ERM Phase 3 (BCM) seed has been run and you are logged in with a BCM role.
        </Alert>
      ) : (
        <DepMapView map={map} />
      )}
    </div>
  );
}
