// Wipes all Safety Observation demo data — observations, their attachments,
// and the running workflow instances + tasks + history for module=OBSERVATION.
// Leaves the workflow DEFINITION intact so new observations still flow.
//
// Default is dry-run. Pass --apply to actually delete.
//
// Run with:
//   npx tsx scripts/wipe-observation-data.ts          (dry-run, default)
//   npx tsx scripts/wipe-observation-data.ts --apply  (actually delete)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  console.log(`\n=== Wipe Safety Observation data (${apply ? "APPLY" : "dry-run"}) ===\n`);

  // 1. Count what's there
  const obsCount = await prisma.observation.count();
  const attachmentCount = await prisma.observationAttachment.count();
  const instanceCount = await prisma.workflowInstance.count({ where: { module: "OBSERVATION" } });
  const taskCount = await prisma.workflowTask.count({ where: { module: "OBSERVATION" } });
  const historyCount = await prisma.workflowHistory.count({
    where: { instance: { module: "OBSERVATION" } }
  });

  console.log("Current Observation data in DB:");
  console.log(`  Observation records:        ${obsCount}`);
  console.log(`  Observation attachments:    ${attachmentCount}`);
  console.log(`  Workflow instances:         ${instanceCount}`);
  console.log(`  Workflow tasks:             ${taskCount}`);
  console.log(`  Workflow history rows:      ${historyCount}`);

  if (obsCount === 0 && instanceCount === 0) {
    console.log("\n✓ Nothing to delete — Observation data is already empty.\n");
    return;
  }

  if (!apply) {
    console.log(`\nDry-run only. To actually delete, re-run with --apply\n`);
    return;
  }

  // 2. Delete in dependency order. WorkflowInstance has Cascade on tasks +
  // history, and Observation has Cascade on attachments — so we only need to
  // delete the parent rows.
  console.log("\nDeleting…");

  // Workflow side first — these reference recordId from the observation
  // table but as a plain string, not an FK, so they need to go independently.
  const deletedInstances = await prisma.workflowInstance.deleteMany({
    where: { module: "OBSERVATION" }
  });
  console.log(`  ✓ Workflow instances:    ${deletedInstances.count} deleted (tasks + history cascaded)`);

  // Observations next — attachments cascade
  const deletedObs = await prisma.observation.deleteMany({});
  console.log(`  ✓ Observations:          ${deletedObs.count} deleted (attachments cascaded)`);

  // 3. Confirm clean state
  const finalObs = await prisma.observation.count();
  const finalAtt = await prisma.observationAttachment.count();
  const finalInst = await prisma.workflowInstance.count({ where: { module: "OBSERVATION" } });
  const finalTasks = await prisma.workflowTask.count({ where: { module: "OBSERVATION" } });
  const finalHist = await prisma.workflowHistory.count({
    where: { instance: { module: "OBSERVATION" } }
  });

  console.log(`\nFinal counts (should all be 0):`);
  console.log(`  Observations:           ${finalObs}`);
  console.log(`  Attachments:            ${finalAtt}`);
  console.log(`  Workflow instances:     ${finalInst}`);
  console.log(`  Workflow tasks:         ${finalTasks}`);
  console.log(`  Workflow history:       ${finalHist}`);

  // Note about Supabase storage objects
  if (attachmentCount > 0) {
    console.log(`\nNote: ${attachmentCount} attachment file(s) remain in Supabase Storage (orphaned).`);
    console.log(`      The DB rows are gone so they're unreachable from the app.`);
    console.log(`      A retention sweep job (not built) would purge them on schedule.`);
  }

  console.log(`\n✓ Safety Observation data wiped clean. Workflow definition retained.\n`);
}

main()
  .catch((e) => {
    console.error("Script crashed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
