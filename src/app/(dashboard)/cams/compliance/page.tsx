import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import type { ComplianceTracker, EngagementListResponse, FindingListResponse } from "../lib-cams";
import { ComplianceView } from "./compliance-view";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function ComplianceTrackerPage() {
  await requirePermission("CAMS.READ");

  let tracker: ComplianceTracker = { totalObligations: 0, verifiedByAuditCount: 0, verifiedPct: 0, openNcCount: 0, statusCounts: {}, rows: [] };
  let engagements: EngagementListResponse = { items: [], total: 0, statusCounts: {}, typeCounts: {} };
  let findings: FindingListResponse = { items: [], total: 0, severityCounts: {}, statusCounts: {}, repeatCount: 0 };
  let error: string | null = null;
  try {
    [tracker, engagements, findings] = await Promise.all([
      backendFetch<ComplianceTracker>("/api/cams/compliance"),
      backendFetch<EngagementListResponse>("/api/cams/engagements"),
      backendFetch<FindingListResponse>("/api/cams/findings"),
    ]);
  } catch (e: any) {
    error = e?.message ?? "Failed to load the compliance tracker";
  }

  const session = await getServerSession(authOptions);
  const uid = (session?.user as any)?.id as string | undefined;
  const canLink = uid ? (await can(uid, "CAMS.FINDING_MANAGE")).allowed : false;

  return (
    <div>
      <PageHeader
        title="Compliance Tracker"
        description="Of every statutory obligation, how many are verified by an audit in the last 12 months — and how many carry an open non-conformance. The question a regulator and a certification body actually ask."
        breadcrumbs={[{ label: "CAMS", href: "/cams" }, { label: "Compliance Tracker" }]}
      />
      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</Alert>
      ) : (
        <ComplianceView
          tracker={tracker}
          engagements={engagements.items.map((e) => ({ id: e.id, code: e.engagementCode, title: e.title }))}
          findings={findings.items.map((f) => ({ id: f.id, code: f.findingCode, title: f.title }))}
          canLink={canLink}
        />
      )}
    </div>
  );
}
