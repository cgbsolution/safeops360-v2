// SafeOps360 Workflow Engine
// Single service used by every module. Generic Maker → Checker → Assignee → Verifier → Closure
// Enforces: segregation of duties, full audit trail, SLA tracking, role+field-based assignment

import { prisma } from "@/lib/prisma";
import { Action, InstanceStatus, StepType, TaskStatus, TaskType, type ConditionExpr, type ConditionExprV2, type ConditionRule } from "./types";
import { can, getUserRoleCodes } from "@/lib/auth/permissions";
import { loadRecordContext } from "@/lib/auth/record-context";

type RecordData = Record<string, any>;

// ─── RBAC triple-check ──────────────────────────────────────────────────
// Every workflow transition (approve, reject, submitExecution, verify) calls
// this. Three independent checks, each addressing a different bypass vector:
//   1. Assignee — the user must own the task (or be in its eligible group)
//   2. Role — the user must hold the role the workflow step requires
//   3. Permission — the user must hold the matching {MODULE}.{ACTION} grant
// Any failure throws — caller turns the error into a 403.
async function rbacGate(opts: {
  task: { module: string; recordId: string; assignedToId: string | null; status: string; eligibleGroupRoles?: string | null };
  step: { approverRole: string | null; escalationRole?: string | null };
  userId: string;
  action: "APPROVE" | "EXECUTE" | "VERIFY" | "REJECT";
}) {
  const { task, step, userId, action } = opts;

  // 1. Assignee — direct match, or member of the eligible group queue
  if (task.assignedToId !== userId) {
    let inGroup = false;
    if (task.eligibleGroupRoles) {
      try {
        const groupRoles = JSON.parse(task.eligibleGroupRoles) as string[];
        const userRoles = await getUserRoleCodes(userId);
        inGroup = userRoles.some((r) => groupRoles.includes(r));
      } catch { /* malformed JSON falls through to throw */ }
    }
    if (!inGroup) throw new Error("Not your task");
  }

  // 2. Role — the step's required role must be one the user holds. The
  // escalationRole is also accepted: it's the higher-authority backstop the
  // workflow definition declares for this step (e.g., HSE_MANAGER on a
  // SUPERVISOR step). This lets a manager step in when the primary approver
  // is unavailable, matches safety-ops practice, and prevents stuck workflows
  // when the original assignment was made before a workflow refactor.
  if (step.approverRole) {
    const userRoles = await getUserRoleCodes(userId);
    const allowedRoles = [step.approverRole];
    if (step.escalationRole && step.escalationRole !== step.approverRole) {
      allowedRoles.push(step.escalationRole);
    }
    if (!userRoles.some((r) => allowedRoles.includes(r))) {
      const hint = step.escalationRole && step.escalationRole !== step.approverRole
        ? ` (or escalation: '${step.escalationRole}')`
        : "";
      throw new Error(`This step requires the '${step.approverRole}' role${hint}.`);
    }
  }

  // 3. Permission — module-level grant
  // Action-to-permission mapping: REJECT uses APPROVE permission since the
  // same authority applies to either decision.
  const permAction = action === "REJECT" ? "APPROVE" : action;
  const permCode = `${task.module}.${permAction}`;
  // Resolve the record's plantId so OWN_PLANT scope checks can compare it
  // against the user's profile.plantId. Without this, can() falls back to
  // "scope does not include this record" even when the user IS at the right
  // plant — because it has no plantId to compare against.
  const recordContext = await loadRecordContext(task.module, task.recordId);
  const result = await can(userId, permCode, {
    module: task.module,
    recordId: task.recordId,
    plantId: recordContext.plantId,
    departmentId: recordContext.departmentId,
    record: recordContext.record ?? undefined
  });
  if (!result.allowed) {
    throw new Error(result.reason ?? `Missing permission '${permCode}'.`);
  }
}

// loadRecordContext lives in src/lib/auth/record-context.ts so that both this
// engine and the API authorize() helper share the same per-module scope
// derivation. Imported above.

// ─── Simulation types (shared between engine.simulate() and the test-run UI) ──
export type SimStep = {
  sequence: number;
  stepType: string;
  name: string;
  approverRole: string | null;
  approverField: string | null;
  approverUserId?: string | null;
  approverGroupRoles?: string | null;
  slaHours: number | null;
  conditionExpr?: string | null;
};

export type SimulationStatus = "AUTO" | "EXECUTED" | "SKIPPED" | "BLOCKED";

export type SimulationStepResult = {
  sequence: number;
  stepType: string;
  name: string;
  status: SimulationStatus;
  reason: string | null;
  conditionExpr: string | null;
  dueAt: string | null;
  assignee: { id: string; name: string; designation: string | null; plant?: string | null } | null;
};

export type SimulationError = { sequence: number; message: string };

export type SimulationResult = {
  trace: SimulationStepResult[];
  errors: SimulationError[];
};

// ─── Resolver: turn a step's approver* fields into a real userId ────────────
async function resolveAssignee(opts: {
  approverRole?: string | null;
  approverField?: string | null;
  approverUserId?: string | null;
  approverGroupRoles?: string | null;
  recordData: RecordData;
  initiatorId: string;
  module: string;
  plantId?: string | null;
}): Promise<string | null> {
  const { approverRole, approverField, approverUserId, approverGroupRoles, recordData, initiatorId, plantId } = opts;

  // 1. Specific user — wins if set
  if (approverUserId) return approverUserId;

  // 2. Field-based resolution
  if (approverField) {
    const fieldVal = recordData[approverField] || recordData[approverField.toLowerCase()];
    if (typeof fieldVal === "string") return fieldVal;
    // Map known logical fields to record properties
    if (approverField === "ORIGINATOR") return recordData.observerId ?? recordData.reporterId ?? recordData.originatorId ?? initiatorId;
    if (approverField === "ACTION_OWNER") return recordData.actionOwnerId ?? recordData.responsiblePersonId ?? null;
    if (approverField === "RESPONSIBLE_PERSON") return recordData.responsiblePersonId ?? recordData.actionOwnerId ?? null;
    if (approverField === "ASSIGNED_INSPECTOR") return recordData.inspectorId ?? null;
    if (approverField === "RECEIVER") return recordData.receiverId ?? null;
    if (approverField === "ISSUER") return recordData.issuerId ?? null;
    if (approverField === "TRAINER") return recordData.trainerId ?? null;
  }

  // Departments live on Users, not records. Extract the record's department
  // by looking at whoever "owns" the record (observer for OBSERVATION,
  // reporter for INCIDENT/NEAR_MISS, originator for PTW, etc.) — this is
  // the department the supervisor / dept-head expecting OWN_DEPARTMENT scope
  // needs to match. recordData carries these as nested user objects after
  // loadRecordContext hydration.
  const departmentHint =
    recordData.observer?.department ??
    recordData.reporter?.department ??
    recordData.originator?.department ??
    recordData.leader?.department ??
    recordData.inspector?.department ??
    null;

  // 3. Group queue — union of multiple roles. Read from UserRole so multi-role
  //    users are discoverable via any of their roles. We pick the
  //    earliest-joined user at the current plant; downstream the engine
  //    serialises eligibleGroupRoles on the task so OTHER members of the
  //    group can still claim it.
  if (approverGroupRoles) {
    try {
      const roles = JSON.parse(approverGroupRoles) as string[];
      if (Array.isArray(roles) && roles.length > 0) {
        const userId = await findUserByRoles(roles, plantId ?? null, departmentHint);
        if (userId) return userId;
      }
    } catch {
      /* ignore malformed group roles JSON */
    }
  }

  // 4. Role-based resolution via UserRole — picks a user holding the role at
  //    the requested plant scope (and department hint) if possible.
  if (approverRole) {
    const userId = await findUserByRoles([approverRole], plantId ?? null, departmentHint);
    if (userId) return userId;
  }

  return null;
}

