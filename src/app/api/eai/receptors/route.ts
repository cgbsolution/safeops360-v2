import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const result = await backendFetch("/api/eai/receptors");
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof BackendError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
