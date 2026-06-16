// ────────────────────────────────────────────────────────────────────────
// Manhours workflow orchestrator.
//
// Drives the state machine and writes inbox-visible WorkflowTask rows
// + audit-grade WorkflowHistory entries directly via Prisma. We don't
// use either of the platform-wide workflow engines (Python's or the TS
// engine.ts) for two reasons:
//
//   1. Lock-time KPI snapshot capture is Manhours-specific and lives
//      on the TS side (engine + registry). Hooking it into Python
//      means duplicating the registry; hooking it into the TS engine's
//      generic `syncRecordStatus` means leaking a 6-KPI dependency
//      into infrastructure used by 6 other modules.
//
//   2. The Manhours state machine has rules the generic engine doesn't
//      know: "reject returns to DRAFT" (not REJECTED-terminal), unlock
//      / re-lock cycles, KPI snapshot freshness on every re-lock.
//
// Both engines and this orchestrator write to the SAME WorkflowInstance
// / WorkflowTask / WorkflowHistory tables, so the inbox sees Manhours
// tasks just like any other module's. Plant Head's inbox shows the
// "Plant Head Reviews" task; clicking it lands them in the wizard,
// where the action panel (built in this commit) handles the decision.
//
// State machine:
//   DRAFT → UNDER_REVIEW (submit)
//   UNDER_REVIEW → APPROVED (Plant Head approve)
//   UNDER_REVIEW → DRAFT (Plant Head reject / return for revision)
//   APPROVED → LOCKED (Corporate HSE lock + snapshot)
//   APPROVED → DRAFT (Corporate HSE reject)
//   LOCKED → UNLOCKED_FOR_REVISION (Corporate HSE unlock with reason)
//   UNLOCKED_FOR_REVISION → LOCKED (Corporate HSE re-lock + fresh snapshot)
//   UNLOCKED_FOR_REVISION → DRAFT (HSE Manager opens wizard to edit)
//     ↑ this last edge is implicit: any wizard PATCH on an UNLOCKED row
//       keeps it in UNLOCKED_FOR_REVISION until re-locked; the bridge
//       in C2's `assertEditable` already allows edits in that state.
// ────────────────────────────────────────────────────────────────────────

import type { PrismaClient } from "@prisma/client";
import { captureKpiSnapshot } from "./snapshot";

const WORKFLOW_MODULE = "MANHOURS";

// Internal step labels — shown on the WorkflowTask row in the inbox.
// Match the seed-workflows.ts definition so the existing tracker UI
// can render the step sequence consistently.
const STEPS = {
  MAKER: "Plant HSE Enters",
  CHECKER: "Plant Head Reviews",
  CLOSURE: "Corporate HSE Locks"
} as const;

// SLA used by the inbox sorting + the engine's overdue sweep.
// Matches the seed: 48h for Plant Head review, no fixed deadline on
// Corporate lock (they batch).
const PLANT_HEAD_SLA_HOURS = 48;
const CORPORATE_LOCK_SLA_HOURS = 7 * 24; // soft 7-day target

// ── Helpers ──────────────────────────────────────────────────────

/** Find the seeded MANHOURS workflow definition + its steps. Used to
 *  populate currentStepId/Name on WorkflowInstance so the existing
 *  WorkflowTracker UI renders correctly. */
async function loadDefinition(prisma: PrismaClient) {
  const def = await prisma.workflowDefinition.findFirst({
    where: { module: WORKFLOW_MODULE, isActive: true },
    include: { steps: { orderBy: { sequence: "asc" } } }
  });
  if (!def) {
    throw new Error(
      "MANHOURS workflow definition not found. Run `npm run db:seed-workflows` to provision it."
    );
  }
  return def;
}

/** Pick a user holding a given role at a given plant. Prefers same-plant;
 *  falls back to any active user with the role globally. Used to assign
 *  the Plant Head review task and the Corporate HSE lock task. */
