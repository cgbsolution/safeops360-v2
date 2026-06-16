import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import type { AuditType, Template } from "../../lib-cams";
import { AuditTypesAdmin } from "./audit-types-admin";

export const dynamic = "force-dynamic";

export default async function AuditTypesPage() {
  await requirePermission("CAMS.READ");
  let auditTypes: AuditType[] = [];
  let templates: Template[] = [];
  let error: string | null = null;
  try {
    [auditTypes, templates] = await Promise.all([
      backendFetch<AuditType[]>("/api/cams/audit-types"),
      backendFetch<{ items: Template[] }>("/api/cams/templates", { query: { status: "APPROVED" } }).then((r) => r.items),
    ]);
  } catch (e: any) {
    error = e?.message ?? "Failed to load audit types";
  }

  const session = await getServerSession(authOptions);
  const uid = (session?.user as any)?.id as string | undefined;
  const canConfig = uid ? (await can(uid, "CAMS.TYPE_CONFIG")).allowed : false;

  return (
    <div>
      <PageHeader
        title="Audit Types"
        description="Type configuration — each type sets a default template, recurrence hint, asset requirement, auditor-competency gate and standards. Inspections and audits are the same engine; the type only drives labels and defaults."
        breadcrumbs={[{ label: "CAMS", href: "/cams" }, { label: "Admin" }, { label: "Audit Types" }]}
      />
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>
      ) : (
        <AuditTypesAdmin initial={auditTypes} templates={templates} canConfig={canConfig} />
      )}
    </div>
  );
}
