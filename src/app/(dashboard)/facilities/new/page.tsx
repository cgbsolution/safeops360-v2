import { prisma } from "@/lib/prisma";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { can } from "@/lib/auth/permissions";
import { AddFactoryWizard, type SiteOption } from "./add-factory-wizard";
import type { FactoryProfileListResponse } from "../lib";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function NewFactoryPage() {
  const user = await requirePermission("FACILITY.CREATE");

  // Mapping a factory onto an EXISTING Site only means something for a factory
  // managed under one — the supplier case, which the compliance/supplier lead
  // auditor owns. Everyone else creating a Page-owned facility should never be
  // asked the question: the factory IS the site, and one is provisioned from
  // its own name and location. FACILITY.SITE_LINK is that authority, so the
  // picker is gated on it rather than on a hard-coded role — who holds it stays
  // a data change in the role × permission matrix.
  const canLinkSite = (await can((user as any).id, "FACILITY.SITE_LINK")).allowed;

  let plants: { id: string; name: string; code: string; state: string; location: string }[] = [];
  let taken = new Set<string>();
  let error: string | null = null;
  // Without SITE_LINK the list is never rendered, so don't fetch it — the site
  // register isn't something an unauthorised creator should receive at all.
  if (canLinkSite) {
    try {
      const [plantRows, profiles] = await Promise.all([
        prisma.plant.findMany({
          select: { id: true, name: true, code: true, state: true, location: true },
          orderBy: { code: "asc" },
        }),
        backendFetch<FactoryProfileListResponse>("/api/factory/profiles").catch(
          () => ({ items: [] } as Partial<FactoryProfileListResponse>)
        ),
      ]);
      plants = plantRows;
      taken = new Set((profiles.items ?? []).map((p) => p.siteId));
    } catch (e: any) {
      error = e?.message ?? "Failed to load sites";
    }
  }

  const sites: SiteOption[] = plants.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    state: p.state,
    location: p.location,
    linked: taken.has(p.id),
  }));

  return (
    <div>
      <PageHeader
        title="Add Factory"
        breadcrumbs={[{ label: "Facilities", href: "/facilities" }, { label: "Add Factory" }]}
        description={
          canLinkSite
            ? "Create a factory profile. Link it to an existing Site when the factory is managed under one (typically a supplier); for a Page-owned facility leave the Site blank and one is created for it. Workforce, processes, floor mapping and certifications can be added afterwards."
            : "Create a factory profile. A Site is created for it from its own name and location. Workforce, processes, floor mapping and certifications can be added afterwards."
        }
      />
      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</Alert>
      ) : (
        <AddFactoryWizard sites={sites} canLinkSite={canLinkSite} />
      )}
    </div>
  );
}