async function findUserByRole(
  prisma: PrismaClient,
  role: string,
  plantId?: string
): Promise<string | null> {
  if (plantId) {
    const local = await prisma.user.findFirst({
      where: { role, plantId },
      orderBy: { createdAt: "asc" },
      select: { id: true }
    });
    if (local) return local.id;
  }
  const anywhere = await prisma.user.findFirst({
    where: { role },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });
  return anywhere?.id ?? null;
}

interface InstanceContext {
  instanceId: string;
  recordNumber: string | null;
  recordTitle: string;
}

async function ensureInstance(
  prisma: PrismaClient,
  submissionId: string,
  initiatorId: string
): Promise<InstanceContext> {
  const sub = await prisma.manhoursSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { plant: { select: { name: true, code: true } } }
  });
  const def = await loadDefinition(prisma);

  // Race-safe: try upsert via the (module, recordId) unique constraint.
  const recordTitle = `${sub.plant.name} · ${sub.reportingYear}-${String(sub.reportingMonth).padStart(2, "0")}`;
  const checkerStep = def.steps.find((s) => s.stepType === "CHECKER");
  if (!checkerStep) throw new Error("MANHOURS workflow has no CHECKER step");

  const existing = await prisma.workflowInstance.findUnique({
    where: { module_recordId: { module: WORKFLOW_MODULE, recordId: submissionId } }
  });
  if (existing) {
    return {
      instanceId: existing.id,
      recordNumber: existing.recordNumber,
      recordTitle: existing.recordNumber ?? recordTitle
    };
  }

  const created = await prisma.workflowInstance.create({
    data: {
      definitionId: def.id,
      module: WORKFLOW_MODULE,
      recordId: submissionId,
      recordNumber: sub.submissionNumber,
      currentStepId: checkerStep.id,
      currentStepName: checkerStep.name,
      status: "IN_PROGRESS",
      initiatedById: initiatorId
    }
  });
  return { instanceId: created.id, recordNumber: sub.submissionNumber, recordTitle };
}

// ── Public API ──────────────────────────────────────────────────

/**
 * DRAFT → UNDER_REVIEW. Called from /submit after the status
 * transition + validation gate has succeeded. Creates the
 * WorkflowInstance, MAKER history entry, and Plant Head review task.
 *
 * Idempotent on retries — re-creating an instance for the same
 * (module, recordId) hits the unique constraint and we return the
 * existing one.
 */
export async function initiateManhoursWorkflow(opts: {
  prisma: PrismaClient;
  submissionId: string;
  initiatorId: string;
}): Promise<{ instanceId: string }> {
  const { prisma, submissionId, initiatorId } = opts;
  const ctx = await ensureInstance(prisma, submissionId, initiatorId);
  const def = await loadDefinition(prisma);
  const makerStep = def.steps.find((s) => s.stepType === "MAKER")!;
  const checkerStep = def.steps.find((s) => s.stepType === "CHECKER")!;

  const sub = await prisma.manhoursSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    select: { plantId: true }
  });

  // Resolve Plant Head. Falls back to a global Plant Head if none at
  // the plant — the engine's overdue sweep will escalate stuck rows.
  const plantHeadId = await findUserByRole(prisma, "PLANT_HEAD", sub.plantId);
  if (!plantHeadId) {
    throw new Error(
      "No Plant Head found for this plant. Assign a user with role PLANT_HEAD before submitting."
    );
  }

  await prisma.$transaction([
    // MAKER history (submit auto-completes the maker step)
    prisma.workflowHistory.create({
      data: {
        instanceId: ctx.instanceId,
        stepId: makerStep.id,
        stepName: makerStep.name,
        action: "SUBMITTED",
        performedById: initiatorId,
        toStatus: "IN_PROGRESS"
      }
    }),
    // Plant Head approval task — visible in inbox immediately.
    prisma.workflowTask.create({
      data: {
        instanceId: ctx.instanceId,
        stepId: checkerStep.id,
        stepName: checkerStep.name,
        taskType: "APPROVAL",
        module: WORKFLOW_MODULE,
        recordId: submissionId,
        recordNumber: ctx.recordNumber,
        recordTitle: ctx.recordTitle,
        assignedToId: plantHeadId,
        dueAt: new Date(Date.now() + PLANT_HEAD_SLA_HOURS * 3600 * 1000),
        status: "PENDING",
        priority: "NORMAL"
      }
    }),
    // Submission status mirrors workflow state.
    prisma.manhoursSubmission.update({
      where: { id: submissionId },
      data: { status: "UNDER_REVIEW" }
    })
  ]);

  return { instanceId: ctx.instanceId };
}

