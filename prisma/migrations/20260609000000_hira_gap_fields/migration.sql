-- G16 (ISO 45001 cl.6.1.2.1): consequence per hazard occurrence
ALTER TABLE "HiraEntryHazard" ADD COLUMN "consequence" TEXT;

-- G19: document reference link when evidence is on file
ALTER TABLE "HiraEntryControl" ADD COLUMN "documentReference" VARCHAR(500);

-- G13: affected person groups free-text per entry
ALTER TABLE "HiraEntry" ADD COLUMN "affectedPersonGroups" TEXT;
