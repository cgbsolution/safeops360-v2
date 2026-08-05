// One-off DDL applier for the Facilities tables (FactoryProfile + Building).
// Runs the additive DDL through the Prisma client's connection (the same path
// `prisma db push` uses successfully) because the `prisma db execute` /
// `migrate diff` subcommands hang against the pooler in this environment.
// Idempotent: every statement tolerates "already exists".
//   npx tsx prisma/apply-factory-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "FactoryProfile" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "factoryCode" TEXT NOT NULL,
    "factoryName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPERATIONAL',
    "ownershipType" TEXT NOT NULL DEFAULT 'OWNED',
    "addressLine" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "pincode" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "establishedYear" INTEGER,
    "factoryLicenseNo" TEXT,
    "factoryLicenseValidUntil" TIMESTAMP(3),
    "registrationNos" JSONB NOT NULL DEFAULT '[]',
    "applicableActs" JSONB NOT NULL DEFAULT '[]',
    "pollutionControlBoard" TEXT,
    "totalLandAreaSqm" DOUBLE PRECISION,
    "builtUpAreaSqm" DOUBLE PRECISION,
    "buildingCount" INTEGER NOT NULL DEFAULT 0,
    "totalEmployees" INTEGER NOT NULL DEFAULT 0,
    "primaryIndustry" TEXT NOT NULL DEFAULT 'Garments / Textile',
    "profileStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "FactoryProfile_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "FactoryProfile_siteId_key" ON "FactoryProfile" ("siteId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "FactoryProfile_factoryCode_key" ON "FactoryProfile" ("factoryCode")`,
  `CREATE INDEX IF NOT EXISTS "FactoryProfile_state_idx" ON "FactoryProfile" ("state")`,
  `CREATE INDEX IF NOT EXISTS "FactoryProfile_status_idx" ON "FactoryProfile" ("status")`,
  `CREATE INDEX IF NOT EXISTS "FactoryProfile_profileStatus_idx" ON "FactoryProfile" ("profileStatus")`,
  `CREATE TABLE IF NOT EXISTS "Building" (
    "id" TEXT NOT NULL,
    "factoryProfileId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "buildingName" TEXT NOT NULL,
    "buildingType" TEXT NOT NULL DEFAULT 'PRODUCTION',
    "floors" INTEGER NOT NULL DEFAULT 1,
    "areaSqm" DOUBLE PRECISION,
    "maxOccupancy" INTEGER,
    "currentOccupancy" INTEGER,
    "yearBuilt" INTEGER,
    "assemblyPoint" TEXT,
    "emergencyExits" INTEGER,
    "occupancyCertificateNo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "Building_factoryProfileId_idx" ON "Building" ("factoryProfileId")`,
  `CREATE INDEX IF NOT EXISTS "Building_siteId_idx" ON "Building" ("siteId")`,
  `CREATE INDEX IF NOT EXISTS "Building_buildingType_idx" ON "Building" ("buildingType")`,
  // ── Phase B — Workforce + Processes ──
  `CREATE TABLE IF NOT EXISTS "WorkforceComposition" (
    "id" TEXT NOT NULL,
    "factoryProfileId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "permanentCount" INTEGER NOT NULL DEFAULT 0,
    "contractCount" INTEGER NOT NULL DEFAULT 0,
    "apprenticeTraineeCount" INTEGER NOT NULL DEFAULT 0,
    "maleCount" INTEGER NOT NULL DEFAULT 0,
    "femaleCount" INTEGER NOT NULL DEFAULT 0,
    "otherGenderCount" INTEGER NOT NULL DEFAULT 0,
    "migrantWorkerCount" INTEGER,
    "differentlyAbledCount" INTEGER,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "WorkforceComposition_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "WorkforceComposition_profile_current_idx" ON "WorkforceComposition" ("factoryProfileId", "isCurrent")`,
  `CREATE INDEX IF NOT EXISTS "WorkforceComposition_siteId_idx" ON "WorkforceComposition" ("siteId")`,
  `CREATE TABLE IF NOT EXISTS "ProductionProcess" (
    "id" TEXT NOT NULL,
    "factoryProfileId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "processName" TEXT NOT NULL,
    "processCategory" TEXT,
    "description" TEXT,
    "sequenceOrder" INTEGER,
    "shiftPattern" TEXT,
    "installedCapacity" TEXT,
    "keyHazards" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ProductionProcess_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ProductionProcess_factoryProfileId_idx" ON "ProductionProcess" ("factoryProfileId")`,
  `CREATE INDEX IF NOT EXISTS "ProductionProcess_siteId_idx" ON "ProductionProcess" ("siteId")`,
  // ── Phase C — Certifications + Contacts ──
  `CREATE TABLE IF NOT EXISTS "FactoryCertification" (
    "id" TEXT NOT NULL,
    "factoryProfileId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "certificationType" TEXT NOT NULL,
    "certificateNo" TEXT,
    "issuingBody" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "renewalLeadDays" INTEGER NOT NULL DEFAULT 60,
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "scopeNotes" TEXT,
    "attachmentIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "FactoryCertification_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "FactoryCertification_factoryProfileId_idx" ON "FactoryCertification" ("factoryProfileId")`,
  `CREATE INDEX IF NOT EXISTS "FactoryCertification_siteId_idx" ON "FactoryCertification" ("siteId")`,
  `CREATE INDEX IF NOT EXISTS "FactoryCertification_type_idx" ON "FactoryCertification" ("certificationType")`,
  `CREATE TABLE IF NOT EXISTS "FactoryContact" (
    "id" TEXT NOT NULL,
    "factoryProfileId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OTHER',
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "FactoryContact_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "FactoryContact_factoryProfileId_idx" ON "FactoryContact" ("factoryProfileId")`,
  `CREATE INDEX IF NOT EXISTS "FactoryContact_siteId_idx" ON "FactoryContact" ("siteId")`,
  // ── Phase D — Compliance Snapshot ──
  `CREATE TABLE IF NOT EXISTS "FactoryComplianceSnapshot" (
    "id" TEXT NOT NULL,
    "factoryProfileId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL DEFAULT 'LIVE',
    "auditComplianceScorePct" DOUBLE PRECISION,
    "openFindings" INTEGER NOT NULL DEFAULT 0,
    "criticalFindings" INTEGER NOT NULL DEFAULT 0,
    "openCapas" INTEGER NOT NULL DEFAULT 0,
    "overdueCapas" INTEGER NOT NULL DEFAULT 0,
    "openObligations" INTEGER NOT NULL DEFAULT 0,
    "overdueObligations" INTEGER NOT NULL DEFAULT 0,
    "certsExpiringCount" INTEGER NOT NULL DEFAULT 0,
    "lastAuditDate" TIMESTAMP(3),
    "incidentCount12m" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "FactoryComplianceSnapshot_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "FactoryComplianceSnapshot_profile_period_key" ON "FactoryComplianceSnapshot" ("factoryProfileId", "periodLabel")`,
  `CREATE INDEX IF NOT EXISTS "FactoryComplianceSnapshot_siteId_idx" ON "FactoryComplianceSnapshot" ("siteId")`,
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FactoryComplianceSnapshot_factoryProfileId_fkey') THEN
       ALTER TABLE "FactoryComplianceSnapshot"
         ADD CONSTRAINT "FactoryComplianceSnapshot_factoryProfileId_fkey"
         FOREIGN KEY ("factoryProfileId") REFERENCES "FactoryProfile" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FactoryCertification_factoryProfileId_fkey') THEN
       ALTER TABLE "FactoryCertification"
         ADD CONSTRAINT "FactoryCertification_factoryProfileId_fkey"
         FOREIGN KEY ("factoryProfileId") REFERENCES "FactoryProfile" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FactoryContact_factoryProfileId_fkey') THEN
       ALTER TABLE "FactoryContact"
         ADD CONSTRAINT "FactoryContact_factoryProfileId_fkey"
         FOREIGN KEY ("factoryProfileId") REFERENCES "FactoryProfile" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkforceComposition_factoryProfileId_fkey') THEN
       ALTER TABLE "WorkforceComposition"
         ADD CONSTRAINT "WorkforceComposition_factoryProfileId_fkey"
         FOREIGN KEY ("factoryProfileId") REFERENCES "FactoryProfile" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductionProcess_factoryProfileId_fkey') THEN
       ALTER TABLE "ProductionProcess"
         ADD CONSTRAINT "ProductionProcess_factoryProfileId_fkey"
         FOREIGN KEY ("factoryProfileId") REFERENCES "FactoryProfile" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Building_factoryProfileId_fkey') THEN
       ALTER TABLE "Building"
         ADD CONSTRAINT "Building_factoryProfileId_fkey"
         FOREIGN KEY ("factoryProfileId") REFERENCES "FactoryProfile" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,
  // ── Phase F — Workforce SA8000 extension (child-labour evidence + derived %s) ──
  // Additive columns on the existing WorkforceComposition. The NOT NULL columns
  // carry a DEFAULT so the ALTER backfills existing rows cleanly.
  `ALTER TABLE "WorkforceComposition" ADD COLUMN IF NOT EXISTS "youngestWorkerAge" INTEGER`,
  `ALTER TABLE "WorkforceComposition" ADD COLUMN IF NOT EXISTS "workersUnder18Count" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "WorkforceComposition" ADD COLUMN IF NOT EXISTS "minHiringAgePolicy" INTEGER`,
  `ALTER TABLE "WorkforceComposition" ADD COLUMN IF NOT EXISTS "contractPct" DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE "WorkforceComposition" ADD COLUMN IF NOT EXISTS "femalePct" DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE "WorkforceComposition" ADD COLUMN IF NOT EXISTS "migrantPct" DOUBLE PRECISION`,
  // ── Phase F — Social-Compliance Profile (SA8000 policy/standing, 1:1 w/ factory) ──
  `CREATE TABLE IF NOT EXISTS "SocialComplianceProfile" (
    "id" TEXT NOT NULL,
    "factoryProfileId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "minimumWageCompliant" TEXT NOT NULL DEFAULT 'NOT_ASSESSED',
    "lowestMonthlyWageInr" INTEGER,
    "statutoryMinimumWageInr" INTEGER,
    "wagesPaidOnTime" TEXT NOT NULL DEFAULT 'NOT_ASSESSED',
    "standardWeeklyHours" INTEGER,
    "maxWeeklyOvertimeHours" INTEGER,
    "overtimeVoluntary" TEXT NOT NULL DEFAULT 'NOT_ASSESSED',
    "weeklyRestDayProvided" TEXT NOT NULL DEFAULT 'NOT_ASSESSED',
    "unionOrWorkerCommitteePresent" TEXT NOT NULL DEFAULT 'NOT_ASSESSED',
    "collectiveBargainingAgreement" BOOLEAN NOT NULL DEFAULT false,
    "noDepositOrDocumentRetention" TEXT NOT NULL DEFAULT 'NOT_ASSESSED',
    "grievanceMechanismPresent" TEXT NOT NULL DEFAULT 'NOT_ASSESSED',
    "antiDiscriminationPolicy" TEXT NOT NULL DEFAULT 'NOT_ASSESSED',
    "sa8000AwarenessTrainingPct" DOUBLE PRECISION,
    "socialComplianceOwnerId" TEXT,
    "lastSocialAuditDate" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "overallSocialComplianceFlag" TEXT NOT NULL DEFAULT 'NOT_ASSESSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SocialComplianceProfile_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "SocialComplianceProfile_factoryProfileId_key" ON "SocialComplianceProfile" ("factoryProfileId")`,
  `CREATE INDEX IF NOT EXISTS "SocialComplianceProfile_siteId_idx" ON "SocialComplianceProfile" ("siteId")`,
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SocialComplianceProfile_factoryProfileId_fkey') THEN
       ALTER TABLE "SocialComplianceProfile"
         ADD CONSTRAINT "SocialComplianceProfile_factoryProfileId_fkey"
         FOREIGN KEY ("factoryProfileId") REFERENCES "FactoryProfile" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,
  // ── FactoryEnvPeriod (ESG operational data source for the facility rollup) ──
  `CREATE TABLE IF NOT EXISTS "FactoryEnvPeriod" (
    "id" TEXT NOT NULL,
    "factoryProfileId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "energyKwh" DOUBLE PRECISION,
    "energyIntensity" DOUBLE PRECISION,
    "energyTargetKwh" DOUBLE PRECISION,
    "waterWithdrawnKl" DOUBLE PRECISION,
    "effluentDischargedKl" DOUBLE PRECISION,
    "etpStatus" TEXT,
    "consentStatus" TEXT,
    "wasteGeneratedT" DOUBLE PRECISION,
    "wasteDivertedPct" DOUBLE PRECISION,
    "wasteDivertedTargetPct" DOUBLE PRECISION,
    "scope1TCo2e" DOUBLE PRECISION,
    "scope2TCo2e" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "FactoryEnvPeriod_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "FactoryEnvPeriod_factoryProfileId_periodLabel_key" ON "FactoryEnvPeriod" ("factoryProfileId", "periodLabel")`,
  `CREATE INDEX IF NOT EXISTS "FactoryEnvPeriod_siteId_idx" ON "FactoryEnvPeriod" ("siteId")`,
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FactoryEnvPeriod_factoryProfileId_fkey') THEN
       ALTER TABLE "FactoryEnvPeriod"
         ADD CONSTRAINT "FactoryEnvPeriod_factoryProfileId_fkey"
         FOREIGN KEY ("factoryProfileId") REFERENCES "FactoryProfile" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,
];

async function main() {
  console.log("Applying Facilities DDL (FactoryProfile + Building + FactoryEnvPeriod)…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 60);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }
  const fp = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "FactoryProfile"`);
  const b = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "Building"`);
  const scp = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "SocialComplianceProfile"`);
  const env = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "FactoryEnvPeriod"`);
  console.log(`✅  Tables ready. FactoryProfile rows=${fp[0].c}, Building rows=${b[0].c}, SocialComplianceProfile rows=${scp[0].c}, FactoryEnvPeriod rows=${env[0].c}`);
}

main()
  .catch((e) => {
    console.error("❌  DDL apply failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
