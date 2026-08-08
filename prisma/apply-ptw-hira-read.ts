// Targeted, idempotent grant of HIRA.READ to the permit-facing roles.
//
// Why: the PTW form and the permit detail page both render the
// "HIRA — Relevant Entries" panel, which calls
// GET /api/hira/integrations/for-ptw. That endpoint is gated on HIRA.READ,
// but PERMIT_ISSUER and MAINTENANCE_HEAD had no HIRA grant at all — so the
// panel rendered a red "HTTP 403" on every permit for exactly the people who
// have to weigh those entries before approving.
//
// Read only. Authoring / approving the HIRA register stays with HSE.
//
// Surgical upsert (not the full seed-rbac.ts) so it is safe against prod
// without touching any other role/permission — matches the "never re-run the
// destructive seed" rule.
//   npx tsx prisma/apply-ptw-hira-read.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CODE = "HIRA.READ";
const GRANTS: { roleCode: string; scope: string }[] = [
  // Scopes mirror each role's existing PTW.READ scope.
  { roleCode: "PERMIT_ISSUER", scope: "OWN_PLANT" },
  { roleCode: "MAINTENANCE_HEAD", scope: "OWN_DEPARTMENT" }
];

async function main() {
  const perm = await prisma.permission.upsert({
    where: { code: CODE },
    create: {
      code: CODE,
      module: "HIRA",
      action: "READ",
      // Matches the generated description seed-rbac.ts uses for the
      // module × action grid, so a later full reseed is a no-op here.
      description: "READ on HIRA"
    },
    update: {}
  });
  console.log(`✓ permission ${CODE} (${perm.id})`);

  for (const g of GRANTS) {
    const role = await prisma.role.findUnique({ where: { code: g.roleCode } });
    if (!role) {
      console.log(`  – role ${g.roleCode} not found, skipped`);
      continue;
    }
    const existing = await prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } }
    });
    if (existing) {
      // Never narrow a scope somebody has already widened by hand.
      console.log(`  = ${g.roleCode} already has ${CODE} (${existing.scope}), left as-is`);
      continue;
    }
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: perm.id, scope: g.scope }
    });
    console.log(`  ✓ ${g.roleCode} → ${CODE} (${g.scope})`);
  }

  const holders = await prisma.rolePermission.findMany({
    where: { permission: { code: CODE } },
    include: { role: true }
  });
  console.log(`✅  ${CODE} held by: ${holders.map((h) => h.role.code).sort().join(", ")}`);
}

main()
  .catch((e) => {
    console.error("❌  grant failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
