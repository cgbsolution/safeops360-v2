// DDL applier for the Chemical / Hazmat Management module. Additive + idempotent.
//
// Three of the module's acceptance criteria say "verify at DB constraint level,
// not just form validation". That sentence is the reason this file is long. Each
// of the three is implemented below with a note on WHY the obvious construct
// does not work, because the obvious construct is what a reviewer will ask for:
//
//   1. A chemical cannot reach ACTIVE without an SDS attached.
//      → plain CHECK. Works because `sdsAttachmentId` is denormalised onto
//        ChemicalMaster precisely so the constraint needs no other table.
//
//   2. Inventory quantity is fully ledger-derived; no direct-edit path exists.
//      → NOT a generated column. Postgres GENERATED ALWAYS AS is limited to
//        expressions over the same row, and the balance is an aggregate over a
//        different table. So: an AFTER trigger on the ledger recomputes the
//        balance, and a BEFORE UPDATE trigger on the item REJECTS any statement
//        that changes the balance without coming from that recompute. The
//        second trigger is the one that matters — without it "ledger-derived"
//        is a convention, and conventions do not survive `UPDATE
//        "ChemicalInventoryItem" SET "quantityLedger" = 0 WHERE ...` typed into
//        a psql prompt at 2am.
//
//   3. Incompatibility BLOCK severity actually prevents save.
//      → CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED, the same shape
//        the Fire & Life Safety CRITICAL-defect CAPA rule uses. It must be
//        deferred: the legal ordering is INSERT item → resolve its location →
//        check conflicts, and a non-deferred trigger would fire while the row
//        is still half-built. Firing once at COMMIT expresses the actual
//        assertion — "no transaction may end with two BLOCK-incompatible items
//        in one storage location".
//
// Also seeds the platform-default MSIHC threshold rules and the class-level
// incompatibility matrix, both as `tenantId IS NULL` rows so a tenant inherits
// them and can override without a code change (business rule §2).
//
//   npx tsx prisma/apply-chemical-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── tables ───────────────────────────────────────────────────────────────────
const TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS "ChemicalMaster" (
     "id"                        TEXT PRIMARY KEY,
     "tenantId"                  TEXT NOT NULL DEFAULT 'default',
     "name"                      TEXT NOT NULL,
     "commonName"                TEXT,
     "casNumber"                 TEXT,
     "unNumber"                  TEXT,
     "hazardClasses"             JSONB NOT NULL DEFAULT '[]'::jsonb,
     "physicalState"             TEXT NOT NULL DEFAULT 'LIQUID',
     "flashPointCelsius"         DOUBLE PRECISION,
     "boilingPointCelsius"       DOUBLE PRECISION,
     "nfpaHealth"                INTEGER,
     "nfpaFlammability"          INTEGER,
     "nfpaReactivity"            INTEGER,
     "nfpaSpecial"               TEXT,
     "hazardClassificationSource" TEXT NOT NULL DEFAULT 'MANUAL',
     "sdsAttachmentId"           TEXT,
     "sdsRevisionDate"           TIMESTAMPTZ,
     "sdsReviewDueDate"          TIMESTAMPTZ,
     "sdsReviewOverdue"          BOOLEAN NOT NULL DEFAULT false,
     "sdsReviewFlaggedAt"        TIMESTAMPTZ,
     "status"                    TEXT NOT NULL DEFAULT 'PENDING_SDS',
     "restrictionReason"         TEXT,
     "approvedByUserId"          TEXT,
     "approvedAt"                TIMESTAMPTZ,
     "regulatoryReference"       TEXT,
     "createdAt"                 TIMESTAMPTZ NOT NULL DEFAULT now(),
     "createdBy"                 TEXT,
     "updatedAt"                 TIMESTAMPTZ NOT NULL DEFAULT now(),
     "updatedBy"                 TEXT,
     "isDeleted"                 BOOLEAN NOT NULL DEFAULT false,
     "deletedAt"                 TIMESTAMPTZ,
     "deletedBy"                 TEXT,
     "deletionReason"            TEXT
   )`,

  `CREATE TABLE IF NOT EXISTS "ChemicalStorageLocation" (
     "id"                     TEXT PRIMARY KEY,
     "tenantId"               TEXT NOT NULL DEFAULT 'default',
     "plantId"                TEXT NOT NULL,
     "zoneId"                 TEXT,
     "code"                   TEXT NOT NULL,
     "name"                   TEXT NOT NULL,
     "storageType"            TEXT NOT NULL DEFAULT 'GENERAL',
     "maxCapacity"            DOUBLE PRECISION,
     "capacityUnit"           TEXT,
     "currentOccupancy"       DOUBLE PRECISION NOT NULL DEFAULT 0,
     "ventilated"             BOOLEAN NOT NULL DEFAULT false,
     "bunded"                 BOOLEAN NOT NULL DEFAULT false,
     "temperatureControlled"  BOOLEAN NOT NULL DEFAULT false,
     "isActive"               BOOLEAN NOT NULL DEFAULT true,
     "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
     "createdBy"              TEXT,
     "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
     "updatedBy"              TEXT,
     "isDeleted"              BOOLEAN NOT NULL DEFAULT false,
     "deletedAt"              TIMESTAMPTZ,
     "deletedBy"              TEXT,
     "deletionReason"         TEXT
   )`,

  `CREATE TABLE IF NOT EXISTS "ChemicalInventoryItem" (
     "id"                  TEXT PRIMARY KEY,
     "tenantId"            TEXT NOT NULL DEFAULT 'default',
     "chemicalId"          TEXT NOT NULL REFERENCES "ChemicalMaster"("id") ON DELETE RESTRICT,
     "plantId"             TEXT NOT NULL,
     "storageLocationId"   TEXT REFERENCES "ChemicalStorageLocation"("id") ON DELETE RESTRICT,
     "batchLotNumber"      TEXT NOT NULL,
     "unit"                TEXT NOT NULL DEFAULT 'KG',
     "quantityLedger"      DOUBLE PRECISION NOT NULL DEFAULT 0,
     "currentStatus"       TEXT NOT NULL DEFAULT 'IN_STOCK',
     "lowStockThreshold"   DOUBLE PRECISION,
     "receiptDate"         TIMESTAMPTZ,
     "expiryDate"          TIMESTAMPTZ,
     "supplierName"        TEXT,
     "supplierBatchRef"    TEXT,
     "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
     "createdBy"           TEXT,
     "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
     "updatedBy"           TEXT,
     "isDeleted"           BOOLEAN NOT NULL DEFAULT false,
     "deletedAt"           TIMESTAMPTZ,
     "deletedBy"           TEXT,
     "deletionReason"      TEXT
   )`,

  `CREATE TABLE IF NOT EXISTS "ChemicalInventoryTransaction" (
     "id"                 TEXT PRIMARY KEY,
     "tenantId"           TEXT NOT NULL DEFAULT 'default',
     "itemId"             TEXT NOT NULL REFERENCES "ChemicalInventoryItem"("id") ON DELETE CASCADE,
     "type"               TEXT NOT NULL,
     "quantity"           DOUBLE PRECISION NOT NULL,
     "signedQuantity"     DOUBLE PRECISION NOT NULL,
     "unit"               TEXT NOT NULL,
     "transactedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
     "byUserId"           TEXT NOT NULL,
     "refDocument"        TEXT,
     "reason"             TEXT,
     "counterpartItemId"  TEXT,
     "disposalRecordId"   TEXT,
     "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,

  `CREATE TABLE IF NOT EXISTS "ChemicalIncompatibilityRule" (
     "id"                  TEXT PRIMARY KEY,
     "tenantId"            TEXT,
     "hazardClassA"        TEXT,
     "hazardClassB"        TEXT,
     "chemicalIdA"         TEXT,
     "chemicalIdB"         TEXT,
     "severity"            TEXT NOT NULL DEFAULT 'WARN',
     "regulatoryReference" TEXT,
     "rationale"           TEXT,
     "isActive"            BOOLEAN NOT NULL DEFAULT true,
     "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
     "createdBy"           TEXT,
     "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
     "updatedBy"           TEXT,
     "isDeleted"           BOOLEAN NOT NULL DEFAULT false,
     "deletedAt"           TIMESTAMPTZ,
     "deletedBy"           TEXT,
     "deletionReason"      TEXT
   )`,

  `CREATE TABLE IF NOT EXISTS "ChemicalStorageOverride" (
     "id"                  TEXT PRIMARY KEY,
     "tenantId"            TEXT NOT NULL DEFAULT 'default',
     "plantId"             TEXT NOT NULL,
     "storageLocationId"   TEXT NOT NULL,
     "inventoryItemId"     TEXT NOT NULL,
     "conflictingItemId"   TEXT,
     "ruleId"              TEXT,
     "severity"            TEXT NOT NULL DEFAULT 'WARN',
     "overrideReason"      TEXT NOT NULL,
     "overriddenByUserId"  TEXT NOT NULL,
     "overriddenAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
     "reviewedByUserId"    TEXT,
     "reviewedAt"          TIMESTAMPTZ,
     "reviewOutcome"       TEXT
   )`,

  `CREATE TABLE IF NOT EXISTS "ChemicalThresholdRule" (
     "id"                 TEXT PRIMARY KEY,
     "tenantId"           TEXT,
     "region"             TEXT NOT NULL DEFAULT 'IN',
     "hazardClass"        TEXT,
     "chemicalId"         TEXT,
     "scheduleReference"  TEXT NOT NULL,
     "thresholdQuantity"  DOUBLE PRECISION NOT NULL,
     "unit"               TEXT NOT NULL DEFAULT 'KG',
     "approachRatio"      DOUBLE PRECISION NOT NULL DEFAULT 0.8,
     "triggerObligation"  TEXT NOT NULL,
     "autoMocOnBreach"    BOOLEAN NOT NULL DEFAULT true,
     "notes"              TEXT,
     "isActive"           BOOLEAN NOT NULL DEFAULT true,
     "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
     "createdBy"          TEXT,
     "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
     "updatedBy"          TEXT,
     "isDeleted"          BOOLEAN NOT NULL DEFAULT false,
     "deletedAt"          TIMESTAMPTZ,
     "deletedBy"          TEXT,
     "deletionReason"     TEXT
   )`,

  `CREATE TABLE IF NOT EXISTS "ChemicalThresholdState" (
     "id"                 TEXT PRIMARY KEY,
     "tenantId"           TEXT NOT NULL DEFAULT 'default',
     "plantId"            TEXT NOT NULL,
     "ruleId"             TEXT NOT NULL,
     "status"             TEXT NOT NULL DEFAULT 'BELOW',
     "currentQuantity"    DOUBLE PRECISION NOT NULL DEFAULT 0,
     "thresholdQuantity"  DOUBLE PRECISION NOT NULL DEFAULT 0,
     "unit"               TEXT NOT NULL DEFAULT 'KG',
     "lastEvaluatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
     "lastBreachedAt"     TIMESTAMPTZ,
     "lastClearedAt"      TIMESTAMPTZ,
     "activeMocId"        TEXT
   )`,

  `CREATE TABLE IF NOT EXISTS "MocTriggerLog" (
     "id"                    TEXT PRIMARY KEY,
     "tenantId"              TEXT NOT NULL DEFAULT 'default',
     "plantId"               TEXT,
     "triggeredAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
     "triggerType"           TEXT NOT NULL,
     "sourceEntityType"      TEXT,
     "sourceEntityId"        TEXT NOT NULL,
     "mocId"                 TEXT,
     "mocNumber"             TEXT,
     "status"                TEXT NOT NULL,
     "reason"                TEXT,
     "failureReason"         TEXT,
     "stackTrace"            TEXT,
     "ruleId"                TEXT,
     "scheduleReference"     TEXT,
     "observedQuantity"      DOUBLE PRECISION,
     "thresholdQuantity"     DOUBLE PRECISION,
     "unit"                  TEXT,
     "notifiedUserCount"     INTEGER NOT NULL DEFAULT 0,
     "acknowledgedByUserId"  TEXT,
     "acknowledgedAt"        TIMESTAMPTZ,
     "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,

  `CREATE TABLE IF NOT EXISTS "ChemicalDisposalRecord" (
     "id"                      TEXT PRIMARY KEY,
     "tenantId"                TEXT NOT NULL DEFAULT 'default',
     "plantId"                 TEXT NOT NULL,
     "inventoryItemId"         TEXT NOT NULL REFERENCES "ChemicalInventoryItem"("id") ON DELETE RESTRICT,
     "chemicalId"              TEXT NOT NULL,
     "quantity"                DOUBLE PRECISION NOT NULL,
     "unit"                    TEXT NOT NULL,
     "disposalDate"            TIMESTAMPTZ NOT NULL,
     "manifestReference"       TEXT NOT NULL,
     "disposalVendor"          TEXT NOT NULL,
     "vendorAuthorisationNo"   TEXT,
     "wasteCategory"           TEXT,
     "disposalMethod"          TEXT,
     "manifestAttachmentId"    TEXT,
     "eaiEntryId"              TEXT,
     "recordedByUserId"        TEXT NOT NULL,
     "createdAt"               TIMESTAMPTZ NOT NULL DEFAULT now(),
     "updatedAt"               TIMESTAMPTZ NOT NULL DEFAULT now(),
     "isDeleted"               BOOLEAN NOT NULL DEFAULT false,
     "deletedAt"               TIMESTAMPTZ,
     "deletedBy"               TEXT,
     "deletionReason"          TEXT
   )`,
];

// ── indexes + uniqueness ─────────────────────────────────────────────────────
const INDEXES: string[] = [
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_ChemicalMaster_identity"
     ON "ChemicalMaster" ("tenantId","name", COALESCE("casNumber",''))`,
  `CREATE INDEX IF NOT EXISTS "ix_ChemicalMaster_tenant_status" ON "ChemicalMaster" ("tenantId","status")`,
  `CREATE INDEX IF NOT EXISTS "ix_ChemicalMaster_cas" ON "ChemicalMaster" ("casNumber")`,
  `CREATE INDEX IF NOT EXISTS "ix_ChemicalMaster_sds_due" ON "ChemicalMaster" ("sdsReviewDueDate","sdsReviewOverdue")`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_ChemStorageLoc_code" ON "ChemicalStorageLocation" ("tenantId","plantId","code")`,
  `CREATE INDEX IF NOT EXISTS "ix_ChemStorageLoc_plant_active" ON "ChemicalStorageLocation" ("plantId","isActive")`,
  `CREATE INDEX IF NOT EXISTS "ix_ChemStorageLoc_zone" ON "ChemicalStorageLocation" ("zoneId")`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_ChemInvItem_batch"
     ON "ChemicalInventoryItem" ("tenantId","chemicalId","plantId","batchLotNumber")`,
  `CREATE INDEX IF NOT EXISTS "ix_ChemInvItem_plant_status" ON "ChemicalInventoryItem" ("plantId","currentStatus")`,
  `CREATE INDEX IF NOT EXISTS "ix_ChemInvItem_location" ON "ChemicalInventoryItem" ("storageLocationId","currentStatus")`,
  `CREATE INDEX IF NOT EXISTS "ix_ChemInvItem_chem_plant" ON "ChemicalInventoryItem" ("chemicalId","plantId")`,
  `CREATE INDEX IF NOT EXISTS "ix_ChemInvItem_expiry" ON "ChemicalInventoryItem" ("expiryDate")`,

  `CREATE INDEX IF NOT EXISTS "ix_ChemInvTxn_item_date" ON "ChemicalInventoryTransaction" ("itemId","transactedAt")`,
  `CREATE INDEX IF NOT EXISTS "ix_ChemInvTxn_type_date" ON "ChemicalInventoryTransaction" ("type","transactedAt")`,

  `CREATE INDEX IF NOT EXISTS "ix_ChemIncompat_classes" ON "ChemicalIncompatibilityRule" ("hazardClassA","hazardClassB","isActive")`,
  `CREATE INDEX IF NOT EXISTS "ix_ChemIncompat_chems" ON "ChemicalIncompatibilityRule" ("chemicalIdA","chemicalIdB","isActive")`,

  `CREATE INDEX IF NOT EXISTS "ix_ChemStorageOverride_pending" ON "ChemicalStorageOverride" ("plantId","reviewedAt")`,

  `CREATE INDEX IF NOT EXISTS "ix_ChemThresholdRule_lookup" ON "ChemicalThresholdRule" ("region","hazardClass","isActive")`,
  `CREATE INDEX IF NOT EXISTS "ix_ChemThresholdRule_chem" ON "ChemicalThresholdRule" ("region","chemicalId","isActive")`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_ChemThresholdState" ON "ChemicalThresholdState" ("tenantId","plantId","ruleId")`,
  `CREATE INDEX IF NOT EXISTS "ix_ChemThresholdState_status" ON "ChemicalThresholdState" ("plantId","status")`,

  `CREATE INDEX IF NOT EXISTS "ix_MocTriggerLog_status_time" ON "MocTriggerLog" ("status","triggeredAt")`,
  `CREATE INDEX IF NOT EXISTS "ix_MocTriggerLog_plant_time" ON "MocTriggerLog" ("plantId","triggeredAt")`,
  `CREATE INDEX IF NOT EXISTS "ix_MocTriggerLog_source" ON "MocTriggerLog" ("sourceEntityType","sourceEntityId")`,

  `CREATE INDEX IF NOT EXISTS "ix_ChemDisposal_plant_date" ON "ChemicalDisposalRecord" ("plantId","disposalDate")`,
  `CREATE INDEX IF NOT EXISTS "ix_ChemDisposal_manifest" ON "ChemicalDisposalRecord" ("manifestReference")`,
];

