// Central permission service. Every layer (UI, route guard, API, workflow
// engine) calls into this. Adding/removing what a role can do is a data
// change — never a code change.
//
// The model:
//   User  ──< UserRole >── Role  ──< RolePermission >── Permission
// Each RolePermission carries a scope (ALL_PLANTS / OWN_PLANT /
// OWN_DEPARTMENT / OWN_RECORDS). Permission grants are additive across the
// user's roles — if any matching grant satisfies the scope, the action is
// allowed.

import { prisma } from "@/lib/prisma";

export type PermissionScope = "ALL_PLANTS" | "OWN_PLANT" | "OWN_DEPARTMENT" | "OWN_RECORDS";

export type PermissionContext = {
  module?: string;
  recordId?: string;
  plantId?: string | null;
  departmentId?: string | null;
  // The record itself, if available — used for OWN_RECORDS scope checks.
  // Pass `{ originatorId, ownerId, reporterId, ... }` so we can match.
  record?: Record<string, any>;
};

export type CanResult = { allowed: boolean; reason?: string; matchedScope?: PermissionScope };

// Cache user-permission lookup for 30 seconds. Permission edits in the admin
// UI invalidate the cache via invalidateUserPermissions().
type CachedPermissionRow = {
  permissionCode: string;
  scope: PermissionScope;
  conditions: any;
  roleId: string;
};
type CacheEntry = { rows: CachedPermissionRow[]; expiresAt: number };
const PERMISSION_CACHE = new Map<string, CacheEntry>();
const TTL_MS = 30_000;

function cacheKey(userId: string) {
  return `u:${userId}`;
}

export function invalidateUserPermissions(userId?: string) {
  if (userId) PERMISSION_CACHE.delete(cacheKey(userId));
  else PERMISSION_CACHE.clear();
}

async function loadUserPermissions(userId: string): Promise<CachedPermissionRow[]> {
  const cached = PERMISSION_CACHE.get(cacheKey(userId));
  if (cached && cached.expiresAt > Date.now()) return cached.rows;

  const userRoles = await prisma.userRole.findMany({
    where: {
      userId,
      OR: [
        { validTo: null },
        { validTo: { gt: new Date() } }
      ]
    },
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } }
        }
      }
    }
  });

  const rows: CachedPermissionRow[] = [];
  for (const ur of userRoles) {
    if (!ur.role.isActive) continue;
    for (const rp of ur.role.permissions) {
      rows.push({
        permissionCode: rp.permission.code,
        scope: rp.scope as PermissionScope,
        conditions: rp.conditions ?? null,
        roleId: ur.roleId
      });
    }
  }

  // Don't cache empty results. If a user has no permissions right now (e.g.,
  // mid-reseed, or their role was just deactivated), we want the next call to
  // re-check rather than locking them out for a full TTL window.
  if (rows.length > 0) {
    PERMISSION_CACHE.set(cacheKey(userId), { rows, expiresAt: Date.now() + TTL_MS });
  }
  return rows;
}

// User profile fields needed for scope checks (plant, department, etc).
type UserProfileLite = {
  id: string;
  plantId: string | null;
  department: string | null;
};
async function loadUserProfile(userId: string): Promise<UserProfileLite | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, plantId: true, department: true }
  });
  return u;
}

// The single function every layer calls.
export async function can(
  userId: string,
  permissionCode: string,
  context: PermissionContext = {}
): Promise<CanResult> {
  const rows = await loadUserPermissions(userId);
  const matches = rows.filter((r) => r.permissionCode === permissionCode);

  if (matches.length === 0) {
    return { allowed: false, reason: `Missing permission '${permissionCode}'` };
  }

  // ALL_PLANTS scope wins immediately
  if (matches.some((m) => m.scope === "ALL_PLANTS")) {
    return { allowed: true, matchedScope: "ALL_PLANTS" };
  }

  // Need user profile for plant/department comparison
  const profile = await loadUserProfile(userId);
  if (!profile) return { allowed: false, reason: "User profile lookup failed" };

  for (const m of matches) {
    if (m.scope === "OWN_PLANT") {
      // CREATE-style calls don't pass recordId but do pass plantId
      if (context.plantId && profile.plantId && context.plantId === profile.plantId) {
        return { allowed: true, matchedScope: "OWN_PLANT" };
      }
      // No plant context (e.g., listing): allow — caller is expected to filter
      // by getAccessiblePlants().
      if (!context.plantId && !context.recordId) {
        return { allowed: true, matchedScope: "OWN_PLANT" };
      }
      // User has the permission with OWN_PLANT scope but no plant assigned to
      // their account. Surface a clear, actionable error rather than the
      // generic "scope does not include this record" message.
      if (!profile.plantId) {
        return {
          allowed: false,
          reason:
            "Your account has no plant assigned. Ask an admin to assign you to a plant before creating or modifying records."
        };
      }
      // recordId provided but no plantId — let caller fall back; we can't
      // decide without record data
    }

    if (m.scope === "OWN_DEPARTMENT") {
      if (context.departmentId && profile.department && context.departmentId === profile.department) {
        return { allowed: true, matchedScope: "OWN_DEPARTMENT" };
      }
      if (!context.departmentId && !context.recordId) {
        return { allowed: true, matchedScope: "OWN_DEPARTMENT" };
      }
    }

    if (m.scope === "OWN_RECORDS") {
      // Owner-style fields we may find on a record
      if (context.record) {
        const ownerFields = [
          "originatorId", "ownerId", "reporterId", "observerId",
          "leaderId", "actionOwnerId", "responsiblePersonId",
          "issuerId", "receiverId", "inspectorId", "trainerId",
          "employeeId", "uploadedById", "createdById"
        ];
        const matched = ownerFields.some((f) => context.record?.[f] === userId);
        if (matched) return { allowed: true, matchedScope: "OWN_RECORDS" };
        // Crew membership shorthand for PTW / FLRA
        if (Array.isArray(context.record.workCrew) && context.record.workCrew.some((c: any) => c.userId === userId)) {
          return { allowed: true, matchedScope: "OWN_RECORDS" };
        }
        if (Array.isArray(context.record.crewSignatures) && context.record.crewSignatures.some((c: any) => c.userId === userId)) {
          return { allowed: true, matchedScope: "OWN_RECORDS" };
        }
        if (Array.isArray(context.record.teamMembers) && context.record.teamMembers.some((c: any) => c.userId === userId)) {
          return { allowed: true, matchedScope: "OWN_RECORDS" };
        }
      } else if (!context.recordId) {
        // CREATE-style — anyone who is allowed to create their own records
        return { allowed: true, matchedScope: "OWN_RECORDS" };
      }
    }
  }

  return { allowed: false, reason: `Permission '${permissionCode}' present but scope does not include this record` };
}

