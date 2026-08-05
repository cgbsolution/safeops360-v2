// Shared types + presentation metadata for the Training & Competency Engine
// screens (training assignments, my-training, and the skill-matrix roll-up /
// worker-profile / configuration / correlation views). Pure types + consts +
// helpers only (no JSX) so both server and client components can import it.
//
// Backend contract lives under /api/training-engine/* and /api/skill-matrix/*.
// Colours follow the house convention: met/valid → emerald, expiring → amber,
// expired/overdue/mandatory → rose, in-progress/assigned → sky/primary.

// ─── Assignments ────────────────────────────────────────────────────────────

export type AssignmentStatus =
  | "assigned"
  | "in_progress"
  | "completed"
  | "overdue"
  | "escalated"
  | "cancelled";

export type AssignmentSource =
  | "threshold_rule"
  | "severity_rule"
  | "recert_rule"
  | "manual";

export type Assignment = {
  id: string;
  plantId: string;
  personUserId: string;
  worker?: { name: string; role: string; department: string | null } | null;
  competencyId: string;
  competencyName: string;
  source: AssignmentSource;
  ruleType: string | null;
  sourceModule: string | null;
  sourceRecordId: string | null;
  sourceRecordRef: string | null;
  provenance: Record<string, unknown> | null;
  contentId: string | null;
  assignedAt: string;
  dueDate: string | null;
  status: AssignmentStatus;
  isMandatory: boolean;
  dismissible: boolean;
  escalationFlag: boolean;
  completedAt: string | null;
  completionEvidenceType: string | null;
};

export type AssignmentContent = {
  id: string;
  title: string;
  contentType: string;
  deliveryMode: string;
  contentRef: string | null;
  durationMinutes: number | null;
  vendorId: string | null;
  vendorName: string | null;
};

export type AssignmentDetail = Assignment & { content?: AssignmentContent | null };

export type AssignmentListResponse = {
  items: Assignment[];
  summary: { total: number; byStatus: Record<string, number> };
};

export type AssignmentMineResponse = { items: Assignment[] };

export type EvidenceType = "training_completion" | "assessment" | "manual_signoff";

// ─── HazardToSkill mappings (the configurable trigger "moat") ────────────────

export type Mapping = {
  id: string;
  plantId: string | null;
  sourceModule: string;
  classificationField: string;
  classificationValue: string;
  matchMode: string;
  competencyId: string;
  competencyName: string;
  priority: number;
  notes: string | null;
  isActive: boolean;
};

// ─── Rule config (thresholds / windows) ──────────────────────────────────────

export type RuleConfigEffective = {
  thresholdCount: number;
  thresholdWindowDays: number;
  severitySifImmediate: boolean;
  severityThreshold: string;
  recertWindowDays: number;
  assignmentDueDays: number;
  correlationWindowDays: number;
};

export type RuleConfigResponse = {
  effective: RuleConfigEffective;
  rows: unknown[];
};

// ─── Content adapter (vendor-decoupled learning content) ─────────────────────

export type Content = {
  id: string;
  competencyId: string;
  competencyName: string;
  title: string;
  description: string | null;
  contentType: string;
  deliveryMode: string;
  contentRef: string | null;
  vendorId: string | null;
  vendorName: string | null;
  durationMinutes: number | null;
  passingScore: number | null;
  language: string | null;
  isActive: boolean;
  isPrimary: boolean;
  plantId: string | null;
};

export type Competency = {
  id: string;
  code: string;
  name: string;
  category: string;
  subcategory: string | null;
  defaultValidityMonths: number | null;
  isGlobal: boolean;
};

// ─── Correlation report ──────────────────────────────────────────────────────

export type CorrelationRow = {
  plantId: string;
  competencyId: string;
  competencyName: string;
  cohortSize: number;
  computedCohortSize: number;
  preTotal: number;
  postTotal: number;
  improvementPct: number;
  windowDays: number;
  pending: number;
};

export type CorrelationResponse = { generatedAt: string; rows: CorrelationRow[] };

// ─── Skill-matrix roll-up + worker profile ───────────────────────────────────

export type RollupCompetency = {
  competencyId: string;
  code: string;
  name: string;
  category: string;
  total: number;
  met: number;
  expired: number;
  inProgress: number;
  compliancePct: number;
};

export type RollupResponse = {
  plantId: string;
  competencies: RollupCompetency[];
  summary: {
    workforceCompliancePct: number;
    recordCount: number;
    competencyCount: number;
    atRiskCount: number;
  };
};

export type WorkerProfile = {
  user: {
    id: string;
    name: string;
    role: string;
    department: string | null;
    plantId: string;
    designation: string | null;
  };
  records: {
    competencyId: string;
    name: string;
    category: string;
    state: string;
    currentProficiency: string | null;
    validFrom: string | null;
    validUntil: string | null;
    nextRevalidationDue: string | null;
  }[];
  gaps: {
    competencyId: string;
    name: string;
    requirementType: string;
    requiredProficiency: string | null;
    currentState: string | null;
  }[];
  assignments: {
    id: string;
    competencyId: string;
    competencyName: string;
    source: string;
    status: string;
    isMandatory: boolean;
    dueDate: string | null;
    sourceRecordRef: string | null;
  }[];
  summary: { held: number; met: number; gaps: number; openAssignments: number };
};

