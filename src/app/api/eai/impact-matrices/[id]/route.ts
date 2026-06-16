import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  try {
    const result = await backendFetch(`/api/eai/impact-matrices/${id}`);
    if (
      !result ||
      !Array.isArray((result as any).likelihoods) ||
      !Array.isArray((result as any).magnitudes)
    ) {
      return NextResponse.json(
        { error: "Impact matrix is missing required fields" },
        { status: 502 }
      );
    }
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof BackendError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
