import { NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const result = await backendFetch(`/api/sci/kaizen/posts/${id}/react`, { method: "POST" });
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof BackendError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: (e as Error).message ?? "React failed" }, { status: 500 });
  }
}