// Looks up a single user holding any of the given role codes. Prefers users
// scoped to the requested plant + department; falls back to plant only;
// then to any plant. UserRole-driven so multi-role users are visible no
// matter which role they hold as primary.
//
// Why department matters: when there are multiple users with the same role
// at the same plant (e.g., one Supervisor in IT and one in HR), the engine
// must pick the one matching the record's department — otherwise an HR
// observation gets routed to the IT supervisor, who then can't act on it
// because their OWN_DEPARTMENT scope rejects records from other departments.
async function findUserByRoles(
  roleCodes: string[],
  plantId: string | null,
  departmentHint: string | null = null
): Promise<string | null> {
  if (roleCodes.length === 0) return null;
  const rows = await prisma.userRole.findMany({
    where: {
      role: { code: { in: roleCodes }, isActive: true },
      OR: [{ validTo: null }, { validTo: { gt: new Date() } }]
    },
    include: { user: { select: { id: true, plantId: true, department: true, createdAt: true } } },
    orderBy: { user: { createdAt: "asc" } }
  });
  if (rows.length === 0) return null;

  if (plantId) {
    // Best match: same plant + same department (when a hint is available)
    if (departmentHint) {
      const atPlantAndDept = rows.find(
        (r) => r.user.plantId === plantId && r.user.department === departmentHint
      );
      if (atPlantAndDept) return atPlantAndDept.user.id;
    }
    // Next best: same plant, any department
    const atPlant = rows.find(
      (r) => r.user.plantId === plantId &&
        (!r.scopeType || r.scopeType !== "PLANT" || r.scopeValue === plantId)
    );
    if (atPlant) return atPlant.user.id;
    // Fallback to plant-scoped match where the row's scope wins (e.g., a
    // CORPORATE_HSE role with global scope)
    const scopedFallback = rows.find((r) => !r.scopeType || r.scopeType !== "PLANT");
    if (scopedFallback) return scopedFallback.user.id;
  }
  return rows[0].user.id;
}

// ─── Evaluate a step's conditional expression against record data ──
function evaluateCondition(expr: string | null | undefined, recordData: RecordData): boolean {
  if (!expr) return true;
  try {
    const cond = JSON.parse(expr) as ConditionExpr;

    // v2 explicit format with combinator + rules
    if (typeof cond === "object" && cond !== null && (cond as any).version === 2) {
      const v2 = cond as ConditionExprV2;
      const rules = Array.isArray(v2.rules) ? v2.rules : [];
      if (rules.length === 0) return true;
      const results = rules.map((r) => evaluateRule(r, recordData));
      return v2.combinator === "OR" ? results.some(Boolean) : results.every(Boolean);
    }

    // v1 legacy format: { field: value | array } — all keys ANDed, equality / membership
    for (const [field, expected] of Object.entries(cond as Record<string, any>)) {
      const actual = recordData[field];
      if (Array.isArray(expected)) {
        if (!expected.includes(actual as never)) return false;
      } else if (actual !== expected) return false;
    }
    return true;
  } catch {
    return true;
  }
}

function evaluateRule(rule: ConditionRule, recordData: RecordData): boolean {
  const actual = recordData[rule.field];
  switch (rule.operator) {
    case "=":
      return actual === rule.value;
    case "!=":
      return actual !== rule.value;
    case "in": {
      const list = Array.isArray(rule.value) ? rule.value : String(rule.value).split(",").map((s) => s.trim());
      return (list as any[]).includes(actual);
    }
    case "not_in": {
      const list = Array.isArray(rule.value) ? rule.value : String(rule.value).split(",").map((s) => s.trim());
      return !(list as any[]).includes(actual);
    }
    case "contains":
      return typeof actual === "string" && typeof rule.value === "string" && actual.toLowerCase().includes(rule.value.toLowerCase());
    case ">":
      return Number(actual) > Number(rule.value);
    case "<":
      return Number(actual) < Number(rule.value);
    case ">=":
      return Number(actual) >= Number(rule.value);
    case "<=":
      return Number(actual) <= Number(rule.value);
    default:
      return true;
  }
}

// ─── Find the workflow definition for a module/recordType ──
async function findDefinition(module: string, recordType?: string | null) {
  const def =
    (recordType
      ? await prisma.workflowDefinition.findFirst({ where: { module, recordType, isActive: true }, include: { steps: { orderBy: { sequence: "asc" } } } })
      : null) ??
    (await prisma.workflowDefinition.findFirst({ where: { module, recordType: null, isActive: true }, include: { steps: { orderBy: { sequence: "asc" } } } }));
  return def;
}

// ─── Find the next applicable step starting from a sequence ──
type StepLike = {
  id: string;
  sequence: number;
  stepType: string;
  name: string;
  approverRole: string | null;
  approverField: string | null;
  slaHours: number | null;
  conditionExpr: string | null;
};

function findNextApplicableStep<T extends StepLike>(steps: T[], fromSequence: number, recordData: RecordData): T | undefined {
  return steps
    .filter((s) => s.sequence > fromSequence)
    .find((s) => evaluateCondition(s.conditionExpr, recordData));
}

