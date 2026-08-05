import { PageHeader } from "@/components/page-header";
import { backendFetch } from "@/lib/backend/fetch";
import { requirePermission } from "@/lib/auth/server";
import { resolvePlantContext } from "@/lib/plant-context";
import { resolveUsers } from "@/lib/users/user-ref";
import { PlantSelect, EmptyState, SiteRollupTable, type RollupRow } from "../ui";
import { LeadershipView } from "./leadership-view";
import type { LeaderOption, LeadershipCompliance, Walk } from "./leadership-view";

export const dynamic = "force-dynamic";

async function RollupSection() {
  let rollup: { rows: RollupRow[]; average?: number } = { rows: [] };
  try {
    rollup = await backendFetch("/api/culture/leadership-walks/compliance-rollup");
  } catch {
    /* keep empty */
  }
  const rows = (rollup.rows ?? []).map((r) => ({
    ...r,
    walksLabel: `${Number(r.completedWalks) || 0}/${Number(r.scheduledWalks) || 0}`,
  }));
  return (
    <SiteRollupTable
      rows={rows}
      headlineKey="complianceToSchedule"
      headlineFormat="pct"
      headlineLabel="Walk compliance to schedule, ranked across sites"
      barKey="complianceToSchedule"
      barColorMode="score"
      columns={[
        { key: "walksLabel", label: "done", format: "raw" },
        { key: "engagementScore", label: "eng", format: "score" },
      ]}
      average={rollup.average ?? null}
      averageLabel="Avg compliance"
    />
  );
}

const EMPTY_COMPLIANCE: LeadershipCompliance = {
  complianceToSchedule: 0,
  engagementScore: 0,
  walkQuality: 0,
  scheduledWalks: 0,
  completedWalks: 0,
};

export default async function LeadershipWalksPage(props: {
  searchParams: Promise<{ plant?: string }>;
}) {
  await requirePermission("SAFETY_CULTURE.READ");
  const sp = await props.searchParams;
  const isRollup = sp.plant === "all";
  const { plantId, plants } = await resolvePlantContext(isRollup ? undefined : sp.plant);

  const header = (
    <PageHeader
      title="Leadership Safety Walks"
      breadcrumbs={[{ label: "Safety Culture" }, { label: "Leadership Walks" }]}
      description="Visible-felt leadership on the shop floor — schedule, track and score the safety walks that leaders commit to. Compliance-to-schedule, worker engagement and walk quality roll straight into the site's culture maturity score."
      action={<PlantSelect plants={plants} current={isRollup ? "all" : plantId} allowAll />}
    />
  );

  if (isRollup) {
    return (
      <div>
        {header}
        <RollupSection />
      </div>
    );
  }

  if (!plantId) {
    return (
      <div>
        {header}
        <EmptyState
          title="Select a site"
          hint="Choose a site above to view its leadership walk schedule, compliance and per-leader scorecards."
        />
      </div>
    );
  }

  // Each fetch is independent — degrade to a safe empty rather than 500 the page.
  let compliance: LeadershipCompliance = EMPTY_COMPLIANCE;
  try {
    compliance = await backendFetch<LeadershipCompliance>(
      `/api/culture/leadership-walks/compliance/${plantId}`
    );
  } catch {
    compliance = EMPTY_COMPLIANCE;
  }

  let walks: Walk[] = [];
  try {
    const res = await backendFetch<{ items: Walk[] }>("/api/culture/leadership-walks", {
      query: { plant_id: plantId },
    });
    walks = res?.items ?? [];
  } catch {
    walks = [];
  }

  let leaders: LeaderOption[] = [];
  try {
    const res = await backendFetch<{ items?: unknown[] } | unknown[]>("/api/users", {
      query: { plantId, take: "100" },
    });
    const items = Array.isArray(res) ? res : res?.items ?? [];
    leaders = (items as { id: string; name: string; role?: string | null }[])
      .filter((u) => u && u.id)
      .map((u) => ({ id: u.id, name: u.name, role: u.role ?? null }));
  } catch {
    leaders = [];
  }

  // Resolve every id that could surface as a person so the view never shows a raw cuid.
  const userDir = await resolveUsers([
    ...walks.map((w) => w.leaderId),
    ...leaders.map((l) => l.id),
  ]);

  return (
    <div>
      {header}
      <LeadershipView
        plantId={plantId}
        compliance={compliance}
        walks={walks}
        leaders={leaders}
        userDir={userDir}
      />
    </div>
  );
}
