// ─────────────────────────────────────────────────────────────────────
// Per-record workflow state for the approval-tracker panel.
//
// Every module detail page (Observation, Near-Miss, Incident, PTW, …) used to
// run the same `prisma.workflowInstance.findUnique({ include: { definition:
// { steps }, history: { performedBy }, pendingTasks: { assignedTo } } })`.
// That query now lives once, in FastAPI, behind /api/workflow/state.
//
// The returned shape deliberately mirrors what the Prisma include produced —
// including the nested `plant: { name }` on each party — so the existing
// tracker components and `toParty()` keep working without edits.
// ─────────────────────────────────────────────────────────────────────

import { backendFetch } from "@/lib/backend/fetch";

/**
 * An actor on a workflow row, as the backend joins them.
 *
 * `name` is non-nullable because `User.name` is a NOT NULL column — the same
 * guarantee the Prisma `include` gave, and consumers like the PTW audit-trail
 * panel rely on it (`{ name: string }`). Widening it here would push a null
 * check into every one of those call sites for a case that cannot occur.
 * A missing actor is represented by the whole party being null, not by a
 * present party with a null name.
 *
 * Structurally assignable to PartyRow, so `toParty()` still accepts it.
 */
export interface WorkflowParty {
  id: string;
  name: string;
  designation: string | null;
  role: string | null;
  department: string | null;
  plant: { name: string | null } | null;
}

/** Task statuses that still count as live. A task keeps being actionable
 *  after its SLA slips — OVERDUE/ESCALATED are decorations on an unfinished
 *  task, not terminal states, and treating only PENDING as open is what used
 *  to hide the action panel from the very person who had to act. */
export const OPEN_TASK_STATUSES = ["PENDING", "OVERDUE", "ESCALATED"];

export interface WorkflowStepRow {
  id: string;
  sequence: number;
  stepType: string;
  name: string;
  approverRole: string | null;
  approverField: string | null;
  approverUserId: string | null;
  approverGroupRoles: string | null;
  slaHours: number | null;
  slaUnit: string | null;
  escalationRole: string | null;
  isOptional: boolean;
  conditionExpr: string | null;
  notes: string | null;
  parallelStrategy: string | null;
}

export interface WorkflowHistoryRow {
  id: string;
  stepId: string | null;
  stepName: string;
  action: string;
  performedById: string;
  performedBy: WorkflowParty | null;
  comments: string | null;
  attachments: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  performedAt: string;
}

export interface WorkflowTaskRow {
  id: string;
  stepId: string;
  stepName: string;
  taskType: string;
  module: string;
  recordId: string;
  recordNumber: string | null;
  recordTitle: string | null;
  assignedToId: string;
  assignedTo: WorkflowParty | null;
  status: string;
  assignedAt: string;
  dueAt: string | null;
  completedAt: string | null;
  priority: string;
  readAt: string | null;
}

export interface WorkflowInstanceState {
  id: string;
  definitionId: string;
  module: string;
  recordId: string;
  recordNumber: string | null;
  initiatedById: string;
  status: string;
  currentStepId: string | null;
  currentStepName: string | null;
  initiatedAt: string;
  completedAt: string | null;
  /** Non-null in practice: `definitionId` is a NOT NULL FK, so an instance
   *  always has a definition. Typed non-nullable to match what the Prisma
   *  `include` gave callers, which read `instance.definition.steps` directly. */
  definition: { id: string; name: string; module: string; steps: WorkflowStepRow[] };
  history: WorkflowHistoryRow[];
  /** Every task on the instance, terminal ones included — callers filter.
   *  Use `openTasks()` when you want only the live ones. */
  pendingTasks: WorkflowTaskRow[];
}

/**
 * Load a record's workflow state, or null when it has none.
 *
 * Never throws: a record page must still render its record when the tracker
 * can't be loaded. A null result renders as "no workflow", which is also the
 * honest state for modules that bypass the engine.
 */
export async function getWorkflowState(
  module: string,
  recordId: string
): Promise<WorkflowInstanceState | null> {
  try {
    const res = await backendFetch<{ instance: WorkflowInstanceState | null }>(
      `/api/workflow/state/${encodeURIComponent(module)}/${encodeURIComponent(recordId)}`
    );
    return res.instance;
  } catch {
    return null;
  }
}

/** Live tasks only — drops COMPLETED / REJECTED, which would otherwise render
 *  as ghost "Awaiting Action" rows on the tracker. */
export function openTasks(instance: WorkflowInstanceState | null): WorkflowTaskRow[] {
  return (instance?.pendingTasks ?? []).filter((t) => OPEN_TASK_STATUSES.includes(t.status));
}

/** The viewer's own actionable task on this record, if any. */
export function myOpenTask(
  instance: WorkflowInstanceState | null,
  userId: string
): WorkflowTaskRow | undefined {
  return openTasks(instance).find((t) => t.assignedToId === userId);
}