// ─── Sync the underlying module's `status` column with workflow state ───
// The workflow tables hold the truth, but each module also has a denormalised
// `status` enum used for fast list filters and dashboards. Without this sync,
// observation.status would stay "OPEN" forever even after workflow completion.
//
// Mapping rules (per module):
//   nextStep undefined / instance COMPLETED  → CLOSED (+ closedAt = now)
//   nextStep is CHECKER                       → OPEN
//   nextStep is ASSIGNEE_TASK                 → ASSIGNED
//   nextStep is VERIFIER or CLOSURE           → IN_PROGRESS
//
// Failures here are non-fatal — the workflow tables are authoritative.
async function syncRecordStatus(opts: {
  module: string;
  recordId: string;
  nextStepType?: string | null;
  instanceCompleted: boolean;
}): Promise<void> {
  const { module, recordId, nextStepType, instanceCompleted } = opts;

  const status = (() => {
    if (instanceCompleted) return "CLOSED";
    if (!nextStepType) return null;
    if (nextStepType === StepType.CHECKER) return "OPEN";
    if (nextStepType === StepType.ASSIGNEE_TASK) return "ASSIGNED";
    if (nextStepType === StepType.VERIFIER || nextStepType === StepType.CLOSURE) return "IN_PROGRESS";
    return null;
  })();
  if (!status) return;

  const closedAt = instanceCompleted ? new Date() : null;

  try {
    if (module === "OBSERVATION") {
      await prisma.observation.update({
        where: { id: recordId },
        data: { status: status as any, ...(instanceCompleted ? { closedAt } : {}) }
      });
      // Post-closure cross-module triggers (Dimension 4) are now handled
      // by the Python backend (app/services/post_closure_rules.py), which
      // also runs the AI agents. The Node-side runPostClosureRules has
      // been removed.
    } else if (module === "NEAR_MISS") {
      // Near Miss enum is REPORTED|UNDER_REVIEW|ACTION_ASSIGNED|CLOSED — map accordingly
      const nmStatus =
        status === "CLOSED" ? "CLOSED" :
        status === "ASSIGNED" ? "ACTION_ASSIGNED" :
        status === "IN_PROGRESS" ? "ACTION_ASSIGNED" :
        "UNDER_REVIEW";
      await prisma.nearMiss.update({
        where: { id: recordId },
        data: { status: nmStatus as any }
      });
    } else if (module === "INCIDENT") {
      const incStatus =
        status === "CLOSED" ? "CLOSED" :
        status === "ASSIGNED" ? "CAPA_ASSIGNED" :
        status === "IN_PROGRESS" ? "INVESTIGATION" :
        "REPORTED";
      await prisma.incident.update({
        where: { id: recordId },
        data: { status: incStatus as any, ...(instanceCompleted ? { closedAt } : {}) }
      });
    } else if (module === "MANHOURS") {
      // Manhours has no status enum; instead the `locked` boolean is the
      // post-closure flag. Set it true on workflow completion (Corporate HSE
      // signs off). Workflow advancement steps don't change anything visible
      // to users beyond the engine's own state.
      if (instanceCompleted) {
        await prisma.manhours.update({
          where: { id: recordId },
          data: { locked: true }
        });
      }
    } else if (module === "INSPECTION") {
      // Inspection lifecycle:
      //   nextStep ASSIGNEE_TASK → leave status alone (SCHEDULED/DUE/OVERDUE
      //                            is owned by the date-based sweep, not the
      //                            workflow advancement path).
      //   nextStep VERIFIER       → IN_PROGRESS (inspector has submitted results)
      //   nextStep CLOSURE        → IN_PROGRESS (awaiting HSE close)
      //   instance COMPLETED      → COMPLETED + completedDate
      const ins = await prisma.inspection.findUnique({ where: { id: recordId }, select: { status: true } });
      if (!ins) return;
      if (instanceCompleted) {
        await prisma.inspection.update({
          where: { id: recordId },
          data: { status: "COMPLETED", completedDate: closedAt ?? new Date() }
        });
      } else if (nextStepType === StepType.VERIFIER || nextStepType === StepType.CLOSURE) {
        if (ins.status !== "COMPLETED") {
          await prisma.inspection.update({ where: { id: recordId }, data: { status: "IN_PROGRESS" } });
        }
      }
      // ASSIGNEE_TASK: do nothing — the date-based sweep manages SCHEDULED/DUE/OVERDUE.
    } else if (module === "PTW") {
      // PTW has a richer enum that mirrors physical permit lifecycle. Map workflow
      // step type to the closest enum value:
      //   nextStep CHECKER  → SUBMITTED / approval pending
      //   nextStep ASSIGNEE → ACTIVE (receiver has acknowledged + FLRA gate has passed
      //                       — enforced by submitExecution for the receiver step)
      //   nextStep CLOSURE  → ACTIVE (work in progress, awaiting return)
      //   instance COMPLETED→ CLOSED
      // We avoid stomping on SUSPENDED / EXPIRED / REJECTED — those are external
      // state changes, not driven by the workflow advancement path.
      const existing = await prisma.permit.findUnique({ where: { id: recordId }, select: { status: true } });
      if (!existing || existing.status === "SUSPENDED" || existing.status === "EXPIRED" || existing.status === "REJECTED") {
        return;
      }
      const ptwStatus =
        instanceCompleted ? "CLOSED" :
        nextStepType === StepType.ASSIGNEE_TASK ? "ACTIVE" :
        nextStepType === StepType.CLOSURE ? "ACTIVE" :
        "SUBMITTED";
      await prisma.permit.update({
        where: { id: recordId },
        data: {
          status: ptwStatus as any,
          ...(instanceCompleted ? { closedAt } : {})
        }
      });
    }
    // Other modules (TRAINING, INSPECTION, MANHOURS) have their own status enums
    // tied to module-specific lifecycles — left alone for now.
  } catch (e) {
    console.error(`syncRecordStatus failed for ${module}/${recordId}:`, e);
  }
}

// ─── PUBLIC API ─────────────────────────────────────────────────────────

