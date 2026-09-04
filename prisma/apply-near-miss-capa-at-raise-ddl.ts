// DDL for defining CAPAs when the near miss is raised, and for the record's
// own closure SLA.
//
// NearMissCapa.ownerId and .targetDate both become nullable. The workflow used to define CAPAs at
// step 3 ("Review Meeting & CAPA Definition"), where the reviewer knew both
// what needed doing AND who would do it, so an owner was mandatory from the
// first insert. That step is gone: the reporter now writes the CAPA on the
// report form, and the Safety Officer names its owner at step 2. Between
// those two moments a CAPA legitimately has neither an owner nor a date —
// the reporter says what should be done; the Safety Officer says who does it
// and by when.
//
// The fan-out at CAPA Execution already skips owner-less rows
// (workflow_engine.CAPA_FAN_OUT), and the Safety Officer Review step is gated
// so it cannot be completed while any CAPA is still missing an owner or a
// date — so neither null can leak past step 2.
//
// NearMiss.slaHours records the closure SLA the reporter picked. It used to be
// derived from severity alone and never stored, which meant a record's clock
// silently changed if anyone edited its severity afterwards. Storing the
// chosen value fixes the clock at raise time; severity still supplies the
// default.
//
// Additive and idempotent. Applied through the Prisma client's connection,
// matching the other apply-*-ddl scripts: `prisma db execute` / `migrate diff`
// hang against the pooler in this environment, and `prisma db push` would drop
// the drifted hand-DDL tables.
//
//   npx tsx prisma/apply-near-miss-capa-at-raise-ddl.ts
//
// BACKFILL: slaHours is filled from slaTargetAt - createdAt for the records
// that already have a target, so an existing near miss keeps the clock it was
// given rather than acquiring a new one. Every existing CAPA already has an
// owner; nothing about them changes.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  `ALTER TABLE "NearMissCapa" ALTER COLUMN "ownerId" DROP NOT NULL`,
  `ALTER TABLE "NearMissCapa" ALTER COLUMN "targetDate" DROP NOT NULL`,
  `ALTER TABLE "NearMiss" ADD COLUMN IF NOT EXISTS "slaHours" INTEGER`,

  `UPDATE "NearMiss"
      SET "slaHours" = GREATEST(1, ROUND(EXTRACT(EPOCH FROM ("slaTargetAt" - "createdAt")) / 3600)::int)
    WHERE "slaHours" IS NULL AND "slaTargetAt" IS NOT NULL AND "createdAt" IS NOT NULL`
];

async function main() {
  console.log("Applying near-miss CAPA-at-raise DDL…");
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${sql.trim().split("\n")[0].slice(0, 76)}`);
  }

  const [row] = await prisma.$queryRawUnsafe<
    { total: bigint; withSla: bigint; capas: bigint; ownerless: bigint }[]
  >(
    `SELECT (SELECT count(*)             FROM "NearMiss")::bigint     AS total,
            (SELECT count("slaHours")    FROM "NearMiss")::bigint     AS "withSla",
            (SELECT count(*)             FROM "NearMissCapa")::bigint AS capas,
            (SELECT count(*) FROM "NearMissCapa" WHERE "ownerId" IS NULL)::bigint AS ownerless`
  );
  console.log(
    `✅  Ready — ${row.withSla}/${row.total} near misses carry an SLA, ` +
      `${row.capas} CAPAs (${row.ownerless} awaiting an owner).`
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
