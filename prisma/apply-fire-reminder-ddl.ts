// Overdue fire-checklist reminders + escalation state.
//
// Two things:
//   1. FireEquipment.assignedTechnicianId — who gets told when a sheet is late.
//      Expected to be NULL on every existing row: nothing on this platform has
//      ever assigned a fire asset to a person (maintenanceContractor is free
//      text naming a company). The reminder job is written to behave correctly
//      with it unset, reporting the gap rather than guessing a recipient.
//   2. FireChecklistReminder — one row per overdue occurrence. It is what makes
//      the nightly sweep idempotent (unique on asset+template+period, so the
//      same reminder is not re-sent every night), what makes the escalation
//      visible on the asset instead of only in an inbox, and what answers "who
//      was told, and when" about a missed statutory inspection.
//
// Mirrors prisma/apply-capture-ddl.ts: additive, idempotent, applied through the
// Prisma client's connection because `prisma db execute` / `migrate diff` hang
// against the pooler in this environment, and `prisma db push` would drop the
// drifted hand-DDL tables.
//   npx tsx prisma/apply-fire-reminder-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  `ALTER TABLE "FireEquipment" ADD COLUMN IF NOT EXISTS "assignedTechnicianId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "ix_FireEquipment_technician"
     ON "FireEquipment" ("assignedTechnicianId")`,

  `CREATE TABLE IF NOT EXISTS "FireChecklistReminder" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateCode" TEXT,
    "frequency" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "technicianUserId" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "escalatedTo" JSONB NOT NULL DEFAULT '[]',
    "unassigned" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FireChecklistReminder_pkey" PRIMARY KEY ("id")
  )`,
  // The idempotency backstop. Without this the nightly sweep would mint a new
  // reminder — and send a new email — every night the sheet stayed unfilled.
  `CREATE UNIQUE INDEX IF NOT EXISTS "ix_FireChecklistReminder_occurrence"
     ON "FireChecklistReminder" ("assetId", "templateId", "period")`,
  `CREATE INDEX IF NOT EXISTS "ix_FireChecklistReminder_plant_state"
     ON "FireChecklistReminder" ("plantId", "state")`,
  `CREATE INDEX IF NOT EXISTS "ix_FireChecklistReminder_asset"
     ON "FireChecklistReminder" ("assetId", "state")`,
];

async function main() {
  console.log("Applying fire checklist reminder DDL…");
  for (const sql of STATEMENTS) {
    const label = sql.trim().split("\n")[0].slice(0, 72);
    await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label}`);
  }

  const [assets] = await prisma.$queryRawUnsafe<{ total: bigint; assigned: bigint }[]>(
    `SELECT count(*)::bigint AS total, count("assignedTechnicianId")::bigint AS assigned
       FROM "FireEquipment" WHERE "isDeleted" = false`,
  );
  const [rem] = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT count(*)::bigint AS c FROM "FireChecklistReminder"`,
  );
  console.log(
    `✅  Ready: ${assets.total} fire asset(s), ${assets.assigned} with an assigned technician; ` +
      `${rem.c} reminder row(s).`,
  );
  if (Number(assets.assigned) === 0 && Number(assets.total) > 0) {
    console.log(
      "\n⚠  No asset has an assigned technician. That is expected — the column is new.\n" +
        "   Until the assignment approach is decided, the sweep runs with\n" +
        "   FIRE_REMINDER_UNASSIGNED_STRATEGY=report (the default): it records the\n" +
        "   overdue period and escalates to the EHS lead, and notifies no technician\n" +
        "   rather than guessing one.",
    );
  }
}

main()
  .catch((e) => {
    console.error("❌  DDL apply failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
