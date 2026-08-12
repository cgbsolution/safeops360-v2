/**
 * Patch: grant DEPARTMENT_HEAD `CAMS.READ` (OWN_PLANT).
 *
 * Why this role: CAMS has no auditee role code, by design — the audited party
 * is an area owner who also answers findings, so the taxonomy note in
 * seed-rbac.ts says they "inherit an existing area-owner role + CAMS.READ".
 * DEPARTMENT_HEAD already carries the answering half (AUDIT_COMPLIANCE
 * READ + UPDATE at OWN_RECORDS, which a routed checkpoint satisfies via
 * `record={"routedToUserId": user.id}`). The CAMS.READ half was never granted,
 * so an auditee could respond to a finding through the API but could not open
 * the screen that shows it.
 *
 * Applied as a patch rather than by re-running seed-rbac.ts, because that seed
 * deletes and rebuilds EVERY UserRole row — not something to do to a live
 * system for one missing grant.
 *
 * Idempotent: createMany with skipDuplicates.
 *
 *   npx tsx prisma/patch-auditee-cams-read.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROLE_CODE = "DEPARTMENT_HEAD";
const PERMISSION_CODE = "CAMS.READ";
const SCOPE = "OWN_PLANT";

async function main() {
  const role = await prisma.role.findFirst({ where: { code: ROLE_CODE } });
  if (!role) throw new Error(`${ROLE_CODE} role not found — run seed-rbac.ts first`);

  const perm = await prisma.permission.findFirst({ where: { code: PERMISSION_CODE } });
  if (!perm) throw new Error(`${PERMISSION_CODE} permission not found — run seed-rbac.ts first`);

  const existing = await prisma.rolePermission.findFirst({
    where: { roleId: role.id, permissionId: perm.id },
  });
  if (existing) {
    console.log(`✅  ${ROLE_CODE} already has ${PERMISSION_CODE} (scope ${existing.scope}).`);
    return;
  }

  await prisma.rolePermission.createMany({
    data: [{ roleId: role.id, permissionId: perm.id, scope: SCOPE }],
    skipDuplicates: true,
  });
  console.log(`✅  Granted ${PERMISSION_CODE} (${SCOPE}) to ${ROLE_CODE}.`);

  const holders = await prisma.userRole.count({ where: { roleId: role.id } });
  console.log(`   ${holders} user-role assignment(s) hold ${ROLE_CODE} and gain it.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
