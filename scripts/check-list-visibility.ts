// Simulates what each demo user would see on the Safety Observation list,
// using the same buildObservationListWhere() the page uses. Confirms the
// matrix: WORKER=OWN, SUPERVISOR=DEPT, HSE_MANAGER=PLANT, etc.
//
// Run with:  npx tsx scripts/check-list-visibility.ts
import { PrismaClient } from "@prisma/client";
import { buildObservationListWhere, getReadScope } from "../src/lib/auth/list-filters";

const prisma = new PrismaClient();

async function main() {
  console.log("\n=== Observation list visibility per demo user ===\n");

  const totalObs = await prisma.observation.count();
  console.log(`Total observations in DB: ${totalObs}\n`);

  // Sample one user per role × dept × plant
  const sampleEmails = [
    "worker.it.lms@safeops360.in",
    "worker.hr.lms@safeops360.in",        // Manoj — should NOT see Rajesh's IT observation
    "worker.it.sdh@safeops360.in",        // different plant — should NOT see LMS observation
    "supervisor.it.lms@safeops360.in",    // DEPT scope — should see IT observations at LMS
    "supervisor.hr.lms@safeops360.in",    // DEPT scope — should NOT see IT observations
    "hse-manager.it.lms@safeops360.in",   // PLANT scope — should see all LMS regardless of dept
    "corporate-hse.it.lms@safeops360.in", // ALL scope — should see everything
    "admin@safeops360.in"                 // ALL scope — should see everything
  ];

  console.log("User                                          | Scope           | Visible | Sample emails seen");
  console.log("─".repeat(120));

  for (const email of sampleEmails) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (!u) {
      console.log(`${email.padEnd(45)} | (not found)`);
      continue;
    }
    const scope = await getReadScope(u.id, "OBSERVATION.READ");
    const where = await buildObservationListWhere(u.id);
    const visible = await prisma.observation.findMany({
      where,
      include: { observer: { select: { email: true } } },
      take: 5
    });
    const sample = visible.map((o) => o.observer.email).join(", ") || "(none)";
    console.log(
      `${email.padEnd(45)} | ${(scope ?? "—").padEnd(15)} | ${String(visible.length).padEnd(7)} | ${sample}`
    );
  }
  console.log();
}

main().catch(console.error).finally(() => prisma.$disconnect());