// ── CHECK constraints ────────────────────────────────────────────────────────
// Added via DO blocks because Postgres has no ADD CONSTRAINT IF NOT EXISTS.
function addCheck(table: string, name: string, expr: string): string {
  return `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
       ALTER TABLE "${table}" ADD CONSTRAINT "${name}" CHECK (${expr});
     END IF;
   END $$;`;
}

const CHECKS: string[] = [
  // ── AC #1 — a chemical cannot reach ACTIVE without an SDS attachment. ──────
  // This is the whole of business rule §1, enforced where a form cannot reach.
  addCheck(
    "ChemicalMaster",
    "ck_ChemicalMaster_active_requires_sds",
    `"status" <> 'ACTIVE' OR "sdsAttachmentId" IS NOT NULL`
  ),
  addCheck(
    "ChemicalMaster",
    "ck_ChemicalMaster_status",
    `"status" IN ('PENDING_SDS','ACTIVE','INACTIVE','RESTRICTED')`
  ),
  addCheck(
    "ChemicalMaster",
    "ck_ChemicalMaster_physical_state",
    `"physicalState" IN ('SOLID','LIQUID','GAS')`
  ),
  // The SDS is evidence, never a data source. Anything claiming an extracted
  // classification in this module is a bug — the extraction capability is a
  // separate gated add-on (§0) and this constraint is the tripwire.
  addCheck(
    "ChemicalMaster",
    "ck_ChemicalMaster_classification_source",
    `"hazardClassificationSource" IN ('MANUAL','IMPORTED')`
  ),

  addCheck(
    "ChemicalInventoryTransaction",
    "ck_ChemInvTxn_type",
    `"type" IN ('RECEIPT','ISSUE','TRANSFER_IN','TRANSFER_OUT','DISPOSAL','ADJUSTMENT')`
  ),
  addCheck("ChemicalInventoryTransaction", "ck_ChemInvTxn_qty_positive", `"quantity" > 0`),
  // signedQuantity must agree with type, or the trigger's SUM is quietly wrong
  // in whichever direction the caller got backwards.
  addCheck(
    "ChemicalInventoryTransaction",
    "ck_ChemInvTxn_sign_matches_type",
    `("type" IN ('RECEIPT','TRANSFER_IN')  AND "signedQuantity" = "quantity")
     OR ("type" IN ('ISSUE','TRANSFER_OUT','DISPOSAL') AND "signedQuantity" = -"quantity")
     OR ("type" = 'ADJUSTMENT' AND abs("signedQuantity") = "quantity")`
  ),

  addCheck(
    "ChemicalInventoryItem",
    "ck_ChemInvItem_status",
    `"currentStatus" IN ('IN_STOCK','LOW','EXPIRED','DISPOSED')`
  ),
  // A negative balance means the ledger disagrees with physical reality — an
  // issue larger than stock on hand. Rejecting it at commit is the point: the
  // alternative is a register that silently reports minus 40 litres.
  addCheck("ChemicalInventoryItem", "ck_ChemInvItem_qty_non_negative", `"quantityLedger" >= 0`),

  addCheck(
    "ChemicalStorageLocation",
    "ck_ChemStorageLoc_type",
    `"storageType" IN ('FLAMMABLE_CABINET','VENTILATED_STORE','COLD_STORE','GENERAL','OUTDOOR_BUND')`
  ),

  addCheck(
    "ChemicalIncompatibilityRule",
    "ck_ChemIncompat_severity",
    `"severity" IN ('BLOCK','WARN')`
  ),
  // A rule must actually name a pair. A row with all four columns null matches
  // every chemical against every other and would block the whole store.
  addCheck(
    "ChemicalIncompatibilityRule",
    "ck_ChemIncompat_pair_present",
    `("hazardClassA" IS NOT NULL AND "hazardClassB" IS NOT NULL)
     OR ("chemicalIdA" IS NOT NULL AND "chemicalIdB" IS NOT NULL)`
  ),

  addCheck(
    "ChemicalThresholdRule",
    "ck_ChemThresholdRule_obligation",
    `"triggerObligation" IN ('ON_SITE_EMERGENCY_PLAN','OFF_SITE_EMERGENCY_PLAN','SAFETY_REPORT','LICENSE_UPGRADE')`
  ),
  addCheck("ChemicalThresholdRule", "ck_ChemThresholdRule_qty", `"thresholdQuantity" > 0`),
  addCheck(
    "ChemicalThresholdRule",
    "ck_ChemThresholdRule_approach",
    `"approachRatio" > 0 AND "approachRatio" <= 1`
  ),
  addCheck(
    "ChemicalThresholdRule",
    "ck_ChemThresholdRule_scope",
    `"hazardClass" IS NOT NULL OR "chemicalId" IS NOT NULL`
  ),

  addCheck(
    "ChemicalThresholdState",
    "ck_ChemThresholdState_status",
    `"status" IN ('BELOW','APPROACHING','BREACHED')`
  ),

  addCheck(
    "MocTriggerLog",
    "ck_MocTriggerLog_status",
    `"status" IN ('FIRED','FAILED','SKIPPED')`
  ),
  // The spec's words: failureReason "must never be silently empty on a
  // failure". btrim rather than IS NOT NULL — an empty string is exactly as
  // useless as a null and is what a careless caller actually writes.
  addCheck(
    "MocTriggerLog",
    "ck_MocTriggerLog_failure_reason_present",
    `"status" <> 'FAILED' OR ("failureReason" IS NOT NULL AND btrim("failureReason") <> '')`
  ),
  // A FIRED trigger that produced no MOC is a contradiction; catching it here
  // stops the trigger-log dashboard from reporting success for nothing.
  addCheck(
    "MocTriggerLog",
    "ck_MocTriggerLog_fired_has_moc",
    `"status" <> 'FIRED' OR "mocId" IS NOT NULL`
  ),

  addCheck("ChemicalDisposalRecord", "ck_ChemDisposal_qty", `"quantity" > 0`),
  // §4.7 — manifest reference + vendor are required. NOT NULL alone permits ''.
  addCheck(
    "ChemicalDisposalRecord",
    "ck_ChemDisposal_manifest_present",
    `btrim("manifestReference") <> '' AND btrim("disposalVendor") <> ''`
  ),
];

