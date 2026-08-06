// DDL applier for the shared trigger-engine reliability fix. Additive + idempotent.
//
// The Chemical/Hazmat module's core value proposition is an automatic MOC on a
// regulatory-threshold breach. Wiring that to the pattern the platform already
// had would have shipped a second trigger that can fail without anyone finding
// out — so the pattern was fixed first, at the shared level
// (app/services/trigger_engine.py). This script carries the one schema change
// that fix needs.
//
// WHY: Incident post-closure rules produced an audit log that was returned to
// the caller, logged, and then discarded. NearMiss and Observation both persist
// theirs to a `closureTriggers` JSONB column; Incident — the module whose HIRA
// trigger prompted this whole review — did not. That asymmetry is the reason
// "has this trigger ever fired in production?" was a manual investigation
// instead of:
//
//   SELECT count(*) FILTER (WHERE t->>'status' = 'FIRED')
//     FROM "Incident", jsonb_array_elements("closureTriggers") t
//    WHERE t->>'ruleName' = 'HIRA Review Trigger';
//
// Nullable with no default and no backfill: rows closed before this change
// genuinely have no trigger audit, and inventing an empty array for them would
// misrepresent "we never recorded it" as "nothing fired".
//
//   npx tsx prisma/apply-trigger-reliability-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  `ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "closureTriggers" JSONB`,

  // Partial index: the trigger-log dashboard and the acceptance test both ask
  // "which incidents have a FAILED rule?", and the overwhelming majority of
  // rows will never match. Indexing only the non-null column keeps it small.
  `CREATE INDEX IF NOT EXISTS "ix_Incident_closureTriggers"
     ON "Incident" USING GIN ("closureTriggers")
   WHERE "closureTriggers" IS NOT NULL`,
];

async function main() {
  let applied = 0;
  for (const sql of STATEMENTS) {
    const label = sql.replace(/\s+/g, " ").slice(0, 90);
    try {
      await prisma.$executeRawUnsafe(sql);
      applied += 1;
      console.log(`  ✓ ${label}`);
    } catch (e: any) {
      // Fail loudly. A DDL applier that swallows errors is the same class of
      // defect this whole change exists to remove.
      console.error(`  ✗ ${label}\n    ${e?.message ?? e}`);
      throw e;
    }
  }
  console.log(`\nApplied ${applied}/${STATEMENTS.length} statement(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
