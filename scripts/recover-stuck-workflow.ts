// Recovers a workflow instance that's stuck — i.e., currentStepId points to a
// real step but no PENDING task exists for it. This happens when an old
// engine bug logged ESCALATED to history but failed to create the task.
//
// Strategy: for each stuck instance, look up the underlying record's owner
// fields (using the same loadRecordContext the engine now uses) and create
// the missing task assigned to the resolved person.
//
// Run with:  npx tsx scripts/recover-stuck-workflow.ts          (dry-run)
//            npx tsx scripts/recover-stuck-workflow.ts --apply  (actually create tasks)

import { PrismaClient } from "@prisma/client";
import { loadRecordContext } from "../src/lib/auth/record-context";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

// Compute due-at for a step's SLA, mirroring the engine's logic.
function computeDueAt(slaHours: number | null | undefined): Date | null {
  if (!slaHours || slaHours <= 0) return null;
  return new Date(Date.now() + slaHours * 3600 * 1000);
}

// Map step type to the task type the engine creates.
function taskTypeFor(stepType: string): "APPROVAL" | "EXECUTION" | "VERIFICATION" | null {
  switch (stepType) {
    case "CHECKER":
    case "CLOSURE":
      return "APPROVAL";
    case "ASSIGNEE_TASK":
      return "EXECUTION";
    case "VERIFIER":
      return "VERIFICATION";
    default:
      return null;
  }
}

// Mirror engine's resolveAssignee for the field-based path.
function resolveByField(field: string, recordData: Record<string, any>): string | null {
  if (field === "ACTION_OWNER") return recordData.actionOwnerId ?? recordData.responsiblePersonId ?? null;
  if (field === "RESPONSIBLE_PERSON") return recordData.responsiblePersonId ?? recordData.actionOwnerId ?? null;
  if (field === "RECEIVER") return recordData.receiverId ?? null;
  if (field === "ISSUER") return recordData.issuerId ?? null;
  if (field === "ORIGINATOR") return recordData.observerId ?? recordData.reporterId ?? recordData.originatorId ?? null;
  if (field === "ASSIGNED_INSPECTOR") return recordData.inspectorId ?? null;
  if (field === "TRAINER") return recordData.trainerId ?? null;
  return null;
}

// Mirror engine's findUserByRoles for the role-based path.
async function findUserByRole(roleCode: string, plantId: string | null): Promise<string | null> {
  const rows = await prisma.userRole.findMany({
    where: {
      role: { code: roleCode, isActive: true },
      OR: [{ validTo: null }, { validTo: { gt: new Date() } }]
    },
    include: { user: { select: { id: true, plantId: true } } },
    orderBy: { user: { createdAt: "asc" } }
  });
  if (rows.length === 0) return null;
  if (plantId) {
    const atPlant = rows.find((r) => r.user.plantId === plantId);
    if (atPlant) return atPlant.user.id;
  }
  return rows[0].user.id;
}

async function main() {
  console.log(`\n=== Recover stuck workflows (${apply ? "APPLY" : "dry-run"}) ===\n`);

  const instances = await prisma.workflowInstance.findMany({
    where: { status: "IN_PROGRESS" },
    include: {
      definition: { include: { steps: { orderBy: { sequence: "asc" } } } },
      pendingTasks: true
    }
  });

  let stuck = 0;
  let recovered = 0;
  let unresolvable = 0;

  for (const inst of instances) {
    if (!inst.currentStepId) continue;
    const currentStep = inst.definition.steps.find((s) => s.id === inst.currentStepId);
    if (!currentStep) continue;

    // Stuck = current step expects a task but no PENDING task exists for it.
    const livePending = inst.pendingTasks.some(
      (t) => t.stepId === currentStep.id &&
        (t.status === "PENDING" || t.status === "OVERDUE" || t.status === "ESCALATED")
    );
    if (livePending) continue;

    const expectedType = taskTypeFor(currentStep.stepType);
    if (!expectedType) continue; // MAKER step doesn't need a task

    stuck++;

    // Resolve the assignee
    const ctx = await loadRecordContext(inst.module, inst.recordId);
    const recordData = ctx.record ?? {};
    let assigneeId: string | null = null;
    let resolutionPath = "";

    if (currentStep.approverField) {
      assigneeId = resolveByField(currentStep.approverField, recordData);
      resolutionPath = `field=${currentStep.approverField}`;
    }
    if (!assigneeId && currentStep.approverRole) {
      assigneeId = await findUserByRole(currentStep.approverRole, ctx.plantId);
      resolutionPath = resolutionPath
        ? `${resolutionPath} → fallback role=${currentStep.approverRole}`
        : `role=${currentStep.approverRole}`;
    }

    if (!assigneeId) {
      unresolvable++;
      console.log(`✗ ${inst.module}/${inst.recordNumber} step "${currentStep.name}" — could not resolve assignee (${resolutionPath || "no role/field"})`);
      continue;
    }

    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: { name: true, email: true }
    });

    console.log(
      `${apply ? "→" : "·"} ${inst.module}/${inst.recordNumber} step "${currentStep.name}" → ${assignee?.name} <${assignee?.email}> (${resolutionPath})`
    );

    if (apply) {
      await prisma.workflowTask.create({
        data: {
          instanceId: inst.id,
          stepId: currentStep.id,
          stepName: currentStep.name,
          taskType: expectedType,
          module: inst.module,
          recordId: inst.recordId,
          recordNumber: inst.recordNumber ?? null,
          assignedToId: assigneeId,
          assignedAt: new Date(),
          dueAt: computeDueAt(currentStep.slaHours),
          status: "PENDING"
        }
      });
      await prisma.workflowHistory.create({
        data: {
          instanceId: inst.id,
          stepId: currentStep.id,
          stepName: currentStep.name,
          action: "REASSIGNED",
          performedById: assigneeId,
          comments: `Auto-recovery: task created retroactively after engine fix. (${resolutionPath})`
        }
      });
      recovered++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Stuck instances:        ${stuck}`);
  console.log(`  ${apply ? "Tasks created" : "Tasks would be created"}: ${apply ? recovered : stuck - unresolvable}`);
  console.log(`  Unresolvable:           ${unresolvable}`);
  if (!apply && stuck > 0) {
    console.log(`\nDry-run only. Re-run with --apply to actually create the tasks.\n`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
