// DDL for the Near Miss Risk Calculator, hazard checklist and category tiles —
// the three things the site's printed near miss card asks for that the form
// had no home for.
//
// RISK CALCULATOR (RR = L × S). Two independent 1-3 scales off the card, and
// the rating and category they produce. This is NOT the existing 5×5
// riskLikelihood / riskConsequence pair, which stays exactly as it is: mixing
// 1-3 values into columns that hold 1-5 values across 188 existing records
// would quietly change what those records mean. The two live side by side.
//
// riskSeverityDescription holds the wording the reporter picked — one of the
// three printed descriptions, or their own, since the form lets them add a
// description the card does not cover. Snapshotted rather than referenced so
// the record still reads correctly when the card is next revised.
//
// HAZARD CATEGORIES. A list, not the single hazardCategory MasterItem id the
// form used to send — the card is a tick-any-number grid. hazardCategory stays
// for the records that already carry one.
//
// NEAR MISS CATEGORY. Replaces energySource in the form's second slot. Exactly
// one of the pictogram tiles, plus free text when the reporter picks "Others".
// energySource stays for existing records.
//
// Additive and idempotent. Applied through the Prisma client's connection,
// matching the other apply-*-ddl scripts: `prisma db execute` / `migrate diff`
// hang against the pooler in this environment, and `prisma db push` would drop
// the drifted hand-DDL tables.
//
//   npx tsx prisma/apply-near-miss-risk-calculator-ddl.ts
//
// BACKFILL POLICY: nothing is backfilled. The existing records were scored on
// the 5×5 scale; deriving a 1-3 probability and severity from a 1-5 pair would
// be inventing a reading the reporter never gave.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  `ALTER TABLE "NearMiss" ADD COLUMN IF NOT EXISTS "riskProbability" INTEGER`,
  `ALTER TABLE "NearMiss" ADD COLUMN IF NOT EXISTS "riskSeverityLevel" INTEGER`,
  `ALTER TABLE "NearMiss" ADD COLUMN IF NOT EXISTS "riskSeverityDescription" TEXT`,
  `ALTER TABLE "NearMiss" ADD COLUMN IF NOT EXISTS "riskRating" INTEGER`,
  `ALTER TABLE "NearMiss" ADD COLUMN IF NOT EXISTS "riskCategory" TEXT`,

  `ALTER TABLE "NearMiss" ADD COLUMN IF NOT EXISTS "hazardCategories" JSONB`,
  `ALTER TABLE "NearMiss" ADD COLUMN IF NOT EXISTS "hazardCategoryOther" TEXT`,

  `ALTER TABLE "NearMiss" ADD COLUMN IF NOT EXISTS "nearMissCategory" TEXT`,
  `ALTER TABLE "NearMiss" ADD COLUMN IF NOT EXISTS "nearMissCategoryDetail" TEXT`
];

async function main() {
  console.log("Applying near-miss risk calculator DDL…");
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${sql.trim().split("\n")[0].slice(0, 76)}`);
  }

  const [row] = await prisma.$queryRawUnsafe<
    { total: bigint; scored: bigint; categorised: bigint }[]
  >(
    `SELECT count(*)::bigint                  AS total,
            count("riskRating")::bigint       AS scored,
            count("nearMissCategory")::bigint AS categorised
       FROM "NearMiss"`
  );
  console.log(
    `✅  Ready — ${row.total} near misses, ${row.scored} carrying a risk rating, ` +
      `${row.categorised} a category.`
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
