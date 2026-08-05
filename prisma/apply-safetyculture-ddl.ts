// DDL applier for the Safety Culture Management module. Additive + idempotent.
// Applied via the Prisma client connection (prisma db push is unsafe here — it
// would drop the ~20 hand-DDL tables that aren't in schema.prisma; see DECISIONS
// D2). Mirrors app/models/safety_culture.py + the models added to schema.prisma.
//   npx tsx prisma/apply-safetyculture-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  // ── §1 Culture Maturity ──
  `CREATE TABLE IF NOT EXISTS "CultureMaturityProfile" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "currentStage" TEXT NOT NULL DEFAULT 'Reactive',
    "stageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leadershipEngagement" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "workerParticipation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leadingLaggingRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bbsQualityIndex" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "perceptionIndex" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "industryVertical" TEXT,
    "lastCalculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CultureMaturityProfile_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ux_CultureMaturityProfile_plant" ON "CultureMaturityProfile" ("plantId")`,
  `CREATE INDEX IF NOT EXISTS "ix_CultureMaturityProfile_stage" ON "CultureMaturityProfile" ("currentStage")`,

  `CREATE TABLE IF NOT EXISTS "CultureMaturitySnapshot" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "stageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentStage" TEXT NOT NULL DEFAULT 'Reactive',
    "componentScores" JSONB NOT NULL DEFAULT '{}',
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CultureMaturitySnapshot_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_CultureMaturitySnapshot_plant_period" ON "CultureMaturitySnapshot" ("plantId","period")`,
  `CREATE INDEX IF NOT EXISTS "ix_CultureMaturitySnapshot_plant" ON "CultureMaturitySnapshot" ("plantId","period")`,

  // ── §2 BBS closure loop ──
  `CREATE TABLE IF NOT EXISTS "CultureObservationClosure" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "linkedCapaId" TEXT,
    "linkedActionId" TEXT,
    "reobservationVerified" BOOLEAN NOT NULL DEFAULT false,
    "reobservationDate" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CultureObservationClosure_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ux_CultureObservationClosure_obs" ON "CultureObservationClosure" ("observationId")`,
  `CREATE INDEX IF NOT EXISTS "ix_CultureObservationClosure_plant" ON "CultureObservationClosure" ("plantId")`,

  // ── §3 Leadership walks ──
  `CREATE TABLE IF NOT EXISTS "LeadershipWalk" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "cadence" TEXT,
    "areaVisited" TEXT,
    "workersInteracted" INTEGER NOT NULL DEFAULT 0,
    "observationsRaised" INTEGER NOT NULL DEFAULT 0,
    "hazardsIdentified" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "followUpActionIds" JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadershipWalk_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ix_LeadershipWalk_plant_status" ON "LeadershipWalk" ("plantId","status")`,
  `CREATE INDEX IF NOT EXISTS "ix_LeadershipWalk_leader" ON "LeadershipWalk" ("leaderId","scheduledDate")`,

  // ── §4 Perception surveys ──
  `CREATE TABLE IF NOT EXISTS "PerceptionSurveyTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "industryVertical" TEXT,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cadence" TEXT NOT NULL DEFAULT 'QUARTERLY',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PerceptionSurveyTemplate_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "PerceptionSurveyResponse" (
    "id" TEXT NOT NULL,
    "surveyTemplateId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "respondentAnonymousToken" TEXT NOT NULL,
    "responses" JSONB NOT NULL DEFAULT '[]',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PerceptionSurveyResponse_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_PerceptionResponse_once_per_period" ON "PerceptionSurveyResponse" ("surveyTemplateId","plantId","period","respondentAnonymousToken")`,
  `CREATE INDEX IF NOT EXISTS "ix_PerceptionResponse_plant_period" ON "PerceptionSurveyResponse" ("plantId","period")`,

  `CREATE TABLE IF NOT EXISTS "PerceptionIndexSnapshot" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "dimensionScores" JSONB NOT NULL DEFAULT '{}',
    "compositeScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "responseCount" INTEGER NOT NULL DEFAULT 0,
    "responseRatePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "thresholdMet" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PerceptionIndexSnapshot_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_PerceptionIndex_plant_period" ON "PerceptionIndexSnapshot" ("plantId","period")`,
  `CREATE INDEX IF NOT EXISTS "ix_PerceptionIndex_plant" ON "PerceptionIndexSnapshot" ("plantId","period")`,

  // ── §6 Recognition ──
  `CREATE TABLE IF NOT EXISTS "RecognitionEntry" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "periodEarned" TEXT NOT NULL,
    "badgeAwarded" TEXT,
    "streakWeeks" INTEGER NOT NULL DEFAULT 0,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecognitionEntry_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_Recognition_unique_award" ON "RecognitionEntry" ("plantId","userId","category","periodEarned")`,
  `CREATE INDEX IF NOT EXISTS "ix_Recognition_plant_period" ON "RecognitionEntry" ("plantId","periodEarned")`,
  `CREATE INDEX IF NOT EXISTS "ix_Recognition_user" ON "RecognitionEntry" ("userId")`,
];

async function main() {
  console.log("Applying Safety Culture DDL…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 66);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }
  const c = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "CultureMaturityProfile"`);
  console.log(`✅  Safety Culture tables ready. CultureMaturityProfile rows=${c[0].c}`);
}

main().catch((e) => { console.error("❌  DDL apply failed:", e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
