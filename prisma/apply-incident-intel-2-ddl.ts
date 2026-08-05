// Additive DDL applier for Incident Intelligence — Slice 2 (Features 3, 4, 6, 7, 8).
//   Incident JSON cols: causeAnalysis, statutoryObligation, costImpact
//   New tables: GoldenThreadLink, CompetencyMapping, PlantCostConfig,
//     StatutoryTemplate, StatutoryFormInstance, WhatsappSender,
//     WhatsappTemplate, WhatsappInboundLog
//
// Additive, idempotent (every statement tolerates "already exists"). Applied via
// the Prisma client because `prisma db push` would drop drifted hand-DDL tables.
//   npx tsx prisma/apply-incident-intel-2-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  // ── Incident JSON columns ──
  `ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "causeAnalysis" JSONB`,
  `ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "statutoryObligation" JSONB`,
  `ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "costImpact" JSONB`,

  // ── F7 GoldenThreadLink ──
  `CREATE TABLE IF NOT EXISTS "GoldenThreadLink" (
    "id" TEXT NOT NULL,
    "sourceIncidentId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetRef" TEXT,
    "linkType" TEXT NOT NULL DEFAULT 'created',
    "triggeredBy" TEXT NOT NULL DEFAULT 'system',
    "meta" JSONB,
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GoldenThreadLink_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ix_GoldenThreadLink_source" ON "GoldenThreadLink"("sourceIncidentId")`,
  `CREATE INDEX IF NOT EXISTS "ix_GoldenThreadLink_target" ON "GoldenThreadLink"("targetType", "targetId")`,

  // ── F7 CompetencyMapping ──
  `CREATE TABLE IF NOT EXISTS "CompetencyMapping" (
    "id" TEXT NOT NULL,
    "causeKeyword" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompetencyMapping_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ix_CompetencyMapping_keyword" ON "CompetencyMapping"("causeKeyword")`,
  `CREATE INDEX IF NOT EXISTS "ix_CompetencyMapping_competency" ON "CompetencyMapping"("competencyId")`,

  // ── F8 PlantCostConfig ──
  `CREATE TABLE IF NOT EXISTS "PlantCostConfig" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "hourlyProductionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loadedLaborRateByRole" JSONB,
    "defaultLaborRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlantCostConfig_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_PlantCostConfig_plant" ON "PlantCostConfig"("plantId")`,

  // ── F4 StatutoryTemplate ──
  `CREATE TABLE IF NOT EXISTS "StatutoryTemplate" (
    "id" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "formType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "triggerConditions" JSONB NOT NULL DEFAULT '{}',
    "fieldMapping" JSONB NOT NULL DEFAULT '{}',
    "templateFileRef" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatutoryTemplate_pkey" PRIMARY KEY ("id")
  )`,

  // ── F4 StatutoryFormInstance (immutable versions) ──
  `CREATE TABLE IF NOT EXISTS "StatutoryFormInstance" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "formType" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT,
    "fieldData" JSONB NOT NULL DEFAULT '{}',
    "generatedById" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatutoryFormInstance_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ix_StatutoryFormInstance_incident" ON "StatutoryFormInstance"("incidentId")`,

  // ── F6 WhatsappSender ──
  `CREATE TABLE IF NOT EXISTS "WhatsappSender" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "employeeId" TEXT,
    "plantId" TEXT,
    "role" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationMethod" TEXT,
    "otpHash" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "otpAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsappSender_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_WhatsappSender_phone" ON "WhatsappSender"("phoneNumber")`,

  // ── F6 WhatsappTemplate ──
  `CREATE TABLE IF NOT EXISTS "WhatsappTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'UTILITY',
    "language" TEXT NOT NULL DEFAULT 'en',
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsappTemplate_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_WhatsappTemplate_name" ON "WhatsappTemplate"("name")`,

  // ── F6 WhatsappInboundLog ──
  `CREATE TABLE IF NOT EXISTS "WhatsappInboundLog" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "senderId" TEXT,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "mediaId" TEXT,
    "transcript" TEXT,
    "transcriptLang" TEXT,
    "createdIncidentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'received',
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsappInboundLog_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ix_WhatsappInboundLog_phone" ON "WhatsappInboundLog"("phoneNumber")`,
];

async function main() {
  console.log("Applying Incident Intelligence (Slice 2) DDL…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 70);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }
  const tables = [
    "GoldenThreadLink", "CompetencyMapping", "PlantCostConfig", "StatutoryTemplate",
    "StatutoryFormInstance", "WhatsappSender", "WhatsappTemplate", "WhatsappInboundLog",
  ];
  const counts: Record<string, bigint> = {};
  for (const t of tables) {
    const r = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "${t}"`);
    counts[t] = r[0].c;
  }
  console.log("✅  Tables ready:", Object.entries(counts).map(([t, c]) => `${t}=${c}`).join(", "));
}

main()
  .catch((e) => {
    console.error("❌  DDL apply failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
