import { PageHeader } from "@/components/page-header";
import { backendFetch } from "@/lib/backend/fetch";
import { requirePermission } from "@/lib/auth/server";
import { resolvePlantContext } from "@/lib/plant-context";
import { PlantSelect, EmptyState, SiteRollupTable, type RollupRow } from "../ui";
import { LeadingLaggingView } from "./leading-lagging-view";
import type { LeadingLaggingDetail } from "../lib";

export const dynamic = "force-dynamic";

async function LlRollupSection() {
  let rollup: { rows: RollupRow[] } = { rows: [] };
  try {
    rollup = await backendFetch("/api/culture/leading-lagging-rollup");
  } catch {
    /* keep empty */
  }
  return (
    <SiteRollupTable
      rows={rollup.rows ?? []}
      headlineKey="ratio"
      headlineFormat="ratio"
      headlineLabel="Leading : Lagging ratio, ranked across sites"
      barKey="score"
      barColorMode="score"
      columns={[
        { key: "leading", label: "lead", format: "int" },
        { key: "lagging", label: "lag", format: "int" },
      ]}
    />
  );
}

const DESCRIPTION =
  "The balance between leading activity (walks, verified BBS closures, near-miss reports, trainings, audits) and lagging events (recordable incidents, LTIs, first-aid, property damage). Weighted 20% of the Culture Maturity score — and now with a visible formula, trend and target.";

export default async function LeadingLaggingPage(props: {
  searchParams: Promise<{ plant?: string }>;
}) {
  await requirePermission("SAFETY_CULTURE.READ");
  const sp = await props.searchParams;
  const isRollup = sp.plant === "all";
  const { plantId, plants } = await resolvePlantContext(isRollup ? undefined : sp.plant);

  const breadcrumbs = [{ label: "Safety Culture" }, { label: "Leading / Lagging Ratio" }];

  if (isRollup) {
    return (
      <div>
        <PageHeader
          title="Leading / Lagging Ratio"
          breadcrumbs={breadcrumbs}
          description={DESCRIPTION}
          action={<PlantSelect plants={plants} current="all" allowAll />}
        />
        <LlRollupSection />
      </div>
    );
  }

  if (!plantId) {
    return (
      <div>
        <PageHeader
          title="Leading / Lagging Ratio"
          breadcrumbs={breadcrumbs}
          description={DESCRIPTION}
          action={<PlantSelect plants={plants} current={null} allowAll />}
        />
        <EmptyState
          title="Select a site to view its leading/lagging balance."
          hint="Choose a plant from the selector above to load its ratio, 6-month trend and component breakdown."
        />
      </div>
    );
  }

  let detail: LeadingLaggingDetail | null = null;
  try {
    detail = await backendFetch<LeadingLaggingDetail>(`/api/culture/leading-lagging/${plantId}`);
  } catch {
    detail = null;
  }

  return (
    <div>
      <PageHeader
        title="Leading / Lagging Ratio"
        breadcrumbs={breadcrumbs}
        description={DESCRIPTION}
        action={<PlantSelect plants={plants} current={plantId} allowAll />}
      />
      {detail ? (
        <LeadingLaggingView detail={detail} />
      ) : (
        <EmptyState
          title="No leading/lagging data for this site yet."
          hint="Once observations, near-misses and incidents are recorded, the ratio populates automatically."
        />
      )}
    </div>
  );
}
