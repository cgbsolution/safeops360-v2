import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

// DRAFT / FLAGGED_FOR_REVIEW → IN_REVIEW. Complements the approve route so the
// entry state machine is fully reachable from the UI. A material edit reaches
// IN_REVIEW automatically; this covers the manual routes into it.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const result = await backendFetch(`/api/hira/entries/${id}/submit-for-review`, {
      method: "POST",
      body
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof BackendError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message ?? "Submit failed" }, { status: 500 });
  }
}
