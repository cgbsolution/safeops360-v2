// DDL for NearMiss.departmentName — the department a near miss is reported
// against, held as text.
//
// The form's department dropdown now serves the site's own twenty-name list
// (src/lib/observation-masters.ts — the same list the Safety Observation form
// uses) instead of the plant-scoped Department master. That master is shared
// with Incidents, Permits, HIRA, EAI and Manhours and carries a different,
// generic set of thirteen names, so pointing the near-miss form at the site
// list means the value no longer resolves to a Department row. Observation
// already stores its department the same way and for the same reason.
//
// NearMiss.departmentId is left in place: it is the legacy path, still read by
// the detail view and the workflow routing payload.
//
// Additive and idempotent. Applied through the Prisma client's connection,
// matching the other apply-*-ddl scripts: `prisma db execute` / `migrate diff`
// hang against the pooler in this environment, and `prisma db push` would drop
// the drifted hand-DDL tables.
//
//   npx tsx prisma/apply-near-miss-department-name-ddl.ts
//
// BACKFILL POLICY: nothing to backfill — no NearMiss row carries a
// departmentId today, so there is no name to copy across.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  `ALTER TABLE "NearMiss" ADD COLUMN IF NOT EXISTS "departmentName" TEXT`
];

async function main() {
  console.log("Applying NearMiss.departmentName DDL…");
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${sql.trim().split("\n")[0].slice(0, 72)}`);
  }

  const [{ total, named }] = await prisma.$queryRawUnsafe<
    { total: bigint; named: bigint }[]
  >(
    `SELECT count(*)::bigint AS total,
            count("departmentName")::bigint AS named
       FROM "NearMiss"`
  );
  console.log(
    `✅  NearMiss.departmentName ready — ${total} near misses, ${named} carrying a department name.`
  );
}

main()
  .catch((e) => {
    console.error("❌  DDL apply failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
