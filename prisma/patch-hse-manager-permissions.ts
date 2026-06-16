/**
 * Patch: grant HSE_MANAGER every permission that exists in the system
 * EXCEPT the CONFIGURATION module (MASTERS, PERMISSIONS, ROLES, USERS, WORKFLOWS).
 *
 * The scope used for each newly-added grant mirrors the principle:
 *   - Modules that are inherently plant-scoped → OWN_PLANT
 *   - CREATE actions on modules where CREATE was already ALL_PLANTS → ALL_PLANTS
 *
 * Idempotent: uses createMany with skipDuplicates.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const hseRole = await prisma.role.findFirst({ where: { code: "HSE_MANAGER" } });
  if (!hseRole) throw new Error("HSE_MANAGER role not found");

  // Load all permissions except CONFIGURATION module
  const allPerms = await prisma.permission.findMany({
    where: { module: { not: "CONFIGURATION" } },
    select: { id: true, code: true, module: true, action: true },
  });

  // Load current HSE_MANAGER grants
  const existing = await prisma.rolePermission.findMany({
    where: { roleId: hseRole.id },
    select: { permissionId: true },
  });
  const existingIds = new Set(existing.map((e) => e.permissionId));

  // Modules where CREATE was granted ALL_PLANTS (keep consistent)
  const ALL_PLANTS_CREATE_MODULES = new Set([
    "OBSERVATION",
    "NEAR_MISS",
    "INCIDENT",
  ]);

  const toAdd = allPerms.filter((p) => !existingIds.has(p.id));
  if (toAdd.length === 0) {
    console.log("✅  No missing permissions — HSE_MANAGER already has everything.");
    return;
  }

  console.log(`Adding ${toAdd.length} missing permissions to HSE_MANAGER…`);

  const grants = toAdd.map((p) => {
    // Use ALL_PLANTS for CREATE on select modules; OWN_PLANT for everything else
    const scope =
      p.action === "CREATE" && ALL_PLANTS_CREATE_MODULES.has(p.module)
        ? "ALL_PLANTS"
        : "OWN_PLANT";
    return {
      roleId: hseRole.id,
      permissionId: p.id,
      scope: scope as "ALL_PLANTS" | "OWN_PLANT",
      conditions: undefined,
    };
  });

  const result = await prisma.rolePermission.createMany({
    data: grants,
    skipDuplicates: true,
  });

  console.log(`✅  Added ${result.count} permission grants to HSE_MANAGER.`);

  // Print summary by module
  const byMod: Record<string, string[]> = {};
  for (const p of toAdd) {
    if (!byMod[p.module]) byMod[p.module] = [];
    byMod[p.module].push(p.action);
  }
  for (const [mod, actions] of Object.entries(byMod).sort()) {
    console.log(`   ${mod}: ${actions.join(", ")}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
