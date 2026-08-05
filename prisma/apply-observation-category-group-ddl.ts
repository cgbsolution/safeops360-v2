// DDL for ObservationCategoryGroup — the DuPont STOP category →
// Behavioural | Physical mapping that drives the SLA closure-date matrix.
//
// Follow-up to apply-observation-sla-ddl.ts. The first build derived the group
// from the act/condition axis in code; this makes it configuration, adds an
// explicit PENDING_DECISION sentinel for categories nobody has classified yet,
// and keeps the axis derivation only as a fallback for observations that carry
// no STOP category at all (the SAFE_* types).
//
//   npx tsx prisma/apply-observation-category-group-ddl.ts
//
// Additive and idempotent. Safe to run before or after the SLA DDL — it
// references no other new table. Run the seed after this.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "ObservationCategoryGroup" (
    "id" TEXT NOT NULL,
    "categoryCode" TEXT NOT NULL,
    "axis" TEXT NOT NULL DEFAULT 'ANY',
    "categoryGroup" TEXT NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    CONSTRAINT "ObservationCategoryGroup_pkey" PRIMARY KEY ("id")
  )`,
  // One mapping per category per axis. 'ANY' is itself a valid axis value, so
  // a plain composite unique works here — no partial index needed.
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_ObservationCategoryGroup_cat_axis"
     ON "ObservationCategoryGroup"("categoryCode", "axis")`,
  `CREATE INDEX IF NOT EXISTS "ix_ObservationCategoryGroup_lookup"
     ON "ObservationCategoryGroup"("categoryCode", "isActive")`,
  // PENDING_DECISION is deliberately allowed: it is how an undecided category
  // is represented, and the resolver turns it into "no SLA, set manually".
  `DO $$ BEGIN
     ALTER TABLE "ObservationCategoryGroup"
       ADD CONSTRAINT "ck_ObservationCategoryGroup_group"
       CHECK ("categoryGroup" IN ('BEHAVIORAL', 'PHYSICAL', 'PENDING_DECISION'));
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
     ALTER TABLE "ObservationCategoryGroup"
       ADD CONSTRAINT "ck_ObservationCategoryGroup_axis"
       CHECK ("axis" IN ('ACT', 'CONDITION', 'ANY'));
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

async function main() {
  console.log("Applying ObservationCategoryGroup DDL…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 78);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }
  const r = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT count(*)::bigint AS c FROM "ObservationCategoryGroup"`
  );
  console.log(`✅  ObservationCategoryGroup ready (${r[0].c} row(s)).`);
  console.log("    Next: npm run db:seed-observation-category-groups");
  console.log("    Then: restart uvicorn.");
}

main()
  .catch((e) => {
    console.error("❌  DDL apply failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
