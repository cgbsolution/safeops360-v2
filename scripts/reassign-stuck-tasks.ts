// Reassigns pending workflow tasks whose current assignee no longer holds the
// step's required role (e.g., after a workflow definition was changed to
// require a different role). Idempotent — only touches tasks that are
// genuinely mis-assigned.
//
// Run with:  npx tsx scripts/reassign-stuck-tasks.ts          (dry-run, default)
//            npx tsx scripts/reassign-stuck-tasks.ts --apply  (actually move)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function getUserRoleCodes(userId: string): Promise<string[]> {
  const rows = await prisma.userRole.findMany({
    where: {
      userId,
      OR: [{ validTo: null }, { validTo: { gt: new Date() } }]
    },
    include: { role: { select: { code: true, isActive: true } } }
  });
  return rows.filter((r) => r.role.isActive).map((r) => r.role.code);
}

async function findUserByRole(roleCode: string, plantId: string | null) {
  const rows = await prisma.userRole.findMany({
    where: {
      role: { code: roleCode, isActive: true },
      OR: [{ validTo: null }, { validTo: { gt: new Date() } }]
    },
    include: { user: { select: { id: true, name: true, email: true, plantId: true } } },
    orderBy: { user: { createdAt: "asc" } }
  });
  if (rows.length === 0) return null;
  if (plantId) {
    const atPlant = rows.find((r) => r.user.plantId === plantId);
    if (atPlant) return atPlant.user;
  }
  return rows[0].user;
}

async function main() {
  console.log(`\n=== Reassign stuck tasks (${apply ? "APPLY" : "dry-run"}) ===\n`);

  const tasks = await prisma.workflowTask.findMany({
    where: { status: { in: ["PENDING", "OVERDUE", "ESCALATED"] } },
    include: {
      instance: { include: { definition: { include: { steps: true } } } },
      assignedTo: { select: { id: true, name: true, email: true, plantId: true } }
    }
  });

  let scanned = 0;
  let stuck = 0;
  let moved = 0;
  let unresolvable = 0;

  for (const task of tasks) {
    scanned++;
    const step = task.instance.definition.steps.find((s) => s.id === task.stepId);
    if (!step) continue;

    // If the step has no role requirement (e.g., approverField-resolved),
    // skip — there's nothing to validate against.
    if (!step.approverRole) continue;

    // Check if the current assignee holds the required role OR the escalationRole
    const currentRoles = await getUserRoleCodes(task.assignedToId);
    const allowedRoles = [step.approverRole];
    if (step.escalationRole) allowedRoles.push(step.escalationRole);

    const isOK = currentRoles.some((r) => allowedRoles.includes(r));
    if (isOK) continue;

    stuck++;
    // Use the current assignee's plantId as the targeting hint — the workflow
    // task itself doesn't carry plantId, but the assignee almost always does.
    const newUser = await findUserByRole(step.approverRole, task.assignedTo.plantId);
    if (!newUser) {
      unresolvable++;
      console.log(
        `⚠️  Task ${task.module}/${task.recordNumber} step "${task.stepName}" — no user with role '${step.approverRole}'. Leaving with ${task.assignedTo.name}.`
      );
      continue;
    }

    if (newUser.id === task.assignedToId) continue;

    console.log(
      `${apply ? "→" : "·"} ${task.module}/${task.recordNumber} "${task.stepName}":  ${task.assignedTo.name} → ${newUser.name} (${step.approverRole})`
    );

    if (apply) {
      await prisma.workflowTask.update({
        where: { id: task.id },
        data: { assignedToId: newUser.id, assignedAt: new Date() }
      });
      // Audit history entry so the timeline shows the reassignment
      await prisma.workflowHistory.create({
        data: {
          instanceId: task.instanceId,
          stepId: task.stepId,
          stepName: task.stepName,
          action: "REASSIGNED",
          performedById: newUser.id,
          comments: `Auto-reassigned from ${task.assignedTo.name} to ${newUser.name} after workflow definition changed required role to ${step.approverRole}.`
        }
      });
      moved++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Tasks scanned:           ${scanned}`);
  console.log(`  Mis-assigned tasks:      ${stuck}`);
  console.log(`  Could not resolve role:  ${unresolvable}`);
  console.log(`  ${apply ? "Tasks reassigned" : "Tasks would be reassigned"}: ${apply ? moved : stuck - unresolvable}`);
  if (!apply && stuck > 0) {
    console.log(`\nDry-run only. To actually move tasks, re-run with --apply\n`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
