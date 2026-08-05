// One-off DDL applier: add structured contractor links to Observation and Permit
// (Raychem TRS §2.3.g — contractor↔UA/UC and contractor↔PTW traceability).
// Additive + idempotent (ADD COLUMN / CREATE INDEX / ADD CONSTRAINT IF NOT EXISTS).
// Applied through the Prisma client because `prisma db push` would drop drifted
// hand-DDL tables. Run BEFORE restarting the backend (else SELECTs on these
// tables 500 once the new SQLAlchemy columns are live).
//   npx tsx prisma/apply-contractor-links-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  // ── Observation.contractorCompanyId ──
  `ALTER TABLE "Observation" ADD COLUMN IF NOT EXISTS "contractorCompanyId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "Observation_contractorCompanyId_idx" ON "Observation" ("contractorCompanyId")`,
  // FK guarded: add only if absent (ADD CONSTRAINT has no IF NOT EXISTS).
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Observation_contractorCompanyId_fkey') THEN
       ALTER TABLE "Observation"
         ADD CONSTRAINT "Observation_contractorCompanyId_fkey"
         FOREIGN KEY ("contractorCompanyId") REFERENCES "ContractorCompany"("id")
         ON DELETE SET NULL ON UPDATE CASCADE;
     END IF;
   END $$;`,

  // ── Permit.contractorCompanyId ──
  `ALTER TABLE "Permit" ADD COLUMN IF NOT EXISTS "contractorCompanyId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "Permit_contractorCompanyId_idx" ON "Permit" ("contractorCompanyId")`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Permit_contractorCompanyId_fkey') THEN
       ALTER TABLE "Permit"
         ADD CONSTRAINT "Permit_contractorCompanyId_fkey"
         FOREIGN KEY ("contractorCompanyId") REFERENCES "ContractorCompany"("id")
         ON DELETE SET NULL ON UPDATE CASCADE;
     END IF;
   END $$;`,
];

async function main() {
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log("  ✓", sql.replace(/\s+/g, " ").slice(0, 74));
  }
  console.log("Contractor links applied (Observation + Permit).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
