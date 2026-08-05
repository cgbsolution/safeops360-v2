-- Additive DDL for the Facilities module (FactoryProfile + Building).
--
-- Applied directly (prisma db execute) instead of `prisma db push` because the
-- live DB carries Cams* tables managed outside schema.prisma (migrate-cams.ts),
-- so a full `db push` would try to DROP them. This script ONLY creates the two
-- new tables + indexes, matching Prisma's Postgres type mapping (timestamp(3),
-- jsonb) so both the Prisma client and the SQLAlchemy backend read them like
-- every other Prisma-owned table. Idempotent (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "FactoryProfile" (
  "id"                       TEXT NOT NULL,
  "siteId"                   TEXT NOT NULL,
  "factoryCode"              TEXT NOT NULL,
  "factoryName"              TEXT NOT NULL,
  "status"                   TEXT NOT NULL DEFAULT 'OPERATIONAL',
  "ownershipType"            TEXT NOT NULL DEFAULT 'OWNED',
  "addressLine"              TEXT NOT NULL DEFAULT '',
  "city"                     TEXT NOT NULL DEFAULT '',
  "state"                    TEXT NOT NULL DEFAULT '',
  "pincode"                  TEXT NOT NULL DEFAULT '',
  "latitude"                 DOUBLE PRECISION,
  "longitude"                DOUBLE PRECISION,
  "establishedYear"          INTEGER,
  "factoryLicenseNo"         TEXT,
  "factoryLicenseValidUntil" TIMESTAMP(3),
  "registrationNos"          JSONB NOT NULL DEFAULT '[]',
  "applicableActs"           JSONB NOT NULL DEFAULT '[]',
  "pollutionControlBoard"    TEXT,
  "totalLandAreaSqm"         DOUBLE PRECISION,
  "builtUpAreaSqm"           DOUBLE PRECISION,
  "buildingCount"            INTEGER NOT NULL DEFAULT 0,
  "totalEmployees"           INTEGER NOT NULL DEFAULT 0,
  "primaryIndustry"          TEXT NOT NULL DEFAULT 'Garments / Textile',
  "profileStatus"            TEXT NOT NULL DEFAULT 'DRAFT',
  "lastReviewedAt"           TIMESTAMP(3),
  "nextReviewDate"           TIMESTAMP(3),
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy"                TEXT,
  "updatedAt"                TIMESTAMP(3) NOT NULL,
  "updatedBy"                TEXT,
  "isDeleted"                BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "FactoryProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FactoryProfile_siteId_key" ON "FactoryProfile" ("siteId");
CREATE UNIQUE INDEX IF NOT EXISTS "FactoryProfile_factoryCode_key" ON "FactoryProfile" ("factoryCode");
CREATE INDEX IF NOT EXISTS "FactoryProfile_state_idx" ON "FactoryProfile" ("state");
CREATE INDEX IF NOT EXISTS "FactoryProfile_status_idx" ON "FactoryProfile" ("status");
CREATE INDEX IF NOT EXISTS "FactoryProfile_profileStatus_idx" ON "FactoryProfile" ("profileStatus");

CREATE TABLE IF NOT EXISTS "Building" (
  "id"                     TEXT NOT NULL,
  "factoryProfileId"       TEXT NOT NULL,
  "siteId"                 TEXT NOT NULL,
  "buildingName"           TEXT NOT NULL,
  "buildingType"           TEXT NOT NULL DEFAULT 'PRODUCTION',
  "floors"                 INTEGER NOT NULL DEFAULT 1,
  "areaSqm"                DOUBLE PRECISION,
  "maxOccupancy"           INTEGER,
  "currentOccupancy"       INTEGER,
  "yearBuilt"              INTEGER,
  "assemblyPoint"          TEXT,
  "emergencyExits"         INTEGER,
  "occupancyCertificateNo" TEXT,
  "isActive"               BOOLEAN NOT NULL DEFAULT true,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy"              TEXT,
  "updatedAt"              TIMESTAMP(3) NOT NULL,
  "updatedBy"              TEXT,
  "isDeleted"              BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Building_factoryProfileId_idx" ON "Building" ("factoryProfileId");
CREATE INDEX IF NOT EXISTS "Building_siteId_idx" ON "Building" ("siteId");
CREATE INDEX IF NOT EXISTS "Building_buildingType_idx" ON "Building" ("buildingType");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Building_factoryProfileId_fkey'
  ) THEN
    ALTER TABLE "Building"
      ADD CONSTRAINT "Building_factoryProfileId_fkey"
      FOREIGN KEY ("factoryProfileId") REFERENCES "FactoryProfile" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
