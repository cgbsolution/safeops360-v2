// Fire Alarm System checklists — PIL/EHS/CL/025-R1 (A) through (E).
//
// Six sheets, not two: the workbook carries Daily, Monthly for Unit-21 A (zone
// panels) and Unit-21 B (loop panels), Quarterly, Annually, and a separate daily
// Beam Detector sheet. All six are seeded templates, so this page fetches them
// rather than listing them.
//
// Beam detectors are a different asset type with their own document, so they get
// their own workbench below the panels rather than a tab inside the panel one —
// a beam detector is not a panel, and its daily sheet is document (E), not (A).

import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { ChecklistWorkbench } from "../_components/checklist-workbench";
import { ChecklistAsset, MX, TemplateSummary } from "../lib";

export const dynamic = "force-dynamic";

async function load(assetType: string) {
  const [templates, assets] = await Promise.all([
    backendFetch<{ items: TemplateSummary[] }>("/api/fire/checklists/templates", {
      query: { assetType },
    })
      .then((d) => d.items ?? [])
      .catch(() => [] as TemplateSummary[]),
    backendFetch<{ items: ChecklistAsset[] }>("/api/fire/checklists/assets", { query: { assetType } })
      .then((d) => d.items ?? [])
      .catch(() => [] as ChecklistAsset[]),
  ]);
  return { templates, assets };
}

export default async function FireAlarmPage() {
  let panels: Awaited<ReturnType<typeof load>> = { templates: [], assets: [] };
  let beams: Awaited<ReturnType<typeof load>> = { templates: [], assets: [] };
  let error: string | null = null;
  try {
    [panels, beams] = await Promise.all([load("FIRE_ALARM_PANEL"), load("BEAM_DETECTOR")]);
  } catch (e: any) {
    error = e?.message ?? "Failed to load the fire alarm checklists.";
  }

  const noTemplates = !error && panels.templates.length === 0 && beams.templates.length === 0;

  return (
    <div>
      <PageHeader
        title="Fire Alarm System"
        breadcrumbs={[
          { label: "Operational Safety" },
          { label: "Fire Safety", href: "/fire-safety" },
          { label: "Fire Alarm" },
        ]}
        description="PIL/EHS/CL/025-R1 — daily panel rounds, the monthly zone/loop test sheet, quarterly battery endurance, the annual 20% detector sample, and the beam detector daily check."
      />

      {noTemplates ? (
        <div
          className="rounded-xl border p-6 text-[13px]"
          style={{ borderColor: MX.iceLine, background: MX.ice, color: MX.navy }}
        >
          No fire alarm checklist templates are seeded yet. Run{" "}
          <code className="rounded bg-white px-1 py-0.5">python seed_fire_checklists.py</code> on the backend.
        </div>
      ) : (
        <div className="space-y-8">
          <ChecklistWorkbench
            title="Fire Alarm Panels"
            description="Daily, monthly, quarterly and annual inspection sheets for each FAS panel."
            assetTypeLabel="Fire alarm panels"
            assets={panels.assets}
            templates={panels.templates}
            loadError={error}
          />

          {beams.templates.length > 0 && (
            <div>
              <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider" style={{ color: MX.muted }}>
                Beam Detectors — PIL/EHS/CL/025-R1 (E)
              </h2>
              <ChecklistWorkbench
                title="Beam Detectors"
                description="Daily beam detector inspection, testing and maintenance."
                assetTypeLabel="Beam detectors"
                assets={beams.assets}
                templates={beams.templates}
                loadError={null}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
