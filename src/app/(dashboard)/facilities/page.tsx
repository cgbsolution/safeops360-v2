import Link from "next/link";
import { Plus } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { Can } from "@/components/auth/can";
import { FacilitiesDashboard } from "./facilities-dashboard";
import type { FactoryProfileListResponse } from "./lib";

export const dynamic = "force-dynamic";

export default async function FacilitiesPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission("FACILITY.READ");
  const sp = await props.searchParams;
  const query: Record<string, string> = {};
  for (const k of ["state", "status", "q"]) if (sp[k]) query[k] = sp[k]!;

  let data: FactoryProfileListResponse = {
    items: [],
    total: 0,
    totalBuildings: 0,
    totalEmployees: 0,
    certsExpiring: 0,
    groupComplianceScore: null,
    groupOpenCapas: 0,
    groupOverdueCapas: 0,
    statusCounts: {},
    stateCounts: {},
  };
  let error: string | null = null;
  try {
    data = await backendFetch<FactoryProfileListResponse>("/api/factory/profiles", { query });
  } catch (e: any) {
    error = e?.message ?? "Failed to load facilities";
  }

  return (
    <div>
      <PageHeader
        title="Consolidated Facilities Dashboard"
        breadcrumbs={[{ label: "Facilities" }]}
        description="Every factory profile in one group view — buildings, workforce and statutory identity, with live audit & CAPA roll-ups wiring in next."
        action={
          <Can permission="FACILITY.CREATE">
            <Link
              href="/facilities/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800"
            >
              <Plus size={16} /> Add Factory
            </Link>
          </Can>
        }
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>
      ) : (
        <FacilitiesDashboard data={data} activeState={sp.state ?? null} />
      )}
    </div>
  );
}
