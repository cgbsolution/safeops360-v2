import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ConfigurableDashboard, type LayoutItem } from "@/components/dashboard/configurable-dashboard";
import { WIDGET_BY_ID, type WidgetSpan } from "@/lib/dashboard/widget-catalog";
import { presetForRole, presetLayout } from "@/lib/dashboard/presets";

// The dashboard is now a per-user configurable surface (UI Depth sprint,
// Deliverable 3). The server resolves the saved layout (or seeds the
// role's persona preset) and the admin policy, then hands off to the
// interactive client grid. If the persistence tables haven't been migrated
// yet (`prisma db push`), it falls back to the role preset so the
// dashboard still renders — only saving is unavailable until migrated.

export const dynamic = "force-dynamic";

const GROUP_WIDE_ROLES = new Set(["ADMIN", "CORPORATE_HSE", "CEO", "MD", "DIRECTOR"]);
const ADMIN_ROLES = new Set(["ADMIN", "PLANT_HEAD"]);

function sanitize(layout: unknown): LayoutItem[] {
  if (!Array.isArray(layout)) return [];
  const seen = new Set<string>();
  const out: LayoutItem[] = [];
  for (const it of layout) {
    const id = (it as { widgetId?: unknown })?.widgetId;
    const meta = typeof id === "string" ? WIDGET_BY_ID[id] : undefined;
    if (typeof id !== "string" || !meta || seen.has(id)) continue;
    seen.add(id);
    let span = Number((it as { span?: unknown }).span) as WidgetSpan;
    if (!meta.allowedSpans.includes(span)) span = meta.defaultSpan;
    out.push({ widgetId: id, span });
  }
  return out;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const userId = (session.user as { id: string }).id;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, plantId: true } });
  const role = user?.role ?? null;

  let items: LayoutItem[] = [];
  let basedOnPreset: string | null = null;
  let lockedWidgetIds: string[] = [];
  let editingLocked = false;

  try {
    const [row, cfg] = await Promise.all([
      prisma.userDashboardLayout.findUnique({ where: { userId } }),
      prisma.dashboardAdminConfig.findFirst({ where: { plantId: null } }),
    ]);
    if (row) {
      items = sanitize(row.layout);
      basedOnPreset = row.basedOnPreset ?? null;
    } else {
      const key = presetForRole(role);
      items = presetLayout(key);
      basedOnPreset = key;
    }
    lockedWidgetIds = Array.isArray(cfg?.lockedWidgetIds) ? (cfg!.lockedWidgetIds as unknown as string[]) : [];
    editingLocked = cfg?.editingLocked ?? false;
    for (const lid of lockedWidgetIds) {
      const meta = WIDGET_BY_ID[lid];
      if (meta && !items.find((i) => i.widgetId === lid)) items.unshift({ widgetId: lid, span: meta.defaultSpan });
    }
  } catch {
    // Persistence tables not migrated yet — fall back to the role preset.
    const key = presetForRole(role);
    items = presetLayout(key);
    basedOnPreset = key;
  }

  const isAdmin = !!role && ADMIN_ROLES.has(role);
  const canPickPlant = !role || GROUP_WIDE_ROLES.has(role);
  const plants = canPickPlant ? await prisma.plant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <ConfigurableDashboard
      initialItems={items}
      basedOnPreset={basedOnPreset}
      lockedWidgetIds={lockedWidgetIds}
      editingLocked={editingLocked}
      isAdmin={isAdmin}
      canPickPlant={canPickPlant}
      plants={plants}
      today={today}
    />
  );
}
