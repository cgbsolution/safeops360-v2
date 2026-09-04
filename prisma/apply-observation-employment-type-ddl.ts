// One-off DDL applier: Observation.employmentType.
//
// The New Safety Observation form asks "Employed By: Company employee /
// Contractor" and nothing else — the Contractor Company dropdown was removed on
// request. That left the answer with nowhere to live: it had only ever been
// inferred from whether contractorCompanyId was null, so with no company picked
// "Contractor" was a radio button the observer selected and the system then
// forgot. This column stores the answer itself.
//
// COMPANY | CONTRACTOR. Nullable, because every observation filed before this
// column existed genuinely has no recorded answer, and defaulting those to
// COMPANY would invent data — a contractor's unsafe act would be back-labelled
// as an employee's.
//
// `contractorCompanyId` is KEPT: it still carries the specific company on the
// records that have one, and Near Miss / PTW still collect it.
//
// Additive + idempotent (ADD COLUMN IF NOT EXISTS). Applied through the Prisma
// client because `prisma db push` would drop drifted hand-DDL tables. Run BEFORE
// restarting the backend — the new SQLAlchemy column makes every SELECT on
// Observation 500 until it exists.
//   npx tsx prisma/apply-observation-employment-type-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  `ALTER TABLE "Observation" ADD COLUMN IF NOT EXISTS "employmentType" TEXT`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Observation_employmentType_check') THEN
       ALTER TABLE "Observation" ADD CONSTRAINT "Observation_employmentType_check"
         CHECK ("employmentType" IS NULL OR "employmentType" IN ('COMPANY', 'CONTRACTOR'));
     END IF;
   END $$;`,
];

async function main() {
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log("  ✓", sql.replace(/\s+/g, " ").slice(0, 74));
  }
  console.log("Observation.employmentType applied.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
