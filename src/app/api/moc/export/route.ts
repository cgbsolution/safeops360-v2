import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { backendFetch } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

// Streams the backend's CSV export through with the right download headers.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const plantId = new URL(req.url).searchParams.get("plantId");
  if (!plantId) return NextResponse.json({ error: "plantId required" }, { status: 400 });
  try {
    const res = await backendFetch<Response>("/api/moc/export.csv", {
      responseType: "raw",
      query: { plantId }
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="moc-register.csv"'
      }
    });
  } catch {
    return NextResponse.json({ error: "Export failed" }, { status: 502 });
  }
}
