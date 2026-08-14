// Incident READ access.
//
// The Incident Investigation RBAC matrix scopes who can see which records:
//   • Worker / Contractor Workman            → OWN_RECORDS  (reported themselves)
//   • Supervisor / Permit Issuer / Dept Head → OWN_DEPARTMENT
//   • Safety Officer / HSE Manager / Plant Head → OWN_PLANT
//   • Corporate HSE / Admin                  → ALL_PLANTS
//
// Row filtering is no longer done here. `/api/incidents` applies the scope
// itself and `/api/incidents/{id}` 403s a record the caller may not read, so
// this file's remaining job is only to answer two questions the UI asks
// *before* it fetches:
//
//   1. "does this user hold INCIDENT.READ at all?" — so the list page can
//      render a denied banner instead of an empty table;
//   2. "may this user open THIS record?" — the detail page's gate, which
//      decides between rendering and redirecting.
//
// Keeping (2) as a real backend call matters: the detail page fetches a dozen
// child collections, and every one of them would 403 individually. Asking once
// up front is what turns a screen plastered with "Failed to load" into a clean
// redirect.

import { backendFetch } from "@/lib/backend/fetch";
import { can } from "@/lib/auth/permissions";

// `{}`    → the caller holds INCIDENT.READ; the backend narrows the rows.
// `false` → no access at all (render the denied state, skip the fetch).
export type IncidentReadScope = Record<string, never> | false;

export async function incidentReadScopeWhere(userId: string): Promise<IncidentReadScope> {
  if (!userId) return false;
  const check = await can(userId, "INCIDENT.READ", {});
  return check.allowed ? {} : false;
}

/** True if `userId` may READ this incident — the detail page's gate.
 *  Soft-deleted incidents are unreadable at every scope; the backend's own
 *  filter enforces that, so a deleted record answers false here too. */
export async function canReadIncident(userId: string, incidentId: string): Promise<boolean> {
  if (!userId || !incidentId) return false;
  try {
    await backendFetch(`/api/incidents/${encodeURIComponent(incidentId)}`, { userId });
    return true;
  } catch {
    // Any non-2xx — 403 (out of scope), 404 (absent or soft-deleted) — means
    // "don't render". Fail closed: a transport error must not open the page.
    return false;
  }
}
