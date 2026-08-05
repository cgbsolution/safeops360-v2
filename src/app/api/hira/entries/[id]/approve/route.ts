import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

// Entry re-approval. The endpoint existed on the backend from the start but
// had no caller — a material edit could withdraw an approval with no way to
// restore it through the UI. HIRA.APPROVE is enforced backend-side.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const result = await backendFetch(`/api/hira/entries/${id}/approve`, {
      method: "POST",
      body
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof BackendError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message ?? "Approve failed" }, { status: 500 });
  }
}
