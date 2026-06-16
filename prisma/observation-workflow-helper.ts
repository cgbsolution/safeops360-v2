// ──────────────────────────────────────────────────────────────────────────
// Observation workflow backfill helper.
//
// Creates WorkflowInstance + WorkflowHistory + (optionally) WorkflowTask rows
// for Observation records that were seeded before the workflow engine was
// wired to the observation save path. Without these rows the detail-page flow
// tracker and the inbox task panel are both hidden.
//
// Designed to be called from scripts/backfill-observation-workflow.ts.
// ──────────────────────────────────────────────────────────────────────────

import type { PrismaClient } from "@prisma/client";

// ── Shape returned by loadObservationDefinition ───────────────────────────

export interface WorkflowStepRef {
  id: string;
  sequence: number;
  stepType: string;
  name: string;
}

export interface ObservationDefinition {
  id: string;
  steps: WorkflowStepRef[];
}

// ── Shape returned by loadApproverPools ──────────────────────────────────

export interface ApproverPool {
  supervisors: { id: string; name: string }[];
  safetyOfficers: { id: string; name: string }[];
  hseManagers: { id: string; name: string }[];
}

// ── Observation field subset used by buildObservationWorkflow ────────────

export interface ObservationRef {
  id: string;
  number: string;
  plantId: string;
  observerId: string;
  responsiblePersonId: string | null;
  date: Date;
  closedAt: Date | null;
  status: string;
  severity: string;
}

// ── Loaders ──────────────────────────────────────────────────────────────

export async function loadObservationDefinition(
  prisma: PrismaClient
): Promise<ObservationDefinition> {
  const def = await prisma.workflowDefinition.findFirst({
    where: { module: "OBSERVATION", isActive: true },
    include: {
      steps: {
        orderBy: { sequence: "asc" },
        select: { id: true, sequence: true, stepType: true, name: true },
      },
    },
  });

  if (!def) {
    throw new Error(
      "No active OBSERVATION WorkflowDefinition found. Run seed-workflows.ts first."
    );
  }

  return { id: def.id, steps: def.steps };
}