// ── triggers ─────────────────────────────────────────────────────────────────
const TRIGGERS: string[] = [
  // ═══ AC #2 — inventory quantity is fully ledger-derived ═══════════════════
  //
  // Part 1: recompute the balance (and the derived status, and the parent
  // location's occupancy) from the ledger whenever the ledger changes.
  //
  // `SET LOCAL safeops.chem_ledger_recompute = 'on'` marks the update as
  // legitimate for the guard in Part 2. A transaction-local GUC is the right
  // scope: it cannot leak to another session, and it is reset at COMMIT.
  `CREATE OR REPLACE FUNCTION "chem_recompute_item_balance"() RETURNS TRIGGER AS $$
   DECLARE
     v_item_id   TEXT;
     v_balance   DOUBLE PRECISION;
     v_item      "ChemicalInventoryItem"%ROWTYPE;
     v_status    TEXT;
   BEGIN
     v_item_id := COALESCE(NEW."itemId", OLD."itemId");

     SELECT COALESCE(SUM("signedQuantity"), 0) INTO v_balance
       FROM "ChemicalInventoryTransaction" WHERE "itemId" = v_item_id;

     SELECT * INTO v_item FROM "ChemicalInventoryItem" WHERE "id" = v_item_id;
     IF NOT FOUND THEN RETURN NULL; END IF;

     -- Derived status. Order matters: DISPOSED is terminal and must win over
     -- EXPIRED, or a disposed drum reappears on the expiry report forever.
     IF v_balance <= 0 THEN
       v_status := 'DISPOSED';
     ELSIF v_item."expiryDate" IS NOT NULL AND v_item."expiryDate" < now() THEN
       v_status := 'EXPIRED';
     ELSIF v_item."lowStockThreshold" IS NOT NULL AND v_balance <= v_item."lowStockThreshold" THEN
       v_status := 'LOW';
     ELSE
       v_status := 'IN_STOCK';
     END IF;

     PERFORM set_config('safeops.chem_ledger_recompute', 'on', true);
     UPDATE "ChemicalInventoryItem"
        SET "quantityLedger" = v_balance,
            "currentStatus"  = v_status,
            "updatedAt"      = now()
      WHERE "id" = v_item_id;
     PERFORM set_config('safeops.chem_ledger_recompute', 'off', true);

     -- Storage occupancy is the same derived quantity one level up.
     IF v_item."storageLocationId" IS NOT NULL THEN
       UPDATE "ChemicalStorageLocation" l
          SET "currentOccupancy" = COALESCE((
                SELECT SUM(i."quantityLedger") FROM "ChemicalInventoryItem" i
                 WHERE i."storageLocationId" = l."id" AND i."isDeleted" = false
              ), 0)
        WHERE l."id" = v_item."storageLocationId";
     END IF;

     RETURN NULL;
   END $$ LANGUAGE plpgsql`,

  `DROP TRIGGER IF EXISTS "trg_chem_ledger_recompute" ON "ChemicalInventoryTransaction"`,
  `CREATE TRIGGER "trg_chem_ledger_recompute"
     AFTER INSERT OR UPDATE OR DELETE ON "ChemicalInventoryTransaction"
     FOR EACH ROW EXECUTE FUNCTION "chem_recompute_item_balance"()`,

  // Part 2 — the guard that makes "no direct-edit path exists" true rather than
  // aspirational. Any UPDATE that changes quantityLedger or currentStatus
  // without the recompute GUC set is rejected outright.
  `CREATE OR REPLACE FUNCTION "chem_block_direct_quantity_edit"() RETURNS TRIGGER AS $$
   BEGIN
     IF current_setting('safeops.chem_ledger_recompute', true) = 'on' THEN
       RETURN NEW;
     END IF;
     IF NEW."quantityLedger" IS DISTINCT FROM OLD."quantityLedger" THEN
       RAISE EXCEPTION
         'ChemicalInventoryItem.quantityLedger is ledger-derived and cannot be set directly (item %). Post a ChemicalInventoryTransaction instead.',
         OLD."id"
         USING ERRCODE = 'check_violation';
     END IF;
     IF NEW."currentStatus" IS DISTINCT FROM OLD."currentStatus" THEN
       RAISE EXCEPTION
         'ChemicalInventoryItem.currentStatus is derived from the ledger and cannot be set directly (item %).',
         OLD."id"
         USING ERRCODE = 'check_violation';
     END IF;
     RETURN NEW;
   END $$ LANGUAGE plpgsql`,

  `DROP TRIGGER IF EXISTS "trg_chem_block_direct_quantity_edit" ON "ChemicalInventoryItem"`,
  `CREATE TRIGGER "trg_chem_block_direct_quantity_edit"
     BEFORE UPDATE ON "ChemicalInventoryItem"
     FOR EACH ROW EXECUTE FUNCTION "chem_block_direct_quantity_edit"()`,

  // A changed expiryDate or lowStockThreshold changes the derived status, so
  // re-derive rather than leaving the row stale. Runs AFTER, and re-enters the
  // guarded UPDATE through the same GUC.
  `CREATE OR REPLACE FUNCTION "chem_rederive_item_status"() RETURNS TRIGGER AS $$
   DECLARE v_status TEXT;
   BEGIN
     IF NEW."expiryDate" IS NOT DISTINCT FROM OLD."expiryDate"
        AND NEW."lowStockThreshold" IS NOT DISTINCT FROM OLD."lowStockThreshold"
        AND NEW."storageLocationId" IS NOT DISTINCT FROM OLD."storageLocationId" THEN
       RETURN NULL;
     END IF;

     IF NEW."quantityLedger" <= 0 THEN
       v_status := 'DISPOSED';
     ELSIF NEW."expiryDate" IS NOT NULL AND NEW."expiryDate" < now() THEN
       v_status := 'EXPIRED';
     ELSIF NEW."lowStockThreshold" IS NOT NULL AND NEW."quantityLedger" <= NEW."lowStockThreshold" THEN
       v_status := 'LOW';
     ELSE
       v_status := 'IN_STOCK';
     END IF;

     IF v_status IS DISTINCT FROM NEW."currentStatus" THEN
       PERFORM set_config('safeops.chem_ledger_recompute', 'on', true);
       UPDATE "ChemicalInventoryItem" SET "currentStatus" = v_status WHERE "id" = NEW."id";
       PERFORM set_config('safeops.chem_ledger_recompute', 'off', true);
     END IF;
     RETURN NULL;
   END $$ LANGUAGE plpgsql`,

  `DROP TRIGGER IF EXISTS "trg_chem_rederive_item_status" ON "ChemicalInventoryItem"`,
  `CREATE TRIGGER "trg_chem_rederive_item_status"
     AFTER UPDATE ON "ChemicalInventoryItem"
     FOR EACH ROW EXECUTE FUNCTION "chem_rederive_item_status"()`,

  // The ledger is append-only. A correction is a compensating ADJUSTMENT row,
  // not an edit — that is what makes a stock-verification audit worth running.
  `CREATE OR REPLACE FUNCTION "chem_ledger_append_only"() RETURNS TRIGGER AS $$
   BEGIN
     RAISE EXCEPTION
       'ChemicalInventoryTransaction is append-only (attempted % on %). Post a compensating ADJUSTMENT transaction instead.',
       TG_OP, OLD."id"
       USING ERRCODE = 'check_violation';
   END $$ LANGUAGE plpgsql`,

  `DROP TRIGGER IF EXISTS "trg_chem_ledger_append_only" ON "ChemicalInventoryTransaction"`,
  `CREATE TRIGGER "trg_chem_ledger_append_only"
     BEFORE UPDATE OR DELETE ON "ChemicalInventoryTransaction"
     FOR EACH ROW EXECUTE FUNCTION "chem_ledger_append_only"()`,

  // ═══ AC #4 — incompatibility BLOCK severity actually prevents save ════════
  //
  // DEFERRABLE INITIALLY DEFERRED, fired at COMMIT, and it RE-READS the row
  // rather than trusting NEW — the same reasoning as the Fire & Life Safety
  // CAPA constraint. The legal ordering is: insert the item, assign its
  // location, then (possibly) move it again within the same transaction. A
  // per-statement trigger would reject the intermediate state of a legitimate
  // re-shelving; the assertion we actually want is about the state at COMMIT.
  //
  // Only items with stock on hand are considered: an emptied drum still sitting
  // in the row is not a co-storage hazard, and treating it as one would make
  // the store un-loadable for reasons nobody can see.
  `CREATE OR REPLACE FUNCTION "chem_assert_no_blocked_costorage"() RETURNS TRIGGER AS $$
   DECLARE
     v_item      "ChemicalInventoryItem"%ROWTYPE;
     v_conflict  RECORD;
   BEGIN
     SELECT * INTO v_item FROM "ChemicalInventoryItem" WHERE "id" = NEW."id";
     IF NOT FOUND OR v_item."isDeleted" OR v_item."storageLocationId" IS NULL
        OR v_item."quantityLedger" <= 0 THEN
       RETURN NULL;
     END IF;

     SELECT other."id" AS other_id, oc."name" AS other_name, mc."name" AS this_name,
            r."regulatoryReference" AS reg_ref
       INTO v_conflict
       FROM "ChemicalInventoryItem" other
       JOIN "ChemicalMaster" oc ON oc."id" = other."chemicalId"
       JOIN "ChemicalMaster" mc ON mc."id" = v_item."chemicalId"
       JOIN "ChemicalIncompatibilityRule" r
         ON r."isActive" AND NOT r."isDeleted" AND r."severity" = 'BLOCK'
        AND (
              -- specific-chemical pair, either direction
              (r."chemicalIdA" = mc."id" AND r."chemicalIdB" = oc."id")
           OR (r."chemicalIdA" = oc."id" AND r."chemicalIdB" = mc."id")
              -- or hazard-class pair, either direction
           OR (r."chemicalIdA" IS NULL AND r."chemicalIdB" IS NULL
               AND ((mc."hazardClasses" ? r."hazardClassA" AND oc."hazardClasses" ? r."hazardClassB")
                 OR (mc."hazardClasses" ? r."hazardClassB" AND oc."hazardClasses" ? r."hazardClassA")))
            )
      WHERE other."id" <> v_item."id"
        AND other."storageLocationId" = v_item."storageLocationId"
        AND other."isDeleted" = false
        AND other."quantityLedger" > 0
      LIMIT 1;

     IF FOUND THEN
       RAISE EXCEPTION
         'Co-storage blocked: % cannot share a storage location with % (rule severity BLOCK%).',
         v_conflict.this_name, v_conflict.other_name,
         COALESCE(', ' || v_conflict.reg_ref, '')
         USING ERRCODE = 'check_violation';
     END IF;
     RETURN NULL;
   END $$ LANGUAGE plpgsql`,

  `DROP TRIGGER IF EXISTS "trg_chem_assert_no_blocked_costorage" ON "ChemicalInventoryItem"`,
  `CREATE CONSTRAINT TRIGGER "trg_chem_assert_no_blocked_costorage"
     AFTER INSERT OR UPDATE ON "ChemicalInventoryItem"
     DEFERRABLE INITIALLY DEFERRED
     FOR EACH ROW EXECUTE FUNCTION "chem_assert_no_blocked_costorage"()`,
];

