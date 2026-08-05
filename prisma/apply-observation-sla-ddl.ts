// One-off DDL applier for the Observation SLA / Worker-Involved / Deroster work:
//   • ObservationSlaConfig            — severity × categoryGroup closure matrix
//   • ObservationDerosterConfig       — review SLA hours + escalation contact
//   • ObservationWorkerInvolved       — named worker(s), polymorphic User | ContractorWorker
//   • ObservationDeroster             — one review per involved worker
//   • ObservationDerosterEvent        — append-only deroster audit trail
//   • ObservationTargetDateHistory    — append-only closure-date trail
//   • Observation.targetDateSource / .targetDateSlaConfig / .targetDateOverrideReason
//   • User.rosterStatus / .currentDerosterRef
//   • ContractorWorker.rosterStatus / .currentDerosterRef
//
// Mirrors prisma/apply-observation-taxonomy-ddl.ts: additive, idempotent
// (every statement tolerates "already exists"), applied through the Prisma
// client's connection because `prisma db execute` / `migrate diff` hang against
// the pooler in this environment, and `prisma db push` would drop the drifted
// hand-DDL tables.
//   npx tsx prisma/apply-observation-sla-ddl.ts
//
// ⚠ ORDER MATTERS — RUN THIS BEFORE RESTARTING UVICORN.
// This migration adds mapped columns to **User**, not just to Observation.
// SQLAlchemy names every mapped column in its SELECT list, so until
// User.rosterStatus exists, every query that touches User — which includes
// login — returns a 500. Apply this first, then seed, then restart.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  // ── ObservationSlaConfig ──
  // plantId NULL = the global default; a plant row overrides it. Same
  // precedence TrainingRuleConfig uses (there is no Tenant table in this schema).
  `CREATE TABLE IF NOT EXISTS "ObservationSlaConfig" (
    "id" TEXT NOT NULL,
    "plantId" TEXT,
    "severity" TEXT NOT NULL,
    "categoryGroup" TEXT NOT NULL,
    "slaDays" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    CONSTRAINT "ObservationSlaConfig_pkey" PRIMARY KEY ("id")
  )`,
  // Two PARTIAL unique indexes rather than one composite: in Postgres, NULLs
  // are distinct, so a plain UNIQUE(plantId, severity, categoryGroup) would
  // happily allow duplicate global rows — exactly the rows the resolver falls
  // back to when no plant override exists.
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_ObservationSlaConfig_global"
     ON "ObservationSlaConfig"("severity", "categoryGroup") WHERE "plantId" IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_ObservationSlaConfig_plant"
     ON "ObservationSlaConfig"("plantId", "severity", "categoryGroup") WHERE "plantId" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS "ix_ObservationSlaConfig_lookup"
     ON "ObservationSlaConfig"("severity", "categoryGroup", "isActive")`,
  `CREATE INDEX IF NOT EXISTS "ix_ObservationSlaConfig_plantId"
     ON "ObservationSlaConfig"("plantId")`,

  // ── ObservationDerosterConfig ──
  `CREATE TABLE IF NOT EXISTS "ObservationDerosterConfig" (
    "id" TEXT NOT NULL,
    "plantId" TEXT,
    "reviewSlaHours" INTEGER NOT NULL DEFAULT 4,
    "escalationContactUserId" TEXT,
    "escalationRoleCode" TEXT NOT NULL DEFAULT 'HSE_MANAGER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    CONSTRAINT "ObservationDerosterConfig_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_ObservationDerosterConfig_global"
     ON "ObservationDerosterConfig"(("plantId" IS NULL)) WHERE "plantId" IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_ObservationDerosterConfig_plant"
     ON "ObservationDerosterConfig"("plantId") WHERE "plantId" IS NOT NULL`,

  // ── ObservationWorkerInvolved ──
  // Polymorphic: exactly one of userId / contractorWorkerId, matching partyType.
  // The CHECK is the enforcement — the app layer validates too, but a direct
  // INSERT must not be able to create a row that belongs to neither table.
  `CREATE TABLE IF NOT EXISTS "ObservationWorkerInvolved" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "partyType" TEXT NOT NULL,
    "userId" TEXT,
    "contractorWorkerId" TEXT,
    "nameSnapshot" TEXT NOT NULL,
    "roleSnapshot" TEXT,
    "employerSnapshot" TEXT,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ObservationWorkerInvolved_pkey" PRIMARY KEY ("id")
  )`,
  `DO $$ BEGIN
     ALTER TABLE "ObservationWorkerInvolved"
       ADD CONSTRAINT "ck_ObservationWorkerInvolved_party"
       CHECK (
         ("partyType" = 'USER' AND "userId" IS NOT NULL AND "contractorWorkerId" IS NULL)
         OR
         ("partyType" = 'CONTRACTOR_WORKER' AND "contractorWorkerId" IS NOT NULL AND "userId" IS NULL)
       );
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
     ALTER TABLE "ObservationWorkerInvolved"
       ADD CONSTRAINT "fk_ObservationWorkerInvolved_observation"
       FOREIGN KEY ("observationId") REFERENCES "Observation"("id") ON DELETE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
     ALTER TABLE "ObservationWorkerInvolved"
       ADD CONSTRAINT "fk_ObservationWorkerInvolved_user"
       FOREIGN KEY ("userId") REFERENCES "User"("id");
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
     ALTER TABLE "ObservationWorkerInvolved"
       ADD CONSTRAINT "fk_ObservationWorkerInvolved_contractorworker"
       FOREIGN KEY ("contractorWorkerId") REFERENCES "ContractorWorker"("id");
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  // One person may be named at most once per observation. Partial indexes
  // again, because the unused column is NULL on every row.
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_ObservationWorkerInvolved_user"
     ON "ObservationWorkerInvolved"("observationId", "userId") WHERE "userId" IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_ObservationWorkerInvolved_worker"
     ON "ObservationWorkerInvolved"("observationId", "contractorWorkerId") WHERE "contractorWorkerId" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS "ix_ObservationWorkerInvolved_observationId"
     ON "ObservationWorkerInvolved"("observationId")`,
  `CREATE INDEX IF NOT EXISTS "ix_ObservationWorkerInvolved_userId"
     ON "ObservationWorkerInvolved"("userId")`,
  `CREATE INDEX IF NOT EXISTS "ix_ObservationWorkerInvolved_contractorWorkerId"
     ON "ObservationWorkerInvolved"("contractorWorkerId")`,
  `CREATE INDEX IF NOT EXISTS "ix_ObservationWorkerInvolved_partyType"
     ON "ObservationWorkerInvolved"("partyType")`,

  // ── ObservationDeroster ──
  `CREATE TABLE IF NOT EXISTS "ObservationDeroster" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "workerInvolvedId" TEXT NOT NULL,
    "partyType" TEXT NOT NULL,
    "userId" TEXT,
    "contractorWorkerId" TEXT,
    "plantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "flaggedReason" TEXT NOT NULL,
    "reviewSlaHours" INTEGER NOT NULL DEFAULT 4,
    "reviewDueAt" TIMESTAMP(3) NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewDecisionReason" TEXT,
    "correctiveActionTrainingId" TEXT,
    "correctiveActionCompetencyId" TEXT,
    "correctiveActionNote" TEXT,
    "escalatedAt" TIMESTAMP(3),
    "escalatedToId" TEXT,
    "reinstatedById" TEXT,
    "reinstatedAt" TIMESTAMP(3),
    "reinstatementNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ObservationDeroster_pkey" PRIMARY KEY ("id")
  )`,
  `DO $$ BEGIN
     ALTER TABLE "ObservationDeroster"
       ADD CONSTRAINT "fk_ObservationDeroster_observation"
       FOREIGN KEY ("observationId") REFERENCES "Observation"("id") ON DELETE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
     ALTER TABLE "ObservationDeroster"
       ADD CONSTRAINT "fk_ObservationDeroster_workerinvolved"
       FOREIGN KEY ("workerInvolvedId") REFERENCES "ObservationWorkerInvolved"("id") ON DELETE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  // 1:1 with the involved-worker row — this uniqueness is what makes the
  // trigger idempotent under a retried submission.
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_ObservationDeroster_workerInvolvedId"
     ON "ObservationDeroster"("workerInvolvedId")`,
  `CREATE INDEX IF NOT EXISTS "ix_ObservationDeroster_observationId"
     ON "ObservationDeroster"("observationId")`,
  `CREATE INDEX IF NOT EXISTS "ix_ObservationDeroster_status"
     ON "ObservationDeroster"("status")`,
  `CREATE INDEX IF NOT EXISTS "ix_ObservationDeroster_userId"
     ON "ObservationDeroster"("userId")`,
  `CREATE INDEX IF NOT EXISTS "ix_ObservationDeroster_contractorWorkerId"
     ON "ObservationDeroster"("contractorWorkerId")`,
  `CREATE INDEX IF NOT EXISTS "ix_ObservationDeroster_plantId"
     ON "ObservationDeroster"("plantId")`,
  // The escalation scan's exact predicate: pending + never escalated + overdue.
  `CREATE INDEX IF NOT EXISTS "ix_ObservationDeroster_escalation_scan"
     ON "ObservationDeroster"("status", "escalatedAt", "reviewDueAt")`,

  // ── ObservationDerosterEvent (append-only) ──
  `CREATE TABLE IF NOT EXISTS "ObservationDerosterEvent" (
    "id" TEXT NOT NULL,
    "derosterId" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "actorId" TEXT,
    "notes" TEXT,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ObservationDerosterEvent_pkey" PRIMARY KEY ("id")
  )`,
  `DO $$ BEGIN
     ALTER TABLE "ObservationDerosterEvent"
       ADD CONSTRAINT "fk_ObservationDerosterEvent_deroster"
       FOREIGN KEY ("derosterId") REFERENCES "ObservationDeroster"("id") ON DELETE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE INDEX IF NOT EXISTS "ix_ObservationDerosterEvent_derosterId"
     ON "ObservationDerosterEvent"("derosterId")`,
  `CREATE INDEX IF NOT EXISTS "ix_ObservationDerosterEvent_observationId"
     ON "ObservationDerosterEvent"("observationId")`,
  `CREATE INDEX IF NOT EXISTS "ix_ObservationDerosterEvent_createdAt"
     ON "ObservationDerosterEvent"("createdAt")`,

  // ── ObservationTargetDateHistory (append-only) ──
  `CREATE TABLE IF NOT EXISTS "ObservationTargetDateHistory" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "reason" TEXT,
    "slaConfigApplied" JSONB,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ObservationTargetDateHistory_pkey" PRIMARY KEY ("id")
  )`,
  `DO $$ BEGIN
     ALTER TABLE "ObservationTargetDateHistory"
       ADD CONSTRAINT "fk_ObservationTargetDateHistory_observation"
       FOREIGN KEY ("observationId") REFERENCES "Observation"("id") ON DELETE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE INDEX IF NOT EXISTS "ix_ObservationTargetDateHistory_observationId"
     ON "ObservationTargetDateHistory"("observationId")`,
  `CREATE INDEX IF NOT EXISTS "ix_ObservationTargetDateHistory_changedAt"
     ON "ObservationTargetDateHistory"("changedAt")`,

  // ── Observation: target-date provenance sidecars ──
  // Nullable with no backfill by design (spec §5). A NULL targetDateSource
  // reads as "legacy" — a row written before the SLA layer existed. The old
  // free-text `targetDate` column is untouched, which is why no report,
  // dashboard or mobile screen had to change.
  `ALTER TABLE "Observation" ADD COLUMN IF NOT EXISTS "targetDateSource" TEXT`,
  `ALTER TABLE "Observation" ADD COLUMN IF NOT EXISTS "targetDateSlaConfig" JSONB`,
  `ALTER TABLE "Observation" ADD COLUMN IF NOT EXISTS "targetDateOverrideReason" TEXT`,

  // ── User: safety-roster gate ──
  // NOT NULL DEFAULT 'active' so every existing user is immediately valid —
  // this column is read on the login path.
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rosterStatus" TEXT NOT NULL DEFAULT 'active'`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "currentDerosterRef" TEXT`,
  `CREATE INDEX IF NOT EXISTS "ix_User_rosterStatus" ON "User"("rosterStatus")`,

  // ── ContractorWorker: safety-roster gate ──
  // Deliberately separate from `overallStatus` — see models/epc.py.
  `ALTER TABLE "ContractorWorker" ADD COLUMN IF NOT EXISTS "rosterStatus" TEXT NOT NULL DEFAULT 'active'`,
  `ALTER TABLE "ContractorWorker" ADD COLUMN IF NOT EXISTS "currentDerosterRef" TEXT`,
  `CREATE INDEX IF NOT EXISTS "ix_ContractorWorker_rosterStatus" ON "ContractorWorker"("rosterStatus")`,
];

async function main() {
  console.log("Applying Observation SLA / Worker-Involved / Deroster DDL…");

  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 78);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }

  const counts: Record<string, bigint> = {};
  for (const table of [
    "ObservationSlaConfig",
    "ObservationDerosterConfig",
    "ObservationWorkerInvolved",
    "ObservationDeroster",
    "ObservationDerosterEvent",
    "ObservationTargetDateHistory",
  ]) {
    const r = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
      `SELECT count(*)::bigint AS c FROM "${table}"`
    );
    counts[table] = r[0].c;
  }

  const blocked = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT (SELECT count(*) FROM "User" WHERE "rosterStatus" <> 'active')
          + (SELECT count(*) FROM "ContractorWorker" WHERE "rosterStatus" <> 'active') AS c`
  );

  console.log(
    "✅  Tables ready:",
    Object.entries(counts)
      .map(([t, c]) => `${t}=${c}`)
      .join(", ")
  );
  console.log(`ℹ️   ${blocked[0].c} worker(s) currently held by a safety roster status.`);
  console.log(
    "    Next: npm run db:seed-observation-sla\n" +
      "    Then: restart uvicorn (User.rosterStatus is on the login query path)."
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
