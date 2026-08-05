// One-off DDL applier for the DuPont STOP observation taxonomy:
//   • ObservationTaxonomy          — category/sub-category master, per act/condition axis
//   • UnmappedLegacyObservation    — migration review queue
//   • Observation.categoryCode / .subCategoryCode / .taxonomyAxis
//   • 4 new ObservationCategory enum values (STOP codes that had no legacy twin)
//   • composite FK enforcing "sub-category belongs to this axis" at the DB level
//
// Mirrors prisma/apply-capture-ddl.ts: additive, idempotent (every statement
// tolerates "already exists"), applied through the Prisma client's connection
// because `prisma db execute` / `migrate diff` hang against the pooler in this
// environment, and `prisma db push` would drop the drifted hand-DDL tables.
//   npx tsx prisma/apply-observation-taxonomy-ddl.ts
//
// ORDER MATTERS. Run this BEFORE restarting uvicorn — the SQLAlchemy
// Observation model now maps categoryCode/subCategoryCode/taxonomyAxis, and
// SELECT lists every mapped column, so *every* Observation query 500s until
// these columns exist. Then: db:seed-observation-taxonomy, then (optionally)
// migrate-observation-taxonomy.ts.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ALTER TYPE ... ADD VALUE cannot run in the same transaction that uses the new
// value, so these go first and on their own. IF NOT EXISTS makes re-runs a
// no-op. PPE and HOUSEKEEPING already exist as legacy hazard categories and are
// reused as-is by STOP-3 / STOP-6.
const ENUM_VALUES = [
  "REACTIONS_OF_PEOPLE",
  "POSITIONS_OF_PEOPLE",
  "TOOLS_EQUIPMENT",
  "PROCEDURES",
];

