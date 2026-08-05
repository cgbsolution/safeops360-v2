import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/backend/fetch";
import { versioningQuery } from "../../versioning-query";

export const dynamic = "force-dynamic";

// Wholesale hazard-row replace for Section 2 of the entry editor. The backend
// reconciles by hazardId in place, so row ids (and any Permit linked to them)
// survive the save.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    // changeReason / skipVersion are query params on the backend, not body
    // fields — forward them verbatim or the backend 422s on an approved study
    // and re-versions a save that was already versioned by the PATCH.
    const result = await backendFetch(`/api/hira/entries/${id}/hazards`, {
      method: "PUT",
      query: versioningQuery(req),
      body
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof BackendError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message ?? "Save failed" }, { status: 500 });
  }
}