/**
 * UNDER_REVIEW → APPROVED. Plant Head approves; creates the
 * Corporate HSE lock task.
 */
export async function plantHeadApprove(opts: {
  prisma: PrismaClient;
  submissionId: string;
  approverId: string;
  notes: string | null;
}): Promise<void> {
  const { prisma, submissionId, approverId, notes } = opts;
  const sub = await prisma.manhoursSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    select: { status: true, plantId: true }
  });
  if (sub.status !== "UNDER_REVIEW") {
    throw new Error(`Cannot approve a submission in ${sub.status} state (expected UNDER_REVIEW)`);
  }

  const def = await loadDefinition(prisma);
  const checkerStep = def.steps.find((s) => s.stepType === "CHECKER")!;
  const closureStep = def.steps.find((s) => s.stepType === "CLOSURE")!;
  const instance = await prisma.workflowInstance.findUniqueOrThrow({
    where: { module_recordId: { module: WORKFLOW_MODULE, recordId: submissionId } }
  });

  // Pick Corporate HSE. There's typically one team at HQ — global lookup
  // is fine; plantId is ignored for this role.
  const corporateId = await findUserByRole(prisma, "CORPORATE_HSE");
  if (!corporateId) {
    throw new Error(
      "No Corporate HSE user found. Assign a user with role CORPORATE_HSE before approving."
    );
  }

  await prisma.$transaction([
    // Complete the Plant Head task(s) for this instance.
    prisma.workflowTask.updateMany({
      where: { instanceId: instance.id, stepId: checkerStep.id, status: "PENDING" },
      data: { status: "COMPLETED", completedAt: new Date() }
    }),
    prisma.workflowHistory.create({
      data: {
        instanceId: instance.id,
        stepId: checkerStep.id,
        stepName: checkerStep.name,
        action: "APPROVED",
        performedById: approverId,
        comments: notes ?? null
      }
    }),
    prisma.workflowInstance.update({
      where: { id: instance.id },
      data: { currentStepId: closureStep.id, currentStepName: closureStep.name }
    }),
    // Spawn the Corporate HSE lock task.
    prisma.workflowTask.create({
      data: {
        instanceId: instance.id,
        stepId: closureStep.id,
        stepName: closureStep.name,
        taskType: "APPROVAL",
        module: WORKFLOW_MODULE,
        recordId: submissionId,
        recordNumber: instance.recordNumber,
        recordTitle: instance.recordNumber,
        assignedToId: corporateId,
        dueAt: new Date(Date.now() + CORPORATE_LOCK_SLA_HOURS * 3600 * 1000),
        status: "PENDING",
        priority: "NORMAL"
      }
    }),
    prisma.manhoursSubmission.update({
      where: { id: submissionId },
      data: {
        status: "APPROVED",
        reviewedById: approverId,
        reviewedAt: new Date(),
        reviewerNotes: notes,
        reviewDecision: "APPROVED"
      }
    })
  ]);
}

/**
 * UNDER_REVIEW → DRAFT. Plant Head rejects or returns for revision.
 * Submission goes back to the HSE Manager's queue.
 *
 * `decision` distinguishes "REJECTED" (real disagreement) from
 * "RETURNED_FOR_REVISION" (just needs more data) — both behave the
 * same in the state machine but the audit log distinguishes them.
 */