// Convenience helpers. Each composes can() with a specific module/action.
export async function canCreate(userId: string, module: string, plantId?: string | null) {
  return can(userId, `${module}.CREATE`, { module, plantId: plantId ?? null });
}
export async function canRead(userId: string, module: string, recordId: string, record?: any) {
  return can(userId, `${module}.READ`, { module, recordId, record });
}
export async function canUpdate(userId: string, module: string, recordId: string, record?: any) {
  return can(userId, `${module}.UPDATE`, { module, recordId, record });
}
export async function canApprove(userId: string, module: string, recordId: string, record?: any) {
  return can(userId, `${module}.APPROVE`, { module, recordId, record });
}
export async function canExecute(userId: string, module: string, recordId: string, record?: any) {
  return can(userId, `${module}.EXECUTE`, { module, recordId, record });
}
export async function canVerify(userId: string, module: string, recordId: string, record?: any) {
  return can(userId, `${module}.VERIFY`, { module, recordId, record });
}
export async function canClose(userId: string, module: string, recordId: string, record?: any) {
  return can(userId, `${module}.CLOSE`, { module, recordId, record });
}

// Batch permission check used by the UI to gate multiple buttons in one round-trip.
export async function getPermissions(userId: string): Promise<Record<string, boolean>> {
  const rows = await loadUserPermissions(userId);
  const map: Record<string, boolean> = {};
  for (const r of rows) map[r.permissionCode] = true;
  return map;
}

// Returns the distinct scopes a user holds for a single permission (empty
// array = the user does not hold the permission at all). Used by list
// endpoints that need to build a precise per-scope query filter rather than
// the coarse plant-only narrowing getAccessiblePlants() provides.
export async function getScopesFor(
  userId: string,
  permissionCode: string
): Promise<PermissionScope[]> {
  const rows = await loadUserPermissions(userId);
  return [
    ...new Set(
      rows.filter((r) => r.permissionCode === permissionCode).map((r) => r.scope)
    )
  ];
}

// Returns the set of plant IDs this user can act in. Used by list endpoints
// to scope queries server-side. ALL_PLANTS scope returns null (= unrestricted).
export async function getAccessiblePlants(userId: string): Promise<string[] | null> {
  const rows = await loadUserPermissions(userId);
  if (rows.some((r) => r.scope === "ALL_PLANTS")) return null;
  const profile = await loadUserProfile(userId);
  if (!profile) return [];
  // OWN_PLANT or OWN_DEPARTMENT roles narrow to user's plant
  if (rows.some((r) => r.scope === "OWN_PLANT" || r.scope === "OWN_DEPARTMENT")) {
    return profile.plantId ? [profile.plantId] : [];
  }
  // OWN_RECORDS-only users can technically be at any plant — list endpoints
  // should layer an OR-clause on owner fields rather than relying on plant.
  return profile.plantId ? [profile.plantId] : [];
}

// Returns the user's role codes — used by workflow engine to validate that
// a step's required role is held by the actor.
export async function getUserRoleCodes(userId: string): Promise<string[]> {
  const userRoles = await prisma.userRole.findMany({
    where: {
      userId,
      OR: [{ validTo: null }, { validTo: { gt: new Date() } }]
    },
    include: { role: { select: { code: true, isActive: true } } }
  });
  return userRoles.filter((ur) => ur.role.isActive).map((ur) => ur.role.code);
}

// True if the user holds the given role code (any scope).
export async function hasRole(userId: string, roleCode: string): Promise<boolean> {
  const codes = await getUserRoleCodes(userId);
  return codes.includes(roleCode);
}
