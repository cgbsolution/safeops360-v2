import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { SourceIntakeForm, SourceIntakeConfig } from "@/components/capa/source-intake-form";

export const dynamic = "force-dynamic";

const CONFIG: SourceIntakeConfig = {
  sourceTypeCode: "AUDIT_EXTERNAL",
  sourceLabel: "Audit Finding",
  defaultPrimaryCategory: "PROCESS",
  defaultSeverity: "MODERATE",
  intro:
    "Use this intake for audit findings (internal, external, regulatory). The audit reference, classification, and clause violated are captured as source metadata.",
  fields: [
    { key: "auditType", label: "Audit type", type: "select", required: true, options: [
      { code: "INTERNAL", label: "Internal" },
      { code: "EXTERNAL", label: "External / Certification body" },
      { code: "REGULATORY", label: "Regulatory" },
      { code: "SUPPLIER", label: "Supplier" },
      { code: "CUSTOMER", label: "Customer" }
    ]},
    { key: "auditName", label: "Audit name / reference", type: "text", required: true, placeholder: "e.g. ISO 9001 Surveillance Audit 2026" },
    { key: "auditorName", label: "Auditor name", type: "text", required: true },
    { key: "auditDate", label: "Audit date", type: "date", required: true },
    { key: "findingReference", label: "Finding reference", type: "text", required: true, placeholder: "e.g. Finding 3.2" },
    { key: "findingClassification", label: "Classification", type: "select", required: true, options: [
      { code: "MAJOR", label: "Major" },
      { code: "MINOR", label: "Minor" },
      { code: "OBSERVATION", label: "Observation" },
      { code: "OPPORTUNITY_FOR_IMPROVEMENT", label: "Opportunity for improvement" }
    ]},
    { key: "clauseViolated", label: "Clause / standard violated", type: "text", placeholder: "e.g. ISO 9001:2015 Clause 8.2.1" },
    { key: "auditorWording", label: "Auditor's wording (quoted from report)", type: "textarea", placeholder: "Quote the finding verbatim from the audit report" }
  ]
};

export default async function NewAuditCapaPage() {
  await requirePermission("CAPA.CREATE");
  const opts = await backendFetch<{
    plants: { id: string; code: string; name: string }[];
    users: { id: string; name: string; email: string; plantId: string | null }[];
  }>("/api/hira/wizard/study-options");
  return (
    <div>
      <PageHeader
        title="New CAPA — Audit Finding"
        description="Raise a CAPA from an internal / external / regulatory audit finding."
        breadcrumbs={[{ label: "CAPA", href: "/capa" }, { label: "New" }, { label: "Audit" }]}
      />
      <SourceIntakeForm config={CONFIG} plants={opts.plants} users={opts.users} />
    </div>
  );
}