export async function plantHeadReject(opts: {
  prisma: PrismaClient;
  submissionId: string;
  reviewerId: string;
  decision: "REJECTED" | "RETURNED_FOR_REVISION";
  notes: string;
}): Promise<void> {
  const { prisma, submissionId, reviewerId, decision, notes } = opts;
  if (!notes || notes.trim().length < 5) {
    throw new Error("Reject / return reason must be at least 5 characters.");
  }
  const sub = await prisma.manhoursSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    select: { status: true }
  });
  if (sub.status !== "UNDER_REVIEW") {
    throw new Error(`Cannot reject a submission in ${sub.status} state (expected UNDER_REVIEW)`);
  }

  const def = await loadDefinition(prisma);
  const checkerStep = def.steps.find((s) => s.stepType === "CHECKER")!;
  const instance = await prisma.workflowInstance.findUniqueOrThrow({
    where: { module_recordId: { module: WORKFLOW_MODULE, recordId: submissionId } }
  });

  await prisma.$transaction([
    prisma.workflowTask.updateMany({
      where: { instanceId: instance.id, stepId: checkerStep.id, status: "PENDING" },
      data: { status: "COMPLETED", completedAt: new Date() }
    }),
    prisma.workflowHistory.create({
      data: {
        instanceId: instance.id,
        stepId: checkerStep.id,
        stepName: checkerStep.name,
        action: "REJECTED",
        performedById: reviewerId,
        comments: `[${decision}] ${notes}`,
        fromStatus: "IN_PROGRESS",
        toStatus: "REJECTED"
      }
    }),
    // Workflow instance moves to REJECTED so the standard
    // tracker UI reflects the state. Re-submission re-uses the
    // same instance via initiateManhoursWorkflow's idempotency.
    prisma.workflowInstance.update({
      where: { id: instance.id },
      data: { status: "REJECTED", currentStepName: "Rejected — returned to HSE Manager" }
    }),
    prisma.manhoursSubmission.update({
      where: { id: submissionId },
      data: {
        status: "DRAFT",
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewerNotes: notes,
        reviewDecision: decision
      }
    })
  ]);
}

/**
 * APPROVED → LOCKED. Corporate HSE locks the submission. Captures the
 * KPI snapshot atomically with the status flip so a partial failure
 * can't leave a "locked but no snapshot" row.
 */
export async function corporateLock(opts: {
  prisma: PrismaClient;
  submissionId: string;
  lockerId: string;
  notes: string | null;
}): Promise<void> {
  const { prisma, submissionId, lockerId, notes } = opts;
  const sub = await prisma.manhoursSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    select: { status: true }
  });
  if (sub.status !== "APPROVED") {
    throw new Error(`Cannot lock a submission in ${sub.status} state (expected APPROVED)`);
  }

  // Capture snapshot BEFORE the transaction so the engine has a
  // consistent view + so we don't hold a write transaction open
  // during the (potentially slow) KPI computation.
  const snapshot = await captureKpiSnapshot({ prisma, submissionId, capturedById: lockerId });

  const def = await loadDefinition(prisma);
  const closureStep = def.steps.find((s) => s.stepType === "CLOSURE")!;
  const instance = await prisma.workflowInstance.findUniqueOrThrow({
    where: { module_recordId: { module: WORKFLOW_MODULE, recordId: submissionId } }
  });

  await prisma.$transaction([
    prisma.workflowTask.updateMany({
      where: { instanceId: instance.id, stepId: closureStep.id, status: "PENDING" },
      data: { status: "COMPLETED", completedAt: new Date() }
    }),
    prisma.workflowHistory.create({
      data: {
        instanceId: instance.id,
        stepId: closureStep.id,
        stepName: closureStep.name,
        action: "APPROVED",
        performedById: lockerId,
        comments: notes ?? null,
        toStatus: "COMPLETED"
      }
    }),
    prisma.workflowInstance.update({
      where: { id: instance.id },
      data: {
        status: "COMPLETED",
        currentStepId: null,
        currentStepName: "Locked",
        completedAt: new Date()
      }
    }),
    prisma.manhoursSubmission.update({
      where: { id: submissionId },
      data: {
        status: "LOCKED",
        lockedById: lockerId,
        lockedAt: new Date(),
        lockNotes: notes,
        kpiSnapshot: snapshot as unknown as object
      }
    })
  ]);
}

