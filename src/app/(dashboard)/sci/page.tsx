import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { PlantSwitcher } from "@/components/plant-switcher";
import { resolvePlantContext } from "@/lib/plant-context";
import { SciSyncButton } from "./sci-sync-button";
import { SciTabs } from "./sci-tabs";

export const dynamic = "force-dynamic";

export type MyScore = {
  userId: string;
  name: string;
  totalPoints: number;
  rank: number | null;
  totalContributors: number;
  insights: string[];
  breakdown: { module: string; label: string; points: number; count: number }[];
  recent: {
    eventType: string;
    module: string;
    moduleLabel: string;
    basePoints: number;
    multiplier: number;
    finalPoints: number;
    sourceTransactionId: string;
    scoringPeriod: string;
    createdAt: string | null;
  }[];
};

export type Leaderboard = {
  plantId: string;
  totalContributors: number;
  totalPoints: number;
  individuals: {
    rank: number;
    userId: string;
    name: string;
    department: string | null;
    role: string | null;
    points: number;
    contributions: number;
    isMe: boolean;
  }[];
  departments: { rank: number; department: string; points: number; people: number }[];
};

export default async function SciPage(props: { searchParams: Promise<{ plantId?: string }> }) {
  const sp = await props.searchParams;
  const { plantId, plants } = await resolvePlantContext(sp.plantId);

  if (!plantId) {
    return (
      <div>
        <PageHeader title="Safety Culture Index" description="Verified safety culture — every point earned from a real safety action." />
        <div className="rounded-xl border bg-white p-8 text-sm text-slate-600">Select a plant to view the index.</div>
      </div>
    );
  }

  const [myScore, leaderboard] = await Promise.all([
    backendFetch<MyScore>("/api/sci/my-score", { query: { plantId } }).catch(
      () => ({ userId: "", name: "You", totalPoints: 0, rank: null, totalContributors: 0, insights: [], breakdown: [], recent: [] }) as MyScore
    ),
    backendFetch<Leaderboard>("/api/sci/leaderboard", { query: { plantId } }).catch(
      () => ({ plantId, totalContributors: 0, totalPoints: 0, individuals: [], departments: [] }) as Leaderboard
    )
  ]);

  return (
    <div>
      <PageHeader
        title="Safety Culture Index"
        description="Verified, auditable safety culture — every point is earned from a real, verified safety action. No self-reporting."
        breadcrumbs={[{ label: "People & Competency" }, { label: "Safety Culture Index" }]}
        action={
          <div className="flex items-center gap-2">
            <SciSyncButton plantId={plantId} />
            <PlantSwitcher plants={plants} currentPlantId={plantId} />
          </div>
        }
      />
      <SciTabs myScore={myScore} leaderboard={leaderboard} />
    </div>
  );
}
