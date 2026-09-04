// Page Industries observation category master.
//   npx tsx prisma/seed-page-observation-categories.ts
//   npx tsx prisma/seed-page-observation-categories.ts --retire-dupont
//
// Source: Dept.list.xlsx, sheet "Unsafe Act & condition" (2026-09-04) — 17
// unsafe-condition categories and 19 unsafe-act categories, as the site
// classifies them.
//
// These REPLACE the DuPont STOP six as the list an observer picks from. They
// are seeded into ObservationTaxonomy rather than a new table because that is
// the table the server already validates against
// (services/observation_taxonomy.validate_selection) and already serves from
// (/api/observation-taxonomy/categories?type=ACT|CONDITION). A parallel master
// would be a second list that can disagree with the one doing the enforcing.
//
// Two structural notes:
//
//   • Codes are axis-prefixed (UA_ / UC_). The two lists are separate
//     vocabularies that both contain "Others", and a shared code would make
//     one axis's group mapping silently apply to the other.
//
//   • ObservationTaxonomy.subCategoryCode is NOT NULL and category eligibility
//     is DERIVED ("offer a category on an axis if ≥1 active row exists there"),
//     so each category needs one row to exist at all. The Sub-category field
//     was removed from the form, so each gets a single `__GENERAL` placeholder
//     that nothing renders. It is scaffolding for the eligibility query, not a
//     classification anyone chooses.
//
// Idempotent: upserts on (categoryCode, subCategoryCode, observationType), so a
// re-run updates labels and ordering in place and never duplicates.
//
// --retire-dupont additionally sets isActive=false on the six DuPont STOP
// categories, removing them from the dropdown. Existing observations that
// reference them are untouched and still read correctly — deactivating hides a
// category from new entry, it does not delete it.

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

// DATABASE_URL points at the Supabase transaction pooler, which reuses backends
// across statements and so rejects Prisma's named prepared statements with
// 42P05 "prepared statement s0 already exists" on the second query of a run.
// `pgbouncer=true` turns them off; without it this seeder dies on row two.
const POOLED_URL =
  (process.env.DATABASE_URL ?? "") +
  ((process.env.DATABASE_URL ?? "").includes("?") ? "&" : "?") +
  "pgbouncer=true&connection_limit=1";

const prisma = new PrismaClient({ datasources: { db: { url: POOLED_URL } } });

const RETIRE_DUPONT = process.argv.includes("--retire-dupont");

type Spec = {
  code: string;
  label: string;
  /** The legacy ObservationCategory enum bucket this rolls up to — see
   *  services/observation_taxonomy.legacy_category_for. Keep the two in step. */
  legacy: string;
};

/** Sheet column "Unsafe condition category" — a state of the plant. */
const CONDITION: Spec[] = [
  { code: "UC_POOR_HOUSEKEEPING", label: "Poor Housekeeping", legacy: "HOUSEKEEPING" },
  { code: "UC_SLIP_AND_TRIP", label: "Slip & Trip", legacy: "HOUSEKEEPING" },
  { code: "UC_MACHINE_SAFETY", label: "Machine Safety", legacy: "TOOLS_EQUIPMENT" },
  { code: "UC_ELECTRICAL_HAZARD", label: "Electrical hazard", legacy: "ELECTRICAL" },
  { code: "UC_FIRE_AND_EMERGENCY", label: "Fire & Emergency", legacy: "EMERGENCY_PREP" },
  { code: "UC_CHEMICAL_SAFETY", label: "Chemical Safety", legacy: "CHEMICAL_HANDLING" },
  { code: "UC_MATERIAL_STACKING", label: "Material stacking", legacy: "MATERIAL_HANDLING" },
  { code: "UC_WORK_AT_HEIGHT", label: "Work at Height", legacy: "WORK_AT_HEIGHT" },
  { code: "UC_PPE", label: "PPE", legacy: "PPE" },
  { code: "UC_ERGONOMICS", label: "Ergonomics", legacy: "OTHERS" },
  { code: "UC_VEHICLE_TRAFFIC_PARKING", label: "Vehicle / Traffic / Parking", legacy: "MOBILE_EQUIPMENT" },
  { code: "UC_TOOLS_AND_EQUIPMENT", label: "Tools & Equipment", legacy: "TOOLS_EQUIPMENT" },
  { code: "UC_LOTO", label: "LOTO", legacy: "PROCEDURES" },
  { code: "UC_ENVIRONMENTAL", label: "Environmental", legacy: "OTHERS" },
  { code: "UC_STRUCTURAL", label: "Structural", legacy: "OTHERS" },
  { code: "UC_UTILITIES", label: "Utilities", legacy: "OTHERS" },
  { code: "UC_OTHERS", label: "Others", legacy: "OTHERS" }
];

