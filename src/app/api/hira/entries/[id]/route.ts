import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { changeReason, changeTrigger, ...rest } = body ?? {};
    const query: Record<string, string> = {};
    if (changeReason) query.changeReason = changeReason;
    if (changeTrigger) query.changeTrigger = changeTrigger;
    const result = await backendFetch(`/api/hira/entries/${id}`, {
      method: "PATCH",
      body: rest,
      query
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof BackendError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message ?? "Update failed" }, { status: 500 });
  }
}
