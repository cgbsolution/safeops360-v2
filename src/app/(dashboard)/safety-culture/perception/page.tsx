import { PageHeader } from "@/components/page-header";
import { backendFetch } from "@/lib/backend/fetch";
import { requirePermission } from "@/lib/auth/server";
import { resolvePlantContext } from "@/lib/plant-context";
import { PlantSelect, EmptyState, SiteRollupTable, type RollupRow } from "../ui";
import {
  PerceptionView,
  type PerceptionIndex,
  type PerceptionTrend,
  type ResponseRate,
  type TemplatesResponse,
} from "./perception-view";

export const dynamic = "force-dynamic";

async function PerceptionRollupSection() {
  let rollup: { rows: RollupRow[]; average?: number } = { rows: [] };
  try {
    rollup = await backendFetch("/api/culture/perception-surveys/rollup");
  } catch {
    /* keep empty */
  }
  const rows = (rollup.rows ?? []).map((r) => ({ ...r, periodLabel: r.period ?? "—" }));
  return (
    <SiteRollupTable
      rows={rows}
      headlineKey="compositeScore"
      headlineFormat="score"
      headlineLabel="Perception composite, ranked across sites"
      barKey="compositeScore"
      barColorMode="score"
      columns={[
        { key: "responseRatePercent", label: "resp", format: "pct" },
        { key: "periodLabel", label: "", format: "raw" },
      ]}
      average={rollup.average ?? null}
      averageLabel="Avg composite"
      emptyHint="Perception scores appear once sites cross the anonymity response threshold."
    />
  );
}

export default async function PerceptionPage(props: {
  searchParams: Promise<{ plant?: string; period?: string }>;
}) {
  await requirePermission("SAFETY_CULTURE.READ");
  const sp = await props.searchParams;
  const isRollup = sp.plant === "all";
  const { plantId, plants } = await resolvePlantContext(isRollup ? undefined : sp.plant);

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const period = sp.period ?? `${y}-Q${Math.floor((m - 1) / 3) + 1}`;

  const description =
    "Anonymous worker-perception surveys measure how safety really feels on the floor — trust in reporting, psychological safety, management commitment and peer accountability. Individual answers are never linked to a person, and scores stay withheld until a minimum response threshold is met.";

  if (isRollup) {
    return (
      <div>
        <PageHeader
          title="Worker Perception Survey"
          breadcrumbs={[{ label: "Safety Culture" }, { label: "Perception Survey" }]}
          description={description}
          action={<PlantSelect plants={plants} current="all" allowAll />}
        />
        <PerceptionRollupSection />
      </div>
    );
  }

  if (!plantId) {
    return (
      <div>
        <PageHeader
          title="Worker Perception Survey"
          breadcrumbs={[{ label: "Safety Culture" }, { label: "Perception Survey" }]}
          description={description}
          action={<PlantSelect plants={plants} current={plantId} allowAll />}
        />
        <EmptyState
          title="Select a site to view its perception index"
          hint="Perception scores are computed per site and per quarter."
        />
      </div>
    );
  }

  // Safe defaults so the page always renders even if the backend is unavailable.
  let rate: ResponseRate = {
    plantId,
    period,
    responseCount: 0,
    responseRatePercent: 0,
    thresholdMet: false,
  };
  let index: PerceptionIndex = {
    plantId,
    period,
    thresholdMet: false,
    responseCount: 0,
    responseRatePercent: 0,
    message: "Awaiting responses for this period.",
  };
  let templates: TemplatesResponse = { items: [] };
  let trend: PerceptionTrend = { plantId, series: [], benchmarkComposite: null, benchmarkLabel: "" };

  try {
    rate = await backendFetch<ResponseRate>(
      `/api/culture/perception-surveys/response-rate/${plantId}`,
      { query: { period } }
    );
  } catch {
    /* keep default */
  }

  try {
    trend = await backendFetch<PerceptionTrend>(`/api/culture/perception-surveys/trend/${plantId}`);
  } catch {
    /* keep default */
  }

  try {
    index = await backendFetch<PerceptionIndex>(
      `/api/culture/perception-surveys/index/${plantId}/${period}`
    );
  } catch {
    /* keep default */
  }

  try {
    templates = await backendFetch<TemplatesResponse>(
      "/api/culture/perception-surveys/templates"
    );
  } catch {
    /* keep default */
  }

  return (
    <div>
      <PageHeader
        title="Worker Perception Survey"
        breadcrumbs={[{ label: "Safety Culture" }, { label: "Perception Survey" }]}
        description={description}
        action={<PlantSelect plants={plants} current={plantId} allowAll />}
      />
      <PerceptionView
        plantId={plantId}
        plants={plants}
        period={period}
        rate={rate}
        index={index}
        templates={templates}
        trend={trend}
      />
    </div>
  );
}
