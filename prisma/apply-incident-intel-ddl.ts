// Additive DDL applier for Incident Intelligence — Slice 1 (Features 1, 2, 5).
//   • Incident.severityDetail  (JSONB) — numeric 5×5 score + escalation ledger
//   • Incident.aiAssist        (JSONB) — AI summary + root-cause suggestion provenance
//   • IncidentCapa.linkedCauseId (TEXT) — back-link from a CAPA to its RCA cause node
//
// Mirrors prisma/apply-capture-ddl.ts: additive, idempotent (every statement
// tolerates "already exists"), applied through the Prisma client's connection
// because `prisma db push` would drop the drifted hand-DDL tables on this
// shared Supabase database.
//   npx tsx prisma/apply-incident-intel-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  `ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "severityDetail" JSONB`,
  `ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "aiAssist" JSONB`,
  `ALTER TABLE "IncidentCapa" ADD COLUMN IF NOT EXISTS "linkedCauseId" TEXT`,
];

async function main() {
  console.log("Applying Incident Intelligence (Slice 1) DDL…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 70);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }
  // Verify the new columns are present.
  const cols = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE (table_name = 'Incident' AND column_name IN ('severityDetail','aiAssist'))
        OR (table_name = 'IncidentCapa' AND column_name = 'linkedCauseId')
     ORDER BY table_name, column_name`,
  );
  console.log(
    "✅  Columns ready:",
    cols.map((c) => `${c.table_name}.${c.column_name}`).join(", "),
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
