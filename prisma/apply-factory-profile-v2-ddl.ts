// One-off DDL applier for the Factory Profile enhancement pass:
//   • BuildingFloor / BuildingFloorActivity — multi-process mapping per
//     building AND floor (Block A / Floor 1 / Sewing …), with standardised
//     fixed-unit measure columns.
//   • FactoryProfileChangeRequest — governed profile edits (Plant Head →
//     Compliance Lead Auditor approval) + append-only version history.
//
// Same conventions as apply-factory-ext-ddl.ts: additive, idempotent (every
// statement tolerates a re-run), applied through the Prisma client's connection
// because `prisma db execute` / `migrate diff` hang against the pooler here, and
// `prisma db push` would drop the drifted Cams* / Facilities tables that were
// bootstrapped the same way. Unlike the older appliers this one pins itself to
// the DIRECT connection — see ddlConnectionUrl() below.
//   npx tsx prisma/apply-factory-profile-v2-ddl.ts

import { PrismaClient } from "@prisma/client";

// DDL goes over the DIRECT connection, never the pooler.
//
// DATABASE_URL points at Supabase's pgbouncer (:6543) in transaction pooling
// mode, where each statement can land on a different backend while Prisma keeps
// re-declaring the same prepared statement name — which surfaces as
// `42P05: prepared statement "s0" already exists` on an arbitrary statement,
// leaving the DDL half-applied. DATABASE_URL_SYNC (:5432) is the direct
// connection Prisma already uses as `directUrl` for exactly this reason.
//
// Falls back to DATABASE_URL with pgbouncer flags set, so the script still runs
// (statement caching off) in an environment that only has the pooled URL.
function ddlConnectionUrl(): string {
  const direct = process.env.DATABASE_URL_SYNC;
  if (direct) return direct;
  const pooled = process.env.DATABASE_URL;
  if (!pooled) throw new Error("Set DATABASE_URL_SYNC (preferred) or DATABASE_URL before running this script.");
  const url = new URL(pooled);
  url.searchParams.set("pgbouncer", "true");
  url.searchParams.set("statement_cache_size", "0");
  console.warn("⚠️  DATABASE_URL_SYNC is not set — falling back to the pooled URL with prepared statements disabled.");
  return url.toString();
}

const prisma = new PrismaClient({ datasources: { db: { url: ddlConnectionUrl() } } });

