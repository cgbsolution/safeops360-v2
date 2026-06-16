// Incident READ access — single source of truth.
//
// The Incident Investigation RBAC matrix scopes who can see which records:
//   • Worker / Contractor Workman           → OWN_RECORDS  (reported themselves)
//   • Supervisor / Permit Issuer / Dept Head → OWN_DEPARTMENT (their department)
//   • Safety Officer / HSE Manager / Plant Head → OWN_PLANT (their plant)
//   • Corporate HSE / Admin                  → ALL_PLANTS (everything)
//
// This helper turns the caller's scopes into a Prisma `where` fragment. Both
// the LIST page (to hide rows the user can't open and to scope the counts)
// and the DETAIL page (as the read gate) use it, so the two can never
// disagree — the list never shows a row that the detail page would deny.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getScopesFor } from "@/lib/auth/permissions";
import { getAccessiblePlantIds } from "@/lib/dashboard/scope";

// `{}`    → unrestricted (ALL_PLANTS)
// `false` → no access at all (render nothing)
// object  → a where-fragment limiting to the accessible records
export type IncidentReadScope = Prisma.IncidentWhereInput | false;

export async function incidentReadScopeWhere(userId: string): Promise<IncidentReadScope> {
  if (!userId) return false;

  const scopes = await getScopesFor(userId, "INCIDENT.READ");
  if (scopes.length === 0) return false;
  if (scopes.includes("ALL_PLANTS")) return {};

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { plantId: true, department: true }
  });

  const ors: Prisma.IncidentWhereInput[] = [];

  // OWN_PLANT — every incident at the user's accessible plants.
  // Uses getAccessiblePlantIds() so multi-plant users (e.g. NW+SW HSE Manager)
  // see incidents from all their plants, not just their primary plantId.
  if (scopes.includes("OWN_PLANT")) {
    const plantIds = await getAccessiblePlantIds();
    if (plantIds && plantIds.length > 0) {
      ors.push(plantIds.length === 1 ? { plantId: plantIds[0] } : { plantId: { in: plantIds } });
    } else if (me?.plantId) {
      ors.push({ plantId: me.plantId });
    }
  }

  // OWN_DEPARTMENT — incidents at the user's plant(s) in their department.
  if (scopes.includes("OWN_DEPARTMENT") && me?.plantId) {
    ors.push(
      me.department
        ? { plantId: me.plantId, department: { is: { name: me.department } } }
        : { plantId: me.plantId }
    );
  }

  // OWN_RECORDS — only incidents the user reported themselves.
  if (scopes.includes("OWN_RECORDS")) {
    ors.push({ reporterId: userId });
  }

  if (ors.length === 0) return false;
  return ors.length === 1 ? ors[0] : { OR: ors };
}

// True if `userId` may READ the given incident — used by the detail-page gate.
export async function canReadIncident(userId: string, incidentId: string): Promise<boolean> {
  const scope = await incidentReadScopeWhere(userId);
  if (scope === false) return false;
  const hit = await prisma.incident.findFirst({
    where: { AND: [{ id: incidentId }, scope] },
    select: { id: true }
  });
  return hit !== null;
}
