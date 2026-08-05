-- HIRA Round 3 — outstanding-gap build.
-- Mirrors safeops_360_bakend/scripts/add_hira_round3_columns.py, which is what
-- actually applied these to the live database. Recorded here so Prisma's
-- migration history matches the deployed schema.

-- Hazard-row-grain regulatory citation (distinct from entry-level HiraEntryRegulationRef)
ALTER TABLE "HiraEntryHazard" ADD COLUMN IF NOT EXISTS "regulationRef" VARCHAR(200);
ALTER TABLE "HiraEntryHazard" ADD COLUMN IF NOT EXISTS "regulationSection" VARCHAR(120);

-- Section 6 evidence — mirrors HiraEntryControl's pair exactly
ALTER TABLE "HiraEntryRecommendedControl" ADD COLUMN IF NOT EXISTS "evidenceAttached" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HiraEntryRecommendedControl" ADD COLUMN IF NOT EXISTS "documentReference" VARCHAR(500);

-- Library-level permit gate driving the Create-PTW prompt on a hazard row
ALTER TABLE "HiraHazard" ADD COLUMN IF NOT EXISTS "requiresPermit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HiraHazard" ADD COLUMN IF NOT EXISTS "permitTypes" JSONB;

-- First FK from a permit back to the HIRA row that prompted it
ALTER TABLE "Permit" ADD COLUMN IF NOT EXISTS "hiraEntryId" TEXT;
ALTER TABLE "Permit" ADD COLUMN IF NOT EXISTS "hiraEntryHazardId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Permit" ADD CONSTRAINT "Permit_hiraEntryId_fkey"
    FOREIGN KEY ("hiraEntryId") REFERENCES "HiraEntry"(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Permit" ADD CONSTRAINT "Permit_hiraEntryHazardId_fkey"
    FOREIGN KEY ("hiraEntryHazardId") REFERENCES "HiraEntryHazard"(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "ix_Permit_hiraEntryId" ON "Permit" ("hiraEntryId");
