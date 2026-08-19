// Fire Extinguisher Inspection Checklist — PIL/EHSD/CL/027-R1.
//
// One sheet: 21 checks against Jan-Dec for a single extinguisher. The cadence is
// monthly and the printed page is a year, so the grid pivots twelve monthly runs
// into the twelve columns the paper shows.
//
// The picker lists cylinders by their ALLOTTED serial — the tag stencilled on the
// body, and the number the sheet's own "Fire Extinguisher No:" header asks for —
// rather than by platform code, because that is what the inspector is holding
// when they open this screen. Type and number come from the Register, which is
// the one deliberate improvement on the paper process: today the register and the
// inspection sheet are separate documents and nothing links them, so nothing
// stops a sheet being filed against a cylinder that was never registered.

import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { ChecklistWorkbench } from "../_components/checklist-workbench";
import { ChecklistAsset, MX, TemplateSummary } from "../lib";

export const dynamic = "force-dynamic";

const ASSET_TYPE = "FIRE_EXTINGUISHER";

export default async function FeInspectionPage() {
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
    error = e?.message ?? "Failed to load the extinguisher inspection checklist.";
  }

  return (
    <div>
      <PageHeader
        title="Fire Extinguisher Inspection"
        breadcrumbs={[
          { label: "Operational Safety" },
          { label: "Fire Safety", href: "/fire-safety" },
          { label: "FE Inspection" },
        ]}
        description={
          'PIL/EHSD/CL/027-R1 — 21 monthly checks per cylinder. Write "Yes" if satisfactory, "No" if unsatisfactory, "NA" if not applicable.'
        }
        action={
          <Link
            href="/fire-safety/extinguisher-register"
            className="rounded-lg border px-3 py-1.5 text-[12px] font-medium"
            style={{ borderColor: MX.iceLine, color: MX.navy }}
          >
            Register of Fire Extinguishers →
          </Link>
        }
      />

      {!error && assets.length === 0 ? (
        <div
          className="rounded-xl border p-6 text-[13px]"
          style={{ borderColor: MX.iceLine, background: MX.ice, color: MX.navy }}
        >
          No extinguishers in the register yet. An inspection sheet must resolve to a registered cylinder —{" "}
          <Link href="/fire-safety/extinguisher-register" className="font-semibold underline">
            add one to the register
          </Link>{" "}
          first.
        </div>
      ) : (
        <ChecklistWorkbench
          title="Fire Extinguishers"
          description="A year of monthly inspections per cylinder."
          assetTypeLabel="Extinguishers"
          assets={assets}
          templates={templates}
          loadError={error}
        />
      )}
    </div>
  );
}
