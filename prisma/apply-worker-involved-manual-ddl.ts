// One-off DDL applier: manual (unlisted) worker entry on Safety Observations.
//
// Two changes, both to ObservationWorkerInvolved:
//
//   1. codeSnapshot — the employee / works / gate-pass number. It is the ONLY
//      handle a `MANUAL` row has for matching the person later, since such a
//      row carries neither userId nor contractorWorkerId.
//
//   2. ck_ObservationWorkerInvolved_party gains a third arm for `MANUAL`:
//      both ids null, and a non-blank nameSnapshot. The constraint stays a
//      closed set — a row that names nobody and links to nobody is still
//      impossible. Kept in sync with apply-observation-sla-ddl.ts, which
//      creates this same shape on a fresh database.
//
// Additive + idempotent (ADD COLUMN IF NOT EXISTS; the CHECK is dropped and
// re-added, which is safe because every existing row satisfies the new one —
// the two original arms are unchanged). Applied through the Prisma client
// because `prisma db push` would drop drifted hand-DDL tables. Run BEFORE
// restarting the backend: the new SQLAlchemy column makes every SELECT on this
// table 500 until it exists, and every manual entry 500 until the CHECK allows
// it.
//   npx tsx prisma/apply-worker-involved-manual-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  `ALTER TABLE "ObservationWorkerInvolved" ADD COLUMN IF NOT EXISTS "codeSnapshot" TEXT`,

  `ALTER TABLE "ObservationWorkerInvolved"
     DROP CONSTRAINT IF EXISTS "ck_ObservationWorkerInvolved_party"`,
  `ALTER TABLE "ObservationWorkerInvolved"
     ADD CONSTRAINT "ck_ObservationWorkerInvolved_party"
     CHECK (
       ("partyType" = 'USER' AND "userId" IS NOT NULL AND "contractorWorkerId" IS NULL)
       OR
       ("partyType" = 'CONTRACTOR_WORKER' AND "contractorWorkerId" IS NOT NULL AND "userId" IS NULL)
       OR
       ("partyType" = 'MANUAL' AND "userId" IS NULL AND "contractorWorkerId" IS NULL
        AND length(btrim("nameSnapshot")) > 0)
     )`,
];

async function main() {
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log("  ✓", sql.replace(/\s+/g, " ").slice(0, 74));
  }
  console.log("Manual worker-involved entry applied (codeSnapshot + MANUAL party arm).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
