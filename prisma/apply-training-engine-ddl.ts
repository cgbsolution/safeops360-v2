// Training & Competency Engine — hand-DDL applier.
//
// Additive + idempotent (every statement tolerates "already exists"), applied
// through the Prisma client's connection because `prisma db push` would drop
// the drifted hand-DDL tables on this shared Supabase database.
//   npx tsx prisma/apply-training-engine-ddl.ts   (or: npm run db:apply-training-engine)
//
// Creates the 6 engine tables (HazardToSkillMapping, TrainingRuleConfig,
// TrainingAssignment, TrainingContent, TrainingTriggerEvent,
// TrainingCorrelationPoint) + 3 additive columns on existing Skill-Matrix
// tables. SQLAlchemy mirror: app/models/training_engine.py.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  // ── Additive columns on existing Skill-Matrix tables ──────────────────
  `ALTER TABLE "RoleCompetencyRequirement" ADD COLUMN IF NOT EXISTS "requiredProficiency" TEXT`,
  `ALTER TABLE "RoleCompetencyRequirement" ADD COLUMN IF NOT EXISTS "recertIntervalMonthsOverride" INTEGER`,
  `ALTER TABLE "CompetencyRecord" ADD COLUMN IF NOT EXISTS "currentProficiency" TEXT`,

  // ── HazardToSkillMapping — the admin-configurable "moat" mapping ──────
  `CREATE TABLE IF NOT EXISTS "HazardToSkillMapping" (
     "id"                  TEXT PRIMARY KEY,
     "plantId"             TEXT,
     "sourceModule"        TEXT NOT NULL DEFAULT 'ANY',
     "classificationField" TEXT NOT NULL,
     "classificationValue" TEXT NOT NULL,
     "matchMode"           TEXT NOT NULL DEFAULT 'exact',
     "competencyId"        TEXT NOT NULL,
     "priority"            INTEGER NOT NULL DEFAULT 100,
     "notes"               TEXT,
     "isActive"            BOOLEAN NOT NULL DEFAULT true,
     "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "createdBy"           TEXT,
     "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedBy"           TEXT,
     "isDeleted"           BOOLEAN NOT NULL DEFAULT false
   )`,
  `CREATE INDEX IF NOT EXISTS "HazardToSkillMapping_plant_module_active_idx" ON "HazardToSkillMapping" ("plantId", "sourceModule", "isActive")`,
  `CREATE INDEX IF NOT EXISTS "HazardToSkillMapping_competencyId_idx" ON "HazardToSkillMapping" ("competencyId")`,
  `CREATE INDEX IF NOT EXISTS "HazardToSkillMapping_field_value_idx" ON "HazardToSkillMapping" ("classificationField", "classificationValue")`,

  // ── TrainingRuleConfig — configurable thresholds & windows ────────────
  `CREATE TABLE IF NOT EXISTS "TrainingRuleConfig" (
     "id"                    TEXT PRIMARY KEY,
     "plantId"               TEXT,
     "thresholdCount"        INTEGER NOT NULL DEFAULT 3,
     "thresholdWindowDays"   INTEGER NOT NULL DEFAULT 90,
     "severitySifImmediate"  BOOLEAN NOT NULL DEFAULT true,
     "severityThreshold"     TEXT NOT NULL DEFAULT 'HIGH',
     "recertWindowDays"      INTEGER NOT NULL DEFAULT 30,
     "assignmentDueDays"     INTEGER NOT NULL DEFAULT 30,
     "correlationWindowDays" INTEGER NOT NULL DEFAULT 90,
     "personFlagThreshold"   INTEGER NOT NULL DEFAULT 2,
     "personFlagWindowDays"  INTEGER NOT NULL DEFAULT 365,
     "personRiskElevated"    INTEGER NOT NULL DEFAULT 3,
     "personRiskHigh"        INTEGER NOT NULL DEFAULT 6,
     "personRiskCritical"    INTEGER NOT NULL DEFAULT 10,
     "isActive"              BOOLEAN NOT NULL DEFAULT true,
     "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "createdBy"             TEXT,
     "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedBy"             TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS "TrainingRuleConfig_plant_active_idx" ON "TrainingRuleConfig" ("plantId", "isActive")`,
  // person-risk config columns — ADD COLUMN too, so a TrainingRuleConfig created
  // by an earlier run of this script (without them) is upgraded in place.
  `ALTER TABLE "TrainingRuleConfig" ADD COLUMN IF NOT EXISTS "personFlagThreshold" INTEGER NOT NULL DEFAULT 2`,
  `ALTER TABLE "TrainingRuleConfig" ADD COLUMN IF NOT EXISTS "personFlagWindowDays" INTEGER NOT NULL DEFAULT 365`,
  `ALTER TABLE "TrainingRuleConfig" ADD COLUMN IF NOT EXISTS "personRiskElevated" INTEGER NOT NULL DEFAULT 3`,
  `ALTER TABLE "TrainingRuleConfig" ADD COLUMN IF NOT EXISTS "personRiskHigh" INTEGER NOT NULL DEFAULT 6`,
  `ALTER TABLE "TrainingRuleConfig" ADD COLUMN IF NOT EXISTS "personRiskCritical" INTEGER NOT NULL DEFAULT 10`,

  // ── TrainingAssignment — first-class assignment with provenance ───────
  `CREATE TABLE IF NOT EXISTS "TrainingAssignment" (
     "id"                     TEXT PRIMARY KEY,
     "plantId"                TEXT NOT NULL,
     "personUserId"           TEXT NOT NULL,
     "competencyId"           TEXT NOT NULL,
     "source"                 TEXT NOT NULL,
     "ruleType"               TEXT,
     "sourceModule"           TEXT,
     "sourceRecordId"         TEXT,
     "sourceRecordRef"        TEXT,
     "triggerMappingId"       TEXT,
     "provenance"             JSONB,
     "contentId"              TEXT,
     "assignedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "assignedByUserId"       TEXT,
     "dueDate"                TIMESTAMP(3),
     "status"                 TEXT NOT NULL DEFAULT 'assigned',
     "isMandatory"            BOOLEAN NOT NULL DEFAULT false,
     "dismissible"            BOOLEAN NOT NULL DEFAULT true,
     "escalationFlag"         BOOLEAN NOT NULL DEFAULT false,
     "escalatedToUserId"      TEXT,
     "completedAt"            TIMESTAMP(3),
     "completionEvidenceType" TEXT,
     "completionEvidenceId"   TEXT,
     "completionNote"         TEXT,
     "competencyRecordId"     TEXT,
     "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "createdBy"              TEXT,
     "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedBy"              TEXT,
     "isDeleted"              BOOLEAN NOT NULL DEFAULT false
   )`,
  `CREATE INDEX IF NOT EXISTS "TrainingAssignment_plant_status_idx" ON "TrainingAssignment" ("plantId", "status")`,
  `CREATE INDEX IF NOT EXISTS "TrainingAssignment_person_status_idx" ON "TrainingAssignment" ("personUserId", "status")`,
  `CREATE INDEX IF NOT EXISTS "TrainingAssignment_competencyId_idx" ON "TrainingAssignment" ("competencyId")`,
  `CREATE INDEX IF NOT EXISTS "TrainingAssignment_source_record_idx" ON "TrainingAssignment" ("sourceModule", "sourceRecordId")`,

  // ── TrainingContent — vendor-decoupled content adapter ────────────────
  `CREATE TABLE IF NOT EXISTS "TrainingContent" (
     "id"              TEXT PRIMARY KEY,
     "competencyId"    TEXT NOT NULL,
     "title"           TEXT NOT NULL,
     "description"     TEXT,
     "contentType"     TEXT NOT NULL,
     "deliveryMode"    TEXT NOT NULL,
     "contentRef"      TEXT NOT NULL,
     "vendorId"        TEXT,
     "vendorName"      TEXT,
     "durationMinutes" INTEGER,
     "passingScore"    INTEGER,
     "language"        TEXT NOT NULL DEFAULT 'en',
     "isActive"        BOOLEAN NOT NULL DEFAULT true,
     "isPrimary"       BOOLEAN NOT NULL DEFAULT false,
     "plantId"         TEXT,
     "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "createdBy"       TEXT,
     "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedBy"       TEXT,
     "isDeleted"       BOOLEAN NOT NULL DEFAULT false
   )`,
  `CREATE INDEX IF NOT EXISTS "TrainingContent_competency_active_idx" ON "TrainingContent" ("competencyId", "isActive")`,
  `CREATE INDEX IF NOT EXISTS "TrainingContent_vendorId_idx" ON "TrainingContent" ("vendorId")`,

  // ── TrainingTriggerEvent — dedicated outbox for the rule engine ───────
  `CREATE TABLE IF NOT EXISTS "TrainingTriggerEvent" (
     "id"              TEXT PRIMARY KEY,
     "plantId"         TEXT,
     "sourceModule"    TEXT NOT NULL,
     "sourceRecordId"  TEXT NOT NULL,
     "sourceRecordRef" TEXT,
     "eventType"       TEXT NOT NULL DEFAULT 'classification_saved',
     "classification"  JSONB NOT NULL DEFAULT '{}',
     "occurredAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "processedAt"     TIMESTAMP(3),
     "processingError" TEXT,
     "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "TrainingTriggerEvent_processedAt_idx" ON "TrainingTriggerEvent" ("processedAt")`,
  `CREATE INDEX IF NOT EXISTS "TrainingTriggerEvent_source_record_idx" ON "TrainingTriggerEvent" ("sourceModule", "sourceRecordId")`,

  // ── TrainingCorrelationPoint — the defensible data asset (spec §D) ────
  `CREATE TABLE IF NOT EXISTS "TrainingCorrelationPoint" (
     "id"                  TEXT PRIMARY KEY,
     "plantId"             TEXT NOT NULL,
     "competencyId"        TEXT NOT NULL,
     "personUserId"        TEXT NOT NULL,
     "assignmentId"        TEXT,
     "sourceModule"        TEXT,
     "sourceRecordId"      TEXT,
     "sourceRecordRef"     TEXT,
     "trainingCompletedAt" TIMESTAMP(3) NOT NULL,
     "windowDays"          INTEGER NOT NULL DEFAULT 90,
     "preWindowCount"      INTEGER NOT NULL DEFAULT 0,
     "postWindowCount"     INTEGER,
     "computedAt"          TIMESTAMP(3),
     "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "TrainingCorrelationPoint_plant_competency_idx" ON "TrainingCorrelationPoint" ("plantId", "competencyId")`,
  `CREATE INDEX IF NOT EXISTS "TrainingCorrelationPoint_personUserId_idx" ON "TrainingCorrelationPoint" ("personUserId")`,

  // ── WorkerTrainingFlag — the person-risk analytic (auto-flag repeat-involved) ─
  `CREATE TABLE IF NOT EXISTS "WorkerTrainingFlag" (
     "id"                      TEXT PRIMARY KEY,
     "plantId"                 TEXT NOT NULL,
     "personUserId"            TEXT NOT NULL,
     "riskScore"               DOUBLE PRECISION NOT NULL DEFAULT 0,
     "riskBand"                TEXT NOT NULL DEFAULT 'elevated',
     "windowDays"              INTEGER NOT NULL DEFAULT 365,
     "incidentCount"           INTEGER NOT NULL DEFAULT 0,
     "nearMissCount"           INTEGER NOT NULL DEFAULT 0,
     "observationCount"        INTEGER NOT NULL DEFAULT 0,
     "sifCount"                INTEGER NOT NULL DEFAULT 0,
     "totalEvents"             INTEGER NOT NULL DEFAULT 0,
     "contributingRecords"     JSONB,
     "recommendedCompetencies" JSONB,
     "mappedCompetencyIds"     TEXT[] NOT NULL DEFAULT '{}',
     "assignmentIds"           TEXT[] NOT NULL DEFAULT '{}',
     "status"                  TEXT NOT NULL DEFAULT 'flagged',
     "flaggedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "lastEvaluatedAt"         TIMESTAMP(3),
     "acknowledgedBy"          TEXT,
     "acknowledgedAt"          TIMESTAMP(3),
     "clearedBy"               TEXT,
     "clearedAt"               TIMESTAMP(3),
     "clearReason"             TEXT,
     "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "WorkerTrainingFlag_personUserId_key" ON "WorkerTrainingFlag" ("personUserId")`,
  `CREATE INDEX IF NOT EXISTS "WorkerTrainingFlag_plant_status_idx" ON "WorkerTrainingFlag" ("plantId", "status")`,
  `CREATE INDEX IF NOT EXISTS "WorkerTrainingFlag_riskBand_idx" ON "WorkerTrainingFlag" ("riskBand")`,

  // ── FK constraints (competencyId → Competency) — guarded, no IF NOT EXISTS ─
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HazardToSkillMapping_competencyId_fkey') THEN
       ALTER TABLE "HazardToSkillMapping"
         ADD CONSTRAINT "HazardToSkillMapping_competencyId_fkey"
         FOREIGN KEY ("competencyId") REFERENCES "Competency" ("id");
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TrainingAssignment_competencyId_fkey') THEN
       ALTER TABLE "TrainingAssignment"
         ADD CONSTRAINT "TrainingAssignment_competencyId_fkey"
         FOREIGN KEY ("competencyId") REFERENCES "Competency" ("id");
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TrainingContent_competencyId_fkey') THEN
       ALTER TABLE "TrainingContent"
         ADD CONSTRAINT "TrainingContent_competencyId_fkey"
         FOREIGN KEY ("competencyId") REFERENCES "Competency" ("id");
     END IF;
   END $$`,
];

async function main() {
  console.log("→ Applying Training & Competency Engine DDL (idempotent)…\n");
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${sql.trim().split("\n")[0].slice(0, 74)}`);
  }
  const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_name IN ('HazardToSkillMapping','TrainingRuleConfig','TrainingAssignment',
                           'TrainingContent','TrainingTriggerEvent','TrainingCorrelationPoint',
                           'WorkerTrainingFlag')
      ORDER BY table_name`
  );
  console.log("\n✅  Engine tables present:", tables.map((t) => t.table_name).join(", "));
}

main()
  .catch((e) => {
    console.error("❌ DDL apply failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
