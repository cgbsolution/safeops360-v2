// DDL for department-segregated management-system audits (PAGE_IMS).
//
//   npx tsx prisma/apply-department-audit-ddl.ts
//
// Page audit HR / Admin / OHC separately and assess each department against
// BOTH source sheets — the IMS one (ISO 9001 / 14001 / 45001) and the EnMS one
// (ISO 50001). `AuditCheckpointResponse.categoryId` carries the department;
// these columns carry what that axis cannot express:
//
//   streamCode       IMS | ENMS — which of the two reports the row belongs to
//   replicationKey   the same workbook line in another department
//   pairKey          the same requirement on the other sheet, this department
//   conformanceMode  FULL (7-value status) | TRISTATE (the customer's 3)
//   standardClauses  [{code, standard, clause}] — an IMS line cites three ISOs
//   AuditReport.reportStream   which stream a report covers (null = whole audit)
//
// Additive and idempotent: every column is nullable or defaulted, so existing
// rows need no backfill and every other checkpoint library keeps materialising
// rows with none of it. NEVER `prisma db push` — this schema carries hand-DDL
// tables that push would drop.
//
// Run BEFORE restarting uvicorn: app/models/audit_compliance.py maps these
// columns, and a mapped column that does not exist 500s EVERY query against
// AuditCheckpointResponse — which is every screen in CAMS.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  // ── AuditCheckpointResponse ───────────────────────────────────────────────
  `ALTER TABLE "AuditCheckpointResponse" ADD COLUMN IF NOT EXISTS "streamCode" TEXT`,
  `ALTER TABLE "AuditCheckpointResponse" ADD COLUMN IF NOT EXISTS "replicationKey" TEXT`,
  `ALTER TABLE "AuditCheckpointResponse" ADD COLUMN IF NOT EXISTS "pairKey" TEXT`,
  `ALTER TABLE "AuditCheckpointResponse" ADD COLUMN IF NOT EXISTS "conformanceMode" TEXT`,
  `ALTER TABLE "AuditCheckpointResponse" ADD COLUMN IF NOT EXISTS "standardClauses" JSONB NOT NULL DEFAULT '[]'::jsonb`,

  // A row's stream is what a per-stream report is scoped by, so an unknown
  // token here would silently drop checkpoints out of BOTH reports rather than
  // failing loudly. NULL stays legal — it is what every other library writes.
  `DO $$ BEGIN
     ALTER TABLE "AuditCheckpointResponse"
       ADD CONSTRAINT "ck_AuditCheckpointResponse_streamCode"
       CHECK ("streamCode" IS NULL OR "streamCode" IN ('IMS', 'ENMS'));
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
     ALTER TABLE "AuditCheckpointResponse"
       ADD CONSTRAINT "ck_AuditCheckpointResponse_conformanceMode"
       CHECK ("conformanceMode" IS NULL OR "conformanceMode" IN ('FULL', 'TRISTATE'));
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  // The conduct worklist filters (audit, department, stream); the report
  // generator scans (audit, stream); replication looks up (audit,
  // replicationKey) and the paired-card join uses (audit, pairKey). Partial on
  // NOT NULL so the ~2,500 existing rows from other libraries cost nothing.
  `CREATE INDEX IF NOT EXISTS "ix_AuditCheckpointResponse_audit_stream"
     ON "AuditCheckpointResponse"("auditId", "streamCode") WHERE "streamCode" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS "ix_AuditCheckpointResponse_audit_replkey"
     ON "AuditCheckpointResponse"("auditId", "replicationKey") WHERE "replicationKey" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS "ix_AuditCheckpointResponse_audit_pairkey"
     ON "AuditCheckpointResponse"("auditId", "pairKey") WHERE "pairKey" IS NOT NULL`,

  // ── AuditReport ───────────────────────────────────────────────────────────
  `ALTER TABLE "AuditReport" ADD COLUMN IF NOT EXISTS "reportStream" TEXT`,
  `DO $$ BEGIN
     ALTER TABLE "AuditReport"
       ADD CONSTRAINT "ck_AuditReport_reportStream"
       CHECK ("reportStream" IS NULL OR "reportStream" IN ('IMS', 'ENMS'));
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  // Superseding is per (audit, type, stream): re-issuing the IMS interim must
  // not mark the EnMS one stale, and that lookup runs on every generation.
  `CREATE INDEX IF NOT EXISTS "ix_AuditReport_audit_type_stream"
     ON "AuditReport"("auditId", "reportType", "reportStream")`,
];

async function main() {
  console.log("Applying department-segregated audit DDL…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 88);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }

  const cols = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE (table_name = 'AuditCheckpointResponse'
             AND column_name IN ('streamCode','replicationKey','pairKey','conformanceMode','standardClauses'))
         OR (table_name = 'AuditReport' AND column_name = 'reportStream')
      ORDER BY table_name, column_name`
  );
  console.log(`\n✅  ${cols.length}/6 columns present:`);
  for (const c of cols) console.log(`      ${c.table_name}.${c.column_name}`);
  if (cols.length !== 6) {
    throw new Error(`Expected 6 columns, found ${cols.length} — do NOT restart the backend.`);
  }

  console.log("\n    Next: cd ../Safeops360-backend && python scripts/seed_page_audit_category_libraries.py");
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
