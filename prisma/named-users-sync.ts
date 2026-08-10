// Shared sync for the named all-plant accounts listed in
// demo-users-config.ts → NAMED_ALL_PLANT_USERS.
//
// Two callers, one implementation:
//   - prisma/seed-named-users.ts — standalone runner (`npm run db:seed-named-users`)
//   - prisma/seed-rbac.ts        — calls it at the end, because seed-rbac wipes
//                                  and rebuilds the whole UserRole table. Without
//                                  that call a re-run would silently demote these
//                                  accounts to their home plant only: the back-fill
//                                  path there scopes non-matrix emails to
//                                  User.plantId, and the NW↔SW cross-plant block
//                                  matches on `.it.nw@` / `.it.sw@` emails.
//
// Idempotent: the user is upserted, and role rows use skipDuplicates against the
// UserRole @@unique([userId, roleId, scopeType, scopeValue]).

import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_PASSWORD, NAMED_ALL_PLANT_USERS } from "./demo-users-config";

export type NamedUserSyncResult = {
  email: string;
  roleCode: string;
  plantsGranted: number;
  created: boolean;
};

export async function syncNamedAllPlantUsers(
  prisma: PrismaClient,
  opts: { resetPassword?: boolean } = {}
): Promise<NamedUserSyncResult[]> {
  if (NAMED_ALL_PLANT_USERS.length === 0) return [];

  const plants = await prisma.plant.findMany({ select: { id: true, code: true } });
  if (plants.length === 0) {
    console.warn("   ⚠️  No plants found — named all-plant users skipped.");
    return [];
  }
  const plantIdByCode = new Map(plants.map((p) => [p.code, p.id]));

  const roleIdByCode = new Map(
    (await prisma.role.findMany({ select: { id: true, code: true } })).map((r) => [r.code, r.id])
  );

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const results: NamedUserSyncResult[] = [];

  for (const nu of NAMED_ALL_PLANT_USERS) {
    const homePlantId = plantIdByCode.get(nu.homePlantCode);
    if (!homePlantId) {
      console.warn(`   ⚠️  Home plant ${nu.homePlantCode} not found — skipping ${nu.email}.`);
      continue;
    }
    const roleId = roleIdByCode.get(nu.roleCode);
    if (!roleId) {
      console.warn(`   ⚠️  Role ${nu.roleCode} not found — skipping ${nu.email}. Run seed-rbac.ts first.`);
      continue;
    }

    const existing = await prisma.user.findUnique({ where: { email: nu.email }, select: { id: true } });

    // Password is only (re)written on create, or when explicitly asked for —
    // a re-seed must not reset a password the person has since changed.
    const user = await prisma.user.upsert({
      where: { email: nu.email },
      update: {
        name: nu.name,
        role: nu.roleCode,
        designation: nu.designation,
        department: nu.department,
        plantId: homePlantId,
        ...(opts.resetPassword ? { passwordHash } : {})
      },
      create: {
        email: nu.email,
        name: nu.name,
        passwordHash,
        role: nu.roleCode,
        designation: nu.designation,
        department: nu.department,
        plantId: homePlantId
      },
      select: { id: true }
    });

    // One PLANT-scoped role row per plant → getAccessiblePlantIds() returns the
    // whole group, so every OWN_PLANT grant on the role applies everywhere.
    await prisma.userRole.createMany({
      data: plants.map((p) => ({
        userId: user.id,
        roleId,
        scopeType: "PLANT",
        scopeValue: p.id
      })),
      skipDuplicates: true
    });

    results.push({
      email: nu.email,
      roleCode: nu.roleCode,
      plantsGranted: plants.length,
      created: !existing
    });
  }

  return results;
}