export async function loadApproverPools(prisma: PrismaClient): Promise<ApproverPool> {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
  });

  const byRole = (keyword: string) =>
    users.filter((u) => u.email.toLowerCase().includes(keyword));

  return {
    supervisors: byRole("supervisor"),
    safetyOfficers: byRole("safety-officer"),
    hseManagers: byRole("hse-manager").concat(
      users.filter((u) => u.email === "priya.nair@safeops360.in")
    ),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function pickUser<T extends { id: string }>(pool: T[], index: number, fallback: T): T {
  if (!pool.length) return fallback;
  return pool[index % pool.length];
}

function offsetMs(base: Date, hours: number): Date {
  return new Date(base.getTime() + hours * 3_600_000);
}

function taskPriority(severity: string): string {
  if (severity === "CRITICAL") return "URGENT";
  if (severity === "HIGH") return "HIGH";
  return "NORMAL";
}

// Observation status → how far through the workflow it is.
//  OPEN         → submitted by observer, first checker step pending
//  ASSIGNED     → checker approved, action assigned to responsible person
//  IN_PROGRESS  → action underway, verifier step pending
//  CLOSED       → workflow completed
function workflowProgressForStatus(status: string): number {
  // Returns number of completed steps (0 = just initiated)
  switch (status) {
    case "OPEN":        return 0;
    case "ASSIGNED":    return 1;
    case "IN_PROGRESS": return 2;
    case "CLOSED":      return 99; // all steps done
    default:            return 0;
  }
}

// ── Main builder ──────────────────────────────────────────────────────────

export async function buildObservationWorkflow(
  prisma: PrismaClient,
  definitionId: string,
  steps: WorkflowStepRef[],
  obs: ObservationRef,
  pool: ApproverPool
): Promise<string> {
  const progress = workflowProgressForStatus(obs.status);
  const isClosed = obs.status === "CLOSED";
  const instanceStatus = isClosed ? "COMPLETED" : progress > 0 ? "IN_PROGRESS" : "IN_PROGRESS";

  // ── Pick approvers from pools (use obs.id to spread picks deterministically)
  const seedIndex = obs.id.charCodeAt(obs.id.length - 1);
  const fallbackUser = { id: obs.observerId, name: "Observer" };
  const checker = pickUser(pool.safetyOfficers, seedIndex, fallbackUser);
  const hseManager = pickUser(pool.hseManagers, seedIndex + 1, fallbackUser);
  const responsible = obs.responsiblePersonId ?? obs.observerId;

  const t0 = obs.date;             // observation date = initiation
  const t1 = offsetMs(t0, 4);     // checker review ~ 4h later
  const t2 = offsetMs(t0, 24);    // assignment ~ 24h later
  const t3 = offsetMs(t0, 48);    // action start ~ 48h later
  const t4 = obs.closedAt ?? offsetMs(t0, 168); // closure ~ 1 week

  // Determine which step is current (0-indexed into sorted steps array)
  const currentStep = isClosed
    ? steps[steps.length - 1]
    : steps[Math.min(progress, steps.length - 1)];

  // ── Create WorkflowInstance ──────────────────────────────────────────
  const instance = await prisma.workflowInstance.create({
    data: {
      definitionId,
      module: "OBSERVATION",
      recordId: obs.id,
      recordNumber: obs.number,
      currentStepId: isClosed ? null : currentStep?.id ?? null,
      currentStepName: isClosed ? null : currentStep?.name ?? null,
      status: instanceStatus,
      initiatedById: obs.observerId,
      initiatedAt: t0,
      completedAt: isClosed ? t4 : null,
    },
  });

  // ── WorkflowHistory entries ──────────────────────────────────────────
  const historyRows: Parameters<typeof prisma.workflowHistory.create>[0]["data"][] = [];

  // Step 0 — INITIATED (always)
  historyRows.push({
    instanceId: instance.id,
    stepId: steps[0]?.id ?? null,
    stepName: steps[0]?.name ?? "Submission",
    action: "INITIATED",
    performedById: obs.observerId,
    performedAt: t0,
    fromStatus: null,
    toStatus: "IN_PROGRESS",
    comments: "Observation submitted for review.",
  });

  if (progress >= 1 || isClosed) {
    // Step 1 — APPROVED by safety officer / checker
    historyRows.push({
      instanceId: instance.id,
      stepId: steps[1]?.id ?? steps[0]?.id ?? null,
      stepName: steps[1]?.name ?? "Safety Officer Review",
      action: "APPROVED",
      performedById: checker.id,
      performedAt: t1,
      fromStatus: "IN_PROGRESS",
      toStatus: "IN_PROGRESS",
      comments:
        obs.severity === "CRITICAL" || obs.severity === "HIGH"
          ? "Observation verified. Severity confirmed. Action assigned with urgency."
          : "Observation reviewed and verified. Action assigned to responsible person.",
    });
  }

  if (progress >= 2 || isClosed) {
    // Step 2 — SUBMITTED / EXECUTED by responsible person
    historyRows.push({
      instanceId: instance.id,
      stepId: steps[2]?.id ?? null,
      stepName: steps[2]?.name ?? "Corrective Action",
      action: "EXECUTED",
      performedById: responsible,
      performedAt: t3,
      fromStatus: "IN_PROGRESS",
      toStatus: "IN_PROGRESS",
      comments: "Corrective action implemented. Verification requested.",
    });
  }

  if (isClosed) {
    // Final step — APPROVED / COMPLETED by HSE manager
    historyRows.push({
      instanceId: instance.id,
      stepId: steps[steps.length - 1]?.id ?? null,
      stepName: steps[steps.length - 1]?.name ?? "Closure",
      action: "COMPLETED",
      performedById: hseManager.id,
      performedAt: t4,
      fromStatus: "IN_PROGRESS",
      toStatus: "COMPLETED",
      comments: "Closure verified. Corrective action confirmed effective. Observation closed.",
    });
  }

  for (const row of historyRows) {
    await prisma.workflowHistory.create({ data: row });
  }

  // ── WorkflowTask — only for open / in-progress observations ──────────
  if (!isClosed && currentStep) {
    const assigneeId =
      currentStep.stepType === "ASSIGNEE_TASK"
        ? responsible
        : currentStep.sequence <= 1
          ? checker.id
          : hseManager.id;

    const slaHours = obs.severity === "CRITICAL" ? 24 : obs.severity === "HIGH" ? 48 : 168;
    const dueAt = offsetMs(
      currentStep.sequence <= 1 ? t0 : t2,
      slaHours
    );

    await prisma.workflowTask.create({
      data: {
        instanceId: instance.id,
        stepId: currentStep.id,
        stepName: currentStep.name,
        taskType: currentStep.stepType === "ASSIGNEE_TASK" ? "EXECUTION" : "APPROVAL",
        module: "OBSERVATION",
        recordId: obs.id,
        recordNumber: obs.number,
        recordTitle: `${obs.severity} observation — ${obs.number}`,
        assignedToId: assigneeId,
        assignedAt: currentStep.sequence <= 1 ? t0 : t2,
        dueAt,
        status: "PENDING",
        priority: taskPriority(obs.severity),
      },
    });
  }

  return instance.id;
}
