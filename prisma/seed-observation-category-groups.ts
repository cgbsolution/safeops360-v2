// Seeds the DuPont STOP category → Behavioural | Physical mapping used by the
// Observation SLA closure-date matrix.
//
//   npx tsx prisma/seed-observation-category-groups.ts            # fill gaps only
//   npx tsx prisma/seed-observation-category-groups.ts --force    # reset edited rows
//
// Idempotent. Without --force this only INSERTS missing rows and never
// overwrites an existing one — so a decision recorded in the admin screen is
// not silently reverted by a re-run. That matters most for STOP-2: once Harry
// rules on it, re-running this seed must not put it back to PENDING_DECISION.
//
// Axis is seeded as 'ANY' throughout, matching the published grouping. The
// schema supports per-axis rows (ACT / CONDITION) if a category is ever split,
// and an exact-axis row beats an ANY row at lookup time.

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

const FORCE = process.argv.includes("--force");

type Row = {
  categoryCode: string;
  categoryGroup: "BEHAVIORAL" | "PHYSICAL" | "PENDING_DECISION";
  notes: string;
};

export const CATEGORY_GROUPS: Row[] = [
  {
    categoryCode: "REACTIONS_OF_PEOPLE",
    categoryGroup: "BEHAVIORAL",
    notes:
      "STOP-1. A reaction is something a person does on seeing an observer — " +
      "behavioural by definition, and correctable by coaching.",
  },
  {
    // The one deliberately-undecided row. Positions of People is the
    // line-of-fire category: it reads as behavioural (where a person put
    // themselves) but the exposures under it — struck by, caught between,
    // contact with electrical current — are often driven by physical layout.
    // Not ours to call.
    categoryCode: "POSITIONS_OF_PEOPLE",
    categoryGroup: "PENDING_DECISION",
    notes:
      "STOP-2. OPEN DECISION — pending Harry's ruling. Behavioural (where a " +
      "person placed themselves) vs Physical (layout / line-of-fire exposure) " +
      "is genuinely arguable and changes the closure SLA. Until it is set, " +
      "observations in this category resolve NO auto SLA and the reporter " +
      "enters a closure date manually.",
  },
  {
    categoryCode: "PPE",
    categoryGroup: "PHYSICAL",
    notes: "STOP-3. Personal Protective Equipment.",
  },
  {
    categoryCode: "TOOLS_EQUIPMENT",
    categoryGroup: "PHYSICAL",
    notes: "STOP-4. Tools & Equipment.",
  },
  {
    categoryCode: "PROCEDURES",
    categoryGroup: "PHYSICAL",
    notes: "STOP-5. Procedures.",
  },
  {
    categoryCode: "HOUSEKEEPING",
    categoryGroup: "PHYSICAL",
    notes: "STOP-6. Housekeeping / Orderliness.",
  },
];

async function main() {
  console.log(
    `Seeding STOP category → SLA group mapping${FORCE ? " — FORCE, overwriting edits" : ""}…`
  );

  let created = 0;
  let updated = 0;
  let kept = 0;

  for (const row of CATEGORY_GROUPS) {
    const existing = await prisma.$queryRawUnsafe<{ id: string; categoryGroup: string }[]>(
      `SELECT "id", "categoryGroup" FROM "ObservationCategoryGroup"
        WHERE "categoryCode" = $1 AND "axis" = 'ANY'`,
      row.categoryCode
    );

    if (existing.length === 0) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ObservationCategoryGroup"
           ("id", "categoryCode", "axis", "categoryGroup", "notes", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, 'ANY', $3, $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        randomUUID().replace(/-/g, ""),
        row.categoryCode,
        row.categoryGroup,
        row.notes
      );
      created++;
      console.log(`  + ${row.categoryCode.padEnd(22)} → ${row.categoryGroup}`);
      continue;
    }

    if (existing[0].categoryGroup === row.categoryGroup) {
      kept++;
      continue;
    }
    if (!FORCE) {
      kept++;
      console.log(
        `  · ${row.categoryCode.padEnd(22)} left at ${existing[0].categoryGroup} ` +
          `(seed default is ${row.categoryGroup}; pass --force to reset)`
      );
      continue;
    }
    await prisma.$executeRawUnsafe(
      `UPDATE "ObservationCategoryGroup"
          SET "categoryGroup" = $1, "notes" = $2, "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $3`,
      row.categoryGroup,
      row.notes,
      existing[0].id
    );
    updated++;
    console.log(
      `  ~ ${row.categoryCode.padEnd(22)} ${existing[0].categoryGroup} → ${row.categoryGroup}`
    );
  }

  const pending = await prisma.$queryRawUnsafe<{ categoryCode: string }[]>(
    `SELECT "categoryCode" FROM "ObservationCategoryGroup"
      WHERE "categoryGroup" = 'PENDING_DECISION' AND "isActive" = true`
  );

  console.log(`✅  Mapping seeded: ${created} created, ${updated} updated, ${kept} unchanged.`);
  if (pending.length > 0) {
    console.log(
      `⚠   ${pending.length} category(ies) awaiting a decision: ` +
        pending.map((p) => p.categoryCode).join(", ")
    );
    console.log(
      "    Observations in these categories get NO auto closure date — the " +
        "reporter sets it manually and sees an inline notice.\n" +
        "    Resolve in Settings → Configuration → Observation SLA Matrix."
    );
  }
}

main()
  .catch((e) => {
    console.error("❌  Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