// ── platform-default config rows ─────────────────────────────────────────────
// tenantId IS NULL = platform default, inherited by every tenant and overridable
// per tenant without a deploy (business rule §2).
//
// SOURCE + CAVEAT: quantities below follow the Manufacture, Storage and Import
// of Hazardous Chemical Rules 1989 (MSIHC) Schedule 2/3 structure. They are
// seeded as a STARTING POINT for configuration, not as legal advice, and the
// module is built so a compliance officer edits them as data. Verify against the
// current gazette for the site's specific chemicals before go-live.
const SEED_THRESHOLDS = [
  { ref: "MSIHC Schedule 2 — Flammable", cls: "FLAMMABLE", qty: 10_000, unit: "KG", ob: "ON_SITE_EMERGENCY_PLAN" },
  { ref: "MSIHC Schedule 3 — Flammable (major accident)", cls: "FLAMMABLE", qty: 50_000, unit: "KG", ob: "OFF_SITE_EMERGENCY_PLAN" },
  { ref: "MSIHC Schedule 2 — Toxic", cls: "TOXIC", qty: 1_000, unit: "KG", ob: "ON_SITE_EMERGENCY_PLAN" },
  { ref: "MSIHC Schedule 3 — Toxic (major accident)", cls: "TOXIC", qty: 20_000, unit: "KG", ob: "SAFETY_REPORT" },
  { ref: "MSIHC Schedule 2 — Oxidizer", cls: "OXIDIZER", qty: 5_000, unit: "KG", ob: "ON_SITE_EMERGENCY_PLAN" },
  { ref: "MSIHC Schedule 2 — Explosive", cls: "EXPLOSIVE", qty: 500, unit: "KG", ob: "LICENSE_UPGRADE" },
  { ref: "PESO/Explosives Rules — Compressed gas licence category", cls: "COMPRESSED_GAS", qty: 1_000, unit: "KG", ob: "LICENSE_UPGRADE" },
  { ref: "MSIHC Schedule 2 — Corrosive", cls: "CORROSIVE", qty: 20_000, unit: "KG", ob: "ON_SITE_EMERGENCY_PLAN" },
];

