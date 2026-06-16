import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { backendFetch, BackendError } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; depId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, depId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  try {
    const r = await backendFetch(
      `/api/moc/change-requests/${id}/dependent-records/${depId}`,
      { method: "PATCH", body }
    );
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof BackendError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
