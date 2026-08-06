import { notFound } from "next/navigation";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import type { Engagement, ChecklistRunner, FindingListResponse, Template } from "../../lib-cams";
import type { BookingsResponse } from "../../lib-calendar";
import { EngagementWorkspace } from "./engagement-workspace";

export const dynamic = "force-dynamic";

export default async function EngagementWorkspacePage(props: { params: Promise<{ id: string }> }) {
  await requirePermission("CAMS.READ");
  const { id } = await props.params;

  let engagement: Engagement;
  try {
    engagement = await backendFetch<Engagement>(`/api/cams/engagements/${id}`);
  } catch {
    notFound();
  }

  const [runner, findings, templates, bookings] = await Promise.all([
    backendFetch<ChecklistRunner>(`/api/cams/engagements/${id}/checklist`).catch(() => null),
    backendFetch<FindingListResponse>("/api/cams/findings", { query: { engagementId: id } }).catch(
      () => ({ items: [], total: 0, severityCounts: {}, statusCounts: {}, repeatCount: 0 }) as FindingListResponse
    ),
    backendFetch<{ items: Template[] }>("/api/cams/templates", { query: { status: "APPROVED" } }).then((r) => r.items).catch(() => [] as Template[]),
    // Degrades to null rather than failing the page: the CalendarBooking table
    // may not be applied yet on this deployment.
    backendFetch<BookingsResponse>("/api/calendar/bookings", {
      query: { engagementKind: "INSPECTION", engagementId: id },
    }).catch(() => null),
  ]);

  // Capability flags for client gating (server-evaluated, authoritative).
  const session = await getServerSession(authOptions);
  const uid = (session?.user as any)?.id as string | undefined;
  const flag = async (code: string) => (uid ? (await can(uid, code)).allowed : false);
  const perms = {
    schedule: await flag("CAMS.SCHEDULE"),
    execute: await flag("CAMS.EXECUTE"),
    close: await flag("CAMS.CLOSE"),
    findingManage: await flag("CAMS.FINDING_MANAGE"),
  };

  return (
    <div>
      <PageHeader
        title={`${engagement.engagementCode} — ${engagement.title}`}
        breadcrumbs={[{ label: "CAMS", href: "/cams" }, { label: "Engagements", href: "/cams/engagements" }, { label: engagement.engagementCode }]}
      />
      <EngagementWorkspace
        key={engagement.status}
        engagement={engagement}
        runner={runner}
        findings={findings.items}
        approvedTemplates={templates}
        perms={perms}
        bookings={bookings}
      />
    </div>
  );
}
