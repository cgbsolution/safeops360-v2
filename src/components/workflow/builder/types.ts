export type StepType = "MAKER" | "CHECKER" | "ASSIGNEE_TASK" | "VERIFIER" | "CLOSURE";

export type AssignmentMode = "NONE" | "ROLE" | "FIELD" | "USER" | "GROUP";

export type EditorStep = {
  // Stable client-side id. For new steps we generate one with crypto.randomUUID().
  // Server-side `id` (if it exists) lives separately in `serverId`.
  clientId: string;
  serverId?: string;
  sequence: number;
  stepType: StepType;
  name: string;
  approverRole: string | null;
  approverField: string | null;
  approverUserId: string | null;
  approverUserName?: string | null; // display-only; populated when fetched server-side
  approverGroupRoles: string[] | null; // multi-role union; serialised to JSON before save
  slaHours: number | null;
  slaUnit: "HOURS" | "DAYS" | null;
  escalationRole: string | null;
  isOptional: boolean;
  conditionExpr: string | null;
  notes: string | null;
};

// Server-side shape passed from the page (a row in WorkflowDefinition with its steps)
export type DefinitionDTO = {
  id: string;
  module: string;
  recordType: string | null;
  name: string;
  description: string | null;
  isActive: boolean;
  instanceCount: number;
  versionCount?: number;
  steps: {
    id: string;
    sequence: number;
    stepType: string;
    name: string;
    approverRole: string | null;
    approverField: string | null;
    approverUserId?: string | null;
    approverUser?: { id: string; name: string; designation: string | null } | null;
    approverGroupRoles?: string | null;
    slaHours: number | null;
    slaUnit?: string | null;
    escalationRole: string | null;
    isOptional: boolean;
    conditionExpr: string | null;
    notes?: string | null;
  }[];
};

export const STEP_TYPE_LIST: { value: StepType; label: string; description: string }[] = [
  { value: "MAKER", label: "Maker", description: "Initiator of the record. Always the first step." },
  { value: "CHECKER", label: "Checker / Approver", description: "Reviews and approves before moving forward." },
  { value: "ASSIGNEE_TASK", label: "Assignee — Execute", description: "An action owner executes a task (CAPA, FLRA, etc.)." },
  { value: "VERIFIER", label: "Verifier", description: "Verifies that the assignee did the work correctly." },
  { value: "CLOSURE", label: "Closure", description: "Final closure of the record." }
];

export const ROLE_OPTIONS = [
  { value: "WORKER", label: "Worker" },
  { value: "HSE_MANAGER", label: "HSE Manager" },
  { value: "PLANT_HEAD", label: "Plant Head" },
  { value: "ADMIN", label: "Admin" }
];

export const FIELD_OPTIONS = [
  { value: "ORIGINATOR", label: "Originator (record creator)" },
  { value: "ACTION_OWNER", label: "Action Owner (named on record)" },
  { value: "RESPONSIBLE_PERSON", label: "Responsible Person (named on record)" },
  { value: "ASSIGNED_INSPECTOR", label: "Assigned Inspector" },
  { value: "RECEIVER", label: "Receiver" },
  { value: "ISSUER", label: "Issuer" },
  { value: "TRAINER", label: "Trainer" },
  { value: "AREA_OWNER", label: "Area Owner" }
];

export const CONDITION_OPERATORS = [
  { value: "=", label: "equals" },
  { value: "!=", label: "not equals" },
  { value: "in", label: "is in" },
  { value: "not_in", label: "is not in" },
  { value: "contains", label: "contains" },
  { value: ">", label: "greater than" },
  { value: "<", label: "less than" },
  { value: ">=", label: "greater or equal" },
  { value: "<=", label: "less or equal" }
] as const;

export type ConditionOp = (typeof CONDITION_OPERATORS)[number]["value"];

export type EditorConditionRule = {
  field: string;
  operator: ConditionOp;
  value: string; // free input; lists comma-separated for in / not_in
};

export type EditorCondition = {
  combinator: "AND" | "OR";
  rules: EditorConditionRule[];
};

// Parse stored conditionExpr back into the editor's structured form, supporting both
// v1 legacy ({field: value | array}) and v2 (with version/combinator/rules).
export function parseConditionExpr(expr: string | null | undefined): EditorCondition {
  if (!expr) return { combinator: "AND", rules: [] };
  try {
    const obj = JSON.parse(expr);
    if (obj && obj.version === 2 && Array.isArray(obj.rules)) {
      return {
        combinator: obj.combinator === "OR" ? "OR" : "AND",
        rules: obj.rules.map((r: any) => ({
          field: String(r.field ?? ""),
          operator: r.operator ?? "=",
          value: Array.isArray(r.value) ? r.value.join(",") : String(r.value ?? "")
        }))
      };
    }
    // v1 legacy: { field: value | array }, all ANDed together
    const rules: EditorConditionRule[] = Object.entries(obj).map(([field, val]) => ({
      field,
      operator: Array.isArray(val) ? "in" : "=",
      value: Array.isArray(val) ? val.join(",") : String(val)
    }));
    return { combinator: "AND", rules };
  } catch {
    return { combinator: "AND", rules: [] };
  }
}

// Serialise the editor condition form back to JSON for storage. Only emits when there is
// at least one fully-filled rule; otherwise returns null so the step is unconditional.
export function serializeConditionExpr(cond: EditorCondition): string | null {
  const cleaned = cond.rules.filter((r) => r.field.trim() && r.value.trim());
  if (cleaned.length === 0) return null;
  return JSON.stringify({
    version: 2,
    combinator: cond.combinator,
    rules: cleaned.map((r) => ({
      field: r.field.trim(),
      operator: r.operator,
      value: r.operator === "in" || r.operator === "not_in"
        ? r.value.split(",").map((v) => v.trim()).filter(Boolean)
        : r.value.trim()
    }))
  });
}

// Translate a server-side step DTO into the editor's structured form.
export function dtoStepToEditor(s: DefinitionDTO["steps"][number], clientId: string): EditorStep {
  return {
    clientId,
    serverId: s.id,
    sequence: s.sequence,
    stepType: s.stepType as StepType,
    name: s.name,
    approverRole: s.approverRole ?? null,
    approverField: s.approverField ?? null,
    approverUserId: s.approverUserId ?? null,
    approverUserName: s.approverUser?.name ?? null,
    approverGroupRoles: (() => {
      if (!s.approverGroupRoles) return null;
      try {
        const parsed = JSON.parse(s.approverGroupRoles);
        return Array.isArray(parsed) && parsed.length ? parsed : null;
      } catch {
        return null;
      }
    })(),
    slaHours: s.slaHours ?? null,
    slaUnit: (s.slaUnit as "HOURS" | "DAYS") ?? null,
    escalationRole: s.escalationRole ?? null,
    isOptional: s.isOptional ?? false,
    conditionExpr: s.conditionExpr ?? null,
    notes: s.notes ?? null
  };
}

export function detectAssignmentMode(s: EditorStep): AssignmentMode {
  if (s.approverUserId) return "USER";
  if (s.approverGroupRoles && s.approverGroupRoles.length > 0) return "GROUP";
  if (s.approverField) return "FIELD";
  if (s.approverRole) return "ROLE";
  return "NONE";
}
