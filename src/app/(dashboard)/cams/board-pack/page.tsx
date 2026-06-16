import { backendFetch } from "@/lib/backend/fetch";
import { requirePermission } from "@/lib/auth/server";
import type { BoardPack } from "../lib-cams";
import { BoardPackView } from "./board-pack-view";

export const dynamic = "force-dynamic";

export default async function BoardPackPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requirePermission("CAMS.ANALYTICS");
  const { period } = await searchParams;
  const qs = period ? `?periodLabel=${encodeURIComponent(period)}` : "";
  let data: BoardPack | null = null;
  let error: string | null = null;
  try {
    data = await backendFetch<BoardPack>(`/api/cams/board-pack${qs}`);
  } catch (e: any) {
    error = e?.message ?? "Failed to generate the board pack";
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error ?? "No data"}</div>
      </div>
    );
  }
  return <BoardPackView pack={data} />;
}
