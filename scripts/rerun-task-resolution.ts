// Re-runs assignee resolution for in-progress tasks where the current assignee
// might be wrong (e.g., after the engine learned to consider department).
// For each PENDING task, the script computes who SHOULD be assigned given the
// current resolveAssignee logic and reassigns if different. Idempotent.
//
// Run with:
//   npx tsx scripts/rerun-task-resolution.ts          (dry-run)
//   npx tsx scripts/rerun-task-resolution.ts --apply

import { PrismaClient } from "@prisma/client";
import { loadRecordContext } from "../src/lib/auth/record-context";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function findUserByRole(
  roleCode: string,
  plantId: string | null,
  departmentHint: string | null
) {
  const rows = await prisma.userRole.findMany({
    where: {
      role: { code: roleCode, isActive: true },
      OR: [{ validTo: null }, { validTo: { gt: new Date() } }]
    },
    include: { user: { select: { id: true, name: true, email: true, plantId: true, department: true } } },
    orderBy: { user: { createdAt: "asc" } }
  });
  if (rows.length === 0) return null;
  if (plantId && departmentHint) {
    const best = rows.find(
      (r) => r.user.plantId === plantId && r.user.department === departmentHint
    );
    if (best) return best.user;
  }
  if (plantId) {
    const atPlant = rows.find((r) => r.user.plantId === plantId);
    if (atPlant) return atPlant.user;
  }
  return rows[0].user;
}

async function main() {
  console.log(`\n=== Re-run task resolution (${apply ? "APPLY" : "dry-run"}) ===\n`);

  const tasks = await prisma.workflowTask.findMany({
    where: { status: { in: ["PENDING", "OVERDUE", "ESCALATED"] } },
    include: {
      instance: { include: { definition: { include: { steps: true } } } },
      assignedTo: { select: { id: true, name: true, email: true, department: true } }
    }
  });

  let scanned = 0;
  let moved = 0;

  for (const task of tasks) {
    scanned++;
    const step = task.instance.definition.steps.find((s) => s.id === task.stepId);
    if (!step || !step.approverRole) continue; // field-resolved tasks aren't in scope

    const ctx = await loadRecordContext(task.module, task.recordId);
    const recordData = ctx.record ?? {};
    const departmentHint =
      recordData.observer?.department ??
      recordData.reporter?.department ??
      recordData.originator?.department ??
      recordData.leader?.department ??
      recordData.inspector?.department ??
      null;

    const correct = await findUserByRole(step.approverRole, ctx.plantId, departmentHint);
    if (!correct) continue;
    if (correct.id === task.assignedToId) continue;

    console.log(
      `${apply ? "→" : "·"} ${task.module}/${task.recordNumber} "${task.stepName}":`
    );
    console.log(
      `      from ${task.assignedTo.name} <${task.assignedTo.email}> (dept=${task.assignedTo.department})`
    );
    console.log(
      `      to   ${correct.name} <${correct.email}> (dept=${correct.department}) — matched ${departmentHint ? `dept=${departmentHint}` : "plant only"}`
    );

    if (apply) {
      await prisma.workflowTask.update({
        where: { id: task.id },
        data: { assignedToId: correct.id, assignedAt: new Date() }
      });
      await prisma.workflowHistory.create({
        data: {
          instanceId: task.instanceId,
          stepId: task.stepId,
          stepName: task.stepName,
          action: "REASSIGNED",
          performedById: correct.id,
          comments: `Auto-reassigned to honour department scope (was assigned to ${task.assignedTo.name} in ${task.assignedTo.department}; record's department is ${departmentHint ?? "—"}).`
        }
      });
      moved++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Tasks scanned:   ${scanned}`);
  console.log(`  ${apply ? "Reassigned" : "Would reassign"}:  ${apply ? moved : "(see above)"}`);
  if (!apply) console.log(`\nDry-run only. Re-run with --apply to commit.\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