/**
 * APPROVED → DRAFT. Corporate HSE rejects after Plant Head's approval.
 * Rare but legitimate (e.g. policy mismatch caught late).
 */
export async function corporateReject(opts: {
  prisma: PrismaClient;
  submissionId: string;
  reviewerId: string;
  notes: string;
}): Promise<void> {
  const { prisma, submissionId, reviewerId, notes } = opts;
  if (!notes || notes.trim().length < 5) {
    throw new Error("Rejection reason must be at least 5 characters.");
  }
  const sub = await prisma.manhoursSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    select: { status: true }
  });
  if (sub.status !== "APPROVED") {
    throw new Error(`Cannot reject a submission in ${sub.status} state (expected APPROVED)`);
  }

  const def = await loadDefinition(prisma);
  const closureStep = def.steps.find((s) => s.stepType === "CLOSURE")!;
  const instance = await prisma.workflowInstance.findUniqueOrThrow({
    where: { module_recordId: { module: WORKFLOW_MODULE, recordId: submissionId } }
  });

  await prisma.$transaction([
    prisma.workflowTask.updateMany({
      where: { instanceId: instance.id, stepId: closureStep.id, status: "PENDING" },
      data: { status: "COMPLETED", completedAt: new Date() }
    }),
    prisma.workflowHistory.create({
      data: {
        instanceId: instance.id,
        stepId: closureStep.id,
        stepName: closureStep.name,
        action: "REJECTED",
        performedById: reviewerId,
        comments: `[CORPORATE_REJECT] ${notes}`,
        fromStatus: "IN_PROGRESS",
        toStatus: "REJECTED"
      }
    }),
    prisma.workflowInstance.update({
      where: { id: instance.id },
      data: { status: "REJECTED", currentStepName: "Rejected by Corporate — back to HSE Manager" }
    }),
    prisma.manhoursSubmission.update({
      where: { id: submissionId },
      data: {
        status: "DRAFT",
        // Note: we don't overwrite Plant Head's earlier review fields —
        // both reviews are auditable through WorkflowHistory.
        lockedById: null,
        lockedAt: null,
        lockNotes: notes
      }
    })
  ]);
}

/**
 * LOCKED → UNLOCKED_FOR_REVISION. Corporate HSE unlocks with a
 * mandatory reason. Creates a ManhoursUnlockEvent row that pairs with
 * the eventual re-lock (or stays open if the revision is abandoned).
 */
export async function unlockSubmission(opts: {
  prisma: PrismaClient;
  submissionId: string;
  unlockerId: string;
  reason: string;
}): Promise<{ unlockEventId: string }> {
  const { prisma, submissionId, unlockerId, reason } = opts;
  if (!reason || reason.trim().length < 10) {
    throw new Error("Unlock reason must be at least 10 characters — this becomes the audit record.");
  }
  const sub = await prisma.manhoursSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    select: { status: true }
  });
  if (sub.status !== "LOCKED") {
    throw new Error(`Cannot unlock a submission in ${sub.status} state (expected LOCKED)`);
  }

  // Defensive: refuse to unlock if there's already an open unlock event.
  // A reopen-from-reopen would corrupt the audit trail.
  const openUnlock = await prisma.manhoursUnlockEvent.findFirst({
    where: { submissionId, reLockedAt: null }
  });
  if (openUnlock) {
    throw new Error("This submission already has an open unlock event. Re-lock first.");
  }

  // Workflow instance moves back to IN_PROGRESS so the standard
  // tracker UI shows the unlock as a live workflow phase.
  const def = await loadDefinition(prisma);
  const closureStep = def.steps.find((s) => s.stepType === "CLOSURE")!;
  const instance = await prisma.workflowInstance.findUnique({
    where: { module_recordId: { module: WORKFLOW_MODULE, recordId: submissionId } }
  });

  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.manhoursUnlockEvent.create({
      data: { submissionId, unlockedById: unlockerId, reason }
    });
    if (instance) {
      await tx.workflowInstance.update({
        where: { id: instance.id },
        data: {
          status: "IN_PROGRESS",
          currentStepId: closureStep.id,
          currentStepName: "Re-lock pending",
          completedAt: null
        }
      });
      await tx.workflowHistory.create({
        data: {
          instanceId: instance.id,
          stepId: closureStep.id,
          stepName: closureStep.name,
          action: "REASSIGNED",
          performedById: unlockerId,
          comments: `[UNLOCK] ${reason}`,
          fromStatus: "COMPLETED",
          toStatus: "IN_PROGRESS"
        }
      });
    }
    await tx.manhoursSubmission.update({
      where: { id: submissionId },
      data: { status: "UNLOCKED_FOR_REVISION" }
    });
    return created;
  });

  return { unlockEventId: event.id };
}

