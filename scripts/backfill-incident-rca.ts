// Backfills rootCauseMethod + rootCauseData (+ rootCauseSummary +
// cause-hierarchy arrays + corrective/preventive action text) for existing
// Incidents whose RCA was never populated — typically [REAL]-tagged seed rows
// that ran before the seeder was wired to the RCA helper. Without
// rootCauseData the methodology visualisation block (fishbone / taproot /
// 5-Why / FTA / bowtie / cause-map) is hidden, so the client sees only the
// plain-English summary line.
//
// Methods are rotated across the matching records so the demo shows variety
// rather than every incident rendering the same shape.
//
// Run:
//   npx tsx scripts/backfill-incident-rca.ts                       (dry-run, prints what it would do)
//   npx tsx scripts/backfill-incident-rca.ts --apply               (actually write)
//   npx tsx scripts/backfill-incident-rca.ts --apply --only-real   (limit to [REAL] tagged seed rows)
//   npx tsx scripts/backfill-incident-rca.ts --apply --id <incidentId>
//   npx tsx scripts/backfill-incident-rca.ts --apply --force       (overwrite even if rootCauseData already exists)

import { PrismaClient } from "@prisma/client";
import { buildRcaForIncident, RCA_METHOD_ROTATION } from "../prisma/incident-rca-helper";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const onlyReal = process.argv.includes("--only-real");
const force = process.argv.includes("--force");
const idIndex = process.argv.indexOf("--id");
const specificId = idIndex >= 0 ? process.argv[idIndex + 1] : null;

async function main() {
  console.log(
    `Mode: ${apply ? "APPLY (writing)" : "DRY-RUN (no writes)"}${onlyReal ? " — [REAL] only" : ""}${force ? " — force overwrite" : ""}${specificId ? ` — id=${specificId}` : ""}`
  );

  const where: any = {};
  if (specificId) where.id = specificId;
  if (onlyReal) where.description = { contains: "[REAL]" };
  // Skip REPORTED — RCA only kicks in once classification has happened.
  where.status = { not: "REPORTED" };
  // Only target rows that are missing rootCauseData unless --force is set.
  if (!force) where.rootCauseData = { equals: null as any };

  const incidents = await prisma.incident.findMany({
    where,
    select: {
      id: true,
      number: true,
      date: true,
      type: true,
      description: true,
      location: true,
      immediateCause: true,
      bodyPart: true,
      natureOfInjury: true,
      status: true
    },
    orderBy: { date: "asc" }
  });
  console.log(`Found ${incidents.length} incident(s) needing RCA backfill`);

  if (!apply) {
    for (const inc of incidents.slice(0, 10)) {
      const m = RCA_METHOD_ROTATION[(incidents.indexOf(inc)) % RCA_METHOD_ROTATION.length];
      console.log(`  - ${inc.number} (${inc.type}, ${inc.status}) → ${m}`);
    }
    if (incidents.length > 10) console.log(`  ... and ${incidents.length - 10} more`);
    console.log("Re-run with --apply to write.");
    return;
  }

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < incidents.length; i++) {
    const inc = incidents[i];
    try {
      // Strip the [REAL] prefix from description before feeding to the helper
      // so the templated RCA reads naturally (helper echoes description into
      // problemStatement / topEvent / eventDescription).
      const cleanDescription = inc.description.replace(/^\[REAL\]\s*/, "");
      const rca = buildRcaForIncident(
        {
          type: inc.type,
          description: cleanDescription,
          immediateCause: inc.immediateCause,
          location: inc.location,
          bodyPart: inc.bodyPart,
          natureOfInjury: inc.natureOfInjury
        },
        inc.date,
        i // spice = stable per-record index so reruns are deterministic
      );

      await prisma.incident.update({
        where: { id: inc.id },
        data: {
          rootCauseMethod: rca.rootCauseMethod,
          rootCauseData: rca.rootCauseData as any,
          rootCauseSummary: rca.rootCauseSummary,
          immediateCauses: rca.immediateCauses,
          underlyingCauses: rca.underlyingCauses,
          rootCauses: rca.rootCauses,
          contributingFactors: rca.contributingFactors,
          correctiveActions: rca.correctiveActions,
          preventiveActions: rca.preventiveActions
        }
      });
      ok++;
      if (ok % 10 === 0) console.log(`  …${ok}/${incidents.length}`);
    } catch (e: any) {
      failed++;
      console.error(`  ! ${inc.number}: ${e?.message ?? e}`);
    }
  }
  console.log(`\nDone. wrote=${ok}, failed=${failed}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