const STATEMENTS: string[] = [
  // ── BuildingFloor ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "BuildingFloor" (
    "id" TEXT NOT NULL,
    "factoryProfileId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "floorLabel" TEXT NOT NULL,
    "floorLevel" INTEGER NOT NULL DEFAULT 0,
    "areaSqm" DOUBLE PRECISION,
    "headroomM" DOUBLE PRECISION,
    "occupancyPersons" INTEGER,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "BuildingFloor_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "BuildingFloor_factoryProfileId_idx" ON "BuildingFloor" ("factoryProfileId")`,
  `CREATE INDEX IF NOT EXISTS "BuildingFloor_buildingId_idx" ON "BuildingFloor" ("buildingId")`,
  `CREATE INDEX IF NOT EXISTS "BuildingFloor_siteId_idx" ON "BuildingFloor" ("siteId")`,
  // One row per level per building. Partial index so a soft-deleted floor never
  // blocks re-creating that level (isDeleted rows are kept for the audit trail).
  `CREATE UNIQUE INDEX IF NOT EXISTS "BuildingFloor_buildingId_floorLevel_key"
     ON "BuildingFloor" ("buildingId", "floorLevel") WHERE "isDeleted" = false`,

  // ── BuildingFloorActivity ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "BuildingFloorActivity" (
    "id" TEXT NOT NULL,
    "factoryProfileId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL DEFAULT 'PROCESS',
    "activityName" TEXT NOT NULL,
    "processId" TEXT,
    "description" TEXT,
    "sequenceOrder" INTEGER,
    "areaSqm" DOUBLE PRECISION,
    "headcount" INTEGER,
    "productionCapacityPcsPerDay" DOUBLE PRECISION,
    "fabricConsumptionMPerDay" DOUBLE PRECISION,
    "powerRatingKva" DOUBLE PRECISION,
    "waterCapacityKld" DOUBLE PRECISION,
    "wasteGeneratedKgPerDay" DOUBLE PRECISION,
    "keyHazards" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "BuildingFloorActivity_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "BuildingFloorActivity_factoryProfileId_idx" ON "BuildingFloorActivity" ("factoryProfileId")`,
  `CREATE INDEX IF NOT EXISTS "BuildingFloorActivity_buildingId_idx" ON "BuildingFloorActivity" ("buildingId")`,
  `CREATE INDEX IF NOT EXISTS "BuildingFloorActivity_floorId_idx" ON "BuildingFloorActivity" ("floorId")`,
  `CREATE INDEX IF NOT EXISTS "BuildingFloorActivity_siteId_idx" ON "BuildingFloorActivity" ("siteId")`,
  `CREATE INDEX IF NOT EXISTS "BuildingFloorActivity_siteId_activityType_idx" ON "BuildingFloorActivity" ("siteId", "activityType")`,

  // ── FactoryProfileChangeRequest ────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "FactoryProfileChangeRequest" (
    "id" TEXT NOT NULL,
    "factoryProfileId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "changes" JSONB NOT NULL DEFAULT '[]',
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_UNIT',
    "requestedBy" TEXT,
    "requestedByRole" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unitApprovedBy" TEXT,
    "unitApprovedAt" TIMESTAMP(3),
    "unitApprovalComment" TEXT,
    "complianceApprovedBy" TEXT,
    "complianceApprovedAt" TIMESTAMP(3),
    "complianceApprovalComment" TEXT,
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedAtStep" TEXT,
    "rejectionReason" TEXT,
    "appliedAt" TIMESTAMP(3),
    "autoApplied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "FactoryProfileChangeRequest_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "FactoryProfileChangeRequest_profile_version_key"
     ON "FactoryProfileChangeRequest" ("factoryProfileId", "version")`,
  `CREATE INDEX IF NOT EXISTS "FactoryProfileChangeRequest_factoryProfileId_idx" ON "FactoryProfileChangeRequest" ("factoryProfileId")`,
  `CREATE INDEX IF NOT EXISTS "FactoryProfileChangeRequest_siteId_idx" ON "FactoryProfileChangeRequest" ("siteId")`,
  `CREATE INDEX IF NOT EXISTS "FactoryProfileChangeRequest_status_idx" ON "FactoryProfileChangeRequest" ("status")`,

  // ── Foreign keys (CASCADE on hard delete; the soft-delete cascade lives in
  //    the router, matching the rest of the Facilities module) ───────────────
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BuildingFloor_factoryProfileId_fkey') THEN
       ALTER TABLE "BuildingFloor"
         ADD CONSTRAINT "BuildingFloor_factoryProfileId_fkey"
         FOREIGN KEY ("factoryProfileId") REFERENCES "FactoryProfile" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BuildingFloor_buildingId_fkey') THEN
       ALTER TABLE "BuildingFloor"
         ADD CONSTRAINT "BuildingFloor_buildingId_fkey"
         FOREIGN KEY ("buildingId") REFERENCES "Building" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BuildingFloorActivity_factoryProfileId_fkey') THEN
       ALTER TABLE "BuildingFloorActivity"
         ADD CONSTRAINT "BuildingFloorActivity_factoryProfileId_fkey"
         FOREIGN KEY ("factoryProfileId") REFERENCES "FactoryProfile" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BuildingFloorActivity_floorId_fkey') THEN
       ALTER TABLE "BuildingFloorActivity"
         ADD CONSTRAINT "BuildingFloorActivity_floorId_fkey"
         FOREIGN KEY ("floorId") REFERENCES "BuildingFloor" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FactoryProfileChangeRequest_factoryProfileId_fkey') THEN
       ALTER TABLE "FactoryProfileChangeRequest"
         ADD CONSTRAINT "FactoryProfileChangeRequest_factoryProfileId_fkey"
         FOREIGN KEY ("factoryProfileId") REFERENCES "FactoryProfile" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,

  // ── Backfill: every existing building gets a floor register derived from its
  //    `floors` count, so the Buildings tab is never empty on first open.
  //    Guarded on "building has no floors yet" so a re-run is a no-op.
  `INSERT INTO "BuildingFloor" (
     "id", "factoryProfileId", "buildingId", "siteId", "floorLabel", "floorLevel",
     "createdAt", "updatedAt", "createdBy"
   )
   SELECT
     'bf_' || b."id" || '_' || g.lvl,
     b."factoryProfileId", b."id", b."siteId",
     CASE WHEN g.lvl = 0 THEN 'Ground Floor' ELSE 'Floor ' || g.lvl END,
     g.lvl,
     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ddl-backfill'
   FROM "Building" b
   CROSS JOIN LATERAL generate_series(0, GREATEST(b."floors", 1) - 1) AS g(lvl)
   WHERE b."isDeleted" = false
     AND NOT EXISTS (
       SELECT 1 FROM "BuildingFloor" f
       WHERE f."buildingId" = b."id" AND f."isDeleted" = false
     )`,
];

async function main() {
  console.log("Applying Factory Profile v2 DDL (Floors + Floor activities + Change requests)…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 66);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }
  const bf = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "BuildingFloor"`);
  const ba = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "BuildingFloorActivity"`);
  const cr = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT count(*)::bigint AS c FROM "FactoryProfileChangeRequest"`
  );
  console.log(
    `✅  Tables ready. BuildingFloor rows=${bf[0].c}, BuildingFloorActivity rows=${ba[0].c}, ` +
      `FactoryProfileChangeRequest rows=${cr[0].c}`
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
