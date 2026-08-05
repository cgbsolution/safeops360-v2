// DDL for the Safety Observation severity suggestion engine:
//   SeverityMatrixRule   — (axis, category, sub-category) → base severity
//   AreaHazardTier       — per-area modifier on that base
//   SeverityOverrideLog  — append-only record of observer disagreement
//
//   npx tsx prisma/apply-observation-severity-ddl.ts
//   (npm run db:apply-observation-severity)
//
// Additive and idempotent. NEVER `prisma db push` — this schema carries
// hand-DDL tables that push would drop.
//
// Run BEFORE restarting uvicorn: app/models/observation_severity.py maps these
// tables, and a mapped table that doesn't exist 500s the queries that touch it.
// Nothing here alters an existing table, so the pre-restart backend is unaffected.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  // ── SeverityMatrixRule ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "SeverityMatrixRule" (
    "id" TEXT NOT NULL,
    "observationType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subCategory" TEXT NOT NULL,
    "baseSeverity" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    CONSTRAINT "SeverityMatrixRule_pkey" PRIMARY KEY ("id")
  )`,
  // Unique among ACTIVE rows only, per spec §1.1. Partial so a retired rule and
  // its replacement can coexist — a SeverityOverrideLog row points at
  // matrixRuleId and must still resolve after the rule is superseded.
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_SeverityMatrixRule_active_triple"
     ON "SeverityMatrixRule"("observationType", "category", "subCategory")
     WHERE "isActive" = true`,
  `CREATE INDEX IF NOT EXISTS "ix_SeverityMatrixRule_lookup"
     ON "SeverityMatrixRule"("observationType", "category", "subCategory", "isActive")`,
  `DO $$ BEGIN
     ALTER TABLE "SeverityMatrixRule"
       ADD CONSTRAINT "ck_SeverityMatrixRule_baseSeverity"
       CHECK ("baseSeverity" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  // The axis, matching ObservationTaxonomy."observationType" — NOT the
  // four-value ObservationType. See app/models/observation_severity.py.
  `DO $$ BEGIN
     ALTER TABLE "SeverityMatrixRule"
       ADD CONSTRAINT "ck_SeverityMatrixRule_axis"
       CHECK ("observationType" IN ('ACT', 'CONDITION'));
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  // ── AreaHazardTier ────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "AreaHazardTier" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "areaId" TEXT,
    "hazardTier" TEXT NOT NULL,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    CONSTRAINT "AreaHazardTier_pkey" PRIMARY KEY ("id")
  )`,
  `DO $$ BEGIN
     ALTER TABLE "AreaHazardTier"
       ADD CONSTRAINT "AreaHazardTier_plantId_fkey"
       FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
     ALTER TABLE "AreaHazardTier"
       ADD CONSTRAINT "AreaHazardTier_areaId_fkey"
       FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  // TWO partial uniques, not one composite. Postgres treats NULLs as distinct
  // in a unique index, so a plain UNIQUE(plantId, areaId) would happily accept
  // several plant-wide defaults for the same plant — and the resolver would
  // then pick whichever row the planner returned first.
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_AreaHazardTier_area"
     ON "AreaHazardTier"("plantId", "areaId") WHERE "areaId" IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_AreaHazardTier_plant_default"
     ON "AreaHazardTier"("plantId") WHERE "areaId" IS NULL`,
  `CREATE INDEX IF NOT EXISTS "ix_AreaHazardTier_lookup"
     ON "AreaHazardTier"("plantId", "isActive")`,
  `DO $$ BEGIN
     ALTER TABLE "AreaHazardTier"
       ADD CONSTRAINT "ck_AreaHazardTier_tier"
       CHECK ("hazardTier" IN ('Standard', 'Elevated', 'HighHazard'));
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  // ── SeverityOverrideLog ───────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "SeverityOverrideLog" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "suggestedSeverity" TEXT NOT NULL,
    "finalSeverity" TEXT NOT NULL,
    "overrideReason" TEXT,
    "observationType" TEXT,
    "categoryCode" TEXT,
    "subCategoryCode" TEXT,
    "baseSeverity" TEXT,
    "hazardTier" TEXT,
    "matrixRuleId" TEXT,
    "plantId" TEXT,
    "areaId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'OBSERVER_FORM',
    "overriddenById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeverityOverrideLog_pkey" PRIMARY KEY ("id")
  )`,
  `DO $$ BEGIN
     ALTER TABLE "SeverityOverrideLog"
       ADD CONSTRAINT "SeverityOverrideLog_observationId_fkey"
       FOREIGN KEY ("observationId") REFERENCES "Observation"("id") ON DELETE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
     ALTER TABLE "SeverityOverrideLog"
       ADD CONSTRAINT "SeverityOverrideLog_overriddenById_fkey"
       FOREIGN KEY ("overriddenById") REFERENCES "User"("id");
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE INDEX IF NOT EXISTS "ix_SeverityOverrideLog_observation"
     ON "SeverityOverrideLog"("observationId")`,
  // The calibration report's own access path: source + window, grouped by pair.
  `CREATE INDEX IF NOT EXISTS "ix_SeverityOverrideLog_calibration"
     ON "SeverityOverrideLog"("source", "createdAt", "observationType", "categoryCode", "subCategoryCode")`,
  `CREATE INDEX IF NOT EXISTS "ix_SeverityOverrideLog_plant"
     ON "SeverityOverrideLog"("plantId", "createdAt")`,
  `DO $$ BEGIN
     ALTER TABLE "SeverityOverrideLog"
       ADD CONSTRAINT "ck_SeverityOverrideLog_severities"
       CHECK ("suggestedSeverity" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
          AND "finalSeverity" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  // Agreement is never logged, so a row where the two match is a bug, not data.
  // The DB refuses to hold one rather than letting it skew every override rate.
  `DO $$ BEGIN
     ALTER TABLE "SeverityOverrideLog"
       ADD CONSTRAINT "ck_SeverityOverrideLog_is_an_override"
       CHECK ("suggestedSeverity" <> "finalSeverity");
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
     ALTER TABLE "SeverityOverrideLog"
       ADD CONSTRAINT "ck_SeverityOverrideLog_source"
       CHECK ("source" IN ('OBSERVER_FORM', 'CAPTURE_CONVERSION', 'EDIT'));
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

async function main() {
  console.log("Applying severity suggestion engine DDL…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 78);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }

  for (const table of ["SeverityMatrixRule", "AreaHazardTier", "SeverityOverrideLog"]) {
    const r = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
      `SELECT count(*)::bigint AS c FROM "${table}"`
    );
    console.log(`✅  ${table.padEnd(20)} ready (${r[0].c} row(s)).`);
  }
  console.log("\n    Next: npm run db:seed-severity-matrix");
  console.log("          npm run db:seed-area-hazard-tiers");
  console.log("    Then: restart uvicorn.");
}

main()
  .catch((e) => {
    console.error("❌  DDL apply failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
