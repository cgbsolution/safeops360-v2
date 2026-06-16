import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { SourceIntakeForm, SourceIntakeConfig } from "@/components/capa/source-intake-form";

export const dynamic = "force-dynamic";

const CONFIG: SourceIntakeConfig = {
  sourceTypeCode: "CUSTOMER_COMPLAINT",
  sourceLabel: "Customer Complaint",
  defaultPrimaryCategory: "CUSTOMER",
  defaultSeverity: "MODERATE",
  intro:
    "Use this intake for complaints received from customers. Initial-response deadline is auto-set per tenant policy; full RCA proceeds in parallel.",
  fields: [
    { key: "customerName", label: "Customer name", type: "text", required: true },
    { key: "complaintReference", label: "Complaint reference", type: "text", required: true, placeholder: "Internal ticket / case number" },
    { key: "channel", label: "Channel received", type: "select", required: true, options: [
      { code: "EMAIL", label: "Email" },
      { code: "PHONE", label: "Phone" },
      { code: "IN_PERSON", label: "In person" },
      { code: "PORTAL", label: "Portal" },
      { code: "THIRD_PARTY", label: "Third party" }
    ]},
    { key: "complaintReceivedAt", label: "Received at", type: "datetime-local", required: true },
    { key: "productId", label: "Product affected", type: "text", placeholder: "Product ID or name" },
    { key: "productLotNumber", label: "Lot number", type: "text" },
    { key: "quantityAffected", label: "Quantity affected", type: "number" },
    { key: "customerImpact", label: "Customer impact", type: "textarea", placeholder: "How is this affecting the customer?" },
    { key: "customerActionRequested", label: "Customer action requested", type: "select", options: [
      { code: "REFUND", label: "Refund" },
      { code: "REPLACEMENT", label: "Replacement" },
      { code: "CREDIT", label: "Credit" },
      { code: "INVESTIGATION_ONLY", label: "Investigation only" },
      { code: "REGULATORY_ACTION", label: "Regulatory action" }
    ]}
  ]
};

export default async function NewComplaintCapaPage() {
  await requirePermission("CAPA.CREATE");
  const opts = await backendFetch<{
    plants: { id: string; code: string; name: string }[];
    users: { id: string; name: string; email: string; plantId: string | null }[];
  }>("/api/hira/wizard/study-options");
  return (
    <div>
      <PageHeader
        title="New CAPA — Customer Complaint"
        description="Raise a CAPA from a customer complaint with initial-response tracking."
        breadcrumbs={[{ label: "CAPA", href: "/capa" }, { label: "New" }, { label: "Customer Complaint" }]}
      />
      <SourceIntakeForm config={CONFIG} plants={opts.plants} users={opts.users} />
    </div>
  );
}
