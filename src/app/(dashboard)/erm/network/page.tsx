import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { NetworkView } from "./network-view";
import type { NetworkGraph } from "../lib";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

const fallback: NetworkGraph = { nodes: [], edges: [] };

export default async function ErmNetworkPage() {
  let graph = fallback;
  let error: string | null = null;
  try {
    graph = await backendFetch<NetworkGraph>("/api/erm/network");
  } catch (e: any) {
    error = e?.message ?? "Failed to load risk interconnection map";
  }

  return (
    <div>
      <PageHeader
        title="Risk Interconnection Map"
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "Interconnection Map" }]}
        description="The enterprise risk network — how risks trigger, amplify and correlate with one another. Concentration here is where a single event becomes a crisis."
      />
      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}. Ensure the ERM seed has been run and you are logged in with an ERM role.
        </Alert>
      ) : (
        <NetworkView graph={graph} />
      )}
    </div>
  );
}