export const WorkflowEngine = {
  async initiate(opts: {
    module: string;
    recordId: string;
    recordNumber?: string;
    recordTitle?: string;
    recordType?: string | null;
    recordData: RecordData;
    initiatorId: string;
    plantId?: string | null;
  }) {
    const def = await findDefinition(opts.module, opts.recordType);
    if (!def) throw new Error(`No active workflow definition for module ${opts.module}${opts.recordType ? `/${opts.recordType}` : ""}`);

    // Hydrate recordData with the underlying record so role-resolution can
    // honour the record's department. Without this, the engine picks ANY
    // user with the role at this plant — e.g., an HR observation gets routed
    // to the IT supervisor instead of the HR supervisor.
    const ctx = await loadRecordContext(opts.module, opts.recordId);
    const recordData: RecordData = { ...(ctx.record ?? {}), ...opts.recordData };

    // Maker step (sequence 1) is auto-completed by the initiator
    const makerStep = def.steps.find((s) => s.stepType === StepType.MAKER) ?? def.steps[0];
    const nextStep = findNextApplicableStep(def.steps, makerStep.sequence, recordData);

    const instance = await prisma.workflowInstance.create({
      data: {
        definitionId: def.id,
        module: opts.module,
        recordId: opts.recordId,
        recordNumber: opts.recordNumber,
        currentStepId: nextStep?.id ?? null,
        currentStepName: nextStep?.name ?? "Completed",
        status: nextStep ? InstanceStatus.IN_PROGRESS : InstanceStatus.COMPLETED,
        initiatedById: opts.initiatorId,
        completedAt: nextStep ? null : new Date()
      }
    });

    // Audit: record the initiation
    await prisma.workflowHistory.create({
      data: {
        instanceId: instance.id,
        stepId: makerStep.id,
        stepName: makerStep.name,
        action: Action.SUBMITTED,
        performedById: opts.initiatorId,
        toStatus: instance.status
      }
    });

    // Create the first pending task
    if (nextStep) {
      await createTaskForStep({
        instanceId: instance.id,
        step: nextStep,
        recordData,
        recordNumber: opts.recordNumber,
        recordTitle: opts.recordTitle,
        module: opts.module,
        recordId: opts.recordId,
        initiatorId: opts.initiatorId,
        plantId: opts.plantId
      });
    }

    await syncRecordStatus({
      module: opts.module,
      recordId: opts.recordId,
      nextStepType: nextStep?.stepType ?? null,
      instanceCompleted: !nextStep
    });

    return instance;
  },

  async approve(opts: { taskId: string; userId: string; comments?: string; attachments?: string[]; recordData?: RecordData; plantId?: string | null }) {
    return await advanceFromApproval({ ...opts, accepted: true });
  },

  async reject(opts: { taskId: string; userId: string; reason: string; comments?: string }) {
    const task = await prisma.workflowTask.findUnique({
      where: { id: opts.taskId },
      include: { instance: { include: { definition: { include: { steps: true } } } } }
    });
    if (!task) throw new Error("Task not found");
    if (task.status !== TaskStatus.PENDING) throw new Error("Task is not pending");
    const step = task.instance.definition.steps.find((s) => s.id === task.stepId);
    if (!step) throw new Error("Step missing");
    await rbacGate({ task: { ...task, eligibleGroupRoles: (task as any).eligibleGroupRoles ?? null }, step, userId: opts.userId, action: "REJECT" });

    await prisma.$transaction([
      prisma.workflowTask.update({
        where: { id: task.id },
        data: { status: TaskStatus.COMPLETED, completedAt: new Date() }
      }),
      prisma.workflowInstance.update({
        where: { id: task.instanceId },
        data: { status: InstanceStatus.REJECTED, currentStepName: "Rejected — rework required" }
      }),
      prisma.workflowHistory.create({
        data: {
          instanceId: task.instanceId,
          stepId: task.stepId,
          stepName: task.stepName,
          action: Action.REJECTED,
          performedById: opts.userId,
          comments: `${opts.reason}${opts.comments ? "\n\n" + opts.comments : ""}`,
          fromStatus: InstanceStatus.IN_PROGRESS,
          toStatus: InstanceStatus.REJECTED
        }
      })
    ]);

    return { ok: true, status: InstanceStatus.REJECTED };
  },

  async submitExecution(opts: { taskId: string; userId: string; executionData?: RecordData; comments?: string; attachments?: string[]; recordData?: RecordData; plantId?: string | null }) {
    return await advanceFromExecution({ ...opts });
  },

  // Re-submit a rejected workflow back into the review queue. Only the original
  // initiator may call this. Restarts the workflow at the FIRST non-MAKER step,
  // which in practice is the CHECKER review the maker can rework against.
  async resubmit(opts: {
    instanceId: string;
    userId: string;
    comments?: string;
    recordData?: RecordData;
    plantId?: string | null;
  }) {
    const instance = await prisma.workflowInstance.findUnique({
      where: { id: opts.instanceId },
      include: { definition: { include: { steps: { orderBy: { sequence: "asc" } } } } }
    });
    if (!instance) throw new Error("Workflow instance not found");
    if (instance.initiatedById !== opts.userId) throw new Error("Only the original submitter can re-submit this record");
    if (instance.status !== InstanceStatus.REJECTED) throw new Error("Only rejected workflows can be re-submitted");

    const ctx = await loadRecordContext(instance.module, instance.recordId);
    const recordData: RecordData = { ...(ctx.record ?? {}), ...(opts.recordData ?? {}) };
    const makerStep = instance.definition.steps.find((s) => s.stepType === StepType.MAKER) ?? instance.definition.steps[0];
    const nextStep = findNextApplicableStep(instance.definition.steps, makerStep.sequence, recordData);
    if (!nextStep) throw new Error("Workflow has no reviewable step after the Maker");

    await prisma.workflowInstance.update({
      where: { id: instance.id },
      data: {
        status: InstanceStatus.IN_PROGRESS,
        currentStepId: nextStep.id,
        currentStepName: nextStep.name,
        completedAt: null
      }
    });
    await prisma.workflowHistory.create({
      data: {
        instanceId: instance.id,
        stepId: makerStep.id,
        stepName: makerStep.name,
        action: Action.SUBMITTED,
        performedById: opts.userId,
        comments: `Re-submitted after rework. ${opts.comments ?? ""}`.trim(),
        fromStatus: InstanceStatus.REJECTED,
        toStatus: InstanceStatus.IN_PROGRESS
      }
    });
    await createTaskForStep({
      instanceId: instance.id,
      step: nextStep,
      recordData,
      recordNumber: instance.recordNumber ?? undefined,
      module: instance.module,
      recordId: instance.recordId,
      initiatorId: instance.initiatedById,
      plantId: opts.plantId
    });
    await syncRecordStatus({
      module: instance.module,
      recordId: instance.recordId,
      nextStepType: nextStep.stepType,
      instanceCompleted: false
    });
    return { ok: true, sentTo: nextStep.name };
  },

  async verify(opts: { taskId: string; userId: string; accepted: boolean; comments?: string; recordData?: RecordData; plantId?: string | null }) {
    return await advanceFromVerification({ ...opts });
  },

  async reassign(opts: { taskId: string; fromUserId: string; toUserId: string; reason: string }) {
    const task = await prisma.workflowTask.findUnique({
      where: { id: opts.taskId },
      include: { instance: true }
    });
    if (!task) throw new Error("Task not found");
    if (opts.toUserId === task.assignedToId) {
      throw new Error("Cannot reassign to the same user already holding the task");
    }
    if (task.assignedToId !== opts.fromUserId) {
      // HSE Manager can also reassign
      const u = await prisma.user.findUnique({ where: { id: opts.fromUserId } });
      if (u?.role !== "HSE_MANAGER" && u?.role !== "ADMIN") throw new Error("Only the current task holder or HSE Manager can reassign");
    }
    // Segregation of duties: cannot reassign to the workflow's initiator unless this is
    // the closure step. Otherwise the maker would be approving their own submission.
    if (opts.toUserId === task.instance.initiatedById) {
      // Allow only when the workflow is at the very last (closure) step, where the
      // initiator approving their own record is acceptable for single-user demos.
      const def = await prisma.workflowDefinition.findUnique({
        where: { id: task.instance.definitionId },
        include: { steps: { orderBy: { sequence: "desc" }, take: 1 } }
      });
      const lastStepId = def?.steps[0]?.id;
      if (task.stepId !== lastStepId) {
        throw new Error(
          "Segregation of duties: cannot reassign this task to the record initiator. Pick a different user."
        );
      }
    }
    await prisma.$transaction([
      prisma.workflowTask.update({
        where: { id: task.id },
        data: { assignedToId: opts.toUserId, status: TaskStatus.PENDING, assignedAt: new Date() }
      }),
      prisma.workflowHistory.create({
        data: {
          instanceId: task.instanceId,
          stepId: task.stepId,
          stepName: task.stepName,
          action: Action.REASSIGNED,
          performedById: opts.fromUserId,
          comments: `Reassigned to user ${opts.toUserId}: ${opts.reason}`
        }
      })
    ]);
    return { ok: true };
  },

  async getMyTasks(opts: { userId: string; status?: string; module?: string; taskType?: string }) {
    return await prisma.workflowTask.findMany({
      where: {
        assignedToId: opts.userId,
        ...(opts.status ? { status: opts.status } : { status: { in: [TaskStatus.PENDING, TaskStatus.OVERDUE, TaskStatus.ESCALATED] } }),
        ...(opts.module ? { module: opts.module } : {}),
        ...(opts.taskType ? { taskType: opts.taskType } : {})
      },
      include: { instance: { include: { initiatedBy: true } } },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }, { assignedAt: "desc" }]
    });
  },

  async getInbox(userId: string) {
    const [pendingApprovals, executionTasks, verifications, mySubmitted, overdue] = await Promise.all([
      this.getMyTasks({ userId, taskType: TaskType.APPROVAL }),
      this.getMyTasks({ userId, taskType: TaskType.EXECUTION }),
      this.getMyTasks({ userId, taskType: TaskType.VERIFICATION }),
      prisma.workflowInstance.findMany({
        where: { initiatedById: userId },
        orderBy: { initiatedAt: "desc" },
        take: 50
      }),
      prisma.workflowTask.findMany({
        where: { assignedToId: userId, status: { in: [TaskStatus.OVERDUE, TaskStatus.ESCALATED] } },
        include: { instance: true },
        orderBy: { dueAt: "asc" }
      })
    ]);
    return { pendingApprovals, executionTasks, verifications, mySubmitted, overdue };
  },

  async getHistory(opts: { module: string; recordId: string }) {
    const instance = await prisma.workflowInstance.findUnique({
      where: { module_recordId: { module: opts.module, recordId: opts.recordId } },
      include: {
        definition: { include: { steps: { orderBy: { sequence: "asc" } } } },
        history: { include: { performedBy: true }, orderBy: { performedAt: "asc" } },
        pendingTasks: { include: { assignedTo: true } }
      }
    });
    return instance;
  },

  async getCurrentTaskForUser(opts: { module: string; recordId: string; userId: string }) {
    const instance = await prisma.workflowInstance.findUnique({
      where: { module_recordId: { module: opts.module, recordId: opts.recordId } }
    });
    if (!instance) return null;
    return await prisma.workflowTask.findFirst({
      where: { instanceId: instance.id, assignedToId: opts.userId, status: TaskStatus.PENDING }
    });
  },

  // Convenience: count pending tasks for sidebar badge
  async countPendingTasks(userId: string) {
    return prisma.workflowTask.count({
      where: { assignedToId: userId, status: { in: [TaskStatus.PENDING, TaskStatus.OVERDUE, TaskStatus.ESCALATED] } }
    });
  },

  // ─── Permit auto-expiry sweep ────────────────────────────────────────
  // Flips permits whose validity window has passed but are still in an open
  // state (SUBMITTED/ISSUER_APPROVED/SAFETY_APPROVED/PLANT_HEAD_APPROVED/ACTIVE)
  // to EXPIRED. Idempotent. Records expiry timestamp on each row + writes a
  // workflow history entry so the audit trail is complete.
  //
  // SUSPENDED permits are also caught — a permit suspended past its validity
  // window cannot resume; it must be re-issued.
  async sweepExpiredPermits(opts?: { now?: Date }) {
    const now = opts?.now ?? new Date();
    const openStatuses: ("SUBMITTED" | "ISSUER_APPROVED" | "SAFETY_APPROVED" | "PLANT_HEAD_APPROVED" | "ACTIVE" | "SUSPENDED")[] = [
      "SUBMITTED",
      "ISSUER_APPROVED",
      "SAFETY_APPROVED",
      "PLANT_HEAD_APPROVED",
      "ACTIVE",
      "SUSPENDED"
    ];
    const overdue = await prisma.permit.findMany({
      where: { status: { in: openStatuses }, validTo: { lt: now } },
      select: { id: true, status: true }
    });
    if (overdue.length === 0) return { expired: 0 };

    await prisma.permit.updateMany({
      where: { id: { in: overdue.map((p) => p.id) } },
      data: { status: "EXPIRED", expiredAt: now }
    });

    // Add history entries on the workflow instance(s), if any, so the timeline shows it.
    for (const p of overdue) {
      const instance = await prisma.workflowInstance.findUnique({
        where: { module_recordId: { module: "PTW", recordId: p.id } }
      });
      if (instance) {
        await prisma.workflowHistory.create({
          data: {
            instanceId: instance.id,
            stepId: instance.currentStepId,
            stepName: instance.currentStepName ?? "Expired",
            action: Action.ESCALATED,
            performedById: instance.initiatedById,
            comments: `Permit auto-expired (validity window ended). Was: ${p.status}.`,
            fromStatus: p.status,
            toStatus: "EXPIRED"
          }
        });
      }
    }

    return { expired: overdue.length };
  },

  // ─── Inspection date sweep ─────────────────────────────────────────────
  // Flips Inspection rows whose scheduledDate has crossed thresholds:
  //   SCHEDULED + within 3 days        → DUE
  //   SCHEDULED / DUE + past           → OVERDUE
  // Doesn't touch IN_PROGRESS or COMPLETED rows. Idempotent.
  async sweepInspectionStatus(opts?: { now?: Date }) {
    const now = opts?.now ?? new Date();
    const dueWindowMs = 3 * 24 * 60 * 60 * 1000;

    // SCHEDULED → OVERDUE if past
    const scheduledOverdue = await prisma.inspection.updateMany({
      where: { status: "SCHEDULED", scheduledDate: { lt: now } },
      data: { status: "OVERDUE" }
    });
    // DUE → OVERDUE if past
    const dueOverdue = await prisma.inspection.updateMany({
      where: { status: "DUE", scheduledDate: { lt: now } },
      data: { status: "OVERDUE" }
    });
    // SCHEDULED → DUE if within 3 days
    const scheduledDue = await prisma.inspection.updateMany({
      where: {
        status: "SCHEDULED",
        scheduledDate: { gte: now, lte: new Date(now.getTime() + dueWindowMs) }
      },
      data: { status: "DUE" }
    });

    return {
      scheduledToOverdue: scheduledOverdue.count,
      dueToOverdue: dueOverdue.count,
      scheduledToDue: scheduledDue.count
    };
  },

  // ─── Auto-create Observation when an Inspection fails ─────────────────
  // Brief: "Any 'Fail' auto-creates CAPA assigned to equipment owner".
  // We piggyback on the existing Observation workflow — creating an Observation
  // routes the Action Owner step to the responsiblePerson, which becomes the
  // CAPA in everything-but-name.
  async createObservationFromFailedInspection(opts: {
    inspectionId: string;
    initiatorId: string;
  }) {
    const ins = await prisma.inspection.findUnique({
      where: { id: opts.inspectionId },
      include: { equipment: true, plant: true, inspector: true }
    });
    if (!ins) return null;
    if (ins.result !== "Fail" && ins.result !== "Partial") return null;

    // Pick a responsible person: prefer the inspector, otherwise the first
    // HSE_MANAGER at the plant (action owner FK can't be null on observations).
    let responsibleId = ins.inspectorId;
    if (!responsibleId) {
      const hse = await prisma.user.findFirst({
        where: { role: "HSE_MANAGER", plantId: ins.plantId },
        orderBy: { createdAt: "asc" }
      });
      responsibleId = hse?.id ?? null;
    }
    if (!responsibleId) {
      console.warn(`createObservationFromFailedInspection: no responsible person found for plant ${ins.plantId}`);
      return null;
    }

    const last = await prisma.observation.count({ where: { plantId: ins.plantId } });
    const year = new Date().getFullYear();
    const plant = await prisma.plant.findUnique({ where: { id: ins.plantId } });
    if (!plant) return null;
    const number = `SO-${year}-${plant.code}-${String(last + 1).padStart(4, "0")}`;

    const severity = ins.result === "Fail" ? "HIGH" : "MEDIUM";
    const targetDays = severity === "HIGH" ? 7 : 14;
    const targetDate = new Date(Date.now() + targetDays * 86400000);

    const observation = await prisma.observation.create({
      data: {
        number,
        observerId: opts.initiatorId,
        date: new Date(),
        plantId: ins.plantId,
        type: "UNSAFE_CONDITION",
        category: "OTHERS",
        description: `Auto-raised from failed inspection ${ins.number} on ${ins.equipment.code} (${ins.equipment.name}). Result: ${ins.result}.${ins.observations ? `\n\nField notes: ${ins.observations}` : ""}`,
        severity: severity as any,
        immediateAction: null,
        responsiblePersonId: responsibleId,
        targetDate,
        status: "OPEN"
      }
    });

    // Initiate the Observation workflow so the assignee gets a CAPA-style task
    try {
      await this.initiate({
        module: "OBSERVATION",
        recordId: observation.id,
        recordNumber: observation.number,
        recordTitle: observation.description.slice(0, 120),
        recordData: {
          severity: observation.severity,
          category: observation.category,
          type: observation.type,
          observerId: observation.observerId,
          responsiblePersonId: observation.responsiblePersonId,
          actionOwnerId: observation.responsiblePersonId,
          targetDate: observation.targetDate,
          plantId: observation.plantId,
          fromInspectionId: ins.id
        },
        initiatorId: opts.initiatorId,
        plantId: observation.plantId
      });
    } catch (e: any) {
      console.error("Auto-Observation workflow init failed:", e.message);
    }

    return observation;
  },

  // ─── SLA sweep ─────────────────────────────────────────────────────────
  // Walks all open tasks and flips status / fires escalation. Idempotent.
  // Intended to be called from the inbox page server component on each load —
  // there is no scheduled cron in this stack, so this is the closest thing.
  //
  // Rules:
  //   PENDING + dueAt < now              → OVERDUE
  //   OVERDUE + dueAt + 24h < now        → ESCALATED + create parallel
  //                                        task for step.escalationRole
  //                                        (priority URGENT, dueAt + 24h)
  //
  // Only one escalation task is ever created per source task — the second pass
  // sees it already exists (linked via stepId + escalation owner) and skips.
  async sweepOverdue(opts?: { now?: Date }) {
    const now = opts?.now ?? new Date();
    const escalateAfterMs = 24 * 60 * 60 * 1000;
    const escalationDueMs = 24 * 60 * 60 * 1000;
    let flippedToOverdue = 0;
    let flippedToEscalated = 0;
    let escalationTasksCreated = 0;

    // 1. PENDING → OVERDUE
    const pendingOverdue = await prisma.workflowTask.findMany({
      where: { status: TaskStatus.PENDING, dueAt: { lt: now } },
      select: { id: true }
    });
    if (pendingOverdue.length > 0) {
      await prisma.workflowTask.updateMany({
        where: { id: { in: pendingOverdue.map((t) => t.id) } },
        data: { status: TaskStatus.OVERDUE }
      });
      flippedToOverdue = pendingOverdue.length;
    }

    // 2. OVERDUE → ESCALATED (+ spawn parallel task for escalationRole)
    const overdueLong = await prisma.workflowTask.findMany({
      where: { status: TaskStatus.OVERDUE, dueAt: { lt: new Date(now.getTime() - escalateAfterMs) } },
      include: { instance: { include: { definition: { include: { steps: true } } } } }
    });
    for (const task of overdueLong) {
      // Mark the source task escalated so we don't reprocess it
      await prisma.workflowTask.update({
        where: { id: task.id },
        data: { status: TaskStatus.ESCALATED }
      });
      flippedToEscalated++;

      const step = task.instance.definition.steps.find((s) => s.id === task.stepId);
      if (!step?.escalationRole) {
        await prisma.workflowHistory.create({
          data: {
            instanceId: task.instanceId,
            stepId: task.stepId,
            stepName: task.stepName,
            action: Action.ESCALATED,
            performedById: task.assignedToId,
            comments: `Auto-escalated — overdue more than 24h. No escalation role configured on this step.`
          }
        });
        continue;
      }

      // Resolve a user with the escalation role scoped to the initiator's plant.
      // Without a plantId, findUserByRoles returns rows[0] globally which may be
      // a shared demo/admin account rather than the plant-local role holder.
      const initiatorUser = await prisma.user.findUnique({
        where: { id: task.instance.initiatedById },
        select: { plantId: true },
      });
      const escalationUserId = await resolveAssignee({
        approverRole: step.escalationRole,
        approverField: null,
        approverUserId: null,
        approverGroupRoles: null,
        recordData: {},
        initiatorId: task.instance.initiatedById,
        module: task.module,
        plantId: initiatorUser?.plantId ?? null,
      });

      if (!escalationUserId || escalationUserId === task.assignedToId) {
        await prisma.workflowHistory.create({
          data: {
            instanceId: task.instanceId,
            stepId: task.stepId,
            stepName: task.stepName,
            action: Action.ESCALATED,
            performedById: task.assignedToId,
            comments: `Auto-escalated — could not find a distinct user with role ${step.escalationRole}.`
          }
        });
        continue;
      }

      // Skip if a parallel escalation task to this user for this step already exists
      const existing = await prisma.workflowTask.findFirst({
        where: {
          instanceId: task.instanceId,
          stepId: task.stepId,
          assignedToId: escalationUserId,
          status: { in: [TaskStatus.PENDING, TaskStatus.OVERDUE, TaskStatus.ESCALATED] }
        }
      });
      if (existing) continue;

      await prisma.workflowTask.create({
        data: {
          instanceId: task.instanceId,
          stepId: task.stepId,
          stepName: `[Escalation] ${task.stepName}`,
          taskType: task.taskType,
          module: task.module,
          recordId: task.recordId,
          recordNumber: task.recordNumber,
          recordTitle: task.recordTitle,
          assignedToId: escalationUserId,
          dueAt: new Date(now.getTime() + escalationDueMs),
          status: TaskStatus.PENDING,
          priority: "URGENT"
        }
      });
      escalationTasksCreated++;

      await prisma.workflowHistory.create({
        data: {
          instanceId: task.instanceId,
          stepId: task.stepId,
          stepName: task.stepName,
          action: Action.ESCALATED,
          performedById: task.assignedToId,
          comments: `Auto-escalated to ${step.escalationRole} (24h+ overdue). Parallel task created.`
        }
      });
    }

    return { flippedToOverdue, flippedToEscalated, escalationTasksCreated };
  },

  // ─── Test-run simulation ─────────────────────────────────────────────────
  // Walks the steps of an in-memory definition (no DB writes) and reports what
  // would happen for the given record data: condition evaluation, resolved
  // assignee with name/designation, dueAt, and any errors. Used by the
  // editor's "Test Run" button so admins can validate workflows before saving.
  async simulate(opts: {
    steps: SimStep[];
    recordData: RecordData;
    initiatorId: string;
    module: string;
    plantId?: string | null;
  }): Promise<SimulationResult> {
    const trace: SimulationStepResult[] = [];
    const errors: SimulationError[] = [];

    for (let i = 0; i < opts.steps.length; i++) {
      const step = opts.steps[i];
      const sequence = i + 1;
      const passes = evaluateCondition(step.conditionExpr, opts.recordData);

      if (!passes) {
        trace.push({
          sequence,
          stepType: step.stepType,
          name: step.name,
          status: "SKIPPED",
          reason: "Condition not matched against sample record",
          conditionExpr: step.conditionExpr ?? null,
          dueAt: null,
          assignee: null
        });
        continue;
      }

      // MAKER auto-completes; no resolution needed
      if (step.stepType === StepType.MAKER) {
        const initiator = await prisma.user.findUnique({
          where: { id: opts.initiatorId },
          select: { id: true, name: true, designation: true }
        });
        trace.push({
          sequence,
          stepType: step.stepType,
          name: step.name,
          status: "AUTO",
          reason: "Maker auto-completes on record submission",
          conditionExpr: null,
          dueAt: null,
          assignee: initiator
        });
        continue;
      }

      const assigneeId = await resolveAssignee({
        approverRole: step.approverRole,
        approverField: step.approverField,
        approverUserId: step.approverUserId,
        approverGroupRoles: step.approverGroupRoles,
        recordData: opts.recordData,
        initiatorId: opts.initiatorId,
        module: opts.module,
        plantId: opts.plantId
      });

      if (!assigneeId) {
        const reason =
          step.approverGroupRoles
            ? `No user matched any of the configured roles${opts.plantId ? " at this plant or globally" : ""}.`
            : step.approverRole
              ? `No user with role "${step.approverRole}" found${opts.plantId ? " at this plant or globally" : ""}.`
              : step.approverField
                ? `Record has no value for field "${step.approverField}".`
                : "No assignment configured for this step.";
        errors.push({ sequence, message: `Step "${step.name}" cannot be auto-assigned: ${reason}` });
        trace.push({
          sequence,
          stepType: step.stepType,
          name: step.name,
          status: "BLOCKED",
          reason,
          conditionExpr: step.conditionExpr ?? null,
          dueAt: null,
          assignee: null
        });
        continue;
      }

      const assignee = await prisma.user.findUnique({
        where: { id: assigneeId },
        select: { id: true, name: true, designation: true, plant: { select: { name: true } } }
      });
      const dueAt = computeDueAt({ stepType: step.stepType, slaHours: step.slaHours }, opts.recordData);

      trace.push({
        sequence,
        stepType: step.stepType,
        name: step.name,
        status: "EXECUTED",
        reason: null,
        conditionExpr: step.conditionExpr ?? null,
        dueAt: dueAt?.toISOString() ?? null,
        assignee: assignee
          ? {
              id: assignee.id,
              name: assignee.name,
              designation: assignee.designation ?? null,
              plant: assignee.plant?.name ?? null
            }
          : null
      });
    }

    return { trace, errors };
  }
};

