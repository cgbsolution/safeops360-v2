import { PageHeader } from "@/components/page-header";
import { backendFetch } from "@/lib/backend/fetch";
import { RcaFieldInputsPanel } from "./panel";

export const dynamic = "force-dynamic";

type FieldInput = {
  id: string;
  fishboneCategory: string | null;
  causePath: { level: number; label?: string; code?: string }[];
  controlSuggestionIds: string[];
  note: string | null;
  transcriptOriginal: string | null;
  transcriptEnglish: string | null;
  isAnonymous: boolean;
  contributor: { id: string; name: string; designation: string | null } | null;
  promotedCauseId: string | null;
  createdAt: string | null;
};

// Officer review of technician RCA contributions (spec 1.3): grouped by
// fishbone, each attributable (or anonymous), one-click promote to an official
// cause node. Reachable from the daily-brief / field-reports surface.
export default async function RcaFieldInputsPage(props: { params: Promise<{ rcaId: string }> }) {
  const { rcaId } = await props.params;

  let byFishbone: Record<string, FieldInput[]> = {};
  let total = 0;
  let loadError: string | null = null;
  try {
    const data = await backendFetch<{ total: number; byFishbone: Record<string, FieldInput[]> }>(
      `/api/erm/rca/${rcaId}/field-inputs`,
    );
    byFishbone = data.byFishbone;
    total = data.total;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load field inputs";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Field Cause Inputs"
        breadcrumbs={[{ label: "Field Reports", href: "/field-reports" }, { label: "RCA contributions" }]}
        description="Structured cause suggestions contributed by field technicians. Promote any one to an official cause node — the provenance link is kept."
      />
      {loadError ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError}</p>
      ) : (
        <RcaFieldInputsPanel rcaId={rcaId} initialByFishbone={byFishbone} total={total} />
      )}
    </div>
  );
}
