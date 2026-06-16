import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { WIDGET_BY_ID, type WidgetSpan } from "@/lib/dashboard/widget-catalog";
import { presetForRole, presetLayout, type LayoutItem } from "@/lib/dashboard/presets";

export const dynamic = "force-dynamic";

// Per-user dashboard layout persistence (server-side, so it follows the
// user across devices). GET resolves the saved layout or seeds the role's
// persona preset; PUT saves; DELETE resets to the role default. Admin
// locks (mandatory widgets, editing-locked) are enforced here too.

/** Validate an incoming layout against the catalog: drop unknown ids,
 *  dedupe, and clamp spans to each widget's allowed set. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitize(items: any): LayoutItem[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const out: LayoutItem[] = [];
  for (const it of items) {
    const id = typeof it?.widgetId === "string" ? it.widgetId : null;
    const meta = id ? WIDGET_BY_ID[id] : undefined;
    if (!id || !meta || seen.has(id)) continue;
    seen.add(id);
    let span = Number(it.span) as WidgetSpan;
    if (!meta.allowedSpans.includes(span)) span = meta.defaultSpan;
    out.push({ widgetId: id, span });
  }
  return out;
}

async function loadAdmin() {
  const cfg = await prisma.dashboardAdminConfig.findFirst({ where: { plantId: null } });
  const lockedWidgetIds = Array.isArray(cfg?.lockedWidgetIds) ? (cfg!.lockedWidgetIds as unknown as string[]) : [];
  return { lockedWidgetIds, editingLocked: cfg?.editingLocked ?? false };
}

/** Guarantee every admin-locked widget is present in the layout. */
function withLocked(items: LayoutItem[], lockedWidgetIds: string[]): LayoutItem[] {
  const present = new Set(items.map((i) => i.widgetId));
  const prepend: LayoutItem[] = [];
  for (const lid of lockedWidgetIds) {
    const meta = WIDGET_BY_ID[lid];
    if (meta && !present.has(lid)) prepend.push({ widgetId: lid, span: meta.defaultSpan });
  }
  return [...prepend, ...items];
}

async function resolveRole(userId: string, session: { user?: { role?: string } } | null): Promise<string | null> {
  const r = session?.user?.role;
  if (r) return r;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return u?.role ?? null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const [row, admin] = await Promise.all([prisma.userDashboardLayout.findUnique({ where: { userId } }), loadAdmin()]);

  let items: LayoutItem[];
  let basedOnPreset: string | null;
  if (row) {
    items = sanitize(row.layout);
    basedOnPreset = row.basedOnPreset ?? null;
  } else {
    const key = presetForRole(await resolveRole(userId, session));
    items = presetLayout(key);
    basedOnPreset = key;
  }

  return NextResponse.json({
    items: withLocked(items, admin.lockedWidgetIds),
    basedOnPreset,
    lockedWidgetIds: admin.lockedWidgetIds,
    editingLocked: admin.editingLocked,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const admin = await loadAdmin();
  if (admin.editingLocked) return NextResponse.json({ error: "Layout editing is locked by your administrator." }, { status: 403 });

  const body = await req.json();
  const items = withLocked(sanitize(body.items), admin.lockedWidgetIds);
  const basedOnPreset = typeof body.basedOnPreset === "string" ? body.basedOnPreset : null;

  await prisma.userDashboardLayout.upsert({
    where: { userId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: { userId, layout: items as any, basedOnPreset },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: { layout: items as any, basedOnPreset },
  });

  return NextResponse.json({ ok: true, items, basedOnPreset });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const admin = await loadAdmin();
  if (admin.editingLocked) return NextResponse.json({ error: "Layout editing is locked by your administrator." }, { status: 403 });

  await prisma.userDashboardLayout.deleteMany({ where: { userId } });
  const key = presetForRole(await resolveRole(userId, session));
  const items = withLocked(presetLayout(key), admin.lockedWidgetIds);
  return NextResponse.json({ ok: true, items, basedOnPreset: key });
}
