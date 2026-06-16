// Repairs WorkflowInstance.currentStepId and WorkflowTask.stepId references
// that were orphaned when the workflow seed deleted-and-recreated step rows.
//
// For each in-progress instance, we look up the original step's sequence by
// joining via stepName (carried as a snapshot on history rows) and remap the
// stale stepId to the live step row that has the matching sequence in the
// current definition. Idempotent — safe to re-run.
//
// Run with:  npx tsx scripts/repair-workflow-step-refs.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n=== Workflow step reference repair ===\n");

  const instances = await prisma.workflowInstance.findMany({
    include: {
      definition: { include: { steps: { orderBy: { sequence: "asc" } } } },
      pendingTasks: true,
      history: { orderBy: { performedAt: "asc" } }
    }
  });

  let fixedInstances = 0;
  let fixedTasks = 0;
  let fixedHistory = 0;

  for (const inst of instances) {
    const liveStepIds = new Set(inst.definition.steps.map((s) => s.id));
    const byName = new Map(inst.definition.steps.map((s) => [s.name, s.id]));
    const bySeq = new Map(inst.definition.steps.map((s) => [s.sequence, s.id]));

    // Helper — given a possibly-stale stepId + a stepName snapshot, find the
    // live step id. Try name match first, then fall back to sequence guesses.
    function resolveStep(staleId: string | null, stepName: string | null): string | null {
      if (staleId && liveStepIds.has(staleId)) return staleId;
      if (stepName && byName.has(stepName)) return byName.get(stepName)!;
      // Last-resort: pick by partial name match
      if (stepName) {
        const live = inst.definition.steps.find(
          (s) => s.name.toLowerCase().startsWith(stepName.toLowerCase().split("—")[0].trim())
        );
        if (live) return live.id;
      }
      return null;
    }

    // 1. Fix instance.currentStepId
    if (inst.currentStepId && !liveStepIds.has(inst.currentStepId)) {
      // Try to resolve from history's snapshot of currentStepName
      const fixed = resolveStep(inst.currentStepId, inst.currentStepName);
      if (fixed) {
        await prisma.workflowInstance.update({
          where: { id: inst.id },
          data: { currentStepId: fixed }
        });
        fixedInstances++;
        console.log(`✓ Instance ${inst.module}/${inst.recordNumber}: currentStepId remapped to "${inst.currentStepName}" (seq ${inst.definition.steps.find((s) => s.id === fixed)?.sequence})`);
      } else {
        console.log(`⚠️  Instance ${inst.module}/${inst.recordNumber}: could not resolve currentStepId="${inst.currentStepId}" (currentStepName="${inst.currentStepName}")`);
      }
    }

    // 2. Fix pending task stepIds
    for (const task of inst.pendingTasks) {
      if (!liveStepIds.has(task.stepId)) {
        const fixed = resolveStep(task.stepId, task.stepName);
        if (fixed) {
          await prisma.workflowTask.update({
            where: { id: task.id },
            data: { stepId: fixed }
          });
          fixedTasks++;
        }
      }
    }

    // 3. Fix history step references (for audit trail accuracy)
    for (const h of inst.history) {
      if (h.stepId && !liveStepIds.has(h.stepId)) {
        const fixed = resolveStep(h.stepId, h.stepName);
        if (fixed) {
          await prisma.workflowHistory.update({
            where: { id: h.id },
            data: { stepId: fixed }
          });
          fixedHistory++;
        }
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Instances:  ${fixedInstances} repaired`);
  console.log(`  Tasks:      ${fixedTasks} repaired`);
  console.log(`  History:    ${fixedHistory} repaired`);
  console.log(`  Total instances scanned: ${instances.length}`);
  console.log(`Done.\n`);
}

main()
  .catch((e) => {
    console.error("Script crashed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