// ─── Presentation metadata ───────────────────────────────────────────────────

export type Tone = "primary" | "emerald" | "amber" | "rose" | "sky" | "slate";

export const ASSIGNMENT_STATUS_META: Record<
  string,
  { label: string; chip: string; tone: Tone }
> = {
  assigned: { label: "Assigned", chip: "bg-sky-100 text-sky-800 border-sky-200", tone: "sky" },
  in_progress: {
    label: "In progress",
    chip: "bg-primary-100 text-primary-700 border-primary-200",
    tone: "primary"
  },
  completed: {
    label: "Completed",
    chip: "bg-emerald-100 text-emerald-800 border-emerald-200",
    tone: "emerald"
  },
  overdue: { label: "Overdue", chip: "bg-rose-100 text-rose-800 border-rose-200", tone: "rose" },
  escalated: {
    label: "Escalated",
    chip: "bg-rose-200 text-rose-900 border-rose-300",
    tone: "rose"
  },
  cancelled: {
    label: "Cancelled",
    chip: "bg-slate-100 text-slate-500 border-slate-200",
    tone: "slate"
  }
};

export const SOURCE_META: Record<string, { label: string; chip: string }> = {
  threshold_rule: { label: "Threshold rule", chip: "bg-amber-50 text-amber-700 border-amber-200" },
  severity_rule: { label: "Severity rule", chip: "bg-rose-50 text-rose-700 border-rose-200" },
  recert_rule: { label: "Recert rule", chip: "bg-sky-50 text-sky-700 border-sky-200" },
  manual: { label: "Manual", chip: "bg-slate-50 text-slate-600 border-slate-200" }
};

// Competency lifecycle state metadata — kept in sync with the §3.2 states used
// by the existing skill-matrix grid (src/app/(dashboard)/skill-matrix/page.tsx).
export const COMPETENCY_STATE_META: Record<
  string,
  { label: string; cell: string; abbr: string }
> = {
  validated_active: { label: "Valid", cell: "bg-emerald-100 text-emerald-800 border-emerald-200", abbr: "✓" },
  expiring_soon: { label: "Expiring soon", cell: "bg-amber-100 text-amber-800 border-amber-200", abbr: "!" },
  expired_in_grace: { label: "Expired (in grace)", cell: "bg-orange-100 text-orange-800 border-orange-200", abbr: "G" },
  expired_revoked: { label: "Expired", cell: "bg-rose-100 text-rose-800 border-rose-200", abbr: "✕" },
  lapsed_requires_full_redo: { label: "Lapsed — full redo", cell: "bg-rose-200 text-rose-900 border-rose-300", abbr: "L" },
  not_yet_attempted: { label: "Not started", cell: "bg-slate-100 text-slate-400 border-slate-200", abbr: "–" },
  in_training: { label: "In training", cell: "bg-sky-100 text-sky-800 border-sky-200", abbr: "T" },
  training_complete_pending_assessment: { label: "Pending assessment", cell: "bg-indigo-100 text-indigo-800 border-indigo-200", abbr: "P" },
  under_assessment: { label: "Under assessment", cell: "bg-violet-100 text-violet-800 border-violet-200", abbr: "A" },
  suspended: { label: "Suspended", cell: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200", abbr: "S" },
  superseded: { label: "Superseded", cell: "bg-slate-200 text-slate-600 border-slate-300", abbr: "↻" }
};

// ─── Enum option lists for the config editors ────────────────────────────────

export const SOURCE_MODULES = ["INCIDENT", "NEAR_MISS", "OBSERVATION", "ANY"] as const;
export const CLASSIFICATION_FIELDS = [
  "category",
  "hazardCategory",
  "initialRootCauseCategory",
  "rootCauseCategory",
  "severity",
  "type",
  "keyword"
] as const;
export const MATCH_MODES = ["exact", "keyword"] as const;
export const CONTENT_TYPES = [
  "video",
  "document",
  "quiz",
  "vr_package",
  "ar_package",
  "external_link"
] as const;
export const DELIVERY_MODES = ["hosted", "external_redirect", "local_package"] as const;
export const SEVERITY_THRESHOLDS = ["HIGH", "CRITICAL"] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function labelize(s: string | null | undefined): string {
  if (!s) return "—";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Deep-link an assignment's source record back to its originating module.
export function sourceRecordHref(
  sourceModule: string | null,
  sourceRecordId: string | null
): string | null {
  if (!sourceRecordId) return null;
  switch (sourceModule) {
    case "INCIDENT":
      return `/incidents/${sourceRecordId}`;
    case "NEAR_MISS":
      return `/near-miss/${sourceRecordId}`;
    case "OBSERVATION":
      return `/observations/${sourceRecordId}`;
    default:
      return null;
  }
}

// Progress-bar / compliance colour thresholds (emerald ≥90, amber 70–89, rose <70)
export function compliancePctTone(pct: number): { bar: string; text: string } {
  if (pct >= 90) return { bar: "bg-emerald-500", text: "text-emerald-700" };
  if (pct >= 70) return { bar: "bg-amber-500", text: "text-amber-700" };
  return { bar: "bg-rose-500", text: "text-rose-700" };
}