// ─── Internal helpers ────────────────────────────────────────────────────

async function createTaskForStep(opts: {
  instanceId: string;
  step: {
    id: string;
    name: string;
    stepType: string;
    approverRole: string | null;
    approverField: string | null;
    approverUserId?: string | null;
    approverGroupRoles?: string | null;
    slaHours: number | null;
  };
  recordData: RecordData;
  recordNumber?: string;
  recordTitle?: string;
  module: string;
  recordId: string;
  initiatorId: string;
  plantId?: string | null;
}) {
  const assigneeId = await resolveAssignee({
    approverRole: opts.step.approverRole,
    approverField: opts.step.approverField,
    approverUserId: opts.step.approverUserId,
    approverGroupRoles: opts.step.approverGroupRoles,
    recordData: opts.recordData,
    initiatorId: opts.initiatorId,
    module: opts.module,
    plantId: opts.plantId
  });

  if (!assigneeId) {
    // No-one to assign — leave a notice in history
    await prisma.workflowHistory.create({
      data: {
        instanceId: opts.instanceId,
        stepId: opts.step.id,
        stepName: opts.step.name,
        action: "ESCALATED",
        performedById: opts.initiatorId,
        comments: `Could not auto-assign step ${opts.step.name} — no user matched role/field. Awaiting manual assignment.`
      }
    });
    return null;
  }

  // Segregation of duties: don't assign back to the initiator unless step is closure (final)
  if (assigneeId === opts.initiatorId && opts.step.stepType !== StepType.CLOSURE) {
    // Try to find another user with the same role
    const fallback = opts.step.approverRole
      ? await prisma.user.findFirst({
          where: { role: opts.step.approverRole as any, plantId: opts.plantId ?? undefined, id: { not: opts.initiatorId } },
          orderBy: { createdAt: "asc" }
        })
      : null;
    if (fallback) {
      const dueAt = computeDueAt(opts.step, opts.recordData);
      const taskType = opts.step.stepType === StepType.CHECKER ? TaskType.APPROVAL : opts.step.stepType === StepType.ASSIGNEE_TASK ? TaskType.EXECUTION : opts.step.stepType === StepType.VERIFIER ? TaskType.VERIFICATION : TaskType.APPROVAL;
      return prisma.workflowTask.create({
        data: {
          instanceId: opts.instanceId,
          stepId: opts.step.id,
          stepName: opts.step.name,
          taskType,
          module: opts.module,
          recordId: opts.recordId,
          recordNumber: opts.recordNumber,
          recordTitle: opts.recordTitle,
          assignedToId: fallback.id,
          dueAt,
          status: TaskStatus.PENDING
        }
      });
    }
    // Otherwise fall through and assign to initiator (single-user demo case)
  }

  const dueAt = computeDueAt(opts.step, opts.recordData);
  const taskType =
    opts.step.stepType === StepType.CHECKER ? TaskType.APPROVAL :
    opts.step.stepType === StepType.ASSIGNEE_TASK ? TaskType.EXECUTION :
    opts.step.stepType === StepType.VERIFIER ? TaskType.VERIFICATION :
    TaskType.APPROVAL;

  return prisma.workflowTask.create({
    data: {
      instanceId: opts.instanceId,
      stepId: opts.step.id,
      stepName: opts.step.name,
      taskType,
      module: opts.module,
      recordId: opts.recordId,
      recordNumber: opts.recordNumber,
      recordTitle: opts.recordTitle,
      assignedToId: assigneeId,
      dueAt,
      status: TaskStatus.PENDING
    }
  });
}