/** Sheet column "Unsafe Act category" — something a person did. */
const ACT: Spec[] = [
  { code: "UA_WORKING_WITHOUT_AUTHORIZATION", label: "Working without authorization", legacy: "PROCEDURES" },
  { code: "UA_FAILURE_TO_USE_PPE", label: "Failure to use PPE", legacy: "PPE" },
  { code: "UA_IMPROPER_USE_OF_EQUIPMENT", label: "Improper use of equipment / usage of damaged tools", legacy: "TOOLS_EQUIPMENT" },
  { code: "UA_BYPASSING_SAFETY_DEVICE", label: "Bypassing safety device / guards", legacy: "TOOLS_EQUIPMENT" },
  { code: "UA_IMPROPER_MATERIAL_HANDLING", label: "Improper handling of material / trolley / equipment / stacking", legacy: "MATERIAL_HANDLING" },
  { code: "UA_VIOLATION_OF_WORK_PERMIT", label: "Violation of work permit", legacy: "PROCEDURES" },
  { code: "UA_HORSEPLAY", label: "Horseplay", legacy: "REACTIONS_OF_PEOPLE" },
  { code: "UA_FAILURE_TO_FOLLOW_SOP", label: "Failure to follow SOP", legacy: "PROCEDURES" },
  { code: "UA_FAILURE_TO_USE_LOTO", label: "Failure to use LOTO", legacy: "PROCEDURES" },
  { code: "UA_WORKING_IN_UNSECURE_POSITION", label: "Working in unsecure position / place", legacy: "POSITIONS_OF_PEOPLE" },
  { code: "UA_FAILURE_TO_REPORT_HAZARD", label: "Failure to report hazard", legacy: "REACTIONS_OF_PEOPLE" },
  { code: "UA_UNAUTHORIZED_MODIFICATION", label: "Unauthorized modification", legacy: "PROCEDURES" },
  { code: "UA_ENTERING_RESTRICTED_AREA", label: "Entering restricted areas without authorization", legacy: "POSITIONS_OF_PEOPLE" },
  { code: "UA_DISTRACTED_WORKING", label: "Distracted working", legacy: "REACTIONS_OF_PEOPLE" },
  { code: "UA_IMPROPER_CHEMICAL_HANDLING", label: "Improper chemical handling / disposal / storage / display", legacy: "CHEMICAL_HANDLING" },
  { code: "UA_REVERSING_WITHOUT_CHECKING", label: "Reversing without checking surroundings", legacy: "MOBILE_EQUIPMENT" },
  { code: "UA_FAILURE_TO_COMMUNICATE", label: "Failure to communicate / coordinate before starting work", legacy: "PROCEDURES" },
  { code: "UA_UNAUTHORIZED_EQUIPMENT_USE", label: "Usage of unauthorized equipment / container / cable / sharp objects", legacy: "TOOLS_EQUIPMENT" },
  { code: "UA_OTHERS", label: "Others", legacy: "OTHERS" }
];

const DUPONT_CODES = [
  "REACTIONS_OF_PEOPLE",
  "POSITIONS_OF_PEOPLE",
  "PPE",
  "TOOLS_EQUIPMENT",
  "PROCEDURES",
  "HOUSEKEEPING"
];

async function seedAxis(specs: Spec[], axis: "ACT" | "CONDITION", refPrefix: string) {
  let i = 0;
  for (const s of specs) {
    i += 1;
    const displayOrder = i * 10;
    const stopReferenceCode = `${refPrefix}-${String(i).padStart(2, "0")}`;
    await prisma.observationTaxonomy.upsert({
      where: {
        categoryCode_subCategoryCode_observationType: {
          categoryCode: s.code,
          subCategoryCode: `${s.code}__GENERAL`,
          observationType: axis
        }
      },
      update: {
        categoryLabel: s.label,
        subCategoryLabel: "General",
        stopReferenceCode,
        displayOrder,
        isActive: true
      },
      create: {
        categoryCode: s.code,
        categoryLabel: s.label,
        observationType: axis,
        subCategoryCode: `${s.code}__GENERAL`,
        subCategoryLabel: "General",
        stopReferenceCode,
        displayOrder,
        isActive: true
      }
    });
  }
  console.log(`  ✓ ${specs.length} ${axis} categories`);
}

async function seedGroups(specs: Spec[], axis: "ACT" | "CONDITION", group: "BEHAVIORAL" | "PHYSICAL", notes: string) {
  // Drives the SLA closure-date matrix (severity × category group). Seeded per
  // axis rather than 'ANY' because the rule IS the axis: an act is something a
  // person did (behavioural), a condition is a state of the plant (physical).
  for (const s of specs) {
    const existing = await prisma.observationCategoryGroup.findFirst({
      where: { categoryCode: s.code, axis }
    });
    if (existing) continue;
    await prisma.observationCategoryGroup.create({
      data: {
        id: randomUUID().replace(/-/g, ""),
        categoryCode: s.code,
        axis,
        categoryGroup: group,
        isActive: true,
        notes
      }
    });
  }
  console.log(`  ✓ ${specs.length} ${axis} category groups → ${group}`);
}

async function main() {
  console.log("Seeding Page Industries observation categories…");
  await seedAxis(CONDITION, "CONDITION", "PI-UC");
  await seedAxis(ACT, "ACT", "PI-UA");

  await seedGroups(
    ACT,
    "ACT",
    "BEHAVIORAL",
    "Unsafe act — something a person did. Behavioural by definition, and correctable by coaching."
  );
  await seedGroups(
    CONDITION,
    "CONDITION",
    "PHYSICAL",
    "Unsafe condition — a state of the plant. Physical by definition, and correctable by engineering or housekeeping."
  );

  if (RETIRE_DUPONT) {
    const { count } = await prisma.observationTaxonomy.updateMany({
      where: { categoryCode: { in: DUPONT_CODES } },
      data: { isActive: false }
    });
    console.log(`  ✓ retired ${count} DuPont STOP taxonomy rows (isActive=false)`);
  } else {
    console.log("  · DuPont STOP categories left active — re-run with --retire-dupont to hide them");
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
