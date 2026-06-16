import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { SourceIntakeForm, SourceIntakeConfig } from "@/components/capa/source-intake-form";

export const dynamic = "force-dynamic";

const CONFIG: SourceIntakeConfig = {
  sourceTypeCode: "CALIBRATION_FAILURE",
  sourceLabel: "Calibration Failure",
  defaultPrimaryCategory: "EQUIPMENT",
  defaultSeverity: "HIGH",
  intro:
    "Instrument out of calibration. Products tested with this instrument since its last successful calibration are potentially impacted — list them in the impact analysis below.",
  fields: [
    { key: "instrumentId", label: "Instrument ID / asset tag", type: "text", required: true },
    { key: "instrumentName", label: "Instrument name", type: "text", required: true },
    { key: "calibrationDate", label: "Calibration date", type: "date", required: true },
    { key: "calibrationDueDate", label: "Calibration due date", type: "date" },
    { key: "measurementParameter", label: "Measurement parameter", type: "text", required: true, placeholder: "e.g. weight (kg), temperature (°C), pressure (bar)" },
    { key: "expectedValue", label: "Expected value", type: "text", required: true },
    { key: "actualValue", label: "Actual value", type: "text", required: true },
    { key: "deviationPercentage", label: "Deviation %", type: "number" },
    { key: "calibrationCertificateId", label: "Calibration certificate ID", type: "text" },
    { key: "productsAffected", label: "Products / processes potentially impacted since last calibration", type: "textarea", required: true, placeholder: "List products tested with this instrument since its last verified calibration" }
  ]
};

export default async function NewCalibrationCapaPage() {
  await requirePermission("CAPA.CREATE");
  const opts = await backendFetch<{
    plants: { id: string; code: string; name: string }[];
    users: { id: string; name: string; email: string; plantId: string | null }[];
  }>("/api/hira/wizard/study-options");
  return (
    <div>
      <PageHeader
        title="New CAPA — Calibration Failure"
        description="Raise a CAPA from an out-of-calibration instrument with downstream product impact tracking."
        breadcrumbs={[{ label: "CAPA", href: "/capa" }, { label: "New" }, { label: "Calibration" }]}
      />
      <SourceIntakeForm config={CONFIG} plants={opts.plants} users={opts.users} />
    </div>
  );
}
