// Named all-plant accounts — standalone runner.
//
// Creates (or refreshes) every entry in demo-users-config.ts →
// NAMED_ALL_PLANT_USERS and gives each one a PLANT-scoped UserRole row for
// EVERY plant, so their role's permissions apply across the whole group rather
// than to a single home plant.
//
// Run after seed.ts + seed-rbac.ts (roles must exist) and after
// seed-industry-tenants.ts / seed-factory.ts (so the later plants are covered).
//
// Run:   npx tsx prisma/seed-named-users.ts
//        npx tsx prisma/seed-named-users.ts --reset-password
//
// --reset-password rewrites the password back to DEMO_PASSWORD; without it an
// existing account keeps whatever password it has now.

import { PrismaClient } from "@prisma/client";
import { syncNamedAllPlantUsers } from "./named-users-sync";
import { DEMO_PASSWORD } from "./demo-users-config";

const prisma = new PrismaClient();

async function main() {
  const resetPassword = process.argv.includes("--reset-password");

  console.log("👤  Syncing named all-plant users…");
  const results = await syncNamedAllPlantUsers(prisma, { resetPassword });

  if (results.length === 0) {
    console.log("   nothing to do.");
    return;
  }
  for (const r of results) {
    console.log(
      `   ${r.created ? "created" : "updated"}: ${r.email} — ${r.roleCode} across ${r.plantsGranted} plants`
    );
    if (r.created || resetPassword) console.log(`      password: ${DEMO_PASSWORD}`);
  }
  console.log("✅  Named all-plant users synced.");
}

main()
  .catch((e) => {
    console.error("❌  seed-named-users failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
