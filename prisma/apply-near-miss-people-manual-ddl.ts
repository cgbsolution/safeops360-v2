// DDL for the Near Miss report form's manual people + equipment capture.
//
// The form no longer searches the employee directory for the people on a near
// miss. On the shop floor the reporter knows the name and the number on the
// helmet; making them find that person in a directory first was the step that
// got skipped, which is the same finding that moved Safety Observation to
// hand-typed entry (see components/observations/worker-involved-picker.tsx).
// So NearMissPersonInvolved and NearMissWitness gain the same shape
// ObservationWorkerInvolved already uses: a nullable link, a partyType, and a
// name/code snapshot that IS the record on a MANUAL row.
//
// What that costs, stated plainly: a MANUAL row links to no personnel record,
// so nothing downstream that keys on a User id — training assignment, roster
// checks — can fire from it. codeSnapshot is the handle for reconciling those
// names against the directory later.
//
// NearMiss.equipmentInvolved replaces the single equipmentId dropdown with the
// list the reporter types. Three states, all meaningful:
//   NULL  — not answered
//   []    — reporter answered "no equipment involved"
//   [...] — the named items
// equipmentId is left in place for the records that already carry one.
//
// The unique constraints stay as they are: Postgres treats NULLs as distinct,
// so (nearMissId, NULL) never collides and a near miss can name any number of
// manual people.
//
// Additive and idempotent. Applied through the Prisma client's connection,
// matching the other apply-*-ddl scripts: `prisma db execute` / `migrate diff`
// hang against the pooler in this environment, and `prisma db push` would drop
// the drifted hand-DDL tables.
//
//   npx tsx prisma/apply-near-miss-people-manual-ddl.ts
//
// BACKFILL: nameSnapshot is filled from the linked User for every existing
// row, so the detail view can read one field for linked and manual people
// alike instead of branching. partyType defaults to USER, which is what every
// existing row is.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  `ALTER TABLE "NearMissPersonInvolved" ALTER COLUMN "userId" DROP NOT NULL`,
  `ALTER TABLE "NearMissPersonInvolved" ADD COLUMN IF NOT EXISTS "partyType" TEXT NOT NULL DEFAULT 'USER'`,
  `ALTER TABLE "NearMissPersonInvolved" ADD COLUMN IF NOT EXISTS "nameSnapshot" TEXT`,
  `ALTER TABLE "NearMissPersonInvolved" ADD COLUMN IF NOT EXISTS "codeSnapshot" TEXT`,

  `ALTER TABLE "NearMissWitness" ALTER COLUMN "witnessId" DROP NOT NULL`,
  `ALTER TABLE "NearMissWitness" ADD COLUMN IF NOT EXISTS "partyType" TEXT NOT NULL DEFAULT 'USER'`,
  `ALTER TABLE "NearMissWitness" ADD COLUMN IF NOT EXISTS "nameSnapshot" TEXT`,
  `ALTER TABLE "NearMissWitness" ADD COLUMN IF NOT EXISTS "codeSnapshot" TEXT`,

  `ALTER TABLE "NearMiss" ADD COLUMN IF NOT EXISTS "equipmentInvolved" JSONB`,

  `UPDATE "NearMissPersonInvolved" p
      SET "nameSnapshot" = u."name"
     FROM "User" u
    WHERE u."id" = p."userId" AND p."nameSnapshot" IS NULL`,
  `UPDATE "NearMissWitness" w
      SET "nameSnapshot" = u."name"
     FROM "User" u
    WHERE u."id" = w."witnessId" AND w."nameSnapshot" IS NULL`
];

async function main() {
  console.log("Applying near-miss manual people + equipment DDL…");
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${sql.trim().split("\n")[0].slice(0, 76)}`);
  }

  const [row] = await prisma.$queryRawUnsafe<
    { involved: bigint; involvedNamed: bigint; witnesses: bigint; witnessesNamed: bigint }[]
  >(
    `SELECT (SELECT count(*)              FROM "NearMissPersonInvolved")::bigint AS involved,
            (SELECT count("nameSnapshot") FROM "NearMissPersonInvolved")::bigint AS "involvedNamed",
            (SELECT count(*)              FROM "NearMissWitness")::bigint        AS witnesses,
            (SELECT count("nameSnapshot") FROM "NearMissWitness")::bigint        AS "witnessesNamed"`
  );
  console.log(
    `✅  Ready — persons involved ${row.involvedNamed}/${row.involved} named, ` +
      `witnesses ${row.witnessesNamed}/${row.witnesses} named.`
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
