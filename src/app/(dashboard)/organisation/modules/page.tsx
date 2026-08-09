// Organisation → Modules. The Super Admin's screen: which of the licensed
// modules this organisation actually uses.
//
// This portal is single-tenant — one organisation (e.g. Page Industries) with
// many plants — so a decision made here applies everywhere at once. That is the
// difference from Configuration → Licence → per-factory access, which allocates
// what survives this screen to individual plants.
//
// Guarded on Super Admin identity — normally the ORGANISATION.MODULES grant,
// with the SUPER_ADMIN role code and the anchor email as break-glass so an RBAC
// edit can't leave the organisation with nobody able to reach this screen. The
// Python API applies exactly the same test, so this guard is defence in depth
// rather than the boundary.

import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { isSuperAdmin, SUPER_ADMIN_PERMISSION } from "@/lib/auth/super-admin";
import { OrganisationModuleGrid } from "@/components/licensing/organisation-module-grid";

export const dynamic = "force-dynamic";

export default async function OrganisationModulesPage() {
  if (!(await isSuperAdmin())) {
    const params = new URLSearchParams({
      code: SUPER_ADMIN_PERMISSION,
      reason: "Organisation-wide module access is managed by the Super Admin."
    });
    redirect(`/access-denied?${params.toString()}`);
  }

  return (
    <div>
      <PageHeader
        title="Organisation modules"
        description="Enable or disable modules for the whole organisation. Applies to every plant and every user."
      />
      <OrganisationModuleGrid />
    </div>
  );
}
