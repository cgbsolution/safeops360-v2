import { notFound } from "next/navigation";
import { backendFetch } from "@/lib/backend/fetch";
import { ConductScreen } from "./conduct-screen";
import type { AuditDetail, PlantUser } from "../../lib";

export const dynamic = "force-dynamic";

export default async function ConductPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const audit = await backendFetch<AuditDetail>(`/api/audit-compliance/${id}`).catch(() => null);
  if (!audit) notFound();
  const usersR = await backendFetch<{ users: PlantUser[] }>("/api/audit-compliance/users", {
    query: { plantId: audit.plantId },
  }).catch(() => ({ users: [] as PlantUser[] }));
  return <ConductScreen audit={audit} users={usersR.users} />;
}
