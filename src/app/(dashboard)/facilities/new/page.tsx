import { prisma } from "@/lib/prisma";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { AddFactoryWizard, type SiteOption } from "./add-factory-wizard";
import type { FactoryProfileListResponse } from "../lib";

export const dynamic = "force-dynamic";

export default async function NewFactoryPage() {
  await requirePermission("FACILITY.CREATE");

  let plants: { id: string; name: string; code: string; state: string; location: string }[] = [];
  let taken = new Set<string>();
  let error: string | null = null;
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
        description="Create a factory profile. Link it to an existing Site when the factory is managed under one (typically a supplier); for a Page-owned facility leave the Site blank and one is created for it. Workforce, processes, floor mapping and certifications can be added afterwards."
      />
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>
      ) : (
        <AddFactoryWizard sites={sites} />
      )}
    </div>
  );
}