const STATEMENTS: string[] = [
  // ── ObservationTaxonomy ──
  `CREATE TABLE IF NOT EXISTS "ObservationTaxonomy" (
    "id" TEXT NOT NULL,
    "categoryCode" TEXT NOT NULL,
    "categoryLabel" TEXT NOT NULL,
    "observationType" TEXT NOT NULL,
    "subCategoryCode" TEXT NOT NULL,
    "subCategoryLabel" TEXT NOT NULL,
    "stopReferenceCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ObservationTaxonomy_pkey" PRIMARY KEY ("id")
  )`,
  // Idempotent seed key AND the target of Observation's composite FK.
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_ObservationTaxonomy_cat_sub_type"
     ON "ObservationTaxonomy"("categoryCode", "subCategoryCode", "observationType")`,
  // The lookup the categories/subcategories endpoints run on every form load.
  `CREATE INDEX IF NOT EXISTS "ix_ObservationTaxonomy_cat_type_active"
     ON "ObservationTaxonomy"("categoryCode", "observationType", "isActive")`,
  `CREATE INDEX IF NOT EXISTS "ix_ObservationTaxonomy_observationType"
     ON "ObservationTaxonomy"("observationType")`,
  `CREATE INDEX IF NOT EXISTS "ix_ObservationTaxonomy_isActive"
     ON "ObservationTaxonomy"("isActive")`,
  // Guard the axis vocabulary at the DB level — a typo'd 'CONDITIONS' row would
  // otherwise silently vanish from every dropdown with no error anywhere.
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ObservationTaxonomy_observationType_check') THEN
       ALTER TABLE "ObservationTaxonomy" ADD CONSTRAINT "ObservationTaxonomy_observationType_check"
         CHECK ("observationType" IN ('ACT', 'CONDITION'));
     END IF;
   END $$`,

  // ── UnmappedLegacyObservation (migration review queue) ──
  `CREATE TABLE IF NOT EXISTS "UnmappedLegacyObservation" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "observationNumber" TEXT NOT NULL,
    "observationType" TEXT NOT NULL,
    "legacyCategory" TEXT,
    "reason" TEXT NOT NULL,
    "suggestedCategoryCode" TEXT,
    "suggestedAxis" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UnmappedLegacyObservation_pkey" PRIMARY KEY ("id")
  )`,
  // One open review row per observation — lets the migration re-run cleanly.
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_UnmappedLegacyObservation_observationId"
     ON "UnmappedLegacyObservation"("observationId")`,
  `CREATE INDEX IF NOT EXISTS "ix_UnmappedLegacyObservation_reason"
     ON "UnmappedLegacyObservation"("reason")`,

  // ── Observation taxonomy columns ──
  `ALTER TABLE "Observation" ADD COLUMN IF NOT EXISTS "categoryCode" TEXT`,
  `ALTER TABLE "Observation" ADD COLUMN IF NOT EXISTS "subCategoryCode" TEXT`,
  `ALTER TABLE "Observation" ADD COLUMN IF NOT EXISTS "taxonomyAxis" TEXT`,
  `CREATE INDEX IF NOT EXISTS "ix_Observation_categoryCode" ON "Observation"("categoryCode")`,
  `CREATE INDEX IF NOT EXISTS "ix_Observation_subCategoryCode" ON "Observation"("subCategoryCode")`,
  `CREATE INDEX IF NOT EXISTS "ix_Observation_taxonomyAxis" ON "Observation"("taxonomyAxis")`,
  `CREATE INDEX IF NOT EXISTS "ix_Observation_categoryCode_taxonomyAxis"
     ON "Observation"("categoryCode", "taxonomyAxis")`,

  // taxonomyAxis must agree with `type`. This is what stops a bad write from
  // satisfying the FK against the WRONG axis (e.g. an UNSAFE_CONDITION row
  // carrying taxonomyAxis='ACT' so it can point at a Positions-of-People
  // sub-category). NULL passes — safe observations and legacy rows.
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Observation_taxonomyAxis_matches_type') THEN
       ALTER TABLE "Observation" ADD CONSTRAINT "Observation_taxonomyAxis_matches_type"
         CHECK (
           "taxonomyAxis" IS NULL
           OR ("taxonomyAxis" = 'ACT'       AND "type"::text IN ('SAFE_ACT', 'UNSAFE_ACT'))
           OR ("taxonomyAxis" = 'CONDITION' AND "type"::text IN ('SAFE_CONDITION', 'UNSAFE_CONDITION'))
         );
     END IF;
   END $$`,

  // The schema-level validator the spec asks for, as a real DB constraint:
  // a sub-category can only be attached to a record whose axis matches the
  // taxonomy row's own observationType. MATCH SIMPLE (the default) means the
  // check is skipped when any of the three columns is NULL, which is exactly
  // what safe observations and unmigrated legacy rows need.
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Observation_stopTaxonomy_fkey') THEN
       ALTER TABLE "Observation" ADD CONSTRAINT "Observation_stopTaxonomy_fkey"
         FOREIGN KEY ("categoryCode", "subCategoryCode", "taxonomyAxis")
         REFERENCES "ObservationTaxonomy"("categoryCode", "subCategoryCode", "observationType")
         ON DELETE RESTRICT ON UPDATE CASCADE;
     END IF;
   END $$`,
];

async function main() {
  console.log("Applying DuPont STOP observation taxonomy DDL…");

  // Enum values first, each on its own statement — see note above.
  for (const value of ENUM_VALUES) {
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "ObservationCategory" ADD VALUE IF NOT EXISTS '${value}'`
    );
    console.log(`  ✓ enum ObservationCategory += ${value}`);
  }

  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 72);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }

  const counts: Record<string, bigint> = {};
  for (const table of ["ObservationTaxonomy", "UnmappedLegacyObservation", "Observation"]) {
    const r = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
      `SELECT count(*)::bigint AS c FROM "${table}"`
    );
    counts[table] = r[0].c;
  }
  const untagged = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT count(*)::bigint AS c FROM "Observation"
      WHERE "type"::text IN ('UNSAFE_ACT', 'UNSAFE_CONDITION') AND "categoryCode" IS NULL`
  );

  console.log(
    "✅  Tables ready:",
    Object.entries(counts).map(([t, c]) => `${t}=${c}`).join(", ")
  );
  console.log(
    `ℹ️   ${untagged[0].c} at-risk observation(s) have no STOP category yet.\n` +
      "    Next: npm run db:seed-observation-taxonomy\n" +
      "    Then: npx tsx prisma/migrate-observation-taxonomy.ts   (dry-run; add --apply to write)\n" +
      "    Then: restart uvicorn."
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
