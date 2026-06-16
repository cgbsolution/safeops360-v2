import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query: Record<string, string | null> = {
      categoryId: searchParams.get("categoryId"),
      search: searchParams.get("search"),
    };
    const result = await backendFetch("/api/eai/aspects", { query });
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof BackendError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
