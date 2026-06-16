import { notFound } from "next/navigation";
import { backendFetch } from "@/lib/backend/fetch";
import { ConductScreen } from "./conduct-screen";
import type { AuditDetail } from "../../lib";

export const dynamic = "force-dynamic";

export default async function ConductPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const audit = await backendFetch<AuditDetail>(`/api/audit-compliance/${id}`).catch(() => null);
  if (!audit) notFound();
  return <ConductScreen audit={audit} />;
}
