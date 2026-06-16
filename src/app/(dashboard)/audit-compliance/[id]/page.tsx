import { notFound } from "next/navigation";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { AuditDetailView } from "./audit-detail";
import type { AuditDetail, AuditDashboard, PlantUser } from "../lib";

export const dynamic = "force-dynamic";

const f = <T,>(v: T) => () => v;

export default async function AuditDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const audit = await backendFetch<AuditDetail>(`/api/audit-compliance/${id}`).catch(() => null);
  if (!audit) notFound();

  const [dash, usersR] = await Promise.all([
    backendFetch<AuditDashboard>(`/api/audit-compliance/${id}/dashboard`).catch(f<AuditDashboard | null>(null)),
    backendFetch<{ users: PlantUser[] }>("/api/audit-compliance/users", { query: { plantId: audit.plantId } }).catch(f({ users: [] as PlantUser[] })),
  ]);

  const userMap: Record<string, string> = {};
  for (const u of usersR.users) userMap[u.id] = u.name;

  return (
    <div>
      <PageHeader
        title={audit.title}
        breadcrumbs={[{ label: "Audit & Compliance", href: "/audit-compliance" }, { label: audit.auditNumber }]}
      />
      <AuditDetailView audit={audit} dashboard={dash} userMap={userMap} users={usersR.users} />
    </div>
  );
}
