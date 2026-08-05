import { PageHeader } from "@/components/page-header";
import { backendFetch } from "@/lib/backend/fetch";
import { requirePermission } from "@/lib/auth/server";
import { resolvePlantContext } from "@/lib/plant-context";
import { resolveUsers, formatUserRefText } from "@/lib/users/user-ref";
import { PlantSelect, EmptyState, SiteRollupTable, type RollupRow } from "../ui";
import { RecognitionView, type Leaderboard } from "./recognition-view";

export const dynamic = "force-dynamic";

async function RecognitionRollupSection({ period }: { period: string }) {
  let rollup: { rows: RollupRow[] } = { rows: [] };
  try {
    rollup = await backendFetch(`/api/culture/recognition/rollup/${period}`);
  } catch {
    /* keep empty */
  }
  const rows = rollup.rows ?? [];
  const userDir = await resolveUsers(rows.map((r) => r.topPerformerId as string).filter(Boolean));
  const withNames = rows.map((r) => ({
    ...r,
    topPerformerName: r.topPerformerId ? formatUserRefText(userDir, r.topPerformerId as string) : "—",
  }));
  return (
    <SiteRollupTable
      rows={withNames}
      headlineKey="totalPoints"
      headlineFormat="points"
      headlineLabel={`Recognition points, ranked across sites · ${period}`}
      barKey="totalPoints"
      barColorMode="fixed"
      columns={[
        { key: "topPerformerName", label: "top", format: "raw" },
        { key: "awardedCount", label: "people", format: "int" },
      ]}
      emptyHint="Run a recalculation so recognition points are awarded for this period."
    />
  );
}

export default async function RecognitionPage(props: {
  searchParams: Promise<{ plant?: string; period?: string }>;
}) {
  await requirePermission("SAFETY_CULTURE.READ");
  const sp = await props.searchParams;
  const isRollup = sp.plant === "all";
  const { plantId, plants } = await resolvePlantContext(isRollup ? undefined : sp.plant);

  // Current month, server-side (YYYY-MM), overridable via ?period=.
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const period = sp.period ?? `${y}-${String(m).padStart(2, "0")}`;

  const header = (
    <PageHeader
      title="Recognition & Rewards"
      breadcrumbs={[{ label: "Safety Culture" }, { label: "Recognition" }]}
      description="Quality-weighted recognition for the people driving culture forward — BBS observation quality, verified closure-loop completions and leadership-walk compliance. Top performers and most-improved only; no naming-and-shaming."
      action={<PlantSelect plants={plants} current={isRollup ? "all" : plantId} allowAll />}
    />
  );

  if (isRollup) {
    return (
      <div>
        {header}
        <RecognitionRollupSection period={period} />
      </div>
    );
  }

  if (!plantId) {
    return (
      <div>
        {header}
        <EmptyState
          title="Select a site"
          hint="Choose a site above to view its recognition leaderboard, most-improved and streaks for this period."
        />
      </div>
    );
  }

  // Degrade to a safe empty board rather than 500 the page.
  let board: Leaderboard = { plantId, period, individual: [], mostImproved: [] };
  try {
    board = await backendFetch<Leaderboard>(
      `/api/culture/recognition/leaderboard/${plantId}/${period}`
    );
  } catch {
    board = { plantId, period, individual: [], mostImproved: [] };
  }

  // Resolve every id that could surface as a person so the view never shows a raw cuid.
  const userDir = await resolveUsers([
    ...(board.individual ?? []).map((e) => e.userId),
    ...(board.mostImproved ?? []).map((e) => e.userId),
  ]);

  return (
    <div>
      {header}
      <RecognitionView
        plantId={plantId}
        plants={plants}
        period={period}
        board={board}
        userDir={userDir}
      />
    </div>
  );
}
