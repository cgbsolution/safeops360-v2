// Backfills WorkflowInstance + WorkflowHistory (+ WorkflowTask) rows for
// existing Observations that were created without going through the workflow
// engine (e.g., the realistic-ops seeder before it was wired up). Without
// these rows the detail page hides its entire flow tracker, so seeded
// records show no audit trail at all.
//
// Run:
//   npx tsx scripts/backfill-observation-workflow.ts                  (dry-run, prints what it would do)
//   npx tsx scripts/backfill-observation-workflow.ts --apply          (actually write)
//   npx tsx scripts/backfill-observation-workflow.ts --apply --only-real
//                                                                    (restrict to [REAL]-tagged seed records)
//   npx tsx scripts/backfill-observation-workflow.ts --apply --id <observationId>
//                                                                    (single record)

import { PrismaClient } from "@prisma/client";
import {
  buildObservationWorkflow,
  loadApproverPools,
  loadObservationDefinition
} from "../prisma/observation-workflow-helper";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const onlyReal = process.argv.includes("--only-real");
const idIndex = process.argv.indexOf("--id");
const specificId = idIndex >= 0 ? process.argv[idIndex + 1] : null;

async function main() {
  console.log(`Mode: ${apply ? "APPLY (writing)" : "DRY-RUN (no writes)"}${onlyReal ? " — [REAL] only" : ""}${specificId ? ` — id=${specificId}` : ""}`);

  const def = await loadObservationDefinition(prisma);
  const pool = await loadApproverPools(prisma);
  console.log(
    `Approver pools: SUPERVISOR=${pool.supervisors.length}, SAFETY_OFFICER=${pool.safetyOfficers.length}, HSE_MANAGER=${pool.hseManagers.length}`
  );

  const where: any = {};
  if (specificId) where.id = specificId;
  if (onlyReal) where.description = { contains: "[REAL]" };

  // Find observations without a workflow instance.
  const candidates = await prisma.observation.findMany({
    where,
    select: {
      id: true,
      number: true,
      plantId: true,
      observerId: true,
      responsiblePersonId: true,
      date: true,
      closedAt: true,
      status: true,
      severity: true
    },
    orderBy: { date: "asc" }
  });
  console.log(`Found ${candidates.length} observation(s) matching filter`);

  const existing = await prisma.workflowInstance.findMany({
    where: { module: "OBSERVATION", recordId: { in: candidates.map((o) => o.id) } },
    select: { recordId: true }
  });
  const hasInstance = new Set(existing.map((e) => e.recordId));
  const needs = candidates.filter((o) => !hasInstance.has(o.id));
  console.log(`${needs.length} need a workflow trail (${candidates.length - needs.length} already have one)`);

  if (!apply) {
    for (const o of needs.slice(0, 10)) {
      console.log(`  - ${o.number} [${o.status}] @ plant=${o.plantId}`);
    }
    if (needs.length > 10) console.log(`  ... and ${needs.length - 10} more`);
    console.log("Re-run with --apply to write.");
    return;
  }

  let ok = 0;
  let failed = 0;
  for (const o of needs) {
    try {
      const result = await buildObservationWorkflow(
        prisma,
        def.id,
        def.steps.map((s) => ({ id: s.id, sequence: s.sequence, stepType: s.stepType, name: s.name })),
        o,
        pool
      );
      ok++;
      if (ok % 10 === 0) console.log(`  …${ok}/${needs.length}`);
      void result;
    } catch (e: any) {
      failed++;
      console.error(`  ! ${o.number}: ${e?.message ?? e}`);
    }
  }
  console.log(`\nDone. wrote=${ok}, failed=${failed}, skipped(existing)=${candidates.length - needs.length}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