// For ASSIGNEE_TASK steps, prefer the record's targetDate (set by submitter) over slaHours.
// Other steps use slaHours from the workflow definition.
function computeDueAt(step: { stepType: string; slaHours: number | null }, recordData: RecordData): Date | null {
  if (step.stepType === StepType.ASSIGNEE_TASK && recordData.targetDate) {
    const d = recordData.targetDate instanceof Date ? recordData.targetDate : new Date(recordData.targetDate);
    if (!isNaN(d.getTime())) return d;
  }
  return step.slaHours ? new Date(Date.now() + step.slaHours * 3600 * 1000) : null;
}

async function advanceFromApproval(opts: { taskId: string; userId: string; comments?: string; attachments?: string[]; accepted: boolean; recordData?: RecordData; plantId?: string | null }) {
  const task = await prisma.workflowTask.findUnique({
    where: { id: opts.taskId },
    include: { instance: { include: { definition: { include: { steps: { orderBy: { sequence: "asc" } } } } } } }
  });
  if (!task) throw new Error("Task not found");
  if (task.status !== TaskStatus.PENDING) throw new Error("Task is not pending");

  const def = task.instance.definition;
  const currentStep = def.steps.find((s) => s.id === task.stepId);
  if (!currentStep) throw new Error("Step missing");
  await rbacGate({ task: { ...task, eligibleGroupRoles: (task as any).eligibleGroupRoles ?? null }, step: currentStep, userId: opts.userId, action: "APPROVE" });

  // Hydrate recordData from the underlying record before resolving the next
  // step. Callers (approval/verify panels) only know what's on screen and
  // typically pass {severity, category, plantId} — but the engine needs the
  // owner-id fields (responsiblePersonId / actionOwnerId / receiverId / ...)
  // to resolve ASSIGNEE_TASK steps. Without this, advancing produces an
  // ESCALATED history entry but no actual task, leaving the workflow stuck.
  const ctx = await loadRecordContext(task.module, task.recordId);
  const recordData: RecordData = { ...(ctx.record ?? {}), ...(opts.recordData ?? {}) };
  const next = findNextApplicableStep(def.steps, currentStep.sequence, recordData);

  await prisma.$transaction(async (tx) => {
    await tx.workflowTask.update({
      where: { id: task.id },
      data: { status: TaskStatus.COMPLETED, completedAt: new Date() }
    });
    await tx.workflowHistory.create({
      data: {
        instanceId: task.instanceId,
        stepId: currentStep.id,
        stepName: currentStep.name,
        action: Action.APPROVED,
        performedById: opts.userId,
        comments: opts.comments,
        attachments: opts.attachments ? JSON.stringify(opts.attachments) : null
      }
    });
    if (next) {
      await tx.workflowInstance.update({
        where: { id: task.instanceId },
        data: { currentStepId: next.id, currentStepName: next.name, status: InstanceStatus.IN_PROGRESS }
      });
    } else {
      await tx.workflowInstance.update({
        where: { id: task.instanceId },
        data: { currentStepId: null, currentStepName: "Completed", status: InstanceStatus.COMPLETED, completedAt: new Date() }
      });
    }
  });

  if (next) {
    await createTaskForStep({
      instanceId: task.instanceId,
      step: next,
      recordData,
      recordNumber: task.recordNumber ?? undefined,
      recordTitle: task.recordTitle ?? undefined,
      module: task.module,
      recordId: task.recordId,
      initiatorId: task.instance.initiatedById,
      plantId: opts.plantId
    });
  }

  await syncRecordStatus({
    module: task.module,
    recordId: task.recordId,
    nextStepType: next?.stepType ?? null,
    instanceCompleted: !next
  });

  return { ok: true, advancedTo: next?.name ?? "Completed" };
}

