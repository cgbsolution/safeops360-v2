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

// DDL goes down the DIRECT connection, not the pooled one.
//
// `DATABASE_URL` points at Supabase's transaction-mode pooler (port 6543). In
// that mode pgbouncer multiplexes one server connection across clients and does
// not reset named prepared statements between them, so Prisma's `$executeRawUnsafe`
// — which prepares as `s0`, `s1`, … — fails on the SECOND run of this script with
// `42P05: prepared statement "s0" already exists`. The first run succeeds, which
// is what makes it a nasty one: the script looks fine until someone re-runs it.
//
// `DATABASE_URL_SYNC` (port 5432) is the session-mode/direct URL the Prisma
// schema already declares as `directUrl` for exactly this reason. Migrations and
// DDL belong on it; only the application's request traffic wants the pooler.
const DDL_URL =
  process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL_SYNC ?? process.env.DATABASE_URL;

const prisma = new PrismaClient(
  DDL_URL ? { datasources: { db: { url: DDL_URL } } } : undefined,
);

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

  // ── Captured signatures on the sign-off chain ─────────────────────────────
  // A userId and a timestamp record who the SYSTEM believes acted; they do not
  // record a person putting their name to a statement, and the sheet being
  // reproduced prints a "Sign. & Date:" box under each of its three roles.
  //
  // Shape is copied exactly from ComplianceAudit.signOffs (WP-41) — same
  // DRAWN/TYPED vocabulary, same keys, same SignatureModal canvas on the front
  // end, same services/signoff.validate_signature guard. One signature
  // mechanism on this platform; this is a second consumer of it, not a new one.
  `ALTER TABLE "CamsEngagement" ADD COLUMN IF NOT EXISTS "signOffs" JSONB`,

  // ── Re-observation of an OPEN finding ─────────────────────────────────────
  // `isRepeatFinding` means "came back after being closed". These mean "never
  // went away": the same check failing on the same asset day after day while the
  // CAPA is still open. That distinction is what lets a DAILY checklist raise
  // CAPAs at all — without it a lamp dead for three weeks is either 21 CAPAs or
  // none.
  //
  // Typed columns rather than a JSON blob: "which defects recur most" deserves an
  // ORDER BY, and the first cut of this wrote into a `sourceMetadata` attribute
  // that does not exist on CamsFinding, so every write silently no-op'd and the
  // count stuck at 2. A column fails loudly.
  `ALTER TABLE "CamsFinding" ADD COLUMN IF NOT EXISTS "occurrenceCount" INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE "CamsFinding" ADD COLUMN IF NOT EXISTS "lastObservedAt" TIMESTAMP(3)`,
  `ALTER TABLE "CamsFinding" ADD COLUMN IF NOT EXISTS "observedPeriods" JSONB NOT NULL DEFAULT '[]'::jsonb`,
  // The dedupe lookup: "is there an open finding for this asset and this item?",
  // asked once per failed check on every submit.
  `CREATE INDEX IF NOT EXISTS "ix_CamsFinding_asset_question"
     ON "CamsFinding" ("areaOrAssetRef","sourceQuestionId","status")`,

  // ── Branded register skins ────────────────────────────────────────────────
  // "Register of Fire Extinguishers" is a controlled document with its own
  // number, revision, column order and print layout. So is a Register of Fire
  // Alarm Panels. What they are NOT is separate asset registers — each is
  // FireEquipment filtered by type, and treating them as separate stores is how
  // this module previously ended up with two add/edit paths onto one table.
  //
  // So a branded register is a config row: filter, columns, branding, PDF
  // layout. The next one is a seed entry, not a screen.
  `CREATE TABLE IF NOT EXISTS "FireRegisterViewConfig" (
     "id" TEXT PRIMARY KEY,
     "tenantId" TEXT,
     "assetType" TEXT NOT NULL,
     "brandName" TEXT NOT NULL,
     "routeSlug" TEXT NOT NULL,
     "documentNo" TEXT NOT NULL,
     "supersedesNo" TEXT,
     "revision" TEXT NOT NULL DEFAULT 'R1',
     "effectiveDate" TIMESTAMP(3),
     "reviewDate" TIMESTAMP(3),
     "department" TEXT NOT NULL DEFAULT 'EHS',
     "columns" JSONB NOT NULL DEFAULT '[]'::jsonb,
     "pdfTemplateKey" TEXT NOT NULL DEFAULT 'GENERIC_REGISTER',
     "isActive" BOOLEAN NOT NULL DEFAULT true,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "createdBy" TEXT,
     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedBy" TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS "ix_FireRegisterViewConfig_type"
     ON "FireRegisterViewConfig" ("assetType","isActive")`,
  `CREATE INDEX IF NOT EXISTS "ix_FireRegisterViewConfig_slug"
     ON "FireRegisterViewConfig" ("routeSlug")`,
  // One ACTIVE config per asset type. Two would make "which register IS the
  // register for extinguishers" a question the UI answers arbitrarily. Partial,
  // so retired configs can be kept for their document history.
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_FireRegisterViewConfig_active"
     ON "FireRegisterViewConfig" ("assetType")
     WHERE "isActive" = true AND "tenantId" IS NULL`,
];

const NEW_TABLES = ["PlantNonWorkingDay", "FireRegisterViewConfig"];

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
