// One-off DDL applier for the Guided Field Capture + Daily Alert Brief tables:
// CaptureSubmission / CaptureAttachment / CaptureTaxonomy / TaxonomyAlias /
// RcaFieldRequest / RcaFieldInput / UploadSession / UploadChunk (offline media)
// and DomainEvent / Alert / AlertSubscription (event-driven dashboard).
// Mirrors prisma/apply-factory-ext-ddl.ts: additive, idempotent (every statement
// tolerates "already exists"), applied through the Prisma client's connection
// because `prisma db execute` / `migrate diff` hang against the pooler in this
// environment, and `prisma db push` would drop the drifted hand-DDL tables.
//   npx tsx prisma/apply-capture-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  // ── CaptureSubmission (field-report staging entity) ──
  `CREATE TABLE IF NOT EXISTS "CaptureSubmission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "number" TEXT NOT NULL,
    "clientSubmissionId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'observation',
    "reporterId" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "anonHash" TEXT,
    "plantId" TEXT NOT NULL,
    "areaId" TEXT,
    "mapPinX" DOUBLE PRECISION,
    "mapPinY" DOUBLE PRECISION,
    "equipmentId" TEXT,
    "qrScanned" BOOLEAN NOT NULL DEFAULT false,
    "categoryL1Id" TEXT,
    "categoryL2Id" TEXT,
    "categorySnapshot" JSONB,
    "aiSuggested" BOOLEAN NOT NULL DEFAULT false,
    "aiConfidence" DOUBLE PRECISION,
    "aiSuggestion" JSONB,
    "severitySelfReported" TEXT NOT NULL DEFAULT 'medium',
    "description" TEXT,
    "voiceLangCode" TEXT,
    "transcriptOriginal" TEXT,
    "transcriptEnglish" TEXT,
    "transcriptionStatus" TEXT NOT NULL DEFAULT 'none',
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "triagedById" TEXT,
    "triagedAt" TIMESTAMP(3),
    "hiraLikelihood" INTEGER,
    "hiraSeverity" INTEGER,
    "riskScore" INTEGER,
    "riskLevel" TEXT,
    "triageNote" TEXT,
    "convertedEntityType" TEXT,
    "convertedEntityId" TEXT,
    "convertedById" TEXT,
    "convertedAt" TIMESTAMP(3),
    "linkedRcaIds" JSONB NOT NULL DEFAULT '[]',
    "linkedCapaIds" JSONB NOT NULL DEFAULT '[]',
    "linkedPtwIds" JSONB NOT NULL DEFAULT '[]',
    "tapCount" INTEGER,
    "durationMs" INTEGER,
    "wasOffline" BOOLEAN NOT NULL DEFAULT false,
    "appVersion" TEXT,
    "deviceLang" TEXT,
    "taxonomyVersion" INTEGER,
    "createdAtClient" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,
    CONSTRAINT "CaptureSubmission_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "CaptureSubmission_number_key" ON "CaptureSubmission"("number")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_CaptureSubmission_tenant_client" ON "CaptureSubmission"("tenantId", "clientSubmissionId")`,
  `CREATE INDEX IF NOT EXISTS "ix_CaptureSubmission_plant_status_created" ON "CaptureSubmission"("tenantId", "plantId", "status", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "ix_CaptureSubmission_cluster" ON "CaptureSubmission"("plantId", "areaId", "categoryL1Id")`,
  `CREATE INDEX IF NOT EXISTS "ix_CaptureSubmission_reporterId" ON "CaptureSubmission"("reporterId")`,
  `CREATE INDEX IF NOT EXISTS "ix_CaptureSubmission_anonHash" ON "CaptureSubmission"("anonHash")`,
  `CREATE INDEX IF NOT EXISTS "ix_CaptureSubmission_status" ON "CaptureSubmission"("status")`,
  `CREATE INDEX IF NOT EXISTS "ix_CaptureSubmission_isDeleted" ON "CaptureSubmission"("isDeleted")`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaptureSubmission_reporterId_fkey') THEN
       ALTER TABLE "CaptureSubmission" ADD CONSTRAINT "CaptureSubmission_reporterId_fkey"
         FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
     END IF;
   END $$`,

  // ── CaptureAttachment ──
  `CREATE TABLE IF NOT EXISTS "CaptureAttachment" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "durationSec" DOUBLE PRECISION,
    "caption" TEXT,
    "sha256" TEXT,
    "clientMediaId" TEXT,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "CaptureAttachment_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ix_CaptureAttachment_submissionId" ON "CaptureAttachment"("submissionId")`,
  `CREATE INDEX IF NOT EXISTS "ix_CaptureAttachment_kind" ON "CaptureAttachment"("kind")`,
  `CREATE INDEX IF NOT EXISTS "ix_CaptureAttachment_clientMediaId" ON "CaptureAttachment"("clientMediaId")`,
  `CREATE INDEX IF NOT EXISTS "ix_CaptureAttachment_deletedAt" ON "CaptureAttachment"("deletedAt")`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaptureAttachment_submissionId_fkey') THEN
       ALTER TABLE "CaptureAttachment" ADD CONSTRAINT "CaptureAttachment_submissionId_fkey"
         FOREIGN KEY ("submissionId") REFERENCES "CaptureSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,

  // ── CaptureTaxonomy (hazard taxonomy + cause library + control library) ──
  `CREATE TABLE IF NOT EXISTS "CaptureTaxonomy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "kind" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "labels" JSONB NOT NULL DEFAULT '{}',
    "iconKey" TEXT,
    "fishboneCategory" TEXT,
    "sortWeight" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaptureTaxonomy_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_CaptureTaxonomy_kind_code" ON "CaptureTaxonomy"("kind", "code")`,
  `CREATE INDEX IF NOT EXISTS "ix_CaptureTaxonomy_kind" ON "CaptureTaxonomy"("kind")`,
  `CREATE INDEX IF NOT EXISTS "ix_CaptureTaxonomy_parentId" ON "CaptureTaxonomy"("parentId")`,

  // ── TaxonomyAlias (stale offline-cache mapping) ──
  `CREATE TABLE IF NOT EXISTS "TaxonomyAlias" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromCode" TEXT NOT NULL,
    "toCode" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxonomyAlias_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_TaxonomyAlias_kind_from" ON "TaxonomyAlias"("kind", "fromCode")`,

  // ── RcaFieldRequest / RcaFieldInput (guided RCA contribution) ──
  `CREATE TABLE IF NOT EXISTS "RcaFieldRequest" (
    "id" TEXT NOT NULL,
    "rcaId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "plantId" TEXT,
    "contextSummary" TEXT NOT NULL DEFAULT '',
    "hazardCategoryCode" TEXT,
    "technicianIds" JSONB NOT NULL DEFAULT '[]',
    "dueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,
    CONSTRAINT "RcaFieldRequest_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ix_RcaFieldRequest_rcaId" ON "RcaFieldRequest"("rcaId")`,
  `CREATE INDEX IF NOT EXISTS "ix_RcaFieldRequest_plantId" ON "RcaFieldRequest"("plantId")`,
  `CREATE INDEX IF NOT EXISTS "ix_RcaFieldRequest_status" ON "RcaFieldRequest"("status")`,
  `CREATE INDEX IF NOT EXISTS "ix_RcaFieldRequest_isDeleted" ON "RcaFieldRequest"("isDeleted")`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RcaFieldRequest_requestedById_fkey') THEN
       ALTER TABLE "RcaFieldRequest" ADD CONSTRAINT "RcaFieldRequest_requestedById_fkey"
         FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
     END IF;
   END $$`,

  `CREATE TABLE IF NOT EXISTS "RcaFieldInput" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "rcaId" TEXT NOT NULL,
    "contributorId" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "anonHash" TEXT,
    "fishboneCategory" TEXT,
    "causePath" JSONB NOT NULL DEFAULT '[]',
    "controlSuggestionIds" JSONB NOT NULL DEFAULT '[]',
    "note" TEXT,
    "voiceStoragePath" TEXT,
    "voiceLangCode" TEXT,
    "transcriptOriginal" TEXT,
    "transcriptEnglish" TEXT,
    "promotedCauseId" TEXT,
    "promotedById" TEXT,
    "promotedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RcaFieldInput_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ix_RcaFieldInput_requestId" ON "RcaFieldInput"("requestId")`,
  `CREATE INDEX IF NOT EXISTS "ix_RcaFieldInput_rcaId" ON "RcaFieldInput"("rcaId")`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RcaFieldInput_requestId_fkey') THEN
       ALTER TABLE "RcaFieldInput" ADD CONSTRAINT "RcaFieldInput_requestId_fkey"
         FOREIGN KEY ("requestId") REFERENCES "RcaFieldRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RcaFieldInput_contributorId_fkey') THEN
       ALTER TABLE "RcaFieldInput" ADD CONSTRAINT "RcaFieldInput_contributorId_fkey"
         FOREIGN KEY ("contributorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
     END IF;
   END $$`,

  // ── UploadSession / UploadChunk (resumable chunked media for offline sync) ──
  `CREATE TABLE IF NOT EXISTS "UploadSession" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "clientMediaId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PHOTO',
    "totalSize" INTEGER NOT NULL,
    "chunkSize" INTEGER NOT NULL,
    "totalChunks" INTEGER NOT NULL,
    "sha256" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "storagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadSession_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ix_UploadSession_ownerId" ON "UploadSession"("ownerId")`,
  `CREATE INDEX IF NOT EXISTS "ix_UploadSession_clientMediaId" ON "UploadSession"("clientMediaId")`,
  `CREATE INDEX IF NOT EXISTS "ix_UploadSession_sha256" ON "UploadSession"("sha256")`,
  `CREATE INDEX IF NOT EXISTS "ix_UploadSession_status" ON "UploadSession"("status")`,

  `CREATE TABLE IF NOT EXISTS "UploadChunk" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadChunk_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_UploadChunk_session_index" ON "UploadChunk"("sessionId", "chunkIndex")`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UploadChunk_sessionId_fkey') THEN
       ALTER TABLE "UploadChunk" ADD CONSTRAINT "UploadChunk_sessionId_fkey"
         FOREIGN KEY ("sessionId") REFERENCES "UploadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,

  // ── DomainEvent (append-only outbox) ──
  `CREATE TABLE IF NOT EXISTS "DomainEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "siteId" TEXT,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityRef" TEXT,
    "actorId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processingError" TEXT,
    "correlationId" TEXT,
    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ix_DomainEvent_eventType" ON "DomainEvent"("eventType")`,
  `CREATE INDEX IF NOT EXISTS "ix_DomainEvent_siteId" ON "DomainEvent"("siteId")`,
  `CREATE INDEX IF NOT EXISTS "ix_DomainEvent_occurredAt" ON "DomainEvent"("occurredAt")`,
  `CREATE INDEX IF NOT EXISTS "ix_DomainEvent_processedAt" ON "DomainEvent"("processedAt")`,
  `CREATE INDEX IF NOT EXISTS "ix_DomainEvent_entity" ON "DomainEvent"("entityType", "entityId")`,

  // ── Alert (materialised impact cards) ──
  `CREATE TABLE IF NOT EXISTS "Alert" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "siteId" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "bodyTemplateKey" TEXT,
    "bodyParams" JSONB NOT NULL DEFAULT '{}',
    "bodyText" TEXT NOT NULL DEFAULT '',
    "sourceEventType" TEXT,
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "impactedEntities" JSONB NOT NULL DEFAULT '[]',
    "deepLink" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'new',
    "ackBy" TEXT,
    "ackAt" TIMESTAMP(3),
    "mutedUntil" TIMESTAMP(3),
    "audienceRoles" JSONB NOT NULL DEFAULT '[]',
    "audienceSiteIds" JSONB NOT NULL DEFAULT '[]',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,
    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ix_Alert_site_status_created" ON "Alert"("tenantId", "siteId", "status", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "ix_Alert_dedupeKey" ON "Alert"("dedupeKey")`,
  `CREATE INDEX IF NOT EXISTS "ix_Alert_severity" ON "Alert"("severity")`,
  `CREATE INDEX IF NOT EXISTS "ix_Alert_status" ON "Alert"("status")`,
  `CREATE INDEX IF NOT EXISTS "ix_Alert_siteId" ON "Alert"("siteId")`,
  `CREATE INDEX IF NOT EXISTS "ix_Alert_isDeleted" ON "Alert"("isDeleted")`,

  // ── AlertSubscription (daily digest) ──
  `CREATE TABLE IF NOT EXISTS "AlertSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "roleCode" TEXT NOT NULL,
    "siteId" TEXT,
    "channels" JSONB NOT NULL DEFAULT '[]',
    "minSeverity" TEXT NOT NULL DEFAULT 'attention',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSentOn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlertSubscription_pkey" PRIMARY KEY ("id")
  )`,
];

async function main() {
  console.log("Applying Guided Field Capture + Daily Alert Brief DDL…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 60);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }
  const counts: Record<string, bigint> = {};
  for (const table of [
    "CaptureSubmission", "CaptureAttachment", "CaptureTaxonomy", "TaxonomyAlias",
    "RcaFieldRequest", "RcaFieldInput", "UploadSession", "UploadChunk",
    "DomainEvent", "Alert", "AlertSubscription",
  ]) {
    const r = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "${table}"`);
    counts[table] = r[0].c;
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