/**
 * UNLOCKED_FOR_REVISION → LOCKED. Re-lock after revision. Captures a
 * FRESH KPI snapshot — historical reports should reflect the corrected
 * data, not the original snapshot taken before unlock. The previous
 * snapshot is preserved inside `unlockEvent.changeLog.before`.
 */
export async function relockSubmission(opts: {
  prisma: PrismaClient;
  submissionId: string;
  lockerId: string;
  notes: string | null;
}): Promise<void> {
  const { prisma, submissionId, lockerId, notes } = opts;
  const sub = await prisma.manhoursSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    select: { status: true, kpiSnapshot: true }
  });
  if (sub.status !== "UNLOCKED_FOR_REVISION") {
    throw new Error(`Cannot re-lock a submission in ${sub.status} state (expected UNLOCKED_FOR_REVISION)`);
  }
  const openUnlock = await prisma.manhoursUnlockEvent.findFirst({
    where: { submissionId, reLockedAt: null },
    orderBy: { unlockedAt: "desc" }
  });
  if (!openUnlock) {
    throw new Error("No open unlock event found for this submission — schema in inconsistent state.");
  }

  // Fresh snapshot reflects the revised data. The PREVIOUS snapshot
  // is recorded in the unlock event's changeLog so the audit trail
  // includes the before/after.
  const newSnapshot = await captureKpiSnapshot({ prisma, submissionId, capturedById: lockerId });

  const def = await loadDefinition(prisma);
  const closureStep = def.steps.find((s) => s.stepType === "CLOSURE")!;
  const instance = await prisma.workflowInstance.findUnique({
    where: { module_recordId: { module: WORKFLOW_MODULE, recordId: submissionId } }
  });

  await prisma.$transaction([
    prisma.manhoursUnlockEvent.update({
      where: { id: openUnlock.id },
      data: {
        reLockedAt: new Date(),
        reLockedById: lockerId,
        changeLog: {
          before: sub.kpiSnapshot as unknown as object,
          after: newSnapshot as unknown as object
        } as unknown as object
      }
    }),
    ...(instance
      ? [
          prisma.workflowInstance.update({
            where: { id: instance.id },
            data: {
              status: "COMPLETED",
              currentStepId: null,
              currentStepName: "Re-locked",
              completedAt: new Date()
            }
          }),
          prisma.workflowHistory.create({
            data: {
              instanceId: instance.id,
              stepId: closureStep.id,
              stepName: closureStep.name,
              action: "APPROVED",
              performedById: lockerId,
              comments: `[RELOCK] ${notes ?? ""}`.trim(),
              fromStatus: "IN_PROGRESS",
              toStatus: "COMPLETED"
            }
          })
        ]
      : []),
    prisma.manhoursSubmission.update({
      where: { id: submissionId },
      data: {
        status: "LOCKED",
        lockedById: lockerId,
        lockedAt: new Date(),
        lockNotes: notes,
        kpiSnapshot: newSnapshot as unknown as object
      }
    })
  ]);
}
