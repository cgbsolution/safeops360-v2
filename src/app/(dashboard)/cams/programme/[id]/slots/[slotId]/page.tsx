import { notFound } from "next/navigation";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { resolvePlantContext } from "@/lib/plant-context";
import { resolveUsers } from "@/lib/users/user-ref";
import { SlotDetailView } from "./slot-detail";
import type { SlotDetail } from "../../../lib-programme";

export const dynamic = "force-dynamic";

/**
 * Slot detail — `/cams/programme/[id]/slots/[slotId]` from docs/cams/08 §6.1.
 *
 * Promoted out of the inline dialog it used to live in. A slot carries a
 * window, a scope, an intended lead, a load estimate, a sampling basis and its
 * own amendment history; a modal could hold roughly the first two honestly,
 * which is why "Materialise" degenerated into a box asking for a pasted UUID.
 */
export default async function SlotDetailPage(props: {
  params: Promise<{ id: string; slotId: string }>;
}) {
  await requirePermission("CAMS.READ");
  const { id, slotId } = await props.params;

  const detail = await backendFetch<SlotDetail>(`/api/programme/slots/${slotId}`).catch(
    () => null,
  );
  if (!detail) notFound();

  const [{ plants }, userDir] = await Promise.all([
    resolvePlantContext(null).catch(() => ({ plantId: null, plants: [], isOverride: false })),
    resolveUsers([detail.slot.intendedLeadUserId, detail.slot.ownerUserId,
      ...detail.amendments.map((a) => a.approvedByUserId)]),
  ]);

  return (
    <div>
      <PageHeader
        title={`Slot ${detail.slot.slotCode}`}
        description={
          detail.plan.scopeUnits.map((u) => u.dimensionLabel).join(", ") || undefined
        }
        breadcrumbs={[
          { label: "Audit & Compliance", href: "/cams/audits" },
          { label: "Programme", href: "/cams/programme" },
          {
            label: detail.programme?.programmeCode ?? "Programme",
            href: `/cams/programme/${id}${detail.cycle ? `?cycle=${detail.cycle.id}` : ""}`,
          },
          { label: detail.slot.slotCode },
        ]}
      />
      <SlotDetailView
        programmeId={id}
        detail={detail}
        sites={plants}
        userDir={userDir}
      />
    </div>
  );
}
