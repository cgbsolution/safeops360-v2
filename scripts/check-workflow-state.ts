// Inspects the workflow state of an observation: instance status, all tasks
// (with status), and history. Helps debug stuck or stale workflow trackers.
//
// Run with:  npx tsx scripts/check-workflow-state.ts SO-2026-LMS-0001
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const number = process.argv[2];
  if (!number) {
    console.log("Usage: npx tsx scripts/check-workflow-state.ts <observation-number>");
    return;
  }

  const obs = await prisma.observation.findUnique({ where: { number } });
  if (!obs) { console.log("Observation not found"); return; }

  const instance = await prisma.workflowInstance.findUnique({
    where: { module_recordId: { module: "OBSERVATION", recordId: obs.id } },
    include: {
      definition: { include: { steps: { orderBy: { sequence: "asc" } } } },
      pendingTasks: { include: { assignedTo: { select: { name: true, email: true } } } },
      history: { include: { performedBy: { select: { name: true } } }, orderBy: { performedAt: "asc" } }
    }
  });
  if (!instance) { console.log("No workflow instance"); return; }

  console.log(`\n=== ${obs.number} workflow state ===\n`);
  console.log(`Instance status:    ${instance.status}`);
  console.log(`Current step id:    ${instance.currentStepId}`);
  console.log(`Current step name:  ${instance.currentStepName}\n`);

  console.log(`Steps in definition:`);
  for (const s of instance.definition.steps) {
    const isCurrent = s.id === instance.currentStepId;
    console.log(`  ${isCurrent ? "→" : " "} [${s.sequence}] ${s.stepType.padEnd(15)} ${s.name}`);
  }

  console.log(`\nAll tasks on this instance: ${instance.pendingTasks.length}`);
  for (const t of instance.pendingTasks) {
    const tag = t.status === "PENDING" || t.status === "OVERDUE" || t.status === "ESCALATED" ? "🟡" : "✓";
    console.log(`  ${tag} ${t.taskType.padEnd(15)} ${t.stepName.padEnd(35)} status=${t.status.padEnd(10)} → ${t.assignedTo.name} <${t.assignedTo.email}>`);
  }

  console.log(`\nHistory (${instance.history.length} entries):`);
  for (const h of instance.history) {
    console.log(`  · ${h.action.padEnd(12)} ${h.stepName.padEnd(35)} by ${h.performedBy.name} ${h.fromStatus ? `(${h.fromStatus} → ${h.toStatus})` : ""}`);
  }

  console.log();
}

main().catch(console.error).finally(() => prisma.$disconnect());
