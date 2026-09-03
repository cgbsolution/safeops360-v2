// One-off DDL applier: Observation.department.
//
// Free text, typed by the observer on the New Safety Observation form — the
// department as the site names it out loud ("Dye House", "Utilities night
// shift"). Deliberately NOT an FK to a department master: gating an observation
// on a master row nobody has created yet loses the observation. Structured
// grouping still comes from plantId / areaId.
//
// Additive + idempotent (ADD COLUMN IF NOT EXISTS). Applied through the Prisma
// client because `prisma db push` would drop drifted hand-DDL tables. Run BEFORE
// restarting the backend — the new SQLAlchemy column makes every SELECT on
// Observation 500 until it exists.
//   npx tsx prisma/apply-observation-department-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  `ALTER TABLE "Observation" ADD COLUMN IF NOT EXISTS "department" TEXT`,
];

async function main() {
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log("  ✓", sql.replace(/\s+/g, " ").slice(0, 74));
  }
  console.log("Observation.department applied.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
