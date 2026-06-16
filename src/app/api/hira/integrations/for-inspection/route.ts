import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const result = await backendFetch("/api/hira/integrations/for-inspection", {
      query: {
        plantId: url.searchParams.get("plantId"),
        areaId: url.searchParams.get("areaId"),
        equipmentId: url.searchParams.get("equipmentId")
      }
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof BackendError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message ?? "Query failed" }, { status: 500 });
  }
}
