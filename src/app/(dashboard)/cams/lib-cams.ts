// Shared CAMS (Compliance & Audit Management System) frontend types + constants.
// Mirrors app/schemas/cams.py. Server components fetch via
// backendFetch("/api/cams/..."); client components mutate via fetch("/api/cams/...")
// through the catch-all proxy.

// ── enums / option lists ──────────────────────────────────────────────────
export const ENGAGEMENT_TYPES = [
  { value: "INTERNAL_AUDIT", label: "Internal Audit" },
  { value: "COMPLIANCE_AUDIT", label: "Compliance Audit" },
  { value: "INSPECTION", label: "Inspection" },
  { value: "SUPPLIER_AUDIT", label: "Supplier Audit" },
  { value: "LAYERED_PROCESS_AUDIT", label: "Layered Process Audit" },
  { value: "MANAGEMENT_REVIEW", label: "Management Review" },
] as const;

export const ENGAGEMENT_STATUSES = [
  "PLANNED", "SCHEDULED", "IN_PROGRESS", "FIELDWORK_COMPLETE",
  "FINDINGS_REVIEW", "REPORT_ISSUED", "CLOSED", "CANCELLED",
] as const;

export const QUESTION_TYPES = [
  { value: "CONFORM_NC_NA", label: "Conform / NC / N/A" },
  { value: "YES_NO_NA", label: "Yes / No / N/A" },
  { value: "RATING_SCALE", label: "Rating scale" },
  { value: "NUMERIC", label: "Numeric" },
  { value: "SINGLE_SELECT", label: "Single select" },
  { value: "MULTI_SELECT", label: "Multi select" },
  { value: "TEXT", label: "Free text" },
  { value: "PHOTO_REQUIRED", label: "Photo required" },
  { value: "SIGNATURE", label: "Signature" },
] as const;

export const FREQUENCIES = ["WEEKLY", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL", "CUSTOM_DAYS"] as const;
export const STANDARDS = ["ISO_45001", "ISO_14001", "ISO_9001"] as const;
export const SCORING_MODES = ["PERCENT_CONFORMANCE", "WEIGHTED_SCORE", "PASS_FAIL", "NONE"] as const;

// ── chip maps ───────────────────────────────────────────────────────────────
export const ENGAGEMENT_STATUS_CHIP: Record<string, string> = {
  PLANNED: "bg-slate-100 text-slate-700 border-slate-200",
  SCHEDULED: "bg-sky-100 text-sky-800 border-sky-200",
  IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-200",
  FIELDWORK_COMPLETE: "bg-indigo-100 text-indigo-800 border-indigo-200",
  FINDINGS_REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
  REPORT_ISSUED: "bg-violet-100 text-violet-800 border-violet-200",
  CLOSED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-400 border-slate-200 line-through",
};

export const ENGAGEMENT_TYPE_CHIP: Record<string, string> = {
  INTERNAL_AUDIT: "bg-blue-50 text-blue-700 border-blue-200",
  COMPLIANCE_AUDIT: "bg-rose-50 text-rose-700 border-rose-200",
  INSPECTION: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SUPPLIER_AUDIT: "bg-amber-50 text-amber-700 border-amber-200",
  LAYERED_PROCESS_AUDIT: "bg-violet-50 text-violet-700 border-violet-200",
  MANAGEMENT_REVIEW: "bg-slate-100 text-slate-700 border-slate-200",
};

export const RESULT_CHIP: Record<string, string> = {
  CONFORMING: "bg-emerald-100 text-emerald-800 border-emerald-200",
  MINOR_NC: "bg-amber-100 text-amber-800 border-amber-200",
  MAJOR_NC: "bg-orange-100 text-orange-900 border-orange-200",
  CRITICAL_NC: "bg-rose-200 text-rose-900 border-rose-300 font-semibold",
};

export const SEVERITY_CHIP: Record<string, string> = {
  OBSERVATION: "bg-slate-100 text-slate-600 border-slate-200",
  OPPORTUNITY_FOR_IMPROVEMENT: "bg-sky-100 text-sky-700 border-sky-200",
  MINOR_NC: "bg-amber-100 text-amber-800 border-amber-200",
  MAJOR_NC: "bg-orange-100 text-orange-900 border-orange-200",
  CRITICAL_NC: "bg-rose-200 text-rose-900 border-rose-300 font-semibold",
};

export const FINDING_STATUS_CHIP: Record<string, string> = {
  OPEN: "bg-rose-100 text-rose-800 border-rose-200",
  CAPA_RAISED: "bg-blue-100 text-blue-800 border-blue-200",
  IN_REMEDIATION: "bg-amber-100 text-amber-800 border-amber-200",
  VERIFICATION: "bg-violet-100 text-violet-800 border-violet-200",
  CLOSED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ACCEPTED_RISK: "bg-slate-100 text-slate-600 border-slate-200",
};

export const TEMPLATE_STATUS_CHIP: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  IN_REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  RETIRED: "bg-slate-100 text-slate-400 border-slate-200",
};

