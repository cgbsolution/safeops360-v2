// DDL applier for P1-4 Fire Safety & Emergency Response. Additive + idempotent.
// Also adds a generic sourceEntityId to CamsEngagement so a fire inspection (a CAMS
// engagement, sourceModule='FIRE') links to the specific equipment it inspects —
// single engine, no parallel checklist store.
//   npx tsx prisma/apply-firesafety-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  `ALTER TABLE "CamsEngagement" ADD COLUMN IF NOT EXISTS "sourceEntityId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "ix_CamsEngagement_sourceEntity" ON "CamsEngagement" ("sourceModule","sourceEntityId")`,

  `CREATE TABLE IF NOT EXISTS "FireEquipment" (
    "id" TEXT NOT NULL, "equipmentCode" TEXT NOT NULL, "type" TEXT NOT NULL,
    "make" TEXT, "model" TEXT, "serialNo" TEXT, "location" TEXT NOT NULL,
    "buildingId" TEXT, "plantId" TEXT NOT NULL, "latitude" DOUBLE PRECISION, "longitude" DOUBLE PRECISION,
    "floorLevel" INTEGER, "installationDate" TIMESTAMP(3), "lastInspectionDate" TIMESTAMP(3),
    "nextInspectionDueDate" TIMESTAMP(3), "inspectionFrequencyDays" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE', "capacitySpec" TEXT, "maintenanceContractor" TEXT,
    "qrCode" TEXT, "outOfServiceReason" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false, "deletedAt" TIMESTAMP(3), "deletedBy" TEXT, "deletionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedBy" TEXT,
    CONSTRAINT "FireEquipment_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "FireEquipment_equipmentCode_key" ON "FireEquipment" ("equipmentCode")`,
  `CREATE INDEX IF NOT EXISTS "ix_FireEquipment_plant_status" ON "FireEquipment" ("plantId","status")`,
  `CREATE INDEX IF NOT EXISTS "ix_FireEquipment_due" ON "FireEquipment" ("nextInspectionDueDate")`,

  `CREATE TABLE IF NOT EXISTS "AssemblyPoint" (
    "id" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "plantId" TEXT NOT NULL,
    "buildingIds" JSONB NOT NULL DEFAULT '[]', "capacity" INTEGER, "latitude" DOUBLE PRECISION, "longitude" DOUBLE PRECISION,
    "wardenUserId" TEXT, "alternateWardenUserId" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssemblyPoint_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "AssemblyPoint_code_key" ON "AssemblyPoint" ("code")`,
  `CREATE INDEX IF NOT EXISTS "ix_AssemblyPoint_plant" ON "AssemblyPoint" ("plantId")`,

  `CREATE TABLE IF NOT EXISTS "FireEmergencyPlan" (
    "id" TEXT NOT NULL, "planCode" TEXT NOT NULL, "title" TEXT NOT NULL, "plantId" TEXT NOT NULL,
    "continuityPlanId" TEXT, "fireTypes" JSONB NOT NULL DEFAULT '[]', "commandStructure" JSONB NOT NULL DEFAULT '[]',
    "callTree" JSONB NOT NULL DEFAULT '[]', "assemblyPointIds" JSONB NOT NULL DEFAULT '[]',
    "criticalEquipmentShutdownSequence" TEXT, "hazmatLocations" JSONB NOT NULL DEFAULT '[]', "externalContacts" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'DRAFT', "lastReviewDate" TIMESTAMP(3), "nextReviewDate" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false, "deletedAt" TIMESTAMP(3), "deletedBy" TEXT, "deletionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedBy" TEXT,
    CONSTRAINT "FireEmergencyPlan_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "FireEmergencyPlan_planCode_key" ON "FireEmergencyPlan" ("planCode")`,
  `CREATE INDEX IF NOT EXISTS "ix_FireEmergencyPlan_plant" ON "FireEmergencyPlan" ("plantId")`,

  `CREATE TABLE IF NOT EXISTS "FireDrill" (
    "id" TEXT NOT NULL, "drillCode" TEXT NOT NULL, "plantId" TEXT NOT NULL, "drillType" TEXT NOT NULL,
    "planId" TEXT, "scheduledDate" TIMESTAMP(3) NOT NULL, "conductedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PLANNED', "outcome" TEXT, "facilitatorId" TEXT, "participantCount" INTEGER,
    "evacuationTimeMinutes" DOUBLE PRECISION, "evacuationTargetMinutes" DOUBLE PRECISION,
    "assemblyPointVerified" BOOLEAN NOT NULL DEFAULT false, "unaccountedPersons" INTEGER,
    "reportRichText" TEXT, "isAnnualMandatory" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false, "deletedAt" TIMESTAMP(3), "deletedBy" TEXT, "deletionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FireDrill_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "FireDrill_drillCode_key" ON "FireDrill" ("drillCode")`,
  `CREATE INDEX IF NOT EXISTS "ix_FireDrill_plant_status" ON "FireDrill" ("plantId","status")`,

  `CREATE TABLE IF NOT EXISTS "FireDrillFinding" (
    "id" TEXT NOT NULL, "drillId" TEXT NOT NULL, "severity" TEXT NOT NULL, "description" TEXT NOT NULL, "capaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "FireDrillFinding_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "ix_FireDrillFinding_drill" ON "FireDrillFinding" ("drillId")`,

  `CREATE TABLE IF NOT EXISTS "FireIncidentLink" (
    "id" TEXT NOT NULL, "incidentId" TEXT NOT NULL, "plantId" TEXT, "affectedEquipmentIds" JSONB NOT NULL DEFAULT '[]',
    "crisisEventId" TEXT, "evacuationOrdered" BOOLEAN NOT NULL DEFAULT false, "fireServiceCalled" BOOLEAN NOT NULL DEFAULT false,
    "estimatedPropertyDamageInr" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdBy" TEXT,
    CONSTRAINT "FireIncidentLink_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "ix_FireIncidentLink_incident" ON "FireIncidentLink" ("incidentId")`,
];

async function main() {
  console.log("Applying Fire Safety DDL…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 60);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }
  for (const t of ["FireEquipment", "AssemblyPoint", "FireEmergencyPlan", "FireDrill", "FireDrillFinding", "FireIncidentLink"]) {
    const r = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "${t}"`);
    console.log(`  ${t}: ${r[0].c} rows`);
  }
  console.log("✅  Fire Safety tables ready.");
}

main().catch((e) => { console.error("❌  DDL apply failed:", e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
