import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const plantId = new URL(req.url).searchParams.get("plantId");
  if (!plantId) return NextResponse.json({ error: "plantId is required" }, { status: 400 });
  try {
    const res = await backendFetch<Response>(`/api/scr/registers/${code}/export.csv`, {
      responseType: "raw",
      query: { plantId }
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          res.headers.get("content-disposition") ?? `attachment; filename="${code}.csv"`
      }
    });
  } catch (e: unknown) {
    if (e instanceof BackendError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: (e as Error).message ?? "Export failed" }, { status: 500 });
  }
}
