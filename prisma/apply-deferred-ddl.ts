// DDL applier for the deferred P2/P3 items — compliance unification link +
// BBS quality/ABC columns. Additive + idempotent.
//   npx tsx prisma/apply-deferred-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  // ── P2-8 compliance unification ──
  `ALTER TABLE "RegulatoryRegistration" ADD COLUMN IF NOT EXISTS "legalObligationId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "ix_RegReg_legalObligation" ON "RegulatoryRegistration" ("legalObligationId")`,

  // ── P3-1 BBS quality gate + ABC ──
  `ALTER TABLE "Observation" ADD COLUMN IF NOT EXISTS "qualityScore" INTEGER`,
  `ALTER TABLE "Observation" ADD COLUMN IF NOT EXISTS "antecedent" TEXT`,
  `ALTER TABLE "Observation" ADD COLUMN IF NOT EXISTS "behaviourObserved" TEXT`,
  `ALTER TABLE "Observation" ADD COLUMN IF NOT EXISTS "consequence" TEXT`,
  `ALTER TABLE "Observation" ADD COLUMN IF NOT EXISTS "capaId" TEXT`,
  `ALTER TABLE "Observation" ADD COLUMN IF NOT EXISTS "capaPromptDeclined" BOOLEAN`,
];

async function main() {
  console.log("Applying deferred-items DDL (compliance link + BBS quality)…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 60);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }
  console.log("✅  Deferred-items columns ready.");
}

main().catch((e) => { console.error("❌  DDL apply failed:", e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
