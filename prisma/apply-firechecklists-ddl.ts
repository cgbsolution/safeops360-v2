// DDL applier for the Fire & Life Safety checklist build (PIL/EHS/CL 025-028).
// Additive + idempotent — safe to re-run.
//
// This build adds NO tables. The four client checklists run on the existing CAMS
// engine (CamsTemplate -> Section -> Question, CamsEngagement + CamsResponse),
// which `app/models/fire_safety.py` already declares as the single inspection
// store: "one engine, no parallel checklist store". So what is applied here is
// three sets of columns and one index.
//
//   1. CamsTemplate.documentMeta   — the client document's own identity
//      (number, revision, supersedes, effective/review dates, layout). Separate
//      from CamsTemplate.version, which is the platform's edit counter: a sheet
//      is PIL/EHSD/CL/026-R2 no matter how many times it has been re-imported.
//
//   2. CamsEngagement.periodLabel + the Prepared/Reviewed/Approved stamps.
//
//   3. FireEquipment's remaining Register-of-Fire-Extinguishers columns.
//
// THE ONE NON-OBVIOUS STATEMENT is the partial unique index. A periodic record
// must be unique per (template, asset, period) or the auto-create-on-first-touch
// flow races itself: two inspectors opening today's daily sheet at the same
// moment both SELECT nothing and both INSERT, and the plant ends up with two
// half-filled records for the same day and no way to say which is the register.
// A plain unique index cannot be used because every engagement predating this
// build has periodLabel NULL — that part is fine (NULLs do not collide), but it
// would also start silently constraining any future non-fire caller that set the
// column for an unrelated reason. Scoping the index with a WHERE clause keeps
// the guarantee exactly where the guarantee is wanted.
//
//   npx tsx prisma/apply-firechecklists-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  // ── CamsTemplate: controlled-document provenance ───────────────────────────
  `ALTER TABLE "CamsTemplate" ADD COLUMN IF NOT EXISTS "documentMeta" JSONB NOT NULL DEFAULT '{}'::jsonb`,

  // ── CamsEngagement: periodic-record identity + sign-off stamps ─────────────
  `ALTER TABLE "CamsEngagement" ADD COLUMN IF NOT EXISTS "periodLabel" TEXT`,
  `ALTER TABLE "CamsEngagement" ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT`,
  `ALTER TABLE "CamsEngagement" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3)`,
  `ALTER TABLE "CamsEngagement" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT`,
  `ALTER TABLE "CamsEngagement" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3)`,

  // Read path: "every period of template T for asset A", which the grid screens
  // ask on every render (31 rows for a month of daily, 12 for the FE year sheet).
  `CREATE INDEX IF NOT EXISTS "ix_CamsEngagement_period"
     ON "CamsEngagement" ("sourceEntityId","templateId","periodLabel")`,

  // Write path: the uniqueness that makes auto-create-on-first-touch safe under
  // concurrency. Deliberately partial — see the header note.
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_CamsEngagement_period"
     ON "CamsEngagement" ("templateId","sourceEntityId","periodLabel")
     WHERE "periodLabel" IS NOT NULL AND "isDeleted" = false`,

  // ── FireEquipment: the Register of Fire Extinguishers columns ──────────────
  // Twelve of the sheet's sixteen columns already existed on this table. These
  // are the rest. HP-test and refill dates are NOT here: they are certificate
  // lifecycles and belong to FireAssetCertificate, which already models them.
  `ALTER TABLE "FireEquipment" ADD COLUMN IF NOT EXISTS "allottedSerialNo" TEXT`,
  `ALTER TABLE "FireEquipment" ADD COLUMN IF NOT EXISTS "yearOfManufacture" INTEGER`,
  `ALTER TABLE "FireEquipment" ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMP(3)`,
  `ALTER TABLE "FireEquipment" ADD COLUMN IF NOT EXISTS "dateOfDischarge" TIMESTAMP(3)`,
  `ALTER TABLE "FireEquipment" ADD COLUMN IF NOT EXISTS "weightKg" DOUBLE PRECISION`,
  `ALTER TABLE "FireEquipment" ADD COLUMN IF NOT EXISTS "registerRemarks" TEXT`,
  `CREATE INDEX IF NOT EXISTS "ix_FireEquipment_allotted"
     ON "FireEquipment" ("plantId","allottedSerialNo")`,
  `CREATE INDEX IF NOT EXISTS "ix_FireEquipment_expiry" ON "FireEquipment" ("expiryDate")`,

  // The client's allotted serial is their asset tag and must be unique within a
  // plant — two cylinders stencilled "36773" in the same unit is a register
  // error, and the FE Inspection screen resolves an extinguisher by that tag.
  // Partial again: the column is NULL for every non-extinguisher asset and for
  // every row seeded before this build.
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_FireEquipment_allotted"
     ON "FireEquipment" ("plantId","allottedSerialNo")
     WHERE "allottedSerialNo" IS NOT NULL AND "isDeleted" = false`,

  // ── Non-working days — the documented holiday-calendar stopgap ─────────────
  // The client's daily sheets pre-print SUNDAY and HOLIDAY across the date
  // columns, so the grid must know which days are excluded or a compliance
  // report reads "8 missed inspections" for a shutdown week. The build spec's
  // open item #1 asks whether a platform holiday calendar exists to wire into:
  // it does not (searched — nothing in the backend or in schema.prisma), so this
  // is the spec's own stated fallback.
  //
  // Sundays are NOT rows here; they are computed from the date. Storing 52 rows
  // a year per plant to record what `weekday()` already knows is a calendar that
  // can drift out of step with the calendar.
  //
  // Deliberately minimal so that when a real Facilities holiday calendar lands,
  // this migrates across as a straight copy and is dropped rather than kept in
  // parallel.
  `CREATE TABLE IF NOT EXISTS "PlantNonWorkingDay" (
     "id" TEXT PRIMARY KEY,
     "plantId" TEXT NOT NULL,
     "day" TIMESTAMP(3) NOT NULL,
     "label" TEXT NOT NULL DEFAULT 'HOLIDAY',
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "createdBy" TEXT
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ix_PlantNonWorkingDay_plant_day"
     ON "PlantNonWorkingDay" ("plantId","day")`,
];

const NEW_TABLES = ["PlantNonWorkingDay"];

async function main() {
  console.log("Applying Fire checklist (PIL/EHS/CL 025-028) DDL...");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 76);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ok  ${label}`);
  }

  const [tpl] = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT count(*)::bigint AS c FROM "CamsTemplate" WHERE "documentMeta" <> '{}'::jsonb`,
  );
  const [eng] = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT count(*)::bigint AS c FROM "CamsEngagement" WHERE "periodLabel" IS NOT NULL`,
  );
  console.log(`  CamsTemplate carrying document metadata: ${tpl.c}`);
  console.log(`  CamsEngagement holding a period record:  ${eng.c}`);
  for (const t of NEW_TABLES) {
    const [r] = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "${t}"`);
    console.log(`  ${t}: ${r.c} rows`);
  }
  console.log("Fire checklist columns ready. Next: python seed_fire_checklists.py");
}

main()
  .catch((e) => {
    console.error("DDL apply failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
