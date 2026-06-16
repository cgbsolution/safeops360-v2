import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { SourceIntakeForm, SourceIntakeConfig } from "@/components/capa/source-intake-form";

export const dynamic = "force-dynamic";

const CONFIG: SourceIntakeConfig = {
  sourceTypeCode: "ENVIRONMENTAL_FINDING",
  sourceLabel: "Environmental Finding",
  defaultPrimaryCategory: "ENVIRONMENTAL",
  defaultSeverity: "HIGH",
  intro:
    "Environmental event requiring corrective action — emission exceedance, spill, waste-management issue, permit violation, or regulatory inspection finding.",
  fields: [
    { key: "findingType", label: "Finding type", type: "select", required: true, options: [
      { code: "EMISSION_EXCEEDANCE", label: "Emission exceedance" },
      { code: "SPILL", label: "Spill" },
      { code: "WASTE_MANAGEMENT", label: "Waste management" },
      { code: "PERMIT_VIOLATION", label: "Permit violation" },
      { code: "REGULATORY_INSPECTION", label: "Regulatory inspection" }
    ]},
    { key: "parameterAffected", label: "Parameter affected", type: "text", required: true, placeholder: "e.g. PM10, BOD, TDS, SOx" },
    { key: "measuredValue", label: "Measured value", type: "text", required: true },
    { key: "permittedValue", label: "Permitted value", type: "text", required: true },
    { key: "durationOfEvent", label: "Duration of event", type: "text", placeholder: "e.g. 4 hours, 1 day, ongoing" },
    { key: "reportedToRegulator", label: "Reported to regulator?", type: "select", required: true, options: [
      { code: "YES", label: "Yes" },
      { code: "NO", label: "No" },
      { code: "PENDING", label: "Pending" }
    ]},
    { key: "regulatorAcknowledgmentId", label: "Regulator acknowledgment ID (if reported)", type: "text" }
  ]
};

export default async function NewEnvironmentalCapaPage() {
  await requirePermission("CAPA.CREATE");
  const opts = await backendFetch<{
    plants: { id: string; code: string; name: string }[];
    users: { id: string; name: string; email: string; plantId: string | null }[];
  }>("/api/hira/wizard/study-options");
  return (
    <div>
      <PageHeader
        title="New CAPA — Environmental Finding"
        description="Raise a CAPA from an environmental event with regulator notification tracking."
        breadcrumbs={[{ label: "CAPA", href: "/capa" }, { label: "New" }, { label: "Environmental" }]}
      />
      <SourceIntakeForm config={CONFIG} plants={opts.plants} users={opts.users} />
    </div>
  );
}
