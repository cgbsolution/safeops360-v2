// One-off DDL applier for the Facilities EXTENSION tables (Equipment, Hazardous
// Materials, Regulatory Registrations, Lifecycle workflow) + the lifecycle
// columns on FactoryProfile. Mirrors prisma/apply-factory-ddl.ts: additive,
// idempotent (every statement tolerates "already exists"), applied through the
// Prisma client's connection because `prisma db execute` / `migrate diff` hang
// against the pooler in this environment, and `prisma db push` would drop the
// drifted Cams* / Facilities tables that were bootstrapped the same way.
//   npx tsx prisma/apply-factory-ext-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  // ── FactoryProfile lifecycle columns (additive) ──
  // NOT NULL column carries a DEFAULT so the ALTER backfills existing rows.
  `ALTER TABLE "FactoryProfile" ADD COLUMN IF NOT EXISTS "lifecycleStage" TEXT NOT NULL DEFAULT 'INITIATED'`,
  `ALTER TABLE "FactoryProfile" ADD COLUMN IF NOT EXISTS "lifecycleStageOwnerRole" TEXT`,
  `ALTER TABLE "FactoryProfile" ADD COLUMN IF NOT EXISTS "lifecycleUpdatedAt" TIMESTAMP(3)`,
  // Backfill: factories that are already data-complete (profileStatus ACTIVE)
  // start life in the ACTIVE lifecycle stage rather than INITIATED. Guarded on
  // lifecycleStage='INITIATED' so a re-run never clobbers a manual stage change.
  `UPDATE "FactoryProfile" SET "lifecycleStage" = 'ACTIVE'
     WHERE "lifecycleStage" = 'INITIATED' AND "profileStatus" = 'ACTIVE'`,

  // ── FactoryEquipment ──
  `CREATE TABLE IF NOT EXISTS "FactoryEquipment" (
    "id" TEXT NOT NULL,
    "factoryProfileId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "buildingId" TEXT,
    "equipmentName" TEXT NOT NULL,
    "assetCode" TEXT,
    "category" TEXT,
    "manufacturer" TEXT,
    "modelNumber" TEXT,
    "serialNumber" TEXT,
    "installationDate" TIMESTAMP(3),
    "warrantyExpiryDate" TIMESTAMP(3),
    "capacity" DOUBLE PRECISION,
    "capacityUnit" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "operatingHoursPerDay" DOUBLE PRECISION,
    "hazardLevel" TEXT NOT NULL DEFAULT 'LOW',
    "puwerRequired" BOOLEAN NOT NULL DEFAULT false,
    "puwerLastInspection" TIMESTAMP(3),
    "puwerNextDue" TIMESTAMP(3),
    "lolerRequired" BOOLEAN NOT NULL DEFAULT false,
    "lolerLastInspection" TIMESTAMP(3),
    "lolerNextDue" TIMESTAMP(3),
    "electricalSafetyRequired" BOOLEAN NOT NULL DEFAULT false,
    "electricalLastCheck" TIMESTAMP(3),
    "electricalNextDue" TIMESTAMP(3),
    "noiseAssessmentRequired" BOOLEAN NOT NULL DEFAULT false,
    "noiseLastTest" TIMESTAMP(3),
    "noiseMeasurementDb" DOUBLE PRECISION,
    "lastMaintenanceDate" TIMESTAMP(3),
    "lastMaintenanceType" TEXT,
    "nextScheduledDate" TIMESTAMP(3),
    "downtimeHoursYtd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "certifiedOperators" JSONB NOT NULL DEFAULT '[]',
    "spareParts" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "FactoryEquipment_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "FactoryEquipment_factoryProfileId_idx" ON "FactoryEquipment" ("factoryProfileId")`,
  `CREATE INDEX IF NOT EXISTS "FactoryEquipment_siteId_idx" ON "FactoryEquipment" ("siteId")`,
  `CREATE INDEX IF NOT EXISTS "FactoryEquipment_status_idx" ON "FactoryEquipment" ("status")`,

  // ── HazardousMaterial ──
  `CREATE TABLE IF NOT EXISTS "HazardousMaterial" (
    "id" TEXT NOT NULL,
    "factoryProfileId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "chemicalName" TEXT NOT NULL,
    "casNumber" TEXT,
    "regulatoryClassification" TEXT,
    "hazmatClassification" TEXT NOT NULL DEFAULT 'LOW',
    "ghsSignalWord" TEXT,
    "ghsHazardClasses" JSONB NOT NULL DEFAULT '[]',
    "ghsPictograms" JSONB NOT NULL DEFAULT '[]',
    "quantityStored" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "maxAllowableQty" DOUBLE PRECISION,
    "reorderLevel" DOUBLE PRECISION,
    "storageBuilding" TEXT,
    "storageRoom" TEXT,
    "containerType" TEXT,
    "containerCount" INTEGER,
    "secondaryContainmentPresent" BOOLEAN NOT NULL DEFAULT false,
    "secondaryContainmentVolume" DOUBLE PRECISION,
    "ventilationAvailable" BOOLEAN NOT NULL DEFAULT false,
    "signagePresent" BOOLEAN NOT NULL DEFAULT false,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "batchLotNumber" TEXT,
    "sdsDocId" TEXT,
    "sdsVersion" TEXT,
    "sdsGhsCompliant" BOOLEAN NOT NULL DEFAULT false,
    "ppeRequired" JSONB NOT NULL DEFAULT '[]',
    "incompatibleSubstances" JSONB NOT NULL DEFAULT '[]',
    "spillKitLocation" TEXT,
    "emergencyContact" TEXT,
    "handlersTrainedCount" INTEGER NOT NULL DEFAULT 0,
    "handlersTotalCount" INTEGER NOT NULL DEFAULT 0,
    "pcbNotificationRequired" BOOLEAN NOT NULL DEFAULT false,
    "pcbRegistrationStatus" TEXT NOT NULL DEFAULT 'NOT_REGISTERED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "HazardousMaterial_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "HazardousMaterial_factoryProfileId_idx" ON "HazardousMaterial" ("factoryProfileId")`,
  `CREATE INDEX IF NOT EXISTS "HazardousMaterial_siteId_idx" ON "HazardousMaterial" ("siteId")`,
  `CREATE INDEX IF NOT EXISTS "HazardousMaterial_classification_idx" ON "HazardousMaterial" ("hazmatClassification")`,

  // ── RegulatoryRegistration ──
  `CREATE TABLE IF NOT EXISTS "RegulatoryRegistration" (
    "id" TEXT NOT NULL,
    "factoryProfileId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "registrationType" TEXT NOT NULL,
    "registrationName" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "issuingAuthority" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "renewalFrequency" TEXT NOT NULL DEFAULT 'ANNUAL',
    "lastRenewedDate" TIMESTAMP(3),
    "nextRenewalDue" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "renewalInProgress" BOOLEAN NOT NULL DEFAULT false,
    "renewalAgencyContact" TEXT,
    "renewalEstimatedCost" DOUBLE PRECISION,
    "renewalNotes" TEXT,
    "alertThresholdDays" INTEGER NOT NULL DEFAULT 90,
    "complianceImpactIfExpired" TEXT NOT NULL DEFAULT 'MEDIUM',
    "documentationIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RegulatoryRegistration_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "RegulatoryRegistration_factoryProfileId_idx" ON "RegulatoryRegistration" ("factoryProfileId")`,
  `CREATE INDEX IF NOT EXISTS "RegulatoryRegistration_siteId_idx" ON "RegulatoryRegistration" ("siteId")`,
  `CREATE INDEX IF NOT EXISTS "RegulatoryRegistration_type_idx" ON "RegulatoryRegistration" ("registrationType")`,
  `CREATE INDEX IF NOT EXISTS "RegulatoryRegistration_expiry_idx" ON "RegulatoryRegistration" ("expiryDate")`,

  // ── FactoryLifecycleEvent (append-only) ──
  `CREATE TABLE IF NOT EXISTS "FactoryLifecycleEvent" (
    "id" TEXT NOT NULL,
    "factoryProfileId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT,
    "performedByRole" TEXT,
    "comment" TEXT,
    "validations" JSONB NOT NULL DEFAULT '{}',
    "issues" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "FactoryLifecycleEvent_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "FactoryLifecycleEvent_factoryProfileId_idx" ON "FactoryLifecycleEvent" ("factoryProfileId")`,
  `CREATE INDEX IF NOT EXISTS "FactoryLifecycleEvent_siteId_idx" ON "FactoryLifecycleEvent" ("siteId")`,

  // ── Foreign keys (CASCADE on hard delete; soft-delete cascade is in the router) ──
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FactoryEquipment_factoryProfileId_fkey') THEN
       ALTER TABLE "FactoryEquipment"
         ADD CONSTRAINT "FactoryEquipment_factoryProfileId_fkey"
         FOREIGN KEY ("factoryProfileId") REFERENCES "FactoryProfile" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HazardousMaterial_factoryProfileId_fkey') THEN
       ALTER TABLE "HazardousMaterial"
         ADD CONSTRAINT "HazardousMaterial_factoryProfileId_fkey"
         FOREIGN KEY ("factoryProfileId") REFERENCES "FactoryProfile" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RegulatoryRegistration_factoryProfileId_fkey') THEN
       ALTER TABLE "RegulatoryRegistration"
         ADD CONSTRAINT "RegulatoryRegistration_factoryProfileId_fkey"
         FOREIGN KEY ("factoryProfileId") REFERENCES "FactoryProfile" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FactoryLifecycleEvent_factoryProfileId_fkey') THEN
       ALTER TABLE "FactoryLifecycleEvent"
         ADD CONSTRAINT "FactoryLifecycleEvent_factoryProfileId_fkey"
         FOREIGN KEY ("factoryProfileId") REFERENCES "FactoryProfile" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,

  // ── Equipment statutory-inspection log (Change 3) ──
  `ALTER TABLE "FactoryEquipment" ADD COLUMN IF NOT EXISTS "lastInspectionDate" TIMESTAMP(3)`,
  `ALTER TABLE "FactoryEquipment" ADD COLUMN IF NOT EXISTS "lastInspectionResult" TEXT`,
  `CREATE TABLE IF NOT EXISTS "FactoryEquipmentInspection" (
    "id" TEXT NOT NULL,
    "factoryProfileId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "inspectionDate" TIMESTAMP(3) NOT NULL,
    "inspectorName" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "findings" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "FactoryEquipmentInspection_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "FactoryEquipmentInspection_equipmentId_idx" ON "FactoryEquipmentInspection" ("equipmentId")`,
  `CREATE INDEX IF NOT EXISTS "FactoryEquipmentInspection_factoryProfileId_idx" ON "FactoryEquipmentInspection" ("factoryProfileId")`,
  `CREATE INDEX IF NOT EXISTS "FactoryEquipmentInspection_siteId_idx" ON "FactoryEquipmentInspection" ("siteId")`,
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FactoryEquipmentInspection_factoryProfileId_fkey') THEN
       ALTER TABLE "FactoryEquipmentInspection"
         ADD CONSTRAINT "FactoryEquipmentInspection_factoryProfileId_fkey"
         FOREIGN KEY ("factoryProfileId") REFERENCES "FactoryProfile" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FactoryEquipmentInspection_equipmentId_fkey') THEN
       ALTER TABLE "FactoryEquipmentInspection"
         ADD CONSTRAINT "FactoryEquipmentInspection_equipmentId_fkey"
         FOREIGN KEY ("equipmentId") REFERENCES "FactoryEquipment" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,
];

async function main() {
  console.log("Applying Facilities EXTENSION DDL (Equipment + Hazmat + Regulatory + Lifecycle)…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 60);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }
  const eq = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "FactoryEquipment"`);
  const hz = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "HazardousMaterial"`);
  const rg = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "RegulatoryRegistration"`);
  const le = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "FactoryLifecycleEvent"`);
  const ei = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "FactoryEquipmentInspection"`);
  console.log(
    `✅  Tables ready. FactoryEquipment rows=${eq[0].c}, HazardousMaterial rows=${hz[0].c}, ` +
      `RegulatoryRegistration rows=${rg[0].c}, FactoryLifecycleEvent rows=${le[0].c}, ` +
      `FactoryEquipmentInspection rows=${ei[0].c}`
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
