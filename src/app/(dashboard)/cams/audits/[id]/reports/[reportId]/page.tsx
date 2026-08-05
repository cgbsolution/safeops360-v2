import { notFound } from "next/navigation";
import { backendFetch } from "@/lib/backend/fetch";
import { ReportView } from "./report-view";
import type { AuditReport, PlantUser } from "../../../lib";
import type { Erratum } from "../../../../lib-assurance";

export const dynamic = "force-dynamic";

const f = <T,>(v: T) => () => v;

export default async function ReportPage(props: { params: Promise<{ id: string; reportId: string }> }) {
  const { id, reportId } = await props.params;
  const report = await backendFetch<AuditReport>(`/api/audit-compliance/reports/${reportId}`).catch(() => null);
  if (!report) notFound();
  const usersR = await backendFetch<{ users: PlantUser[] }>("/api/audit-compliance/users", {
    query: { plantId: report.siteId },
  }).catch(f({ users: [] as PlantUser[] }));
  const userMap: Record<string, string> = {};
  for (const u of usersR.users) userMap[u.id] = u.name;
  // Prefer the names frozen into the snapshot (covers cross-plant actors).
  for (const [uid, name] of Object.entries(report.snapshot.userNames ?? {})) userMap[uid] = name;

  // Errata degrade to empty rather than failing the report — the DDL may not be
  // applied yet, and a report that 500s because a new table is missing is worse
  // than one that renders without its corrections panel.
  const errata = await backendFetch<{ items: Erratum[] }>(
    `/api/assurance/reports/${reportId}/errata`,
  ).catch(f({ items: [] as Erratum[] }));

  return <ReportView report={report} userMap={userMap} auditId={id} errata={errata.items} />;
}
