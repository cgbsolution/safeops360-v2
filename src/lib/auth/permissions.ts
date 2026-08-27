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

import { backendFetch } from "@/lib/backend/fetch";

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
type CacheEntry = { snapshot: AccessSnapshot; expiresAt: number };
const SNAPSHOT_CACHE = new Map<string, CacheEntry>();
// 30s. Deliberately shorter than the backend's own 5-minute snapshot cache:
// this layer only holds a copy, so it should expire first and re-read rather
// than out-live the source it mirrors.
const TTL_MS = 30_000;

function cacheKey(userId: string) {
  return `u:${userId}`;
}

export function invalidateUserPermissions(userId?: string) {
  if (userId) SNAPSHOT_CACHE.delete(cacheKey(userId));
  else SNAPSHOT_CACHE.clear();
}

// The caller's grants + profile, as FastAPI computes them. Both used to be
// rebuilt here from the UserRole → Role → RolePermission → Permission tables;
// they now arrive from /api/auth/access-snapshot, so the grant model is read
// from exactly one place and cannot drift between the two services.
type AccessSnapshot = {
  rows: CachedPermissionRow[];
  profile: UserProfileLite | null;
  roleCodes: string[];
};

type UserProfileLite = {
  id: string;
  plantId: string | null;
  department: string | null;
  /** Primary plant plus every PLANT-scoped role assignment, so a multi-plant
   *  user isn't flattened to their primary plant. */
  plantIds: string[];
};

const EMPTY_SNAPSHOT: AccessSnapshot = { rows: [], profile: null, roleCodes: [] };

async function loadSnapshot(userId: string): Promise<AccessSnapshot> {
  const cached = SNAPSHOT_CACHE.get(cacheKey(userId));
  if (cached && cached.expiresAt > Date.now()) return cached.snapshot;

  let snapshot: AccessSnapshot;
  try {
    const res = await backendFetch<{
      userId: string;
      grants: { permissionCode: string; scope: PermissionScope; roleId: string }[];
      roleCodes: string[];
      plantId: string | null;
      plantIds: string[];
      department: string | null;
    }>("/api/auth/access-snapshot", { userId });

    snapshot = {
      rows: res.grants.map((g) => ({
        permissionCode: g.permissionCode,
        scope: g.scope,
        conditions: null,
        roleId: g.roleId
      })),
      profile: {
        id: res.userId,
        plantId: res.plantId,
        department: res.department,
        plantIds: res.plantIds ?? []
      },
      roleCodes: res.roleCodes ?? []
    };
  } catch {
    // Fail CLOSED. A backend hiccup must deny, never silently grant — every
    // caller treats an empty grant list as "no permission".
    return EMPTY_SNAPSHOT;
  }

  // Don't cache empty results. If a user has no permissions right now (e.g.
  // mid-reseed, or their role was just deactivated), the next call should
  // re-check rather than locking them out for a full TTL window.
  if (snapshot.rows.length > 0) {
    SNAPSHOT_CACHE.set(cacheKey(userId), { snapshot, expiresAt: Date.now() + TTL_MS });
  }
  return snapshot;
}

async function loadUserPermissions(userId: string): Promise<CachedPermissionRow[]> {
  return (await loadSnapshot(userId)).rows;
}

async function loadUserProfile(userId: string): Promise<UserProfileLite | null> {
  return (await loadSnapshot(userId)).profile;
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
          // The incident investigation lead owns the record they were
          // appointed to investigate — see the Python mirror in
          // app/services/permissions.py for why this one matters.
          "investigationTeamLead",
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
  // Every non-ALL_PLANTS scope narrows to the user's plant set. Note this is
  // `plantIds`, not the single `plantId`: a user assigned to two plants through
  // PLANT-scoped roles (an HSE Manager covering NW and SW) must see both, and
  // collapsing to the primary plant used to hide the second one's records.
  // Matches get_accessible_plants() in app/services/permissions.py exactly.
  //
  // OWN_RECORDS-only users can technically be at any plant — list endpoints
  // should layer an OR-clause on owner fields rather than relying on plant.
  return profile.plantIds.length ? [...profile.plantIds] : profile.plantId ? [profile.plantId] : [];
}

// Returns the user's role codes — used by workflow engine to validate that
// a step's required role is held by the actor.
export async function getUserRoleCodes(userId: string): Promise<string[]> {
  // From the same snapshot as everything else — the backend already filters to
  // active roles inside their validity window, and includes roles that carry no
  // permissions (which the workflow engine's role-match check needs).
  return (await loadSnapshot(userId)).roleCodes;
}

// The plant/department facts scope checks compare against. Exposed so list
// filters can build their WHERE clause from the same snapshot `can()` uses,
// instead of re-reading the User row for themselves.
export async function getUserScopeProfile(userId: string): Promise<UserProfileLite | null> {
  return loadUserProfile(userId);
}

// True if the user holds the given role code (any scope).
export async function hasRole(userId: string, roleCode: string): Promise<boolean> {
  const codes = await getUserRoleCodes(userId);
  return codes.includes(roleCode);
}
