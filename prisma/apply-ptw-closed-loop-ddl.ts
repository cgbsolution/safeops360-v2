// One-off DDL applier: PTW closed-loop rebuild.
//   • New PermitStatus values (APPROVED, ISSUED, WORK_COMPLETED,
//     HANDBACK_INSPECTION, CANCELLED)
//   • New Permit columns (issue phase, FLRA policy, work-completed outcome,
//     cancellation, archive)
//   • New PermitActionEvidence table (GPS + photo + signature per action)
//   • PermitAttachment.actionEvidenceId link column
// Additive + idempotent (ADD VALUE / ADD COLUMN / CREATE TABLE IF NOT EXISTS).
// Applied through the Prisma client because `prisma db push` would drop
// drifted hand-DDL tables. Run BEFORE restarting the backend (else the new
// SQLAlchemy columns 500 every Permit SELECT).
//   npx tsx prisma/apply-ptw-closed-loop-ddl.ts
//
// NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block, so
// each statement executes on its own (autocommit) via $executeRawUnsafe —
// do not wrap these in $transaction.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  // ── PermitStatus enum: closed-loop states ──
  `ALTER TYPE "PermitStatus" ADD VALUE IF NOT EXISTS 'APPROVED'`,
  `ALTER TYPE "PermitStatus" ADD VALUE IF NOT EXISTS 'ISSUED'`,
  `ALTER TYPE "PermitStatus" ADD VALUE IF NOT EXISTS 'WORK_COMPLETED'`,
  `ALTER TYPE "PermitStatus" ADD VALUE IF NOT EXISTS 'HANDBACK_INSPECTION'`,
  `ALTER TYPE "PermitStatus" ADD VALUE IF NOT EXISTS 'CANCELLED'`,

  // ── Permit: issue phase ──
  `ALTER TABLE "Permit" ADD COLUMN IF NOT EXISTS "issuedAt" TIMESTAMP(3)`,
  `ALTER TABLE "Permit" ADD COLUMN IF NOT EXISTS "issuedById" TEXT`,

  // ── Permit: FLRA policy snapshot ──
  // Add-and-backfill in one guarded block: every PRE-rebuild permit was
  // created under the mandatory-FLRA regime, so in-flight permits keep
  // requiring an FLRA. New permits resolve from PTW_FLRA_REQUIRED_* config.
  // The backfill runs ONLY when the column is first created (idempotent).
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='Permit'
                      AND column_name='flraRequired') THEN
       ALTER TABLE "Permit" ADD COLUMN "flraRequired" BOOLEAN NOT NULL DEFAULT false;
       UPDATE "Permit" SET "flraRequired" = true;
     END IF;
   END $$;`,

  // ── Permit: work-completed declaration + outcome ──
  `ALTER TABLE "Permit" ADD COLUMN IF NOT EXISTS "workCompletedAt" TIMESTAMP(3)`,
  `ALTER TABLE "Permit" ADD COLUMN IF NOT EXISTS "workCompletedById" TEXT`,
  `ALTER TABLE "Permit" ADD COLUMN IF NOT EXISTS "outcome" TEXT`,

  // ── Permit: cancellation ──
  `ALTER TABLE "Permit" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3)`,
  `ALTER TABLE "Permit" ADD COLUMN IF NOT EXISTS "cancelledById" TEXT`,
  `ALTER TABLE "Permit" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT`,

  // ── Permit: archive flag (layered on CLOSED) ──
  `ALTER TABLE "Permit" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "Permit" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3)`,
  `CREATE INDEX IF NOT EXISTS "Permit_isArchived_idx" ON "Permit" ("isArchived")`,

  // ── PermitActionEvidence: per-action GPS + signature + declaration ──
  `CREATE TABLE IF NOT EXISTS "PermitActionEvidence" (
     "id"                   TEXT NOT NULL,
     "permitId"             TEXT NOT NULL,
     "action"               TEXT NOT NULL,
     "actorId"              TEXT NOT NULL,
     "gpsLatitude"          DOUBLE PRECISION,
     "gpsLongitude"         DOUBLE PRECISION,
     "gpsAccuracyMeters"    DOUBLE PRECISION,
     "capturedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "signatureImageBase64" TEXT,
     "declarationText"      TEXT,
     "comments"             TEXT,
     CONSTRAINT "PermitActionEvidence_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE INDEX IF NOT EXISTS "PermitActionEvidence_permitId_action_idx"
     ON "PermitActionEvidence" ("permitId", "action")`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PermitActionEvidence_permitId_fkey') THEN
       ALTER TABLE "PermitActionEvidence"
         ADD CONSTRAINT "PermitActionEvidence_permitId_fkey"
         FOREIGN KEY ("permitId") REFERENCES "Permit"("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$;`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PermitActionEvidence_actorId_fkey') THEN
       ALTER TABLE "PermitActionEvidence"
         ADD CONSTRAINT "PermitActionEvidence_actorId_fkey"
         FOREIGN KEY ("actorId") REFERENCES "User"("id")
         ON DELETE RESTRICT ON UPDATE CASCADE;
     END IF;
   END $$;`,

  // ── PermitAttachment: link evidence photos to their action ──
  `ALTER TABLE "PermitAttachment" ADD COLUMN IF NOT EXISTS "actionEvidenceId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "PermitAttachment_actionEvidenceId_idx"
     ON "PermitAttachment" ("actionEvidenceId")`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PermitAttachment_actionEvidenceId_fkey') THEN
       ALTER TABLE "PermitAttachment"
         ADD CONSTRAINT "PermitAttachment_actionEvidenceId_fkey"
         FOREIGN KEY ("actionEvidenceId") REFERENCES "PermitActionEvidence"("id")
         ON DELETE SET NULL ON UPDATE CASCADE;
     END IF;
   END $$;`,
];

async function main() {
  for (const sql of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log("  ✓", sql.replace(/\s+/g, " ").slice(0, 78));
    } catch (e) {
      const msg = (e as Error).message || String(e);
      // Tolerate "already exists" so the script is safe to re-run.
      if (/already exists/i.test(msg)) {
        console.log("  SKIP (exists):", sql.replace(/\s+/g, " ").slice(0, 60));
      } else {
        throw e;
      }
    }
  }
  console.log("PTW closed-loop DDL applied (enum values, Permit columns, PermitActionEvidence, attachment link).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