async function advanceFromExecution(opts: { taskId: string; userId: string; executionData?: RecordData; comments?: string; attachments?: string[]; recordData?: RecordData; plantId?: string | null }) {
  const task = await prisma.workflowTask.findUnique({
    where: { id: opts.taskId },
    include: { instance: { include: { definition: { include: { steps: { orderBy: { sequence: "asc" } } } } } } }
  });
  if (!task) throw new Error("Task not found");
  if (task.status !== TaskStatus.PENDING) throw new Error("Task is not pending");

  const def = task.instance.definition;
  const currentStep = def.steps.find((s) => s.id === task.stepId);
  if (!currentStep) throw new Error("Step missing");
  await rbacGate({ task: { ...task, eligibleGroupRoles: (task as any).eligibleGroupRoles ?? null }, step: currentStep, userId: opts.userId, action: "EXECUTE" });

  // PTW–FLRA gate: a permit cannot transition out of its receiver step
  // (which flips status to ACTIVE) without a COMPLETED FLRA whose crew has
  // all signed. This is the chronological enforcement that the soft banner
  // alone can't deliver.
  if (task.module === "PTW" && currentStep.stepType === StepType.ASSIGNEE_TASK) {
    const { getFlraGateStatus } = await import("@/lib/ptw/flra-gate");
    const gate = await getFlraGateStatus(task.recordId);
    if (!gate.ok) {
      throw new Error(gate.reason ?? "FLRA gate is closed for this permit.");
    }
  }

  // Hydrate from underlying record for the same reason as advanceFromApproval —
  // the engine needs owner-id fields to resolve ASSIGNEE_TASK / VERIFIER steps.
  const ctxExec = await loadRecordContext(task.module, task.recordId);
  const recordData = {
    ...(ctxExec.record ?? {}),
    ...(opts.recordData ?? {}),
    ...(opts.executionData ?? {})
  };
  const next = findNextApplicableStep(def.steps, currentStep.sequence, recordData);

  await prisma.$transaction(async (tx) => {
    await tx.workflowTask.update({
      where: { id: task.id },
      data: { status: TaskStatus.COMPLETED, completedAt: new Date() }
    });
    await tx.workflowHistory.create({
      data: {
        instanceId: task.instanceId,
        stepId: currentStep.id,
        stepName: currentStep.name,
        action: Action.EXECUTED,
        performedById: opts.userId,
        comments: opts.comments,
        attachments: opts.attachments ? JSON.stringify(opts.attachments) : null
      }
    });
    if (next) {
      await tx.workflowInstance.update({
        where: { id: task.instanceId },
        data: { currentStepId: next.id, currentStepName: next.name }
      });
    } else {
      await tx.workflowInstance.update({
        where: { id: task.instanceId },
        data: { currentStepId: null, currentStepName: "Completed", status: InstanceStatus.COMPLETED, completedAt: new Date() }
      });
    }
  });

  if (next) {
    await createTaskForStep({
      instanceId: task.instanceId,
      step: next,
      recordData,
      recordNumber: task.recordNumber ?? undefined,
      recordTitle: task.recordTitle ?? undefined,
      module: task.module,
      recordId: task.recordId,
      initiatorId: task.instance.initiatedById,
      plantId: opts.plantId
    });
  }

  await syncRecordStatus({
    module: task.module,
    recordId: task.recordId,
    nextStepType: next?.stepType ?? null,
    instanceCompleted: !next
  });

  return { ok: true, advancedTo: next?.name ?? "Completed" };
}

