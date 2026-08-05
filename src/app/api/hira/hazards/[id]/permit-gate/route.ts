import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

// Library-level permit gate for a hazard. Gated on HIRA.LIBRARY_MANAGE
// backend-side — the same permission the hazard configuration screen sits under.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const result = await backendFetch(`/api/hira/hazards/${id}/permit-gate`, {
      method: "PATCH",
      body
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof BackendError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message ?? "Update failed" }, { status: 500 });
  }
}
