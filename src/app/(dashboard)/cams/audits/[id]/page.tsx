import { notFound } from "next/navigation";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { AuditDetailView } from "./audit-detail";
import type { AuditDetail, AuditDashboard, PlantUser, AuditReport } from "../lib";
import type { CompetenceSnapshotRow, MeetingsResponse } from "../../lib-assurance";
import type { BookingsResponse } from "../../lib-calendar";
import type { SignOffStatus } from "@/components/assurance/signoff-panel";
import type { PortalSubmission } from "@/components/assurance/supplier-panel";

export const dynamic = "force-dynamic";

const f = <T,>(v: T) => () => v;

export default async function AuditDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const audit = await backendFetch<AuditDetail>(`/api/audit-compliance/${id}`).catch(() => null);
  if (!audit) notFound();

  const [dash, usersR, reportsR, meetings, competence, signoff, bookings] = await Promise.all([
    backendFetch<AuditDashboard>(`/api/audit-compliance/${id}/dashboard`).catch(f<AuditDashboard | null>(null)),
    backendFetch<{ users: PlantUser[] }>("/api/audit-compliance/users", { query: { plantId: audit.plantId } }).catch(f({ users: [] as PlantUser[] })),
    backendFetch<{ reports: AuditReport[] }>(`/api/audit-compliance/${id}/reports`).catch(f({ reports: [] as AuditReport[] })),
    // Assurance blocks (docs/cams/09 §2.2–2.3). Both degrade to null/empty
    // rather than failing the page — the DDL may not be applied yet, and an
    // audit detail screen that 500s because a new table is missing is worse
    // than one that renders without the new panels.
    backendFetch<MeetingsResponse>("/api/assurance/meetings", {
      query: { engagementKind: "AUDIT", engagementId: id },
    }).catch(f<MeetingsResponse | null>(null)),
    backendFetch<{ items: CompetenceSnapshotRow[] }>("/api/assurance/competence/snapshots", {
      query: { engagementKind: "AUDIT", engagementId: id },
    }).catch(f({ items: [] as CompetenceSnapshotRow[] })),
    // WP-41 sign-off gates closure, so the panel has to load with the page.
    backendFetch<SignOffStatus>(`/api/assurance/audits/${id}/signoff`).catch(
      f<SignOffStatus | null>(null),
    ),
    // Calendar bookings. Degrades to null on the same principle as the
    // assurance blocks above — the CalendarBooking table may not be applied
    // yet, and an audit screen that 500s because a new table is missing is
    // worse than one that renders without the panel.
    backendFetch<BookingsResponse>("/api/calendar/bookings", {
      query: { engagementKind: "AUDIT", engagementId: id },
    }).catch(f<BookingsResponse | null>(null)),
  ]);

  // WP-45 — what the supplier has sent through the portal. Fetched only for a
  // supplier audit, and degrading to empty like the assurance blocks above so a
  // missing portal table cannot 500 the detail screen.
  const submissions =
    audit.subjectType === "VENDOR"
      ? (
          await backendFetch<{ items: PortalSubmission[] }>(
            `/api/cams-completion/suppliers/portal/${id}/submissions`,
          ).catch(f({ items: [] as PortalSubmission[] }))
        ).items
      : [];

  const userMap: Record<string, string> = {};
  for (const u of usersR.users) userMap[u.id] = u.name;
  // Merge the audit's own resolved actor names (covers cross-plant ALL_PLANTS
  // users the plant-scoped /users picker can't return).
  for (const [id, name] of Object.entries(audit.userNames ?? {})) userMap[id] = name;

  return (
    <div>
      <PageHeader
        title={audit.title}
        breadcrumbs={[{ label: "Audit & Compliance", href: "/cams/audits" }, { label: audit.auditNumber }]}
      />
      <AuditDetailView
        audit={audit}
        dashboard={dash}
        userMap={userMap}
        users={usersR.users}
        reports={reportsR.reports}
        meetings={meetings}
        competence={competence.items}
        signoff={signoff}
        submissions={submissions}
        bookings={bookings}
      />
    </div>
  );
}
