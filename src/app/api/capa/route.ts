import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

// Pure proxy → FastAPI. All validation, scope filtering, CAPA-number
// generation, SLA profile resolution happen server-side in
// app/routers/capa.py.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await backendFetch("/api/capa", { method: "POST", body });
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof BackendError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message ?? "Create failed" }, { status: 500 });
  }
}
