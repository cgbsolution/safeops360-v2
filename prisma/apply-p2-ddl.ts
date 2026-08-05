// DDL applier for P2 build — incident→ERM alert columns + JobRun (scheduler
// observability). Additive + idempotent. Applied via Prisma client connection.
//   npx tsx prisma/apply-p2-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  // ── I-04 Incident → ERM risk auto-flag ──
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "incidentAlert" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "incidentAlertReason" TEXT`,
  `ALTER TABLE "EnterpriseRisk" ADD COLUMN IF NOT EXISTS "incidentAlertAt" TIMESTAMP(3)`,

  // ── P2-1 Scheduler observability ──
  `CREATE TABLE IF NOT EXISTS "JobRun" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "recordsAffected" INTEGER,
    "summary" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ix_JobRun_job_started" ON "JobRun" ("jobId","startedAt")`,
  `CREATE INDEX IF NOT EXISTS "ix_JobRun_status" ON "JobRun" ("status")`,
];

async function main() {
  console.log("Applying P2 DDL (incident-alert + JobRun)…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 60);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }
  const j = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "JobRun"`);
  console.log(`✅  P2 columns + JobRun ready. JobRun rows=${j[0].c}`);
}

main().catch((e) => { console.error("❌  DDL apply failed:", e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
