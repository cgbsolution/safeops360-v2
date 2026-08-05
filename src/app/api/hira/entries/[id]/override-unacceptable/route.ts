import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

// Elevated, time-bounded authorisation to approve an Unacceptable (ALARP)
// residual. HIRA.OVERRIDE_UNACCEPTABLE is enforced backend-side (Plant Head /
// Corporate HSE tier). Body: { justification, expiresInDays }.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const result = await backendFetch(`/api/hira/entries/${id}/override-unacceptable`, {
      method: "POST",
      body
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof BackendError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message ?? "Override failed" }, { status: 500 });
  }
}
