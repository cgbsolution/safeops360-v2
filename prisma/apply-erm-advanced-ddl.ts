// One-off DDL applier for the ERM ADVANCED (CRO-grade) extension — adds the
// quantitative-spine columns to EnterpriseRisk / RiskAssessment / RiskLinkage:
//   • monetary exposure (₹ expected / worst loss) on the risk + per assessment
//   • target risk level (likelihood/impact/score/band/EL/date/rationale)
//   • control-derived residual + override variance + control-alert flag
//   • per-assessment likelihood% + best/expected/worst ₹ + time horizon
//   • RiskLinkage correlationStrength + impactFactor (correlated exposure)
//
// Mirrors prisma/apply-factory-ext-ddl.ts: additive, idempotent (every statement
// tolerates "already exists"), applied through the Prisma client connection
// because `prisma db push` would drop the drifted Cams*/Facilities tables.
//   npx tsx prisma/apply-erm-advanced-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  // ── EnterpriseRisk: monetary exposure ──
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "inherentExpectedLossInr" DOUBLE PRECISION`,
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "inherentWorstLossInr" DOUBLE PRECISION`,
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "residualExpectedLossInr" DOUBLE PRECISION`,
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "residualWorstLossInr" DOUBLE PRECISION`,
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "targetExpectedLossInr" DOUBLE PRECISION`,
  // ── EnterpriseRisk: target risk level ──
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "targetLikelihood" INTEGER`,
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "targetImpact" INTEGER`,
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "targetScore" INTEGER`,
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "targetBand" TEXT`,
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "targetDate" TIMESTAMP(3)`,
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "targetRationale" TEXT`,
  // ── EnterpriseRisk: control-derived residual ──
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "controlEffectivenessPct" DOUBLE PRECISION`,
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "derivedResidualScore" INTEGER`,
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "derivedResidualBand" TEXT`,
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "residualIsOverride" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "residualOverrideVariance" INTEGER`,
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "controlAlert" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "controlAlertAt" TIMESTAMP(3)`,
  // ── EnterpriseRisk: bow-tie + three-lines-of-defence + KRI alert ──
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "bowtie" JSONB`,
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "firstLineOwnerId" TEXT`,
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "secondLineOwnerId" TEXT`,
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "thirdLineAssurance" TEXT`,
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "kriAlert" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "kriAlertAt" TIMESTAMP(3)`,
  // ── KriDefinition: leading/lagging indicator type ──
  `ALTER TABLE "KriDefinition" ADD COLUMN IF NOT EXISTS "indicatorType" TEXT NOT NULL DEFAULT 'LAGGING'`,

  // ── RiskAssessment: quantification ──
  `ALTER TABLE "RiskAssessment" ADD COLUMN IF NOT EXISTS "likelihoodPct" DOUBLE PRECISION`,
  `ALTER TABLE "RiskAssessment" ADD COLUMN IF NOT EXISTS "financialBestInr" DOUBLE PRECISION`,
  `ALTER TABLE "RiskAssessment" ADD COLUMN IF NOT EXISTS "financialExpectedInr" DOUBLE PRECISION`,
  `ALTER TABLE "RiskAssessment" ADD COLUMN IF NOT EXISTS "financialWorstInr" DOUBLE PRECISION`,
  `ALTER TABLE "RiskAssessment" ADD COLUMN IF NOT EXISTS "expectedLossInr" DOUBLE PRECISION`,
  `ALTER TABLE "RiskAssessment" ADD COLUMN IF NOT EXISTS "unexpectedLossInr" DOUBLE PRECISION`,
  `ALTER TABLE "RiskAssessment" ADD COLUMN IF NOT EXISTS "timeHorizon" TEXT`,
  `ALTER TABLE "RiskAssessment" ADD COLUMN IF NOT EXISTS "derivedFromControls" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "RiskAssessment" ADD COLUMN IF NOT EXISTS "controlEffectivenessPct" DOUBLE PRECISION`,

  // ── RiskLinkage: correlation modelling ──
  `ALTER TABLE "RiskLinkage" ADD COLUMN IF NOT EXISTS "correlationStrength" DOUBLE PRECISION NOT NULL DEFAULT 0.5`,
  `ALTER TABLE "RiskLinkage" ADD COLUMN IF NOT EXISTS "impactFactor" DOUBLE PRECISION NOT NULL DEFAULT 0.0`,
];

async function main() {
  console.log("Applying ERM ADVANCED DDL (monetary + target + control-derived residual + correlation)…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 70);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }
  const er = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "EnterpriseRisk"`);
  const ra = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "RiskAssessment"`);
  console.log(`✅  ERM advanced columns ready. EnterpriseRisk rows=${er[0].c}, RiskAssessment rows=${ra[0].c}`);
}

main()
  .catch((e) => {
    console.error("❌  DDL apply failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
