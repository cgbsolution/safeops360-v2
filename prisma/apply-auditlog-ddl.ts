// One-off DDL applier for P1-1 unified audit trail — creates the AuditLog table
// (tamper-evident, per-entity SHA-256 hash chain). Additive + idempotent. Applied
// via the Prisma client connection (db push would drop drifted tables).
//   npx tsx prisma/apply-auditlog-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "sequenceNo" BIGINT NOT NULL,
    "plantId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityCode" TEXT,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
    "actorIp" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "before" JSONB,
    "after" JSONB,
    "changedFields" JSONB,
    "reason" TEXT,
    "correlationId" TEXT,
    "previousEntryHash" TEXT,
    "entryHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ix_AuditLog_entity" ON "AuditLog" ("entityType","entityId","sequenceNo")`,
  `CREATE INDEX IF NOT EXISTS "ix_AuditLog_actor" ON "AuditLog" ("actorId")`,
  `CREATE INDEX IF NOT EXISTS "ix_AuditLog_action" ON "AuditLog" ("action")`,
  `CREATE INDEX IF NOT EXISTS "ix_AuditLog_plant" ON "AuditLog" ("plantId")`,
  `CREATE INDEX IF NOT EXISTS "ix_AuditLog_ts" ON "AuditLog" ("timestamp")`,
  `CREATE INDEX IF NOT EXISTS "ix_AuditLog_corr" ON "AuditLog" ("correlationId")`,
  // one chain per entity: (entityType, entityId, sequenceNo) must be unique
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_AuditLog_entity_seq" ON "AuditLog" ("entityType","entityId","sequenceNo")`,
];

async function main() {
  console.log("Applying AuditLog DDL (unified tamper-evident audit trail)…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 60);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }
  const r = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "AuditLog"`);
  console.log(`✅  AuditLog ready. rows=${r[0].c}`);
}

main()
  .catch((e) => {
    console.error("❌  DDL apply failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
