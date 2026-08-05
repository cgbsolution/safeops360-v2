// DuPont STOP observation taxonomy seed.
//   npm run db:seed-observation-taxonomy
//
// Idempotent: upserts on (categoryCode, subCategoryCode, observationType), so a
// re-run updates labels/order in place and never duplicates. Safe to re-run
// after editing a label.
//
// The whole Act-vs-Condition fix rests on ONE property of this file: STOP-1
// "Reactions of People" and STOP-2 "Positions of People" have zero CONDITION
// rows. Category eligibility is derived (a category is offered for an axis only
// if ≥1 active sub-category exists there), so those two categories disappear
// from the Condition dropdown automatically. Do not add CONDITION rows to them
// without understanding that it re-breaks the demo bug.
//
// Requires apply-observation-taxonomy-ddl.ts to have run first.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Row = {
  categoryCode: string;
  categoryLabel: string;
  stopReferenceCode: string;
  observationType: "ACT" | "CONDITION";
  subCategoryCode: string;
  subCategoryLabel: string;
};

type CategorySpec = {
  code: string;
  label: string;
  stop: string;
  act: [string, string][];
  condition: [string, string][];
};

// Exported so the shape can be asserted without touching the database — the
// Act-only property of STOP-1/STOP-2 is the whole fix and is worth checking
// independently of a live connection.
export const CATEGORIES: CategorySpec[] = [
  {
    code: "REACTIONS_OF_PEOPLE",
    label: "Reactions of People",
    stop: "STOP-1",
    act: [
      ["RP_ADJUSTED_PPE", "Adjusted PPE on seeing observer"],
      ["RP_CHANGED_POSITION", "Changed body position"],
      ["RP_REARRANGED_JOB", "Rearranged the job"],
      ["RP_STOPPED_JOB", "Stopped the job"],
      ["RP_ATTACHED_GROUNDS", "Attached grounds/lockout on approach"],
    ],
    // Act-only by design — a reaction is something a person does.
    condition: [],
  },
  {
    code: "POSITIONS_OF_PEOPLE",
    label: "Positions of People",
    stop: "STOP-2",
    act: [
      ["PP_STRIKING_AGAINST", "Striking against"],
      ["PP_STRUCK_BY", "Struck by"],
      ["PP_CAUGHT_IN_ON_BETWEEN", "Caught in/on/between objects"],
      ["PP_FALLING_SAME_LEVEL", "Falling — same level"],
      ["PP_FALLING_DIFFERENT_LEVEL", "Falling — different level"],
      ["PP_CONTACT_TEMPERATURE", "Contact with temperature extreme"],
      ["PP_CONTACT_ELECTRICAL", "Contact with electrical current"],
      ["PP_OVEREXERTION", "Overexertion — lifting/pulling/pushing/reaching"],
    ],
    // Act-only by design — a position is where a person put themselves.
    condition: [],
  },
  {
    code: "PPE",
    label: "Personal Protective Equipment",
    stop: "STOP-3",
    act: [
      ["PPE_NOT_WORN", "PPE not worn"],
      ["PPE_WORN_INCORRECTLY", "PPE worn incorrectly"],
      ["PPE_REMOVED_DURING_TASK", "PPE removed/bypassed during task"],
    ],
    condition: [
      ["PPE_NOT_AVAILABLE", "PPE not available at workstation"],
      ["PPE_DAMAGED_OR_EXPIRED", "PPE damaged or expired"],
      ["PPE_WRONG_SPEC", "PPE not suited to the hazard (wrong spec issued)"],
    ],
  },
  {
    code: "TOOLS_EQUIPMENT",
    label: "Tools & Equipment",
    stop: "STOP-4",
    act: [
      ["TE_WRONG_TOOL", "Wrong tool used for the job"],
      ["TE_USED_INCORRECTLY", "Tool/equipment used incorrectly"],
      ["TE_IMPROVISED_TOOL", "Improvised/homemade tool used"],
    ],
    condition: [
      ["TE_DAMAGED", "Tool/equipment damaged"],
      ["TE_UNSAFE_CONDITION", "Tool/equipment in unsafe condition"],
      ["TE_GUARD_MISSING", "Machine guard missing or defeated"],
      ["TE_OVERDUE_MAINTENANCE", "Equipment overdue calibration/maintenance"],
    ],
  },
  {
    code: "PROCEDURES",
    label: "Procedures",
    stop: "STOP-5",
    act: [
      ["PR_NOT_FOLLOWED", "Procedure not followed"],
      ["PR_DEVIATED_FROM_SOP", "Deviated from SOP"],
      ["PR_PERMIT_LOTO_BYPASSED", "Permit/LOTO step bypassed"],
    ],
    condition: [
      ["PR_INADEQUATE_OR_OUTDATED", "Procedure inadequate or outdated"],
      ["PR_NOT_AVAILABLE", "Procedure not available at worksite"],
      ["PR_NOT_UNDERSTOOD", "Procedure/signage not understood (language/literacy gap)"],
    ],
  },
  {
    code: "HOUSEKEEPING",
    label: "Housekeeping / Orderliness",
    stop: "STOP-6",
    act: [
      ["HK_NOT_CLEAN_AS_YOU_GO", "Did not clean as you go"],
      ["HK_OBSTRUCTING_PATH", "Left materials/tools obstructing a path"],
      ["HK_IMPROPER_WASTE_DISPOSAL", "Improper waste disposal"],
    ],
    condition: [
      ["HK_SPILL_NOT_CLEANED", "Spill/leak not cleaned"],
      ["HK_BLOCKED_EGRESS", "Blocked egress or walkway"],
      ["HK_POOR_LIGHTING", "Poor lighting"],
      ["HK_CLUTTER_DEBRIS", "Clutter/debris in work area"],
      ["HK_DAMAGED_FLOORING", "Damaged flooring/walking surface"],
    ],
  },
];

