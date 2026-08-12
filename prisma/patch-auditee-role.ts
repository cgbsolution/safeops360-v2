/**
 * Patch: create the AUDITEE role and its permission grants.
 *
 * The audited party had no role of its own — it was borrowed, usually
 * DEPARTMENT_HEAD, because that role happened to carry the right audit grants.
 * That works until you need to seat someone who is an auditee and nothing else:
 * a borrowed department-head seat also hands them approval authority over
 * observations, near misses, permits, MOC and HIRA for a whole department, none
 * of which answering an audit finding requires.
 *
 * The grant set is the mirror of what the endpoints actually check:
 *
 *   CAMS.READ (OWN_PLANT)                    open the audit screens at all
 *   AUDIT_COMPLIANCE.READ   (OWN_RECORDS)    see audits they are seated on —
 *                                            `_reader_record()` flattens every
 *                                            party into `teamMembers`, so a
 *                                            seated auditee matches and nobody
 *                                            else's audit is visible
 *   AUDIT_COMPLIANCE.UPDATE (OWN_RECORDS)    AUDITEE_RESPOND, guarded by
 *                                            `record={"routedToUserId": user.id}`
 *   CAPA READ/UPDATE/EXECUTE (OWN_RECORDS)   work the actions they own
 *
 * Deliberately NOT AUDIT_COMPLIANCE.EXECUTE — accepting a response, raising a
 * CAPA from a finding and escalating are the auditor's side of the same
 * conversation, and an auditee holding it could accept their own answers.
 *
 * Applied as a patch rather than by re-running seed-rbac.ts, because that seed
 * deletes and rebuilds every UserRole row.
 *
 * Idempotent: upserts the role, skipDuplicates on the grants.
 *
 *   npx tsx prisma/patch-auditee-role.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROLE = {
  code: "AUDITEE",
  name: "Auditee",
  description:
    "The audited party — reads audits they are seated on, answers findings routed to them with evidence, and works the corrective actions they own. No auditor authority.",
  isSystem: false,
  sortOrder: 34,
  defaultLanding: "/cams/audits",
};

const GRANTS: { code: string; scope: string }[] = [
  { code: "CAMS.READ", scope: "OWN_PLANT" },
  { code: "AUDIT_COMPLIANCE.READ", scope: "OWN_RECORDS" },
  { code: "AUDIT_COMPLIANCE.UPDATE", scope: "OWN_RECORDS" },
  { code: "CAPA.READ", scope: "OWN_RECORDS" },
  { code: "CAPA.UPDATE", scope: "OWN_RECORDS" },
  { code: "CAPA.EXECUTE", scope: "OWN_RECORDS" },
];

async function main() {
  const existing = await prisma.role.findFirst({ where: { code: ROLE.code } });
  const role = existing
    ? await prisma.role.update({ where: { id: existing.id }, data: ROLE })
    : await prisma.role.create({ data: ROLE });
  console.log(`${existing ? "updated" : "created"} role ${ROLE.code} (${role.id})`);

  const perms = await prisma.permission.findMany({
    where: { code: { in: GRANTS.map((g) => g.code) } },
    select: { id: true, code: true },
  });
  const idByCode = new Map(perms.map((p) => [p.code, p.id]));

  const missing = GRANTS.filter((g) => !idByCode.has(g.code));
  if (missing.length) {
    throw new Error(
      `Permission(s) not found: ${missing.map((m) => m.code).join(", ")} — run seed-rbac.ts first`
    );
  }

  const res = await prisma.rolePermission.createMany({
    data: GRANTS.map((g) => ({
      roleId: role.id,
      permissionId: idByCode.get(g.code)!,
      scope: g.scope,
    })),
    skipDuplicates: true,
  });
  console.log(`✅  ${res.count} grant(s) added (${GRANTS.length} total on the role).`);
  for (const g of GRANTS) console.log(`   ${g.code.padEnd(26)} ${g.scope}`);
  console.log("\nNext: npx tsx prisma/seed-named-users.ts — moves the named auditees onto it.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
