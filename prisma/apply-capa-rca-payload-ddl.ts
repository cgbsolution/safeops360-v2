// DDL for the CAPA structured root-cause analysis: Capa.rcaAnalysisPayload.
//
// The CAPA screen's RCA form asked which methodology was used and then showed
// the same three boxes whichever one you picked, because there was nowhere to
// put a 5-Why ladder, a 6M grid or a bowtie. This column is that place, and it
// holds exactly the shapes src/lib/rca/types.ts already defines for incidents —
// one editor, one read view, one summary generator for both modules.
//
// Null stays valid and is the norm: a CAPA closed on a free-text summary alone,
// a method with no template (8D, Is/Is-Not, None required), and every CAPA whose
// analysis is governed by a RootCauseAnalysis row all leave it null.
//
// Additive and idempotent. Applied through the Prisma client's connection,
// matching the other apply-*-ddl scripts: `prisma db execute` / `migrate diff`
// hang against the pooler in this environment, and `prisma db push` would drop
// the drifted hand-DDL tables.
//
//   npx tsx prisma/apply-capa-rca-payload-ddl.ts
//
// BACKFILL POLICY: nothing is backfilled. The 12 CAPAs that already carry an
// rcaMethodology were saved through the old summary-only form, so there is no
// structured analysis to reconstruct — inventing one would put words in an
// auditee's mouth on a signed record.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  `ALTER TABLE "Capa" ADD COLUMN IF NOT EXISTS "rcaAnalysisPayload" JSONB`,
];

async function main() {
  console.log("Applying CAPA RCA payload DDL…");
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${sql.trim().split("\n")[0].slice(0, 72)}`);
  }

  const [{ total, structured }] = await prisma.$queryRawUnsafe<
    { total: bigint; structured: bigint }[]
  >(
    `SELECT count(*)::bigint AS total,
            count("rcaAnalysisPayload")::bigint AS structured
       FROM "Capa"`
  );
  console.log(
    `✅  Capa.rcaAnalysisPayload ready — ${total} CAPAs, ${structured} carrying a structured analysis.`
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
