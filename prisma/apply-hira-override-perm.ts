// Targeted, idempotent grant of the HIRA.OVERRIDE_UNACCEPTABLE permission.
//
// Adds the permission row and grants it to the elevated approver tier only
// (Plant Head + Corporate HSE + ADMIN/SYSTEM_ADMIN) — NOT HSE Manager, who can
// approve normally but must escalate an Unacceptable-risk override.
//
// Written as a surgical upsert (not the full seed-rbac.ts) so it is safe to run
// against prod without touching any other role/permission — matches the "never
// re-run the destructive seed" rule.
//   npx tsx prisma/apply-hira-override-perm.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CODE = "HIRA.OVERRIDE_UNACCEPTABLE";
const GRANTS: { roleCode: string; scope: string }[] = [
  { roleCode: "PLANT_HEAD", scope: "OWN_PLANT" },
  { roleCode: "CORPORATE_HSE", scope: "ALL_PLANTS" },
  { roleCode: "ADMIN", scope: "ALL_PLANTS" },
  { roleCode: "SYSTEM_ADMIN", scope: "ALL_PLANTS" }
];

async function main() {
  const perm = await prisma.permission.upsert({
    where: { code: CODE },
    create: {
      code: CODE,
      module: "HIRA",
      action: "OVERRIDE_UNACCEPTABLE",
      description:
        "Authorise approval of an Unacceptable (ALARP) residual risk via a time-bounded override — Plant Head / Corporate HSE tier"
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
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
      create: { roleId: role.id, permissionId: perm.id, scope: g.scope },
      update: { scope: g.scope }
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
