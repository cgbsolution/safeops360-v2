import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ plantId: string }> }
) {
  const { plantId } = await ctx.params;
  try {
    const body = await req.json();
    const result = await backendFetch(`/api/eai/feature-flag/${plantId}`, {
      method: "PATCH",
      body
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof BackendError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: (e as Error).message ?? "Toggle failed" },
      { status: 500 }
    );
  }
}