async function advanceFromVerification(opts: { taskId: string; userId: string; accepted: boolean; comments?: string; recordData?: RecordData; plantId?: string | null }) {
  const task = await prisma.workflowTask.findUnique({
    where: { id: opts.taskId },
    include: { instance: { include: { definition: { include: { steps: { orderBy: { sequence: "asc" } } } } } } }
  });
  if (!task) throw new Error("Task not found");

  const def = task.instance.definition;
  const currentStep = def.steps.find((s) => s.id === task.stepId);
  if (!currentStep) throw new Error("Step missing");
  await rbacGate({ task: { ...task, eligibleGroupRoles: (task as any).eligibleGroupRoles ?? null }, step: currentStep, userId: opts.userId, action: "VERIFY" });

  if (!opts.accepted) {
    // Send back to most recent ASSIGNEE_TASK
    const prevExec = [...def.steps].reverse().find((s) => s.sequence < currentStep.sequence && s.stepType === StepType.ASSIGNEE_TASK);
    if (!prevExec) throw new Error("No execution step to return to");

    await prisma.$transaction([
      prisma.workflowTask.update({ where: { id: task.id }, data: { status: TaskStatus.COMPLETED, completedAt: new Date() } }),
      prisma.workflowHistory.create({
        data: {
          instanceId: task.instanceId,
          stepId: currentStep.id,
          stepName: currentStep.name,
          action: "REJECTED",
          performedById: opts.userId,
          comments: `Verification rejected — sent back to execution. ${opts.comments ?? ""}`
        }
      }),
      prisma.workflowInstance.update({
        where: { id: task.instanceId },
        data: { currentStepId: prevExec.id, currentStepName: prevExec.name, status: InstanceStatus.IN_PROGRESS }
      })
    ]);
    // Hydrate recordData so the rework task can be reassigned to the right
    // owner — same fix as advanceFromApproval/Execution above.
    const ctxVer = await loadRecordContext(task.module, task.recordId);
    await createTaskForStep({
      instanceId: task.instanceId,
      step: prevExec,
      recordData: { ...(ctxVer.record ?? {}), ...(opts.recordData ?? {}) },
      recordNumber: task.recordNumber ?? undefined,
      recordTitle: task.recordTitle ?? undefined,
      module: task.module,
      recordId: task.recordId,
      initiatorId: task.instance.initiatedById,
      plantId: opts.plantId
    });
    await syncRecordStatus({
      module: task.module,
      recordId: task.recordId,
      nextStepType: prevExec.stepType,
      instanceCompleted: false
    });
    return { ok: true, sentBackTo: prevExec.name };
  }

  // Accepted — advance to next step / closure
  return await advanceFromApproval({
    taskId: opts.taskId,
    userId: opts.userId,
    comments: opts.comments,
    accepted: true,
    recordData: opts.recordData,
    plantId: opts.plantId
  });
}