// Class-level co-storage matrix. BLOCK vs WARN is the difference between "this
// combination has killed people" and "this needs a competent person's sign-off",
// so the BLOCK set is kept deliberately small and defensible.
const SEED_INCOMPAT: Array<[string, string, "BLOCK" | "WARN", string]> = [
  ["FLAMMABLE", "OXIDIZER", "BLOCK", "NFPA 400 / MSIHC Sch.1 — oxidiser accelerates flammable combustion"],
  ["FLAMMABLE", "EXPLOSIVE", "BLOCK", "Explosives Rules 2008 — segregation of explosives from flammables"],
  ["OXIDIZER", "REACTIVE", "BLOCK", "NFPA 400 — oxidiser/reactive incompatible storage"],
  ["WATER_REACTIVE", "CORROSIVE", "BLOCK", "Aqueous corrosive spill onto water-reactive solid"],
  ["PYROPHORIC", "FLAMMABLE", "BLOCK", "NFPA 400 — pyrophoric ignition source adjacent to flammables"],
  ["CORROSIVE", "TOXIC", "WARN", "Corrosive breach of a toxic container — segregate or bund separately"],
  ["FLAMMABLE", "TOXIC", "WARN", "Fire involving toxics escalates to an off-site consequence"],
  ["COMPRESSED_GAS", "FLAMMABLE", "WARN", "Cylinder BLEVE risk in a flammable-liquid fire"],
  ["OXIDIZER", "CARCINOGEN", "WARN", "Segregate to limit combustion products of a carcinogen"],
];

