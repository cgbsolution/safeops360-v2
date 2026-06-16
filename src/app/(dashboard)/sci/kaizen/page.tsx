import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { PlantSwitcher } from "@/components/plant-switcher";
import { resolvePlantContext } from "@/lib/plant-context";
import { ChevronLeft } from "lucide-react";
import { KaizenTabs } from "./kaizen-tabs";

export const dynamic = "force-dynamic";

export type WallPost = {
  id: string;
  category: string;
  hazardSeveritySelf: string;
  description: string;
  locationTag: string | null;
  photoUrl: string | null;
  submitter: string;
  finalCommitteeScore: number | null;
  pointsAwarded: number | null;
  reactionsCount: number;
  approvedAt: string | null;
};
export type MyPost = {
  id: string;
  category: string;
  hazardSeveritySelf: string;
  description: string;
  status: string;
  isAnonymous: boolean;
  pointsAwarded: number | null;
  declineFeedback: string | null;
  aiFlagReason: string | null;
  aiDuplicateFlag: boolean;
  crossPlantDistributed: boolean;
  createdAt: string | null;
};
export type QueuePost = {
  id: string;
  category: string;
  hazardSeveritySelf: string;
  description: string;
  locationTag: string | null;
  photoUrl: string | null;
  aiCategorySuggestion: string | null;
  aiDuplicateFlag: boolean;
  reviewsSoFar: number;
  alreadyReviewed: boolean;
  createdAt: string | null;
};
export type Committee = {
  period: string;
  members: { userId: string; name: string }[];
  hseManagerSeat: boolean;
  iAmMember: boolean;
};

export default async function KaizenWallPage(props: { searchParams: Promise<{ plantId?: string }> }) {
  const sp = await props.searchParams;
  const { plantId, plants } = await resolvePlantContext(sp.plantId);

  if (!plantId) {
    return (
      <div>
        <PageHeader title="Safety Kaizen Wall" description="Peer-reviewed, verified safety ideas — every post governed before it goes live." />
        <div className="rounded-xl border bg-white p-8 text-sm text-slate-600">Select a plant.</div>
      </div>
    );
  }

  const [wall, mine, queue, committee] = await Promise.all([
    backendFetch<{ posts: WallPost[] }>("/api/sci/kaizen/wall", { query: { plantId } }).catch(() => ({ posts: [] })),
    backendFetch<{ posts: MyPost[] }>("/api/sci/kaizen/my-posts", { query: { plantId } }).catch(() => ({ posts: [] })),
    backendFetch<{ posts: QueuePost[]; onCommittee: boolean }>("/api/sci/kaizen/review-queue", { query: { plantId } }).catch(() => ({ posts: [], onCommittee: false })),
    backendFetch<Committee>("/api/sci/kaizen/committee", { query: { plantId } }).catch(() => ({ period: "", members: [], hseManagerSeat: false, iAmMember: false }) as Committee)
  ]);

  return (
    <div>
      <Link href={`/sci?plantId=${plantId}`} className="inline-flex items-center gap-1 text-sm text-violet-700 hover:underline mb-3">
        <ChevronLeft size={14} /> Back to Safety Culture Index
      </Link>
      <PageHeader
        title="Safety Kaizen Wall"
        description="Every post is reviewed by a peer committee before going live — verified, auditable, and identity-protected. No supervisor gatekeeping."
        action={<PlantSwitcher plants={plants} currentPlantId={plantId} />}
      />
      <KaizenTabs plantId={plantId} wall={wall.posts} mine={mine.posts} queue={queue.posts} onCommittee={queue.onCommittee} committee={committee} />
    </div>
  );
}
