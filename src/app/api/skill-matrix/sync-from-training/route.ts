import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

// Recompute a plant's Skill Matrix cells from current training evidence.
export async function POST(req: NextRequest) {
  const plantId = new URL(req.url).searchParams.get("plantId");
  if (!plantId) {
    return NextResponse.json({ error: "plantId is required" }, { status: 400 });
  }
  try {
    const result = await backendFetch("/api/skill-matrix/sync-from-training", {
      method: "POST",
      query: { plantId }
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof BackendError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: (e as Error).message ?? "Sync failed" },
      { status: 500 }
    );
  }
}
