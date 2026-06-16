import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { WIDGET_BY_ID } from "@/lib/dashboard/widget-catalog";

export const dynamic = "force-dynamic";

// Tenant dashboard admin controls (D3 §3.6). System Admin / Plant Head
// can lock widgets as mandatory, set role default layouts, and disable
// user editing. Stored on the global (plantId = null) DashboardAdminConfig
// row for this pass; plant-scoped overrides reuse the same model.

const ADMIN_ROLES = new Set(["ADMIN", "PLANT_HEAD"]);

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const userId = (session.user as { id: string }).id;
  let role = (session.user as { role?: string }).role;
  if (!role) role = (await prisma.user.findUnique({ where: { id: userId }, select: { role: true } }))?.role ?? undefined;
  if (!role || !ADMIN_ROLES.has(role)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { userId, role };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cfg = await prisma.dashboardAdminConfig.findFirst({ where: { plantId: null } });
  return NextResponse.json({
    lockedWidgetIds: (cfg?.lockedWidgetIds as unknown as string[]) ?? [],
    editingLocked: cfg?.editingLocked ?? false,
    defaultLayouts: cfg?.defaultLayouts ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: any = {};
  if (Array.isArray(body.lockedWidgetIds)) {
    patch.lockedWidgetIds = body.lockedWidgetIds.filter((id: unknown) => typeof id === "string" && !!WIDGET_BY_ID[id as string]);
  }
  if (typeof body.editingLocked === "boolean") patch.editingLocked = body.editingLocked;
  if (body.defaultLayouts && typeof body.defaultLayouts === "object") patch.defaultLayouts = body.defaultLayouts;

  const existing = await prisma.dashboardAdminConfig.findFirst({ where: { plantId: null } });
  const saved = existing
    ? await prisma.dashboardAdminConfig.update({ where: { id: existing.id }, data: patch })
    : await prisma.dashboardAdminConfig.create({ data: { plantId: null, ...patch } });

  return NextResponse.json({
    ok: true,
    lockedWidgetIds: (saved.lockedWidgetIds as unknown as string[]) ?? [],
    editingLocked: saved.editingLocked,
    defaultLayouts: saved.defaultLayouts ?? null,
  });
}
