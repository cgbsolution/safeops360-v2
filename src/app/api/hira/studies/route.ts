import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

// Pure proxy → FastAPI. No Prisma; no business logic.
// All validation, number generation, scope checks happen server-side in
// app/routers/hira.py.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await backendFetch("/api/hira/studies", {
      method: "POST",
      body
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof BackendError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message ?? "Create failed" }, { status: 500 });
  }
}
