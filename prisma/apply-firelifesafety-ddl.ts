// DDL applier for the Fire & Life Safety extension of P1-4. Additive + idempotent.
//
// Adds the five tables the P1-4 register lacked (zones, config-driven inspection
// frequency, AMC contracts, asset-level certificates, false-alarm log), the
// FireEquipment columns that link them, and the two CamsFinding columns that make
// the fire defect rules enforceable.
//
// The one non-obvious statement here is the CRITICAL-defect CAPA constraint.
// Spec §5.4 wants it enforced by the database rather than the UI. Postgres does
// not support DEFERRABLE CHECK constraints, and a non-deferred CHECK would make
// the legal ordering (INSERT finding → spawn CAPA → UPDATE finding.capaId, all in
// one transaction) impossible, because the finding row is invalid for the few
// statements between insert and link. A CONSTRAINT TRIGGER ... DEFERRABLE
// INITIALLY DEFERRED fires once at COMMIT instead, which is exactly the assertion
// wanted: "no transaction may end with a requiresCapa finding that has no CAPA".
//
// The trigger is scoped by the `requiresCapa` flag (default false), so existing
// CAMS findings — including CRITICAL_NC ones raised before this build — are
// untouched. Widening it to all CRITICAL_NC findings would fail on live data.
//
//   npx tsx prisma/apply-firelifesafety-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  // ── FireEquipment extensions ───────────────────────────────────────────────
  `ALTER TABLE "FireEquipment" ADD COLUMN IF NOT EXISTS "zoneId" TEXT`,
  `ALTER TABLE "FireEquipment" ADD COLUMN IF NOT EXISTS "assetSubtype" TEXT`,
  `ALTER TABLE "FireEquipment" ADD COLUMN IF NOT EXISTS "amcContractId" TEXT`,
  `ALTER TABLE "FireEquipment" ADD COLUMN IF NOT EXISTS "frequencyMasterId" TEXT`,
  `ALTER TABLE "FireEquipment" ADD COLUMN IF NOT EXISTS "frequencyOverrideReason" TEXT`,
  `ALTER TABLE "FireEquipment" ADD COLUMN IF NOT EXISTS "statusOverride" TEXT`,
  `ALTER TABLE "FireEquipment" ADD COLUMN IF NOT EXISTS "statusOverrideReason" TEXT`,
  `ALTER TABLE "FireEquipment" ADD COLUMN IF NOT EXISTS "statusOverriddenBy" TEXT`,
  `ALTER TABLE "FireEquipment" ADD COLUMN IF NOT EXISTS "statusOverriddenAt" TIMESTAMP(3)`,
  `CREATE INDEX IF NOT EXISTS "ix_FireEquipment_zone_status" ON "FireEquipment" ("zoneId","status")`,
  `CREATE INDEX IF NOT EXISTS "ix_FireEquipment_amc" ON "FireEquipment" ("amcContractId")`,

  // Backfill: P1-4 rows were created with OUT_OF_SERVICE / DECOMMISSIONED held
  // directly in `status`, which the old compute_status() treated as sticky. That
  // stickiness now lives in `statusOverride`, so those rows must carry it over or
  // the first nightly recompute would silently reactivate decommissioned assets.
  `UPDATE "FireEquipment" SET "statusOverride" = "status",
     "statusOverrideReason" = COALESCE("outOfServiceReason", 'Migrated from P1-4 sticky status')
   WHERE "status" IN ('OUT_OF_SERVICE','DECOMMISSIONED') AND "statusOverride" IS NULL`,

  // ── CamsFinding extensions ─────────────────────────────────────────────────
  `ALTER TABLE "CamsFinding" ADD COLUMN IF NOT EXISTS "requiresCapa" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "CamsFinding" ADD COLUMN IF NOT EXISTS "verificationEngagementId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "ix_CamsFinding_assetRef" ON "CamsFinding" ("areaOrAssetRef")`,

  // The deferred assertion behind spec §5.4. Written as a trigger function +
  // constraint trigger so it validates at COMMIT, not per-statement.
  // The function RE-READS the row instead of trusting NEW, and that is the whole
  // trick. A deferred AFTER INSERT trigger fires at COMMIT against the tuple
  // version captured when the INSERT ran — so on the legal ordering (insert
  // finding → spawn CAPA → link it), NEW."capaId" is still NULL at commit and a
  // naive NEW-based check would reject every correctly-raised CRITICAL defect.
  // Re-selecting inside the transaction sees the final state, which is the state
  // the assertion is actually about. `NOT FOUND` means the row was deleted later
  // in the same transaction — nothing left to assert.
  `CREATE OR REPLACE FUNCTION "fn_CamsFinding_requires_capa"() RETURNS TRIGGER AS $$
   DECLARE cur RECORD;
   BEGIN
     SELECT "capaId", "isDeleted", "requiresCapa", "findingCode"
       INTO cur FROM "CamsFinding" WHERE "id" = NEW."id";
     IF NOT FOUND THEN
       RETURN NULL;
     END IF;
     IF cur."requiresCapa" AND cur."capaId" IS NULL AND NOT cur."isDeleted" THEN
       RAISE EXCEPTION
         'CamsFinding % (%) is flagged requiresCapa but has no linked CAPA. A CRITICAL fire defect cannot be committed without one (Fire & Life Safety spec 5.4).',
         NEW."id", cur."findingCode"
         USING ERRCODE = 'check_violation';
     END IF;
     RETURN NULL;
   END;
   $$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS "trg_CamsFinding_requires_capa" ON "CamsFinding"`,
  `CREATE CONSTRAINT TRIGGER "trg_CamsFinding_requires_capa"
     AFTER INSERT OR UPDATE ON "CamsFinding"
     DEFERRABLE INITIALLY DEFERRED
     FOR EACH ROW EXECUTE FUNCTION "fn_CamsFinding_requires_capa"()`,

  // ── FireZone ───────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "FireZone" (
    "id" TEXT NOT NULL, "zoneCode" TEXT NOT NULL, "name" TEXT NOT NULL, "plantId" TEXT NOT NULL,
    "buildingId" TEXT, "areaId" TEXT, "parentZoneId" TEXT, "floor" TEXT, "areaSqm" DOUBLE PRECISION,
    "coverageType" TEXT NOT NULL DEFAULT 'BOTH', "criticality" TEXT NOT NULL DEFAULT 'STANDARD',
    "requiredAssetTypes" JSONB NOT NULL DEFAULT '[]', "panelAssetId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false, "deletedAt" TIMESTAMP(3), "deletedBy" TEXT, "deletionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedBy" TEXT,
    CONSTRAINT "FireZone_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "FireZone_zoneCode_key" ON "FireZone" ("zoneCode")`,
  `CREATE INDEX IF NOT EXISTS "ix_FireZone_plant" ON "FireZone" ("plantId")`,
  `CREATE INDEX IF NOT EXISTS "ix_FireZone_building" ON "FireZone" ("buildingId")`,
  `CREATE INDEX IF NOT EXISTS "ix_FireZone_parent" ON "FireZone" ("parentZoneId")`,

  // ── InspectionFrequencyMaster ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "InspectionFrequencyMaster" (
    "id" TEXT NOT NULL, "plantId" TEXT, "region" TEXT NOT NULL DEFAULT 'IN',
    "assetType" TEXT NOT NULL, "assetSubtype" TEXT, "frequency" TEXT NOT NULL,
    "customIntervalDays" INTEGER, "regulatoryReference" TEXT,
    "checklistTemplateId" TEXT, "auditTypeId" TEXT, "leadTimeDays" INTEGER NOT NULL DEFAULT 7,
    "isActive" BOOLEAN NOT NULL DEFAULT true, "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedBy" TEXT,
    CONSTRAINT "InspectionFrequencyMaster_pkey" PRIMARY KEY ("id"))`,
  // CUSTOM without an interval is a silently-broken config row — reject it at write time.
  `ALTER TABLE "InspectionFrequencyMaster" DROP CONSTRAINT IF EXISTS "IFM_custom_interval_present"`,
  `ALTER TABLE "InspectionFrequencyMaster" ADD CONSTRAINT "IFM_custom_interval_present"
     CHECK ("frequency" <> 'CUSTOM' OR "customIntervalDays" IS NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS "ix_IFM_lookup" ON "InspectionFrequencyMaster" ("region","assetType","assetSubtype")`,
  `CREATE INDEX IF NOT EXISTS "ix_IFM_plant" ON "InspectionFrequencyMaster" ("plantId","assetType")`,
  // One active rule per resolution key. Partial-unique so superseded/soft-deleted
  // rows stay for the audit trail without blocking a replacement.
  `CREATE UNIQUE INDEX IF NOT EXISTS "IFM_active_key"
     ON "InspectionFrequencyMaster" ("region","assetType",COALESCE("assetSubtype",''),COALESCE("plantId",''))
     WHERE "isActive" AND NOT "isDeleted"`,

  // ── FireAmcContract ────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "FireAmcContract" (
    "id" TEXT NOT NULL, "contractCode" TEXT NOT NULL, "plantId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL, "vendorContactId" TEXT, "vendorEmail" TEXT, "vendorPhone" TEXT,
    "scopeSummary" TEXT, "startDate" TIMESTAMP(3) NOT NULL, "endDate" TIMESTAMP(3) NOT NULL,
    "renewalReminderDays" JSONB NOT NULL DEFAULT '[]', "lastReminderTierSent" INTEGER,
    "escalatedAt" TIMESTAMP(3), "contractDocumentIds" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE', "annualValueInr" DOUBLE PRECISION,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false, "deletedAt" TIMESTAMP(3), "deletedBy" TEXT, "deletionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedBy" TEXT,
    CONSTRAINT "FireAmcContract_pkey" PRIMARY KEY ("id"))`,
  `ALTER TABLE "FireAmcContract" DROP CONSTRAINT IF EXISTS "FireAmcContract_dates_ordered"`,
  `ALTER TABLE "FireAmcContract" ADD CONSTRAINT "FireAmcContract_dates_ordered" CHECK ("endDate" > "startDate")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "FireAmcContract_contractCode_key" ON "FireAmcContract" ("contractCode")`,
  `CREATE INDEX IF NOT EXISTS "ix_FireAmcContract_plant_status" ON "FireAmcContract" ("plantId","status")`,
  `CREATE INDEX IF NOT EXISTS "ix_FireAmcContract_end" ON "FireAmcContract" ("endDate")`,

  // ── FireAssetCertificate ───────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "FireAssetCertificate" (
    "id" TEXT NOT NULL, "assetId" TEXT NOT NULL, "plantId" TEXT NOT NULL,
    "certificateType" TEXT NOT NULL, "certificateNo" TEXT, "issuingAuthority" TEXT,
    "issueDate" TIMESTAMP(3), "expiryDate" TIMESTAMP(3), "status" TEXT NOT NULL DEFAULT 'VALID',
    "escalationTierDays" JSONB NOT NULL DEFAULT '[]', "lastReminderTierSent" INTEGER,
    "documentIds" JSONB NOT NULL DEFAULT '[]', "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false, "deletedAt" TIMESTAMP(3), "deletedBy" TEXT, "deletionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedBy" TEXT,
    CONSTRAINT "FireAssetCertificate_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "ix_FireAssetCertificate_asset" ON "FireAssetCertificate" ("assetId")`,
  `CREATE INDEX IF NOT EXISTS "ix_FireAssetCertificate_expiry" ON "FireAssetCertificate" ("expiryDate")`,
  `CREATE INDEX IF NOT EXISTS "ix_FireAssetCertificate_plant_status" ON "FireAssetCertificate" ("plantId","status")`,

  // ── FireFalseAlarmLog ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "FireFalseAlarmLog" (
    "id" TEXT NOT NULL, "panelAssetId" TEXT NOT NULL, "plantId" TEXT NOT NULL, "zoneId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL, "cause" TEXT NOT NULL, "causeNotes" TEXT,
    "correctiveAction" TEXT, "evacuationTriggered" BOOLEAN NOT NULL DEFAULT false,
    "fireServiceCalled" BOOLEAN NOT NULL DEFAULT false, "reportedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdBy" TEXT,
    CONSTRAINT "FireFalseAlarmLog_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "ix_FireFalseAlarmLog_panel" ON "FireFalseAlarmLog" ("panelAssetId","occurredAt")`,
  `CREATE INDEX IF NOT EXISTS "ix_FireFalseAlarmLog_plant" ON "FireFalseAlarmLog" ("plantId","occurredAt")`,

  // ── RegulatoryRegistration: per-tenant escalation tiers ────────────────────
  // Spec §5.6 wants configurable tiers (default 90/60/30/7). The existing column
  // is a single `alertThresholdDays`, which can express one tier, not four. Added
  // here rather than in a new table because Fire NOC / PESO licences already live
  // in this register and must not gain a second home.
  `ALTER TABLE "RegulatoryRegistration" ADD COLUMN IF NOT EXISTS "escalationTierDays" JSONB NOT NULL DEFAULT '[]'`,
  `ALTER TABLE "RegulatoryRegistration" ADD COLUMN IF NOT EXISTS "lastReminderTierSent" INTEGER`,
];

const NEW_TABLES = [
  "FireZone",
  "InspectionFrequencyMaster",
  "FireAmcContract",
  "FireAssetCertificate",
  "FireFalseAlarmLog",
];

async function main() {
  console.log("Applying Fire & Life Safety DDL…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 72);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }
  for (const t of NEW_TABLES) {
    const r = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "${t}"`);
    console.log(`  ${t}: ${r[0].c} rows`);
  }
  const migrated = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT count(*)::bigint AS c FROM "FireEquipment" WHERE "statusOverride" IS NOT NULL`,
  );
  console.log(`  FireEquipment with a sticky status override: ${migrated[0].c}`);
  console.log("✅  Fire & Life Safety tables ready.");
}

main()
  .catch((e) => {
    console.error("❌  DDL apply failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
