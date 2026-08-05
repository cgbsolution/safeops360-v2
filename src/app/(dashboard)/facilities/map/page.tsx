import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { IndiaMap } from "../india-map";
import type { FactoryProfileListResponse } from "../lib";

export const dynamic = "force-dynamic";

export default async function FacilitiesMapPage() {
  await requirePermission("FACILITY.READ");
  let data: FactoryProfileListResponse | null = null;
  let error: string | null = null;
  try {
    data = await backendFetch<FactoryProfileListResponse>("/api/factory/profiles");
  } catch (e: any) {
    error = e?.message ?? "Failed to load facilities";
  }

  return (
    <div>
      <PageHeader
        title="Facilities Map"
        breadcrumbs={[{ label: "Facilities", href: "/facilities" }, { label: "Map" }]}
        description="Every factory pinned across India, colour-coded by live compliance score. Click a pin to open the profile."
      />
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>
      ) : (
        <IndiaMap factories={data!.items} height={620} />
      )}
    </div>
  );
}
