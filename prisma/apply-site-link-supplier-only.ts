// Targeted, idempotent re-grant of FACILITY.SITE_LINK after it was narrowed to
// the supplier case only.
//
// SITE_LINK used to mean "provision a Site for an in-house factory" and was
// handed to every operational creator. It now means "attach a factory to a Site
// that already exists" — the supplier onboarding act — and gates the Site picker
// on Add Factory in the UI and on POST /api/factory/profiles in the backend.
// So it is revoked from the operational roles and granted to the lead auditor.
//
// Surgical: touches ONLY the RolePermission rows for this one permission.
// Deliberately not `db:seed-rbac`, which does rolePermission.deleteMany({}) AND
// userRole.deleteMany({}) — that would wipe every user's role assignment and
// re-derive it, which is not something to do to a live database to move one
// grant.
//
//   npx tsx prisma/apply-site-link-supplier-only.ts
//
// Keep in step with the matrix in seed-rbac.ts, so a future full reseed lands on
// the same answer this script does.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CODE = "FACILITY.SITE_LINK";
const DESCRIPTION =
  "Link a factory to an existing Site (the 1:1 supplier mapping) and configure profile review settings";

// Roles that keep (or gain) the grant. ADMIN / SYSTEM_ADMIN hold every
// permission by convention and are left alone.
const GRANT: { roleCode: string; scope: string }[] = [
  { roleCode: "LEAD_AUDITOR", scope: "ALL_PLANTS" },
  { roleCode: "ADMIN", scope: "ALL_PLANTS" },
  { roleCode: "SYSTEM_ADMIN", scope: "ALL_PLANTS" }
];

// Roles that must LOSE it — they create Page-owned factories, which now needs
// only FACILITY.CREATE because the Site is provisioned automatically.
const REVOKE = ["HSE_MANAGER", "PLANT_HEAD", "FACILITIES_MANAGER"];

// The lead auditor could not previously reach Add Factory at all: the page is
// guarded on FACILITY.CREATE, which the role did not hold. Granting SITE_LINK
// without this would hide the picker from everyone, permanently.
const ALSO_GRANT_CREATE = { roleCode: "LEAD_AUDITOR", code: "FACILITY.CREATE", scope: "ALL_PLANTS" };

async function roleId(code: string): Promise<string | null> {
  const r = await prisma.role.findUnique({ where: { code } });
  if (!r) console.log(`  – role ${code} not found, skipped`);
  return r?.id ?? null;
}

async function main() {
  const perm = await prisma.permission.upsert({
    where: { code: CODE },
    create: { code: CODE, module: "FACILITY", action: "SITE_LINK", description: DESCRIPTION },
    update: { description: DESCRIPTION }
  });
  console.log(`✓ permission ${CODE} (${perm.id})`);

  for (const g of GRANT) {
    const id = await roleId(g.roleCode);
    if (!id) continue;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: id, permissionId: perm.id } },
      create: { roleId: id, permissionId: perm.id, scope: g.scope },
      update: { scope: g.scope }
    });
    console.log(`  ✓ ${g.roleCode} → ${CODE} (${g.scope})`);
  }

  for (const code of REVOKE) {
    const id = await roleId(code);
    if (!id) continue;
    const { count } = await prisma.rolePermission.deleteMany({
      where: { roleId: id, permissionId: perm.id }
    });
    console.log(`  ✗ ${code} → ${CODE} revoked (${count} row${count === 1 ? "" : "s"})`);
  }

  const createPerm = await prisma.permission.findUnique({ where: { code: ALSO_GRANT_CREATE.code } });
  const laId = await roleId(ALSO_GRANT_CREATE.roleCode);
  if (createPerm && laId) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: laId, permissionId: createPerm.id } },
      create: { roleId: laId, permissionId: createPerm.id, scope: ALSO_GRANT_CREATE.scope },
      update: {}
    });
    console.log(`  ✓ ${ALSO_GRANT_CREATE.roleCode} → ${ALSO_GRANT_CREATE.code} (${ALSO_GRANT_CREATE.scope})`);
  }

  const holders = await prisma.rolePermission.findMany({
    where: { permission: { code: CODE } },
    include: { role: true }
  });
  console.log(`✅  ${CODE} held by: ${holders.map((h) => h.role.code).sort().join(", ")}`);
  console.log("   Permission caches expire within 30s (server) / 5min (browser) — hard-refresh to see it.");
}

main()
  .catch((e) => {
    console.error("❌  re-grant failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
