import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const result = await backendFetch(`/api/eai/studies/${id}/entries`, {
      method: "POST",
      body
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof BackendError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: (e as Error).message ?? "Create failed" },
      { status: 500 }
    );
  }
}