// IDs are generated here rather than with gen_random_uuid() in SQL: that
// function only exists unqualified on PG13+ (or with pgcrypto installed), and a
// seed that fails on a customer's PG12 is a worse trade than four lines of TS.
// Format matches app/models/_base.py's gen_id() — uuid4 hex, no dashes.
function genId(): string {
  return [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function seedDefaults(): Promise<void> {
  for (const t of SEED_THRESHOLDS) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ChemicalThresholdRule"
         ("id","tenantId","region","hazardClass","scheduleReference","thresholdQuantity",
          "unit","approachRatio","triggerObligation","autoMocOnBreach","createdBy")
       SELECT $1, NULL, 'IN', $2, $3, $4, $5, 0.8, $6, true, 'system-seed'
        WHERE NOT EXISTS (
          SELECT 1 FROM "ChemicalThresholdRule"
           WHERE "tenantId" IS NULL AND "region" = 'IN' AND "scheduleReference" = $3
        )`,
      genId(), t.cls, t.ref, t.qty, t.unit, t.ob
    );
  }
  for (const [a, b, sev, why] of SEED_INCOMPAT) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ChemicalIncompatibilityRule"
         ("id","tenantId","hazardClassA","hazardClassB","severity","regulatoryReference","rationale","createdBy")
       SELECT $1, NULL, $2, $3, $4, $5, $5, 'system-seed'
        WHERE NOT EXISTS (
          SELECT 1 FROM "ChemicalIncompatibilityRule"
           WHERE "tenantId" IS NULL
             AND (("hazardClassA" = $2 AND "hazardClassB" = $3)
               OR ("hazardClassA" = $3 AND "hazardClassB" = $2))
        )`,
      genId(), a, b, sev, why
    );
  }

  // CAMS audit type for periodic stock verification (§4.6) — reuse of the
  // existing audit engine, NOT a parallel inspection engine.
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CamsAuditType"
       ("id","typeCode","name","engagementType","requiresAssetRef","requiresAuditorCompetency",
        "competenceEnforcement","standardRefs","isActive","createdAt","updatedAt","isDeleted","createdBy")
     SELECT $1,'CHEMICAL_STOCK_VERIFICATION','Chemical Stock Verification',
            'INSPECTION', true, '[]'::json, 'WARN',
            '["MSIHC Rules 1989","Hazardous & Other Wastes (M&TM) Rules 2016"]'::json,
            true, now(), now(), false, 'system-seed'
      WHERE NOT EXISTS (SELECT 1 FROM "CamsAuditType" WHERE "typeCode" = 'CHEMICAL_STOCK_VERIFICATION')`,
    genId()
  );
}

async function main() {
  const groups: Array<[string, string[]]> = [
    ["tables", TABLES],
    ["indexes", INDEXES],
    ["checks", CHECKS],
    ["triggers", TRIGGERS],
  ];
  for (const [label, statements] of groups) {
    console.log(`\n── ${label} ─────────────────────────────`);
    for (const sql of statements) {
      const short = sql.replace(/\s+/g, " ").slice(0, 88);
      try {
        await prisma.$executeRawUnsafe(sql);
        console.log(`  ✓ ${short}`);
      } catch (e: any) {
        console.error(`  ✗ ${short}\n    ${e?.message ?? e}`);
        throw e;
      }
    }
  }
  console.log(`\n── platform defaults ────────────────────`);
  await seedDefaults();
  console.log("  ✓ threshold rules, incompatibility matrix, CAMS audit type");
  console.log("\nChemical module DDL applied.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
