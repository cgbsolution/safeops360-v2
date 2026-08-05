import { PageHeader } from "@/components/page-header";
import { backendFetch } from "@/lib/backend/fetch";
import { requirePermission } from "@/lib/auth/server";
import { resolveUsers } from "@/lib/users/user-ref";
import { resolvePlantContext } from "@/lib/plant-context";
import { PlantSelect, EmptyState, SiteRollupTable, type RollupRow } from "../ui";
import { BbsView, type QualityIndex, type IntegrityFlags, type ClosureData } from "./bbs-view";

export const dynamic = "force-dynamic";

async function BbsRollupSection() {
  let rollup: { rows: RollupRow[]; average?: number } = { rows: [] };
  try {
    rollup = await backendFetch("/api/culture/observations/quality-index-rollup");
  } catch {
    /* keep empty */
  }
  return (
    <SiteRollupTable
      rows={rollup.rows ?? []}
      headlineKey="bbsQualityIndex"
      headlineFormat="score"
      headlineLabel="BBS Quality Index, ranked across sites"
      barKey="bbsQualityIndex"
      barColorMode="score"
      columns={[
        { key: "distinctObservers", label: "obs", format: "int" },
        { key: "verifiedClosures", label: "verified", format: "int" },
      ]}
      average={rollup.average ?? null}
      averageLabel="Avg index"
    />
  );
}

const DESCRIPTION =
  "A quality-weighted, per-observer-capped, closure-loop-multiplied index that replaces the raw observation count as the headline. Surfaces integrity coaching flags and tracks every observation Logged → Linked → Verified.";

export default async function BbsQualityPage(props: {
  searchParams: Promise<{ plant?: string }>;
}) {
  await requirePermission("SAFETY_CULTURE.READ");
  const sp = await props.searchParams;
  const isRollup = sp.plant === "all";
  const { plantId, plants } = await resolvePlantContext(isRollup ? undefined : sp.plant);

  const breadcrumbs = [{ label: "Safety Culture" }, { label: "BBS Quality" }];

  if (isRollup) {
    return (
      <div>
        <PageHeader
          title="BBS Observation Quality"
          breadcrumbs={breadcrumbs}
          description={DESCRIPTION}
          action={<PlantSelect plants={plants} current="all" allowAll />}
        />
        <BbsRollupSection />
      </div>
    );
  }

  if (!plantId) {
    return (
      <div>
        <PageHeader
          title="BBS Observation Quality"
          breadcrumbs={breadcrumbs}
          description={DESCRIPTION}
          action={<PlantSelect plants={plants} current={null} allowAll />}
        />
        <EmptyState
          title="Select a site to view its BBS quality index."
          hint="Choose a plant from the selector above to load its observation quality, integrity flags and closure loop."
        />
      </div>
    );
  }

  // Fetch the three endpoints independently — each degrades to a safe default so a
  // single backend hiccup never blanks the whole page.
  let quality: QualityIndex = {
    bbsQualityIndex: 0,
    observationCount: 0,
    weightedTotal: 0,
    cappedWeightedTotal: 0,
    expectedTarget: 0,
    distinctObservers: 0,
    verifiedClosures: 0,
  };
  try {
    quality = await backendFetch<QualityIndex>(`/api/culture/observations/quality-index/${plantId}`);
  } catch {
    /* keep defaults */
  }

  let integrity: IntegrityFlags = { plantId, flaggedCount: 0, flags: [], framing: "" };
  try {
    integrity = await backendFetch<IntegrityFlags>(`/api/culture/observations/integrity-flags/${plantId}`);
  } catch {
    /* keep defaults */
  }

  let closure: ClosureData = { plantId, items: [] };
  try {
    closure = await backendFetch<ClosureData>(`/api/culture/observations/closure/${plantId}`);
  } catch {
    /* keep defaults */
  }

  const observerIds = [
    ...(integrity.flags ?? []).map((f) => f.observerId),
    ...(closure.items ?? []).map((i) => i.observerId),
  ];
  const userDir = await resolveUsers(observerIds);

  return (
    <div>
      <PageHeader
        title="BBS Observation Quality"
        breadcrumbs={breadcrumbs}
        description={DESCRIPTION}
        action={<PlantSelect plants={plants} current={plantId} allowAll />}
      />
      <BbsView quality={quality} integrity={integrity} closure={closure} userDir={userDir} plantId={plantId} />
    </div>
  );
}
