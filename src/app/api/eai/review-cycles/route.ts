import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query: Record<string, string | null> = {
      status: searchParams.get("status"),
      trigger: searchParams.get("trigger"),
      plantId: searchParams.get("plantId"),
      assignedToId: searchParams.get("assignedToId"),
    };
    const result = await backendFetch("/api/eai/review-cycles", { query });
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof BackendError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await backendFetch("/api/eai/review-cycles", { method: "POST", body });
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof BackendError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: (e as Error).message ?? "Create failed" }, { status: 500 });
  }
}
