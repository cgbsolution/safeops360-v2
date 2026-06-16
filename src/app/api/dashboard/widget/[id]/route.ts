import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import { getWidget } from "@/lib/dashboard/widget-catalog";
import { loadWidgetData } from "@/lib/dashboard/widget-data";
import { stripPlantWhere } from "@/lib/dashboard/scope";

export const dynamic = "force-dynamic";

// Per-widget data endpoint. Each configurable-dashboard tile fetches this
// independently (so one slow widget never blocks the rest). Enforces the
// widget's module RBAC: a user lacking e.g. HIRA.READ gets a 403, which
// the client renders as the "you don't have access" state.
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const meta = getWidget(id);
  if (!meta) return NextResponse.json({ error: "Unknown widget" }, { status: 404 });

  if (meta.permission) {
    const allowed = await can(userId, meta.permission);
    if (!allowed.allowed) return NextResponse.json({ error: "restricted" }, { status: 403 });
  }

  const plantParam = req.nextUrl.searchParams.get("plant") || undefined;
  const plant = await stripPlantWhere(plantParam);

  const fromParam = req.nextUrl.searchParams.get("from") || undefined;
  const toParam   = req.nextUrl.searchParams.get("to")   || undefined;
  // Parse YYYY-MM-DD strings as local midnight; treat invalid dates as undefined.
  const parseDate = (s?: string): Date | undefined => {
    if (!s) return undefined;
    const d = new Date(s + "T00:00:00");
    return isNaN(d.getTime()) ? undefined : d;
  };
  const dateFrom = parseDate(fromParam);
  const dateTo   = parseDate(toParam);

  try {
    const data = await loadWidgetData(id, { plant, now: new Date(), dateFrom, dateTo });
    return NextResponse.json(data);
  } catch (e) {
    console.error(`[widget:${id}] load failed`, e);
    return NextResponse.json({ error: "load failed" }, { status: 500 });
  }
}
