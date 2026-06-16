import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import type { Programme } from "../lib-cams";
import { ProgrammeView } from "./programme-view";

export const dynamic = "force-dynamic";

export default async function ProgrammePage() {
  await requirePermission("CAMS.READ");
  let data: Programme | null = null;
  let error: string | null = null;
  try {
    data = await backendFetch<Programme>("/api/cams/programme");
  } catch (e: any) {
    error = e?.message ?? "Failed to load the audit programme";
  }

  return (
    <div>
      <PageHeader
        title="Audit Programme"
        description="The risk-based programme coverage matrix — sites × audit types/standards — showing where audits are done, planned, or missing. Gap flags surface un-audited scope before the certification body does."
        breadcrumbs={[{ label: "CAMS", href: "/cams" }, { label: "Programme" }]}
      />
      {error || !data ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error ?? "No data"}</div>
      ) : (
        <ProgrammeView p={data} />
      )}
    </div>
  );
}
