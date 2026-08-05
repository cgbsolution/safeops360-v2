// DDL applier for the ERM Cross-Domain RCA & Causal Intelligence module.
// Creates the five new tables (taxonomy + RootCauseAnalysis + tagged causes +
// risk links). Additive, idempotent (CREATE TABLE / INDEX IF NOT EXISTS),
// applied through the Prisma client connection because `prisma db push` would
// drop the drifted Cams*/Facilities tables.
//   npx tsx prisma/apply-rca-ddl.ts
//
// Column conventions match the rest of the schema: id/text PKs, TIMESTAMP(3),
// createdAt defaults to CURRENT_TIMESTAMP, updatedAt has NO default (client-
// managed by SQLAlchemy default=func.now()), JSON stored as JSONB.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  // ── RootCauseCategory — enterprise cause layer (~7) ──
  `CREATE TABLE IF NOT EXISTS "RootCauseCategory" (
    "id" TEXT PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "colorHex" TEXT NOT NULL DEFAULT '#475569',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RootCauseCategory_code_key" ON "RootCauseCategory" ("code")`,

  // ── RootCauseSubCause — domain-scoped leaves; each rolls up to ONE category ──
  `CREATE TABLE IF NOT EXISTS "RootCauseSubCause" (
    "id" TEXT PRIMARY KEY,
    "categoryId" TEXT NOT NULL REFERENCES "RootCauseCategory"("id") ON DELETE CASCADE,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "applicableDomains" JSONB NOT NULL DEFAULT '[]',
    "synonyms" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RootCauseSubCause_code_key" ON "RootCauseSubCause" ("code")`,
  `CREATE INDEX IF NOT EXISTS "ix_RootCauseSubCause_category_active" ON "RootCauseSubCause" ("categoryId", "isActive")`,

  // ── RootCauseAnalysis — the first-class, domain-agnostic RCA (governed) ──
  `CREATE TABLE IF NOT EXISTS "RootCauseAnalysis" (
    "id" TEXT PRIMARY KEY,
    "rcaCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originType" TEXT NOT NULL,
    "sourceEventId" TEXT,
    "sourceRiskId" TEXT,
    "sourceLossEventId" TEXT,
    "primaryDomain" TEXT NOT NULL,
    "methodology" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "analysisPayload" JSONB NOT NULL DEFAULT '{}',
    "narrative" TEXT,
    "analystId" TEXT NOT NULL,
    "approverId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "occurrenceDate" TIMESTAMP(3),
    "plantId" TEXT,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RootCauseAnalysis_rcaCode_key" ON "RootCauseAnalysis" ("rcaCode")`,
  `CREATE INDEX IF NOT EXISTS "ix_RootCauseAnalysis_tenant_status" ON "RootCauseAnalysis" ("tenantId", "status")`,
  `CREATE INDEX IF NOT EXISTS "ix_RootCauseAnalysis_origin" ON "RootCauseAnalysis" ("originType")`,
  `CREATE INDEX IF NOT EXISTS "ix_RootCauseAnalysis_domain" ON "RootCauseAnalysis" ("primaryDomain")`,
  `CREATE INDEX IF NOT EXISTS "ix_RootCauseAnalysis_source_risk" ON "RootCauseAnalysis" ("sourceRiskId")`,
  `CREATE INDEX IF NOT EXISTS "ix_RootCauseAnalysis_source_loss" ON "RootCauseAnalysis" ("sourceLossEventId")`,
  `CREATE INDEX IF NOT EXISTS "ix_RootCauseAnalysis_source_event" ON "RootCauseAnalysis" ("sourceEventId")`,
  `CREATE INDEX IF NOT EXISTS "ix_RootCauseAnalysis_occurrence" ON "RootCauseAnalysis" ("occurrenceDate")`,
  `CREATE INDEX IF NOT EXISTS "ix_RootCauseAnalysis_deleted_status" ON "RootCauseAnalysis" ("isDeleted", "status")`,

  // ── RcaIdentifiedCause — a tagged cause within an RCA (analytical payload) ──
  `CREATE TABLE IF NOT EXISTS "RcaIdentifiedCause" (
    "id" TEXT PRIMARY KEY,
    "rcaId" TEXT NOT NULL REFERENCES "RootCauseAnalysis"("id") ON DELETE CASCADE,
    "subCauseId" TEXT NOT NULL REFERENCES "RootCauseSubCause"("id"),
    "enterpriseCategoryId" TEXT NOT NULL REFERENCES "RootCauseCategory"("id"),
    "causalRole" TEXT NOT NULL DEFAULT 'CONTRIBUTING',
    "description" TEXT,
    "confidence" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS "ix_RcaIdentifiedCause_rca" ON "RcaIdentifiedCause" ("rcaId")`,
  `CREATE INDEX IF NOT EXISTS "ix_RcaIdentifiedCause_subcause" ON "RcaIdentifiedCause" ("subCauseId")`,
  `CREATE INDEX IF NOT EXISTS "ix_RcaIdentifiedCause_category" ON "RcaIdentifiedCause" ("enterpriseCategoryId")`,

  // ── RcaRiskLink — RCA → risk(s) it contributes to (the "combination") ──
  `CREATE TABLE IF NOT EXISTS "RcaRiskLink" (
    "id" TEXT PRIMARY KEY,
    "rcaId" TEXT NOT NULL REFERENCES "RootCauseAnalysis"("id") ON DELETE CASCADE,
    "riskId" TEXT NOT NULL REFERENCES "EnterpriseRisk"("id") ON DELETE CASCADE,
    "contributionType" TEXT NOT NULL DEFAULT 'CAUSED',
    "weight" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS "ix_RcaRiskLink_rca" ON "RcaRiskLink" ("rcaId")`,
  `CREATE INDEX IF NOT EXISTS "ix_RcaRiskLink_risk" ON "RcaRiskLink" ("riskId")`,
];

async function main() {
  console.log("Applying ERM RCA & Causal Intelligence DDL (taxonomy + RootCauseAnalysis + causes + risk links)…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 70);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }
  const c = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "RootCauseAnalysis"`);
  const t = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "RootCauseCategory"`);
  console.log(`✅  RCA tables ready. RootCauseAnalysis rows=${c[0].c}, RootCauseCategory rows=${t[0].c}`);
}

main()
  .catch((e) => {
    console.error("❌  DDL apply failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
