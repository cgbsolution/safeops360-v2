import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { PlantSwitcher } from "@/components/plant-switcher";
import { resolvePlantContext } from "@/lib/plant-context";
import { AuditRegisterView } from "./audit-register-view";
import type { AuditRow, ProgrammeDashboard, AuditCategory, AuditLibrary, AuditTemplate, PlantUser } from "./lib";

export const dynamic = "force-dynamic";

const f = <T,>(v: T) => () => v;

export default async function AuditCompliancePage(props: { searchParams: Promise<{ plantId?: string }> }) {
  const sp = await props.searchParams;
  const { plantId, plants } = await resolvePlantContext(sp.plantId);

  const [list, dash, templates, libraries, usersR] = await Promise.all([
    backendFetch<{ audits: AuditRow[] }>("/api/audit-compliance").catch(f({ audits: [] as AuditRow[] })),
    backendFetch<ProgrammeDashboard>("/api/audit-compliance/dashboard/programme").catch(f<ProgrammeDashboard | null>(null)),
    backendFetch<{ templates: AuditTemplate[] }>("/api/audit-compliance/templates").catch(f({ templates: [] as AuditTemplate[] })),
    // One payload carries both the libraries and the audit-category menu, so
    // the scheduler can never show a category whose checklist is absent.
    backendFetch<{ libraries: AuditLibrary[]; auditCategories?: AuditCategory[] }>("/api/audit-compliance/library")
      .catch(f({ libraries: [] as AuditLibrary[], auditCategories: [] as AuditCategory[] })),
    plantId
      ? backendFetch<{ users: PlantUser[] }>("/api/audit-compliance/users", { query: { plantId } }).catch(f({ users: [] as PlantUser[] }))
      : Promise.resolve({ users: [] as PlantUser[] }),
  ]);

  return (
    <div>
      <PageHeader
        title="Audit & Compliance"
        breadcrumbs={[{ label: "Audit & Compliance" }]}
        description="Three audit categories — Internal (HR, EHS, Production), QMS/EMS/OHS (ISO 9001, 14001, 45001, 50001) and Social Compliance — in one format: schedule, conduct on-site, grade each checkpoint, route findings to auditees, review and close. Critical failures auto-spawn CAPA."
        action={<PlantSwitcher plants={plants} currentPlantId={plantId} />}
      />
      <AuditRegisterView
        plantId={plantId ?? null}
        audits={list.audits}
        dashboard={dash}
        templates={templates.templates}
        libraries={libraries.libraries}
        auditCategories={libraries.auditCategories ?? []}
        users={usersR.users}
      />
    </div>
  );
}
