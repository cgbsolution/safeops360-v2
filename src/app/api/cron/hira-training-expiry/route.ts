import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (expected && auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cronUserId = process.env.CRON_USER_ID;
  if (!cronUserId) {
    return NextResponse.json(
      { error: "CRON_USER_ID env var not set — cannot mint backend token for cron" },
      { status: 500 }
    );
  }
  try {
    const result = await backendFetch("/api/hira/cron/training-expiry", {
      method: "POST",
      userId: cronUserId
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof BackendError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message ?? "Cron failed" }, { status: 500 });
  }
}
