// Additive DDL applier for the MOC (Management of Change) Gensuite-parity
// rebuild — new ChangeRequest columns (5-step wizard) + the MocAttachment table.
//
// Mirrors prisma/apply-incident-intel-ddl.ts: additive, idempotent (every
// statement tolerates "already exists"), applied through the Prisma client's
// connection because `prisma db push` would drop the drifted hand-DDL tables
// on this shared Supabase database. All new ChangeRequest columns are nullable
// or carry a DEFAULT so existing rows backfill and load unchanged.
//   npx tsx prisma/apply-moc-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  // ── ChangeRequest: Step 1 — urgency / emergency fast-track + linked MOCs ──
  `ALTER TABLE "ChangeRequest" ADD COLUMN IF NOT EXISTS "urgency" TEXT NOT NULL DEFAULT 'standard'`,
  `ALTER TABLE "ChangeRequest" ADD COLUMN IF NOT EXISTS "emergencyRetroApprovalDueAt" TIMESTAMP(3)`,
  `ALTER TABLE "ChangeRequest" ADD COLUMN IF NOT EXISTS "linkedMocIds" TEXT[] NOT NULL DEFAULT '{}'`,

  // ── ChangeRequest: Step 2 — risk & hazard assessment ──
  `ALTER TABLE "ChangeRequest" ADD COLUMN IF NOT EXISTS "psmApplicable" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "ChangeRequest" ADD COLUMN IF NOT EXISTS "psmDetails" JSONB`,
  `ALTER TABLE "ChangeRequest" ADD COLUMN IF NOT EXISTS "riskMatrixPre" JSONB`,
  `ALTER TABLE "ChangeRequest" ADD COLUMN IF NOT EXISTS "riskMatrixResidual" JSONB`,
  `ALTER TABLE "ChangeRequest" ADD COLUMN IF NOT EXISTS "hazardCategories" TEXT[] NOT NULL DEFAULT '{}'`,
  `ALTER TABLE "ChangeRequest" ADD COLUMN IF NOT EXISTS "mitigations" TEXT`,

  // ── ChangeRequest: Step 3 — impact & stakeholder + training gate ──
  `ALTER TABLE "ChangeRequest" ADD COLUMN IF NOT EXISTS "departmentImpact" JSONB`,
  `ALTER TABLE "ChangeRequest" ADD COLUMN IF NOT EXISTS "trainingRequired" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "ChangeRequest" ADD COLUMN IF NOT EXISTS "trainingCertificateId" TEXT`,

  // ── ChangeRequest: Step 5 — implementation & closure ──
  `ALTER TABLE "ChangeRequest" ADD COLUMN IF NOT EXISTS "pssrChecklist" JSONB`,
  `ALTER TABLE "ChangeRequest" ADD COLUMN IF NOT EXISTS "effectivenessReview" JSONB`,

  // ── MocAttachment table (drawings / P&IDs / vendor specs / risk docs) ──
  `CREATE TABLE IF NOT EXISTS "MocAttachment" (
     "id"              TEXT PRIMARY KEY,
     "changeRequestId" TEXT NOT NULL,
     "category"        TEXT NOT NULL,
     "fileName"        TEXT NOT NULL,
     "storagePath"     TEXT NOT NULL,
     "fileSize"        INTEGER NOT NULL,
     "mimeType"        TEXT NOT NULL,
     "caption"         TEXT,
     "uploadedById"    TEXT NOT NULL,
     "uploadedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "deletedAt"       TIMESTAMP(3)
   )`,
  `CREATE INDEX IF NOT EXISTS "MocAttachment_changeRequestId_deletedAt_idx" ON "MocAttachment" ("changeRequestId", "deletedAt")`,
  // FK to ChangeRequest (constraints have no IF NOT EXISTS — guard with a DO block).
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MocAttachment_changeRequestId_fkey') THEN
       ALTER TABLE "MocAttachment"
         ADD CONSTRAINT "MocAttachment_changeRequestId_fkey"
         FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest" ("id") ON DELETE CASCADE;
     END IF;
   END $$`,
];

async function main() {
  console.log("Applying MOC Gensuite-parity DDL…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 70);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }
  // Verify the new columns + table are present.
  const cols = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE (table_name = 'ChangeRequest' AND column_name IN (
              'urgency','emergencyRetroApprovalDueAt','linkedMocIds','psmApplicable',
              'psmDetails','riskMatrixPre','riskMatrixResidual','hazardCategories',
              'mitigations','departmentImpact','trainingRequired','trainingCertificateId',
              'pssrChecklist','effectivenessReview'))
        OR (table_name = 'MocAttachment')
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
