// One-off DDL applier for HIRA ALARP tolerability banding.
//
// Adds:
//   RiskMatrix.alarpBands (JSONB)              — level→ALARP-region map
//   HiraEntry.initialAlarpRegion / residualAlarpRegion
//   HiraEntry ALARP demonstration columns (status + cost-benefit test + sign-off)
//   HiraEntry.residualAutoCalculated           — auto-residual-from-controls mode
//   HiraEntry.target*                          — forecast residual + ALARP region
//
// Then backfills existing rows: default band map onto matrices, and derives
// the ALARP region for every existing entry from its stored risk level using
// the default mapping (CRITICAL→UNACCEPTABLE, HIGH/MODERATE→TOLERABLE,
// LOW→BROADLY_ACCEPTABLE). Prior residualAcceptable decisions are left intact;
// they recompute coherently on the next edit.
//
// Additive + idempotent (every statement tolerates "already exists"). Applied
// through the Prisma client's connection because `prisma db execute` /
// `migrate diff` hang against the pooler here, and `prisma db push` would drop
// drifted hand-DDL tables.
//   npx tsx prisma/apply-alarp-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_BANDS = `'{"LOW":"BROADLY_ACCEPTABLE","MODERATE":"TOLERABLE","HIGH":"TOLERABLE","CRITICAL":"UNACCEPTABLE"}'::jsonb`;

// CASE expression mapping a risk-level column to its default ALARP region.
const regionCase = (levelCol: string) => `CASE "${levelCol}"
    WHEN 'CRITICAL' THEN 'UNACCEPTABLE'
    WHEN 'HIGH'     THEN 'TOLERABLE'
    WHEN 'MODERATE' THEN 'TOLERABLE'
    WHEN 'LOW'      THEN 'BROADLY_ACCEPTABLE'
    ELSE NULL END`;

const STATEMENTS: string[] = [
  // ── RiskMatrix.alarpBands ──
  `ALTER TABLE "RiskMatrix" ADD COLUMN IF NOT EXISTS "alarpBands" JSONB`,

  // ── HiraEntry ALARP columns ──
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "initialAlarpRegion" TEXT`,
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "residualAlarpRegion" TEXT`,
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "alarpStatus" TEXT`,
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "alarpFurtherControlsConsidered" BOOLEAN`,
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "alarpFurtherControlsDescription" TEXT`,
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "alarpRiskReductionBenefit" TEXT`,
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "alarpCostBand" TEXT`,
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "alarpGrosslyDisproportionate" BOOLEAN`,
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "alarpJustification" TEXT`,
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "alarpDemonstratedById" TEXT`,
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "alarpDemonstratedAt" TIMESTAMP(3)`,

  // ── residualAutoCalculated (auto-residual-from-controls mode) ──
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "residualAutoCalculated" BOOLEAN`,

  // ── Target (forecast) risk columns ──
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "targetLikelihoodId" TEXT`,
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "targetLikelihoodScore" INTEGER`,
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "targetSeverityId" TEXT`,
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "targetSeverityScore" INTEGER`,
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "targetRiskScore" INTEGER`,
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "targetRiskLevel" TEXT`,
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "targetRiskColor" TEXT`,
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "targetAlarpRegion" TEXT`,
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "targetRationale" TEXT`,

  // ── Unacceptable-risk override (ALARP governance) ──
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "unacceptableOverrideById" TEXT`,
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "unacceptableOverrideAt" TIMESTAMP(3)`,
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "unacceptableOverrideJustification" TEXT`,
  `ALTER TABLE "HiraEntry" ADD COLUMN IF NOT EXISTS "unacceptableOverrideExpiresAt" TIMESTAMP(3)`,

  // ── Indexes ──
  `CREATE INDEX IF NOT EXISTS "ix_HiraEntry_initialAlarpRegion" ON "HiraEntry"("initialAlarpRegion")`,
  `CREATE INDEX IF NOT EXISTS "ix_HiraEntry_residualAlarpRegion" ON "HiraEntry"("residualAlarpRegion")`,
  `CREATE INDEX IF NOT EXISTS "ix_HiraEntry_alarpStatus" ON "HiraEntry"("alarpStatus")`,
  `CREATE INDEX IF NOT EXISTS "ix_HiraEntry_targetAlarpRegion" ON "HiraEntry"("targetAlarpRegion")`,
  `CREATE INDEX IF NOT EXISTS "ix_HiraEntry_unaccept_override_expires" ON "HiraEntry"("unacceptableOverrideExpiresAt")`,

  // ── Backfill: default band map onto existing matrices ──
  `UPDATE "RiskMatrix" SET "alarpBands" = ${DEFAULT_BANDS} WHERE "alarpBands" IS NULL`,

  // ── Backfill: derive regions from stored risk levels ──
  `UPDATE "HiraEntry" SET "initialAlarpRegion" = ${regionCase("initialRiskLevel")}
     WHERE "initialAlarpRegion" IS NULL AND "initialRiskLevel" IS NOT NULL`,
  `UPDATE "HiraEntry" SET "residualAlarpRegion" = ${regionCase("residualRiskLevel")}
     WHERE "residualAlarpRegion" IS NULL AND "residualRiskLevel" IS NOT NULL`,

  // ── Backfill: ALARP status for entries that already have a residual ──
  // BROADLY_ACCEPTABLE/UNACCEPTABLE → NOT_REQUIRED; TOLERABLE → REQUIRED
  // (they must complete the cost-benefit demonstration on next edit).
  `UPDATE "HiraEntry" SET "alarpStatus" = CASE "residualAlarpRegion"
       WHEN 'TOLERABLE' THEN 'REQUIRED'
       ELSE 'NOT_REQUIRED' END
     WHERE "alarpStatus" IS NULL AND "residualAlarpRegion" IS NOT NULL`,
];

async function main() {
  console.log("Applying HIRA ALARP banding DDL…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 72);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }

  const matrices = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT count(*)::bigint AS c FROM "RiskMatrix" WHERE "alarpBands" IS NOT NULL`
  );
  const banded = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT count(*)::bigint AS c FROM "HiraEntry" WHERE "residualAlarpRegion" IS NOT NULL`
  );
  console.log(
    `✅  ALARP ready: matrices with bands=${matrices[0].c}, entries with residual region=${banded[0].c}`
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
