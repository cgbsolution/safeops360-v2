// Builds Prisma `where` clauses that match the user's READ scope for a given
// module. Used by every list page so users only see records their RBAC scope
// allows. Without this, list queries return everything the DB has — including
// records in other plants / departments / belonging to other users.
//
// The broadest applicable scope wins:  ALL_PLANTS → OWN_PLANT → OWN_DEPARTMENT → OWN_RECORDS.
//
// Per-module helpers exist because the WHERE clause shape differs per table
// (e.g., Observation has `observerId` + `responsiblePersonId`; PTW has
// `originatorId` + `issuerId` + `receiverId`).

import { cache } from "react";
import { getScopesFor, getUserScopeProfile } from "@/lib/auth/permissions";
import { getAccessiblePlantIds } from "@/lib/dashboard/scope";

type Scope = "ALL_PLANTS" | "OWN_PLANT" | "OWN_DEPARTMENT" | "OWN_RECORDS";
const SCOPE_RANK: Record<Scope, number> = {
  ALL_PLANTS: 4,
  OWN_PLANT: 3,
  OWN_DEPARTMENT: 2,
  OWN_RECORDS: 1
};

// Wrapped in React.cache so two callers in the same request (e.g.
// buildObservationListWhere + getReadScope on the observations page) only do
// the work once.
//
// All three inputs now come from the /api/auth/access-snapshot cache rather
// than from Prisma, so a list filter and the `can()` check guarding the matching
// detail page are computed from the exact same grant data — they cannot
// disagree about what the user may see.
const loadReadScopeAndProfile = cache(async (userId: string, permissionCode: string) => {
  const [scopes, profile, plantIds] = await Promise.all([
    getScopesFor(userId, permissionCode),
    getUserScopeProfile(userId),
    getAccessiblePlantIds()
  ]);

  // The broadest applicable scope wins.
  let best: Scope | null = null;
  for (const s of scopes as Scope[]) {
    if (!best || SCOPE_RANK[s] > SCOPE_RANK[best]) best = s;
  }

  return { scope: best, profile, plantIds };
});

// "match-nothing" sentinel — used when the user has no scope or their profile
// is missing required fields. Prisma resolves this to an impossible match.
const MATCH_NOTHING = { id: "__no_match__" };

// Build a Prisma plantId filter from accessible plant IDs.
// Single plant → { plantId: id }; multiple → { plantId: { in: [...] } }
function plantFilter(plantIds: string[] | null, fallback: string | null | undefined): Record<string, any> | null {
  if (plantIds && plantIds.length > 0) {
    return plantIds.length === 1 ? { plantId: plantIds[0] } : { plantId: { in: plantIds } };
  }
  if (fallback) return { plantId: fallback };
  return null;
}

// Build a where clause for OBSERVATION list/count queries.
export async function buildObservationListWhere(userId: string): Promise<Record<string, any>> {
  const { scope, profile, plantIds } = await loadReadScopeAndProfile(userId, "OBSERVATION.READ");
  if (!scope) return MATCH_NOTHING;

  if (scope === "ALL_PLANTS") return {};

  if (scope === "OWN_PLANT") {
    const pf = plantFilter(plantIds, profile?.plantId);
    return pf ?? MATCH_NOTHING;
  }

  if (scope === "OWN_DEPARTMENT") {
    if (!profile?.plantId || !profile?.department) return MATCH_NOTHING;
    // Department lives on the observer (departments aren't directly on the
    // record). So filter via the observer relation.
    return {
      plantId: profile.plantId,
      observer: { is: { department: profile.department } }
    };
  }

  // OWN_RECORDS — only observations the user originated or is responsible on
  return {
    OR: [
      { observerId: userId },
      { responsiblePersonId: userId }
    ]
  };
}

// Returns the scope code the helper applied. Useful for showing the user
// which slice of records they're seeing (e.g., a banner: "Showing your
// department's observations only.").
export async function getReadScope(userId: string, permissionCode: string): Promise<Scope | null> {
  const { scope } = await loadReadScopeAndProfile(userId, permissionCode);
  return scope;
}
