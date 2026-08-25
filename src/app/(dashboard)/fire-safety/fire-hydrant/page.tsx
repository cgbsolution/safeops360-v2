// Fire Hydrant & Sprinkler System checklists — PIL/EHSD/CL/026.
//
// Four sheets: Daily (R2, an 8-item month grid), Monthly (R2, sectioned by
// Valves / Hydrant Box / Pump Room / Others / Water Monitor), Quarterly (R1, two
// items across four quarters) and Yearly (R1 (D), the pump motor insulation
// check).
//
// Note the daily and monthly sheets are R2 while the quarterly and yearly are
// still R1. That is why the document header block is rendered per sheet rather
// than once per page: one page here shows two different revisions, and printing
// a single header would misreport one of them.

import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { ChecklistWorkbench } from "../_components/checklist-workbench";
import { ChecklistAsset, MX, TemplateSummary } from "../lib";

export const dynamic = "force-dynamic";

const ASSET_TYPE = "FIRE_HYDRANT_SYSTEM";

export default async function FireHydrantPage({
  searchParams,
}: {
  // Set when the screen was reached by scanning an asset's QR sticker, so the
  // inspector opens on the unit they are standing at rather than the first row.
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  let templates: TemplateSummary[] = [];
  let assets: ChecklistAsset[] = [];
  let error: string | null = null;
  try {
    [templates, assets] = await Promise.all([
      backendFetch<{ items: TemplateSummary[] }>("/api/fire/checklists/templates", {
        query: { assetType: ASSET_TYPE },
      }).then((d) => d.items ?? []),
      backendFetch<{ items: ChecklistAsset[] }>("/api/fire/checklists/assets", {
        query: { assetType: ASSET_TYPE },
      }).then((d) => d.items ?? []),
    ]);
  } catch (e: any) {
    error = e?.message ?? "Failed to load the fire hydrant checklists.";
  }

  return (
    <div>
      <PageHeader
        title="Fire Hydrant & Sprinkler System"
        breadcrumbs={[
          { label: "Operational Safety" },
          { label: "Fire Safety", href: "/fire-safety" },
          { label: "Fire Hydrant" },
        ]}
        description="PIL/EHSD/CL/026 — daily pressure and pump rounds, the monthly valve / hydrant box / pump room inspection, quarterly main pressure test and the yearly motor insulation check."
      />

      {!error && templates.length === 0 ? (
        <div
          className="rounded-xl border p-6 text-[13px]"
          style={{ borderColor: MX.iceLine, background: MX.ice, color: MX.navy }}
        >
          No hydrant checklist templates are seeded yet. Run{" "}
          <code className="rounded bg-white px-1 py-0.5">python seed_fire_checklists.py</code> on the backend.
        </div>
      ) : (
        <ChecklistWorkbench
        initialAssetId={sp.asset ?? null}
        initialTemplateCode={sp.template ?? null}
          title="Fire Hydrant & Sprinkler Systems"
          description="Daily, monthly, quarterly and yearly maintenance sheets for each hydrant system."
          assetTypeLabel="Hydrant systems"
          assets={assets}
          templates={templates}
          loadError={error}
        />
      )}
    </div>
  );
}
