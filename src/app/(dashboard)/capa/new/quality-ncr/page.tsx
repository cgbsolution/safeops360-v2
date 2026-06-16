import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { SourceIntakeForm, SourceIntakeConfig } from "@/components/capa/source-intake-form";

export const dynamic = "force-dynamic";

const CONFIG: SourceIntakeConfig = {
  sourceTypeCode: "QUALITY_NCR",
  sourceLabel: "Quality NCR",
  defaultPrimaryCategory: "MATERIAL",
  defaultSeverity: "MODERATE",
  intro:
    "Non-Conformance Report from quality inspection. Document containment action and disposition before continuing to RCA.",
  fields: [
    { key: "ncrNumber", label: "NCR number", type: "text", required: true },
    { key: "productId", label: "Product", type: "text", required: true },
    { key: "productLotNumber", label: "Lot number", type: "text", required: true },
    { key: "quantityAffected", label: "Quantity affected", type: "number", required: true },
    { key: "defectType", label: "Defect type", type: "text", required: true, placeholder: "e.g. dimensional, visual, functional" },
    { key: "defectDescription", label: "Defect description", type: "textarea", required: true },
    { key: "specificationViolated", label: "Specification violated", type: "text", placeholder: "Reference to the spec / drawing / standard" },
    { key: "inspectionStage", label: "Inspection stage", type: "select", required: true, options: [
      { code: "INCOMING", label: "Incoming" },
      { code: "IN_PROCESS", label: "In-process" },
      { code: "FINAL", label: "Final" },
      { code: "SHIPPED", label: "Shipped" },
      { code: "FIELD_RETURN", label: "Field return" }
    ]},
    { key: "disposition", label: "Disposition", type: "select", required: true, options: [
      { code: "REWORK", label: "Rework" },
      { code: "SCRAP", label: "Scrap" },
      { code: "USE_AS_IS", label: "Use as-is (deviation)" },
      { code: "RETURN_TO_SUPPLIER", label: "Return to supplier" },
      { code: "CONCESSION", label: "Concession" }
    ]},
    { key: "containmentActions", label: "Containment actions taken", type: "textarea", required: true, placeholder: "What did you do to stop the bleeding before raising this CAPA?" }
  ]
};

export default async function NewNcrCapaPage() {
  await requirePermission("CAPA.CREATE");
  const opts = await backendFetch<{
    plants: { id: string; code: string; name: string }[];
    users: { id: string; name: string; email: string; plantId: string | null }[];
  }>("/api/hira/wizard/study-options");
  return (
    <div>
      <PageHeader
        title="New CAPA — Quality NCR"
        description="Raise a CAPA from a quality Non-Conformance Report. Containment first, then RCA."
        breadcrumbs={[{ label: "CAPA", href: "/capa" }, { label: "New" }, { label: "Quality NCR" }]}
      />
      <SourceIntakeForm config={CONFIG} plants={opts.plants} users={opts.users} />
    </div>
  );
}