// ── helpers ───────────────────────────────────────────────────────────────
export function labelize(token: string | null | undefined): string {
  if (!token) return "—";
  return token.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function engagementTypeLabel(v: string): string {
  return ENGAGEMENT_TYPES.find((t) => t.value === v)?.label ?? labelize(v);
}

// ── types (mirror app/schemas/cams.py) ──────────────────────────────────────
export interface AuditType {
  id: string;
  typeCode: string;
  name: string;
  engagementType: string;
  defaultTemplateId?: string | null;
  defaultTemplateName?: string | null;
  defaultRecurrence?: string | null;
  requiresAssetRef: boolean;
  requiresAuditorCompetency: string[];
  // WP-49: the audit type is the configuration home. `scoringRules` replaces the
  // platform-wide MINIMUM_PASS_SCORE constant (F-22); `regimeCode` selects the
  // buyer-regime vocabulary (WP-47); `competenceEnforcement` decides whether a
  // missing competency warns or blocks (WP-36).
  scoringRules?: { minimumPassScore?: number; criticalGateThreshold?: number } | null;
  regimeCode?: string | null;
  competenceEnforcement?: string;
  standardRefs: string[];
  isActive: boolean;
  engagementCount: number;
  updatedAt?: string | null;
}

export interface Engagement {
  id: string;
  engagementCode: string;
  title: string;
  engagementType: string;
  auditTypeId?: string | null;
  auditTypeName?: string | null;
  standardRefs: string[];
  siteId?: string | null;
  siteName?: string | null;
  areaOrAssetRef?: string | null;
  scopeStatement: string;
  leadAuditorId: string;
  leadAuditorName?: string | null;
  auditTeamIds: string[];
  auditeeOwnerId?: string | null;
  auditeeOwnerName?: string | null;
  plannedDate: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  conductedDate?: string | null;
  templateId?: string | null;
  templateName?: string | null;
  templateVersionUsed?: number | null;
  status: string;
  riskBasis?: string | null;
  triggeringRiskId?: string | null;
  overallResult?: string | null;
  scorePercent?: number | null;
  nextScheduledDate?: string | null;
  sourceModule?: string | null;
  findingCount: number;
  openFindingCount: number;
  ncCount: number;
  updatedAt?: string | null;
  // Unified feed only: provenance ("AUDIT" = ComplianceAudit engine) + the
  // detail route (audits → /cams/audits, inspections → /cams/engagements).
  href?: string | null;
}

export interface EngagementListResponse {
  items: Engagement[];
  total: number;
  statusCounts: Record<string, number>;
  typeCounts: Record<string, number>;
}

export interface Question {
  id: string;
  orderIndex: number;
  text: string;
  questionType: string;
  isMandatory: boolean;
  standardClauseRef?: string | null;
  guidance?: string | null;
  weight?: number | null;
  ncTriggersFinding: boolean;
  evidenceRequiredOnNc: boolean;
  options?: string[] | null;
}

export interface Section {
  id: string;
  orderIndex: number;
  title: string;
  weightPct?: number | null;
  questions: Question[];
}

export interface Template {
  id: string;
  templateCode: string;
  name: string;
  description: string;
  applicableEngagementTypes: string[];
  standardRefs: string[];
  version: number;
  status: string;
  approvedBy?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  parentTemplateId?: string | null;
  scoringConfig: { mode?: string; passThresholdPercent?: number; ncWeighting?: Record<string, number> };
  ownerId: string;
  ownerName?: string | null;
  isGlobal: boolean;
  siteId?: string | null;
  sectionCount: number;
  questionCount: number;
  clauseCount: number;
  updatedAt?: string | null;
}

export interface TemplateDetail extends Template {
  sections: Section[];
}

export interface TemplateListResponse {
  items: Template[];
  total: number;
  statusCounts: Record<string, number>;
}

export interface ClauseRef {
  standard: string;
  clause: string;
  title: string;
}

export interface RunnerQuestion extends Question {
  sectionId: string;
  sectionTitle: string;
  value?: unknown;
  conformance?: string | null;
  note?: string;
  evidenceAttachmentIds?: string[];
  findingId?: string | null;
}

export interface ChecklistRunner {
  engagementId: string;
  engagementCode: string;
  engagementTitle: string;
  status: string;
  templateId?: string | null;
  templateName?: string | null;
  templateVersionUsed?: number | null;
  scoringConfig: { mode?: string; passThresholdPercent?: number };
  sections: { id: string; title: string; weightPct?: number | null; questions: RunnerQuestion[] }[];
  completedBy?: string | null;
  completedAt?: string | null;
  scorePercent?: number | null;
  overallResult?: string | null;
}

export interface Finding {
  id: string;
  findingCode: string;
  engagementId: string;
  engagementCode?: string | null;
  engagementTitle?: string | null;
  sourceQuestionId?: string | null;
  title: string;
  description: string;
  severity: string;
  standardClauseRef?: string | null;
  siteId?: string | null;
  siteName?: string | null;
  areaOrAssetRef?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  rootCauseMethod?: string | null;
  rootCauseSummary?: string | null;
  capaId?: string | null;
  capaNumber?: string | null;
  capaState?: string | null;
  status: string;
  isRepeatFinding: boolean;
  repeatOfFindingId?: string | null;
  dueDate?: string | null;
  closedBy?: string | null;
  closedAt?: string | null;
  verificationNote?: string | null;
  evidenceAttachmentIds: string[];
  ageDays: number;
  capaRequired: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  // Unified feed only: detail route (audit findings → /cams/audits).
  href?: string | null;
}

export interface FindingListResponse {
  items: Finding[];
  total: number;
  severityCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  repeatCount: number;
}

// ── Analytics (C-13) ────────────────────────────────────────────────────────
export interface BenchmarkRow {
  siteId?: string | null;
  siteName?: string | null;
  auditsPlanned: number;
  auditsConducted: number;
  completionRatePct: number;
  avgScorePct?: number | null;
  findingCount: number;
  findingDensity: number;
  majorCriticalCount: number;
  repeatCount: number;
}
export interface ClauseConformanceRow {
  clause: string;
  assessments: number;
  nonConformances: number;
  conformancePct: number;
}
export interface ParetoRow { key: string; label: string; count: number }
export interface Analytics {
  programme: {
    planned: number; scheduled: number; inProgress: number; fieldworkComplete: number;
    reportIssued: number; closed: number; cancelled: number; overdue: number; total: number; completionRatePct: number;
  };
  findingsBySeverity: Record<string, number>;
  repeatFindingRatePct: number;
  avgClosureDays?: number | null;
  openFindingCount: number;
  byType: Record<string, number>;
  bySourceModule: Record<string, number>;
  benchmarkingBySite: BenchmarkRow[];
  clauseConformance: ClauseConformanceRow[];
  paretoByClause: ParetoRow[];
  capaOverduePct: number;
}

// ── Compliance Tracker (C-12) ─────────────────────────────────────────────────
export interface ComplianceLink {
  id: string;
  engagementId?: string | null;
  engagementCode?: string | null;
  findingId?: string | null;
  findingCode?: string | null;
  obligationId: string;
  linkType: string;
  notes: string;
  createdAt?: string | null;
}
export interface ObligationCoverageRow {
  obligationId: string;
  obligationCode: string;
  title: string;
  regulatorName: string;
  siteId?: string | null;
  siteName?: string | null;
  status: string;
  validUntil?: string | null;
  verifiedByAudit: boolean;
  lastVerifyingEngagementCode?: string | null;
  openNcCount: number;
  links: ComplianceLink[];
}
export interface ComplianceTracker {
  // WP-52 / F-48: the counts are NULLABLE on purpose. When the statutory
  // obligations register cannot be read, the backend returns
  // `available: false` with nulls rather than zeros — "no obligations" and
  // "could not read obligations" are different facts, and only one of them is
  // good news on a compliance dashboard. Branch on `available`, never on a 0.
  available?: boolean;
  unavailableReason?: string | null;
  totalObligations: number | null;
  verifiedByAuditCount: number | null;
  // Null on an empty register too — 0% over an empty denominator is meaningless
  // and reads as total failure.
  verifiedPct: number | null;
  openNcCount: number | null;
  statusCounts: Record<string, number>;
  rows: ObligationCoverageRow[];
}
export const OBLIGATION_STATUS_CHIP: Record<string, string> = {
  COMPLIANT: "bg-emerald-100 text-emerald-800 border-emerald-200",
  DUE_SOON: "bg-amber-100 text-amber-800 border-amber-200",
  OVERDUE: "bg-rose-200 text-rose-900 border-rose-300 font-semibold",
  UNDER_RENEWAL: "bg-sky-100 text-sky-800 border-sky-200",
  NOT_APPLICABLE: "bg-slate-100 text-slate-500 border-slate-200",
};
export const LINK_TYPE_CHIP: Record<string, string> = {
  VERIFIES: "bg-emerald-100 text-emerald-800 border-emerald-200",
  BREACHES: "bg-rose-200 text-rose-900 border-rose-300 font-semibold",
  EVIDENCES: "bg-amber-100 text-amber-800 border-amber-200",
};

// ── CAPA surfaced view (C-14) ─────────────────────────────────────────────────
export interface AuditCapa {
  id: string;
  capaNumber: string;
  title: string;
  state: string;
  severity: string;
  priority: string;
  sourceTypeCode: string;
  primaryOwnerUserId?: string | null;
  primaryOwnerName?: string | null;
  closureTargetDate?: string | null;
  sourceReferenceId?: string | null;
  sourceReferenceUrl?: string | null;
  findingCode?: string | null;
  engagementCode?: string | null;
  overdueDays: number;
  createdAt?: string | null;
}
export interface AuditCapaListResponse {
  items: AuditCapa[];
  total: number;
  stateCounts: Record<string, number>;
  overdueCount: number;
  openCount: number;
}
export const CAPA_STATE_CHIP: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  SUBMITTED: "bg-blue-100 text-blue-800 border-blue-200",
  UNDER_RCA: "bg-indigo-100 text-indigo-800 border-indigo-200",
  ACTIONS_PLANNED: "bg-amber-100 text-amber-800 border-amber-200",
  ACTIONS_IN_PROGRESS: "bg-amber-100 text-amber-800 border-amber-200",
  PENDING_VERIFICATION: "bg-violet-100 text-violet-800 border-violet-200",
  VERIFIED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CLOSED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CLOSED_RECURRED: "bg-rose-100 text-rose-800 border-rose-200",
  REJECTED: "bg-slate-100 text-slate-500 border-slate-200",
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
};

export interface Recurrence {
  id: string;
  auditTypeId?: string | null;
  auditTypeName?: string | null;
  templateId?: string | null;
  siteScope: string[];
  frequency: string;
  customIntervalDays?: number | null;
  leadTimeDays: number;
  defaultLeadAuditorId?: string | null;
  isActive: boolean;
  lastGeneratedAt?: string | null;
  updatedAt?: string | null;
}
