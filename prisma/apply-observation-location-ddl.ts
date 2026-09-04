// One-off DDL applier: Observation.location.
//
// Free text, typed by the observer on the New Safety Observation form. The
// Location field was an Area dropdown (areaId -> Area); the site asked for a
// typed field instead, because the place something is observed is rarely one of
// a plant's registered areas — it is "behind the Elastic line, near the RM
// door". A master row nobody has created must not be what stops an observation
// being filed.
//
// `areaId` is KEPT and still populated on legacy records: it is a real FK that
// the area hazard tier and historical reporting read. New observations simply
// leave it null and carry `location` instead.
//
// Additive + idempotent (ADD COLUMN IF NOT EXISTS). Applied through the Prisma
// client because `prisma db push` would drop drifted hand-DDL tables. Run BEFORE
// restarting the backend — the new SQLAlchemy column makes every SELECT on
// Observation 500 until it exists.
//   npx tsx prisma/apply-observation-location-ddl.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  `ALTER TABLE "Observation" ADD COLUMN IF NOT EXISTS "location" TEXT`,
];

async function main() {
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log("  ✓", sql.replace(/\s+/g, " ").slice(0, 74));
  }
  console.log("Observation.location applied.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
