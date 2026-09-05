import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import { resolvePlantContext } from "@/lib/plant-context";
import type { AuditType, Template } from "../../lib-cams";
import type { DisciplineOwnerRow } from "../../lib-assurance";
import { CamsConfigTabs } from "./config-tabs";
import { Alert } from "@/components/ui/alert";

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

  // WP-36 could not be configured until this screen could list real
  // competencies. Both degrade to [] rather than failing the page — the screen
  // still works for every other setting, and says so where it matters.
  const [competencies, regimes, owners, plantCtx] = await Promise.all([
    backendFetch<{ items: { id: string; code: string; name: string }[] }>(
      "/api/competency/competencies",
    ).then((r) => r.items ?? []).catch(() => []),
    backendFetch<{ items: { code: string; name: string; scoringStyle: string }[] }>(
      "/api/assurance/regimes",
    ).then((r) => r.items ?? []).catch(() => []),
    // Ownership of record — moved here from the Independence screen. Config
    // belongs with config; the register is evidence.
    backendFetch<{ items: DisciplineOwnerRow[] }>("/api/assurance/discipline-owners")
      .then((r) => r.items ?? [])
      .catch(() => [] as DisciplineOwnerRow[]),
    // So "Add owner" can offer a named site list. It used to ask the admin to
    // type a plant cuid into a free-text box.
    resolvePlantContext(null).catch(() => ({ plantId: null, plants: [], isOverride: false })),
  ]);

  const session = await getServerSession(authOptions);
  const uid = (session?.user as any)?.id as string | undefined;
  const canConfig = uid ? (await can(uid, "CAMS.TYPE_CONFIG")).allowed : false;

  return (
    <div>
      <PageHeader
        title="Audit Configuration"
        description="Audit types and ownership of record. A type sets a default template, recurrence hint, asset requirement, auditor-competency gate and standards; ownership of record is what the own-work independence guard reads."
        breadcrumbs={[{ label: "CAMS", href: "/cams" }, { label: "Admin" }, { label: "Audit Configuration" }]}
      />
      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</Alert>
      ) : (
        <CamsConfigTabs
          auditTypes={auditTypes}
          templates={templates}
          canConfig={canConfig}
          competencies={competencies}
          regimes={regimes}
          owners={owners}
          plants={plantCtx.plants}
        />
      )}
    </div>
  );
}
