// Shared plant-scope resolver for analytics-strip / widget data loaders.
//
// Modules that already expose a list-scope helper (observations, incidents)
// reuse THAT — the strip's numbers then match the list exactly. For modules
// without one, this gives a consistent rule: a plant-bound user sees only the
// plants they have UserRole entries for; corporate/admin roles see the whole
// group. React.cache'd so multiple strips/widgets in one request share a
// single user lookup.

import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Roles that legitimately see across all plants. */
const GROUP_WIDE_ROLES = new Set(["ADMIN", "CORPORATE_HSE", "CEO", "MD", "DIRECTOR"]);

export type PlantIdFilter = string | { in: string[] };
export type PlantWhere = { plantId?: PlantIdFilter };

/**
 * Returns all plant IDs the current user can access, or null for group-wide
 * roles (no restriction). Collects:
 *   1. The user's home plant (User.plantId)
 *   2. Every PLANT-scoped UserRole entry (cross-plant RBAC assignments)
 *
 * This means an HSE Manager assigned to NW and SW via UserRole sees both,
 * while an industry-tenant user with only one plant UserRole sees just theirs.
 */
export const getAccessiblePlantIds = cache(async (): Promise<string[] | null> => {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return null;

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { plantId: true, role: true },
  });
  if (!u || GROUP_WIDE_ROLES.has(u.role)) return null; // no restriction

  const plantIds = new Set<string>();
  if (u.plantId) plantIds.add(u.plantId);

  // Collect all plant IDs from PLANT-scoped UserRole entries
  const plantRoles = await prisma.userRole.findMany({
    where: { userId, scopeType: "PLANT", scopeValue: { not: null } },
    select: { scopeValue: true },
  });
  for (const r of plantRoles) {
    if (r.scopeValue) plantIds.add(r.scopeValue);
  }

  return plantIds.size > 0 ? [...plantIds] : (u.plantId ? [u.plantId] : null);
});

/**
 * Returns a Prisma `where` fragment scoping a query to the caller's plants,
 * or `{}` for group-wide roles. Spread into any model query with a `plantId`
 * column: `where: { ...(await stripPlantWhere()), status: "OPEN" }`.
 *
 * An explicit `plantId` override always wins when provided.
 */
export const stripPlantWhere = cache(
  async (override?: string): Promise<PlantWhere> => {
    if (override) return { plantId: override };
    const ids = await getAccessiblePlantIds();
    if (!ids) return {}; // group-wide — no filter
    if (ids.length === 1) return { plantId: ids[0] };
    return { plantId: { in: ids } };
  }
);
