// Self-heal pass for inspections whose EXECUTION task got left PENDING
// even though the workflow already advanced to a later step. The
// signal: when ≥ 2 pending tasks exist at different step sequences
// for the same instance, the earlier-sequence task must be orphaned
// (a sequential workflow can't legitimately have step N + step N+1
// pending at the same time).
//
// Older code paths advanced the inspection record without calling the
// workflow engine's submitExecution(), so the upstream task's status
// stayed PENDING even after the downstream task got spawned.

import { prisma } from "@/lib/prisma";

export async function healStuckInspectionWorkflow(inspectionId: string): Promise<{ healed: boolean; reason?: string }> {
  const instance = await prisma.workflowInstance.findUnique({
    where: { module_recordId: { module: "INSPECTION", recordId: inspectionId } },
    include: {
      definition: { include: { steps: { select: { id: true, sequence: true, name: true } } } }
    }
  });
  if (!instance) {
    console.log("[heal] no instance for inspection", inspectionId);
    return { healed: false, reason: "no-instance" };
  }

  const stepSequence = new Map<string, number>();
  for (const s of instance.definition.steps) {
    stepSequence.set(s.id, s.sequence);
  }

  const pending = await prisma.workflowTask.findMany({
    where: { instanceId: instance.id, status: "PENDING" },
    select: { id: true, stepId: true, stepName: true, taskType: true, assignedToId: true }
  });
  console.log("[heal]", inspectionId, "pending tasks:", pending.length);
  if (pending.length < 2) return { healed: false, reason: "less-than-2-pending" };

  // Group by sequence — find max sequence; close everything with a lower
  // sequence (those are orphaned by definition in a sequential workflow).
  const withSeq = pending.map((t) => ({ ...t, sequence: stepSequence.get(t.stepId) ?? -1 }));
  const maxSeq = Math.max(...withSeq.map((t) => t.sequence));
  const orphaned = withSeq.filter((t) => t.sequence >= 0 && t.sequence < maxSeq);
  console.log("[heal]", inspectionId, "max seq:", maxSeq, "orphaned:", orphaned.length);
  if (orphaned.length === 0) return { healed: false, reason: "no-earlier-pending" };

  for (const task of orphaned) {
    // If there's no EXECUTED / APPROVED history row for this step yet,
    // backfill one so the audit trail isn't a black hole — otherwise the
    // step just looks "vanished" with no record of who completed it.
    const existingHistory = await prisma.workflowHistory.findFirst({
      where: {
        instanceId: instance.id,
        stepId: task.stepId,
        action: { in: ["EXECUTED", "APPROVED", "VERIFIED"] }
      },
      select: { id: true }
    });

    await prisma.workflowTask.update({
      where: { id: task.id },
      data: { status: "COMPLETED", completedAt: new Date() }
    });

    if (!existingHistory) {
      const action =
        task.taskType === "EXECUTION" ? "EXECUTED" :
        task.taskType === "VERIFICATION" ? "VERIFIED" :
        "APPROVED";
      await prisma.workflowHistory.create({
        data: {
          instanceId: instance.id,
          stepId: task.stepId,
          stepName: task.stepName,
          action,
          performedById: task.assignedToId,
          comments: "Auto-healed: task was orphaned (workflow had advanced past this step)."
        }
      });
    }
  }

  console.log("[heal]", inspectionId, "healed", orphaned.length, "orphaned tasks");
  return { healed: true };
}
