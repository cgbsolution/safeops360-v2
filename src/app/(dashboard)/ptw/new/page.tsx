import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { PermitForm, type HiraPrefill } from "../permit-form";
import { requirePermission } from "@/lib/auth/server";
import { backendFetch } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

export default async function NewPermitPage(
  props: { searchParams: Promise<{ hiraEntryId?: string; hiraEntryHazardId?: string }> }
) {
  const user = await requirePermission("PTW.CREATE");
  const searchParams = await props.searchParams;
  const plants = await prisma.plant.findMany({ include: { areas: true }, orderBy: { name: "asc" } });

  // Default the wizard to the originator's home plant. The session carries it,
  // but fall back to a DB lookup if it's missing so the wizard never opens on
  // an unrelated (and often empty) plant.
  let defaultPlantId = ((user as any)?.plantId as string | undefined) ?? null;
  if (!defaultPlantId && (user as any)?.id) {
    const me = await prisma.user.findUnique({
      where: { id: (user as any).id as string },
      select: { plantId: true },
    });
    defaultPlantId = me?.plantId ?? null;
  }

  // Opened from a HIRA hazard row's Create-PTW prompt. The backend re-checks
  // that the hazard really is permit-flagged and 409s otherwise; a failed
  // prefill degrades to the ordinary blank wizard rather than blocking the
  // user from raising a permit at all.
  let hiraPrefill: HiraPrefill | null = null;
  if (searchParams.hiraEntryId && searchParams.hiraEntryHazardId) {
    hiraPrefill = await backendFetch<HiraPrefill>(
      `/api/hira/entries/${searchParams.hiraEntryId}/hazards/${searchParams.hiraEntryHazardId}/ptw-prefill`
    ).catch(() => null);
  }

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="New Permit to Work"
        description="Initiate a permit request for high-risk work"
        breadcrumbs={[{ label: "Permits", href: "/ptw" }, { label: "New" }]}
      />
      <PermitForm
        plants={plants.map((p) => ({ id: p.id, name: p.name, areas: p.areas.map((a) => ({ id: a.id, name: a.name })) }))}
        defaultPlantId={defaultPlantId}
      />
    </div>
  );
}
