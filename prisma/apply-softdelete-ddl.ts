// One-off DDL applier for P1-3 soft-delete integrity — adds the governed-entity
// soft-delete columns (isDeleted + deletedAt/deletedBy/deletionReason) to the four
// governed entities that lacked them: Incident, Capa, ComplianceAudit, Permit.
// Models that already carry isDeleted (EnterpriseRisk, LossEvent, CamsEngagement,
// FactoryProfile, …) are unaffected.
//
// Additive + idempotent (ADD COLUMN IF NOT EXISTS). Applied via the Prisma client
// connection because `prisma db push` would drop drifted Cams*/Facilities tables.
//   npx tsx prisma/apply-softdelete-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TABLES = ["Incident", "Capa", "ComplianceAudit", "Permit"];

const STATEMENTS: string[] = TABLES.flatMap((t) => [
  `ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`,
  `ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT`,
  `ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "deletionReason" TEXT`,
  `CREATE INDEX IF NOT EXISTS "${t}_isDeleted_idx" ON "${t}" ("isDeleted")`,
]);

async function main() {
  console.log("Applying soft-delete DDL (Incident/Capa/ComplianceAudit/Permit)…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 70);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }
  for (const t of TABLES) {
    const r = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
      `SELECT count(*)::bigint AS c FROM "${t}" WHERE "isDeleted" = false`
    );
    console.log(`  ${t}: ${r[0].c} active rows`);
  }
  console.log("✅  Soft-delete columns ready.");
}

main()
  .catch((e) => {
    console.error("❌  DDL apply failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
