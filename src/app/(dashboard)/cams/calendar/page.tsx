import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import type { EngagementListResponse } from "../lib-cams";
import { CalendarView } from "./calendar-view";

export const dynamic = "force-dynamic";

export default async function UnifiedCalendarPage() {
  await requirePermission("CAMS.READ");
  let data: EngagementListResponse = { items: [], total: 0, statusCounts: {}, typeCounts: {} };
  let error: string | null = null;
  try {
    data = await backendFetch<EngagementListResponse>("/api/cams/unified-engagements");
  } catch (e: any) {
    error = e?.message ?? "Failed to load the audit calendar";
  }

  return (
    <div>
      <PageHeader
        title="Unified Audit Calendar"
        description="Every audit and inspection on one calendar — internal audits, compliance audits, fire & PPE inspections, supplier audits — colour-coded by type, with a provenance badge on consumer-raised engagements. No double-entry."
        breadcrumbs={[{ label: "CAMS", href: "/cams" }, { label: "Calendar" }]}
      />
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>
      ) : (
        <CalendarView items={data.items} />
      )}
    </div>
  );
}
