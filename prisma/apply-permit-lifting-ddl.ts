// One-off DDL applier: add the LIFTING value to the native Postgres "PermitType"
// enum so Lifting Operations permits (Raychem TRS §2.3.c) become insertable.
// Additive + idempotent (ADD VALUE IF NOT EXISTS). Applied through the Prisma
// client connection because `prisma db push` would drop drifted hand-DDL tables.
//   npx tsx prisma/apply-permit-lifting-ddl.ts
//
// NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block, so each
// statement is executed on its own (autocommit) via $executeRawUnsafe — do not
// wrap these in $transaction.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  `ALTER TYPE "PermitType" ADD VALUE IF NOT EXISTS 'LIFTING'`,
];

async function main() {
  for (const sql of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log("OK:", sql.slice(0, 70));
    } catch (e) {
      const msg = (e as Error).message || String(e);
      // Tolerate "already exists" so the script is safe to re-run.
      if (/already exists/i.test(msg)) {
        console.log("SKIP (exists):", sql.slice(0, 70));
      } else {
        throw e;
      }
    }
  }
  console.log("PermitType.LIFTING applied.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