/** Flatten to rows. displayOrder = (category index + 1) * 100 + position, so
 *  categories sort in STOP order and sub-categories keep their authored
 *  sequence within a category. */
export function buildRows(): (Row & { displayOrder: number })[] {
  const rows: (Row & { displayOrder: number })[] = [];
  CATEGORIES.forEach((cat, ci) => {
    const push = (observationType: "ACT" | "CONDITION", pairs: [string, string][]) => {
      pairs.forEach(([subCategoryCode, subCategoryLabel], si) => {
        rows.push({
          categoryCode: cat.code,
          categoryLabel: cat.label,
          stopReferenceCode: cat.stop,
          observationType,
          subCategoryCode,
          subCategoryLabel,
          displayOrder: (ci + 1) * 100 + si,
        });
      });
    };
    push("ACT", cat.act);
    push("CONDITION", cat.condition);
  });
  return rows;
}

async function main() {
  const rows = buildRows();
  console.log(`Seeding ObservationTaxonomy — ${rows.length} rows across ${CATEGORIES.length} categories…`);

  let created = 0;
  let updated = 0;

  for (const { displayOrder, ...row } of rows) {
    const existing = await prisma.observationTaxonomy.findUnique({
      where: {
        categoryCode_subCategoryCode_observationType: {
          categoryCode: row.categoryCode,
          subCategoryCode: row.subCategoryCode,
          observationType: row.observationType,
        },
      },
      select: { id: true },
    });

    await prisma.observationTaxonomy.upsert({
      where: {
        categoryCode_subCategoryCode_observationType: {
          categoryCode: row.categoryCode,
          subCategoryCode: row.subCategoryCode,
          observationType: row.observationType,
        },
      },
      // Re-running must not silently resurrect a row an admin deactivated, so
      // `isActive` is only set on insert.
      update: {
        categoryLabel: row.categoryLabel,
        subCategoryLabel: row.subCategoryLabel,
        stopReferenceCode: row.stopReferenceCode,
        displayOrder,
      },
      create: { ...row, displayOrder, isActive: true },
    });

    if (existing) updated++;
    else created++;
  }

  // Report the eligibility split — this is the line that proves the fix.
  const summary: Record<string, { act: number; condition: number }> = {};
  for (const cat of CATEGORIES) {
    summary[cat.code] = {
      act: await prisma.observationTaxonomy.count({
        where: { categoryCode: cat.code, observationType: "ACT", isActive: true },
      }),
      condition: await prisma.observationTaxonomy.count({
        where: { categoryCode: cat.code, observationType: "CONDITION", isActive: true },
      }),
    };
  }

  console.log(`✅  ${created} created, ${updated} updated (idempotent re-run → 0 created).`);
  console.log("\n    Category                 ACT   CONDITION");
  for (const [code, s] of Object.entries(summary)) {
    const flag = s.condition === 0 ? "   ← Act-only (hidden under Condition)" : "";
    console.log(`    ${code.padEnd(22)} ${String(s.act).padStart(4)} ${String(s.condition).padStart(10)}${flag}`);
  }
}

// Only seed when run directly. CATEGORIES / buildRows are exported for
// verification, and this backend's .env points at the live database — an
// import must never be able to trigger a write as a side effect.
if (require.main === module) {
  main()
    .catch((e) => {
      console.error("❌  Seed failed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
