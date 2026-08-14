// Shared plant-scope resolver for analytics-strip / widget data loaders.
//
// Modules that expose a list-scope helper (observations, incidents) reuse THAT
// — the strip's numbers then match the list exactly. For modules without one,
// this gives a consistent rule.
//
// Scope now comes from /api/auth/access-snapshot via getAccessiblePlants(),
// the same grant data the backend's own list endpoints use. It previously
// derived scope from a hard-coded role-name allowlist:
//
//     GROUP_WIDE_ROLES = ADMIN | CORPORATE_HSE | CEO | MD | DIRECTOR
//
// which meant a role granted ALL_PLANTS through RBAC but absent from that list
// saw a narrower widget than the list beneath it — and a role on the list kept
// group-wide sight after its grant was revoked. Both are gone: the RBAC grant
// is now the only thing that decides.
//
// React.cache'd so multiple strips/widgets in one request share a single
// lookup, which in turn hits the 30s snapshot cache.

import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAccessiblePlants } from "@/lib/auth/permissions";

export type PlantIdFilter = string | { in: string[] };
export type PlantWhere = { plantId?: PlantIdFilter };

/**
 * All plant IDs the current user can access, or null for unrestricted
 * (ALL_PLANTS). Returns an empty array when the user has no plant at all,
 * which callers must treat as "show nothing" rather than "show everything".
 */
export const getAccessiblePlantIds = cache(async (): Promise<string[] | null> => {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  // No session → no scope. Returning null here would mean "unrestricted", so
  // an unauthenticated render must not take that path.
  if (!userId) return [];
  return getAccessiblePlants(userId);
});

/**
 * A `where`-style fragment scoping a query to the caller's plants, or `{}` for
 * unrestricted. An explicit `plantId` override always wins when provided.
 */
export const stripPlantWhere = cache(
  async (override?: string): Promise<PlantWhere> => {
    if (override) return { plantId: override };
    const ids = await getAccessiblePlantIds();
    if (!ids) return {}; // unrestricted — no filter
    if (ids.length === 1) return { plantId: ids[0] };
    return { plantId: { in: ids } };
  }
);
