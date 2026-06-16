import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { SourceIntakeForm, SourceIntakeConfig } from "@/components/capa/source-intake-form";

export const dynamic = "force-dynamic";

const CONFIG: SourceIntakeConfig = {
  sourceTypeCode: "MANAGEMENT_REVIEW_ACTION",
  sourceLabel: "Management Review Action",
  defaultPrimaryCategory: "PROCESS",
  defaultSeverity: "MODERATE",
  intro:
    "Action item from a periodic management review meeting. Use this when an MGR meeting agrees that an organisational issue needs a tracked CAPA.",
  fields: [
    { key: "reviewMeetingDate", label: "Review meeting date", type: "date", required: true },
    { key: "reviewChairperson", label: "Chairperson", type: "text", required: true },
    { key: "actionItemReference", label: "Action item reference from minutes", type: "text", required: true, placeholder: "e.g. MGR-2026-Q2-Action-3" },
    { key: "businessObjectiveLinked", label: "Business objective linked", type: "text", placeholder: "Which strategic objective does this CAPA support?" },
    { key: "strategicPriority", label: "Strategic priority", type: "select", required: true, options: [
      { code: "HIGH", label: "High" },
      { code: "MEDIUM", label: "Medium" },
      { code: "LOW", label: "Low" }
    ]},
    { key: "meetingMinutesUrl", label: "Meeting minutes URL", type: "text", placeholder: "Link to the minutes document" }
  ]
};

export default async function NewManagementReviewCapaPage() {
  await requirePermission("CAPA.CREATE");
  const opts = await backendFetch<{
    plants: { id: string; code: string; name: string }[];
    users: { id: string; name: string; email: string; plantId: string | null }[];
  }>("/api/hira/wizard/study-options");
  return (
    <div>
      <PageHeader
        title="New CAPA — Management Review"
        description="Raise a CAPA from a management review action item."
        breadcrumbs={[{ label: "CAPA", href: "/capa" }, { label: "New" }, { label: "Management Review" }]}
      />
      <SourceIntakeForm config={CONFIG} plants={opts.plants} users={opts.users} />
    </div>
  );
}
