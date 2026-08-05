// DDL applier for the Safety Culture UPGRADE batch (integrity gate + walk depth).
// Additive + idempotent. Applied via the Prisma client connection — `prisma db
// push` is unsafe here (it would drop the ~20 hand-DDL tables not in schema.prisma;
// see DECISIONS D2). Mirrors the additions in app/models/safety_culture.py.
//   npx tsx prisma/apply-culture-upgrade-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  // ── §Fix 1: shared observer-integrity gate (BBS ↔ Recognition) ──
  `CREATE TABLE IF NOT EXISTS "CultureObserverIntegrity" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "observerId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'flagged_pending_review',
    "reasons" JSONB NOT NULL DEFAULT '[]',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CultureObserverIntegrity_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_CultureObserverIntegrity_key" ON "CultureObserverIntegrity" ("plantId","observerId","period")`,
  `CREATE INDEX IF NOT EXISTS "ix_CultureObserverIntegrity_plant_period" ON "CultureObserverIntegrity" ("plantId","period")`,

  // ── §Fix 3: leadership-walk depth (structured checklist + escalation marker) ──
  `ALTER TABLE "LeadershipWalk" ADD COLUMN IF NOT EXISTS "checklist" JSONB`,
  `ALTER TABLE "LeadershipWalk" ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3)`,
];

async function main() {
  console.log("Applying Safety Culture UPGRADE DDL…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 66);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }
  const c = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "CultureObserverIntegrity"`);
  console.log(`✅  Culture upgrade tables/columns ready. CultureObserverIntegrity rows=${c[0].c}`);
}

main().catch((e) => { console.error("❌  DDL apply failed:", e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
