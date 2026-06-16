// Shared types for the workflow engine.
// Module names are constants — keep aligned with WorkflowDefinition.module values.

export const Modules = {
  OBSERVATION: "OBSERVATION",
  NEAR_MISS: "NEAR_MISS",
  PTW: "PTW",
  INCIDENT: "INCIDENT",
  TRAINING: "TRAINING",
  INSPECTION: "INSPECTION",
  MANHOURS: "MANHOURS"
} as const;
export type ModuleKey = (typeof Modules)[keyof typeof Modules];

export const StepType = {
  MAKER: "MAKER",
  CHECKER: "CHECKER",
  ASSIGNEE_TASK: "ASSIGNEE_TASK",
  VERIFIER: "VERIFIER",
  CLOSURE: "CLOSURE"
} as const;
export type StepTypeKey = (typeof StepType)[keyof typeof StepType];

export const InstanceStatus = {
  DRAFT: "DRAFT",
  IN_PROGRESS: "IN_PROGRESS",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED"
} as const;
export type InstanceStatusKey = (typeof InstanceStatus)[keyof typeof InstanceStatus];

export const TaskStatus = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  OVERDUE: "OVERDUE",
  ESCALATED: "ESCALATED",
  REASSIGNED: "REASSIGNED"
} as const;

export const TaskType = {
  APPROVAL: "APPROVAL",
  EXECUTION: "EXECUTION",
  VERIFICATION: "VERIFICATION"
} as const;

export const Action = {
  INITIATED: "INITIATED",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  REASSIGNED: "REASSIGNED",
  COMPLETED: "COMPLETED",
  ESCALATED: "ESCALATED",
  COMMENTED: "COMMENTED",
  EXECUTED: "EXECUTED",
  VERIFIED: "VERIFIED"
} as const;

// Approver field resolvers — fields on the record that resolve to a userId
export const ApproverField = {
  ORIGINATOR: "ORIGINATOR",
  AREA_OWNER: "AREA_OWNER",
  ACTION_OWNER: "ACTION_OWNER",
  ASSIGNED_INSPECTOR: "ASSIGNED_INSPECTOR",
  RECEIVER: "RECEIVER",
  ISSUER: "ISSUER"
} as const;

// Legacy v1 conditional expression — JSON-serialised; evaluated against record data
// e.g. { severity: ["HIGH","CRITICAL"] }. All keys ANDed together.
export type ConditionExprV1 = {
  [field: string]: string | number | boolean | string[] | number[];
};

// New v2 conditional expression — explicit operators + AND/OR
export type ConditionOperator = "=" | "!=" | "in" | "not_in" | "contains" | ">" | "<" | ">=" | "<=";

export type ConditionRule = {
  field: string;
  operator: ConditionOperator;
  value: string | number | boolean | string[] | number[];
};

export type ConditionExprV2 = {
  version: 2;
  combinator: "AND" | "OR";
  rules: ConditionRule[];
};

export type ConditionExpr = ConditionExprV1 | ConditionExprV2;

// Assignment mode for a workflow step. Stored implicitly by which approver* field is set.
export const AssignmentMode = {
  NONE: "NONE",         // no auto-assignment; manual reassign required
  ROLE: "ROLE",         // by role (approverRole)
  FIELD: "FIELD",       // by record field (approverField)
  USER: "USER",         // by specific named user (approverUserId)
  GROUP: "GROUP"        // by group queue / multi-role union (approverGroupRoles)
} as const;
export type AssignmentModeKey = (typeof AssignmentMode)[keyof typeof AssignmentMode];

export function detectAssignmentMode(step: {
  approverRole?: string | null;
  approverField?: string | null;
  approverUserId?: string | null;
  approverGroupRoles?: string | null;
}): AssignmentModeKey {
  if (step.approverUserId) return AssignmentMode.USER;
  if (step.approverGroupRoles) return AssignmentMode.GROUP;
  if (step.approverField) return AssignmentMode.FIELD;
  if (step.approverRole) return AssignmentMode.ROLE;
  return AssignmentMode.NONE;
}
