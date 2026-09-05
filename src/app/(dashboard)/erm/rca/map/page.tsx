import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import type { CauseRiskGraph, SubCauseOut } from "../lib";
import { CauseToRiskMap } from "./map-view";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function RcaMapPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const query: Record<string, string> = {};
  if (sp.subCauseId) query.subCauseId = sp.subCauseId;

  let graph: CauseRiskGraph = { nodes: [], edges: [] };
  let subCauses: SubCauseOut[] = [];
  let error: string | null = null;
  try {
    [graph, subCauses] = await Promise.all([
      backendFetch<CauseRiskGraph>("/api/erm/rca/analytics/cause-to-risk-graph", { query }),
      backendFetch<SubCauseOut[]>("/api/erm/rca/sub-causes").catch(() => [] as SubCauseOut[]),
    ]);
  } catch (e: any) {
    error = e?.message ?? "Failed to load the cause-to-risk map";
  }

  const focusOptions = subCauses.map((s) => ({ id: s.id, label: s.name }));

  return (
    <div>
      <PageHeader
        title="Cause-to-Risk Map"
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "RCA", href: "/erm/rca" }, { label: "Cause-to-Risk Map" }]}
        description="One root cause in the centre, the risks it drives radiating out — coloured by risk domain. The literal 'one cause, combination of risks' picture, with risk-to-risk chains."
      />
      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</Alert>
      ) : (
        <CauseToRiskMap graph={graph} focusOptions={focusOptions} focusValue={sp.subCauseId ?? ""} />
      )}
    </div>
  );
}
