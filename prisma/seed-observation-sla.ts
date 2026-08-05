// Seeds the default Observation SLA matrix + deroster review config.
//
// Idempotent: upserts on the natural key, so re-running restores the defaults
// for rows nobody has edited and leaves edited ones alone unless --force.
//   npx tsx prisma/seed-observation-sla.ts             # global defaults only
//   npx tsx prisma/seed-observation-sla.ts --force     # overwrite edited rows
//
// Seeds the GLOBAL scope (plantId NULL) only. Plant rows are overrides created
// by an admin in Settings → Configuration → Observation SLA Matrix; seeding one
// per plant would turn every plant into an override and quietly break the
// "change the default once, applies everywhere" behaviour the matrix exists for.
//
// categoryGroup is BEHAVIORAL for act-axis observations and PHYSICAL for
// condition-axis ones — see app/services/observation_sla.py for why the axis,
// not the STOP category, is the right key.

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

const FORCE = process.argv.includes("--force");

type Row = { severity: string; categoryGroup: string; slaDays: number };

// Behavioural deviations get the tighter clock: a person is doing something
// unsafe right now, so the corrective window is shorter than for a physical
// condition that usually needs procurement or engineering work to fix.
export const DEFAULT_MATRIX: Row[] = [
  { severity: "CRITICAL", categoryGroup: "BEHAVIORAL", slaDays: 2 },
  { severity: "CRITICAL", categoryGroup: "PHYSICAL", slaDays: 3 },
  { severity: "HIGH", categoryGroup: "BEHAVIORAL", slaDays: 7 },
  { severity: "HIGH", categoryGroup: "PHYSICAL", slaDays: 14 },
  { severity: "MEDIUM", categoryGroup: "BEHAVIORAL", slaDays: 14 },
  { severity: "MEDIUM", categoryGroup: "PHYSICAL", slaDays: 30 },
  { severity: "LOW", categoryGroup: "BEHAVIORAL", slaDays: 30 },
  { severity: "LOW", categoryGroup: "PHYSICAL", slaDays: 45 },
];

export const DEFAULT_REVIEW_SLA_HOURS = 4;

async function main() {
  console.log(
    `Seeding Observation SLA matrix (global scope)${FORCE ? " — FORCE, overwriting edits" : ""}…`
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of DEFAULT_MATRIX) {
    const existing = await prisma.$queryRawUnsafe<{ id: string; slaDays: number }[]>(
      `SELECT "id", "slaDays" FROM "ObservationSlaConfig"
        WHERE "plantId" IS NULL AND "severity" = $1 AND "categoryGroup" = $2`,
      row.severity,
      row.categoryGroup
    );

    if (existing.length === 0) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ObservationSlaConfig"
           ("id", "plantId", "severity", "categoryGroup", "slaDays", "isActive", "createdAt", "updatedAt")
         VALUES ($1, NULL, $2, $3, $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        randomUUID().replace(/-/g, ""),
        row.severity,
        row.categoryGroup,
        row.slaDays
      );
      created++;
      console.log(`  + ${row.severity} / ${row.categoryGroup} → ${row.slaDays} days`);
      continue;
    }

    if (existing[0].slaDays === row.slaDays) {
      skipped++;
      continue;
    }
    if (!FORCE) {
      skipped++;
      console.log(
        `  · ${row.severity} / ${row.categoryGroup} left at ${existing[0].slaDays} days ` +
          `(default is ${row.slaDays}; pass --force to reset)`
      );
      continue;
    }
    await prisma.$executeRawUnsafe(
      `UPDATE "ObservationSlaConfig" SET "slaDays" = $1, "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $2`,
      row.slaDays,
      existing[0].id
    );
    updated++;
    console.log(
      `  ~ ${row.severity} / ${row.categoryGroup}: ${existing[0].slaDays} → ${row.slaDays} days`
    );
  }

  // Deroster review config — one global row.
  const cfg = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "ObservationDerosterConfig" WHERE "plantId" IS NULL`
  );
  if (cfg.length === 0) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ObservationDerosterConfig"
         ("id", "plantId", "reviewSlaHours", "escalationRoleCode", "isActive", "createdAt", "updatedAt")
       VALUES ($1, NULL, $2, 'HSE_MANAGER', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      randomUUID().replace(/-/g, ""),
      DEFAULT_REVIEW_SLA_HOURS
    );
    console.log(`  + deroster review SLA → ${DEFAULT_REVIEW_SLA_HOURS}h, escalates to HSE_MANAGER`);
  } else {
    console.log("  · deroster review config already present — left as-is");
  }

  console.log(
    `✅  SLA matrix seeded: ${created} created, ${updated} updated, ${skipped} unchanged.\n` +
      "    Escalation contact is unset, so timeouts escalate to HSE_MANAGER role holders.\n" +
      "    Set a named contact per plant in Settings → Configuration → Observation SLA Matrix."
  );
}

main()
  .catch((e) => {
    console.error("❌  Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
