import { notFound } from "next/navigation";
import { backendFetch, BackendError } from "@/lib/backend/fetch";
import { AccessRestricted } from "@/components/access-restricted";
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

  // Every other detail page in the app discriminates on the backend's status
  // here; this one used `.catch(() => null)` and rendered notFound() for ALL of
  // them. A row-level scope denial, a 500 and an unreachable backend all came
  // back as "404 This page could not be found", which is the one message that
  // is definitely wrong — the audit exists — and it sent people looking for a
  // broken link instead of at their permissions or the backend.
  let audit: AuditDetail;
  try {
    audit = await backendFetch<AuditDetail>(`/api/audit-compliance/${id}`);
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    // Scope denial — the audit is on a plant outside this viewer's scope, or
    // their role lacks AUDIT_COMPLIANCE.READ. The list is already
    // scope-filtered, so this only fires on a direct URL or a stale link.
    if (e instanceof BackendError && e.status === 403) {
      return (
        <AccessRestricted
          description="This audit is outside your access scope"
          message="It belongs to a plant or scope your role isn’t permitted to view, or your role does not hold AUDIT_COMPLIANCE.READ. Ask an administrator to review your permissions."
          backHref="/cams/audits"
          backLabel="← Back to audits"
          breadcrumbs={[{ label: "Audit & Compliance", href: "/cams/audits" }]}
        />
      );
    }
    // Anything else (500, timeout, bad JWT) is a real fault: let it reach the
    // error boundary and the server logs rather than being disguised as a
    // missing page.
    throw e;
  }

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
