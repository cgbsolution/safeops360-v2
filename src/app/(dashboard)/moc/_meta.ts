// Shared display metadata for the MOC module — kept in one place so the
// landing list, detail view, and form stay consistent. Values mirror the
// String sets the backend stores (spec §3.1).

export const CLASSIFICATIONS = ["minor", "moderate", "major", "critical"] as const;

export const CLASSIFICATION_CHIP: Record<string, string> = {
  minor: "bg-slate-100 text-slate-700 border-slate-200",
  moderate: "bg-sky-100 text-sky-800 border-sky-200",
  major: "bg-amber-100 text-amber-800 border-amber-200",
  critical: "bg-rose-100 text-rose-800 border-rose-200"
};

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_classification_review: "Classification review",
  under_impact_assessment: "Impact assessment",
  under_technical_review: "Technical review",
  under_approval: "Awaiting approval",
  approved_pending_implementation: "Approved",
  implementation_in_progress: "Implementing",
  pre_startup_review: "PSSR",
  implementation_complete_pending_verification: "Pending verification",
  under_post_implementation_review: "Post-impl. review",
  closed_successful: "Closed — successful",
  closed_aborted: "Closed — aborted",
  closed_rejected: "Rejected",
  withdrawn: "Withdrawn",
  expired: "Expired",
  rolled_back: "Rolled back",
  // Legacy short-form statuses from earlier seeds — kept so pre-canonical rows
  // still render proper-case chips (the raw-enum bug) without a re-seed.
  impact_assessment_complete: "Impact assessment",
  approved: "Approved",
  executing: "Implementing",
  verifying: "Pending verification",
  closed: "Closed — successful"
};

export const STATUS_CHIP: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  submitted: "bg-blue-100 text-blue-800 border-blue-200",
  under_classification_review: "bg-blue-100 text-blue-800 border-blue-200",
  under_impact_assessment: "bg-indigo-100 text-indigo-800 border-indigo-200",
  under_technical_review: "bg-indigo-100 text-indigo-800 border-indigo-200",
  under_approval: "bg-amber-100 text-amber-800 border-amber-200",
  approved_pending_implementation: "bg-teal-100 text-teal-800 border-teal-200",
  implementation_in_progress: "bg-violet-100 text-violet-800 border-violet-200",
  pre_startup_review: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
  implementation_complete_pending_verification: "bg-cyan-100 text-cyan-800 border-cyan-200",
  under_post_implementation_review: "bg-cyan-100 text-cyan-800 border-cyan-200",
  closed_successful: "bg-emerald-100 text-emerald-800 border-emerald-200",
  closed_aborted: "bg-slate-200 text-slate-600 border-slate-300",
  closed_rejected: "bg-rose-100 text-rose-800 border-rose-200",
  withdrawn: "bg-slate-200 text-slate-600 border-slate-300",
  expired: "bg-rose-100 text-rose-800 border-rose-200",
  rolled_back: "bg-orange-100 text-orange-800 border-orange-200",
  // Legacy short-form statuses (see STATUS_LABEL).
  impact_assessment_complete: "bg-indigo-100 text-indigo-800 border-indigo-200",
  approved: "bg-teal-100 text-teal-800 border-teal-200",
  executing: "bg-violet-100 text-violet-800 border-violet-200",
  verifying: "bg-cyan-100 text-cyan-800 border-cyan-200",
  closed: "bg-emerald-100 text-emerald-800 border-emerald-200"
};

export const CATEGORIES = [
  "equipment",
  "process",
  "material",
  "organizational",
  "procedural",
  "software_control",
  "scope",
  "temporary",
  "other"
] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  equipment: "Equipment",
  process: "Process",
  material: "Material",
  organizational: "Organizational",
  procedural: "Procedural",
  software_control: "Software / Control",
  scope: "Scope",
  temporary: "Temporary",
  other: "Other"
};

export const ORIGINS = [
  "operational_request",
  "maintenance_initiative",
  "incident_corrective_action",
  "audit_finding_action",
  "regulatory_mandate",
  "customer_complaint_action",
  "kaizen_continuous_improvement",
  "management_review_action",
  "external_engineering_proposal",
  "supplier_change_notification",
  "moc_followup",
  "other"
] as const;

export const ORIGIN_LABEL: Record<string, string> = {
  operational_request: "Operational request",
  maintenance_initiative: "Maintenance initiative",
  incident_corrective_action: "Incident corrective action",
  audit_finding_action: "Audit finding action",
  regulatory_mandate: "Regulatory mandate",
  customer_complaint_action: "Customer complaint action",
  kaizen_continuous_improvement: "Kaizen / CI",
  management_review_action: "Management review action",
  external_engineering_proposal: "External engineering proposal",
  supplier_change_notification: "Supplier change notification",
  moc_followup: "MOC follow-up",
  other: "Other"
};

export const RISK_CHIP: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-800 border-emerald-200",
  moderate: "bg-amber-100 text-amber-800 border-amber-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  critical: "bg-rose-100 text-rose-800 border-rose-200"
};

export const DEP_STATUS_CHIP: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-600 border-slate-200",
  in_progress: "bg-amber-100 text-amber-800 border-amber-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  not_applicable_confirmed: "bg-slate-100 text-slate-500 border-slate-200"
};

// ── Gensuite-parity 5-step wizard constants ──────────────────────────

export const URGENCIES = ["standard", "emergency"] as const;
export const URGENCY_LABEL: Record<string, string> = {
  standard: "Standard",
  emergency: "Emergency — fast-track"
};

// Hazard categories for the Step-2 checklist.
export const HAZARD_CATEGORIES = [
  "fire_explosion",
  "chemical_exposure",
  "mechanical",
  "electrical",
  "ergonomic",
  "environmental_release",
  "other"
] as const;
export const HAZARD_LABEL: Record<string, string> = {
  fire_explosion: "Fire / Explosion",
  chemical_exposure: "Chemical Exposure",
  mechanical: "Mechanical",
  electrical: "Electrical",
  ergonomic: "Ergonomic",
  environmental_release: "Environmental Release",
  other: "Other"
};

// The six departments in the Step-3 impact checklist. Each, if Affected, drives
// a required reviewer in Step-4 routing.
export const IMPACT_DEPARTMENTS = [
  "safety",
  "engineering",
  "operations",
  "quality",
  "environmental",
  "maintenance"
] as const;
export const IMPACT_DEPT_LABEL: Record<string, string> = {
  safety: "Safety",
  engineering: "Engineering",
  operations: "Operations",
  quality: "Quality",
  environmental: "Environmental",
  maintenance: "Maintenance"
};

// Risk-matrix band chips (Combined Risk Register convention: low 1-4 /
// moderate 5-9 / high 10-15 / critical 16-25). MOC stores lowercase bands.
export function bandForScore(score: number | null | undefined): string | null {
  if (score == null) return null;
  if (score <= 4) return "low";
  if (score <= 9) return "moderate";
  if (score <= 15) return "high";
  return "critical";
}

export const ATTACHMENT_CATEGORIES: { value: string; label: string }[] = [
  { value: "drawing", label: "Drawing" },
  { value: "pid", label: "P&ID" },
  { value: "vendor_spec", label: "Vendor spec" },
  { value: "risk_assessment", label: "Risk assessment" },
  { value: "other", label: "Other" }
];

// PSSR checklist verdicts (reused pass/fail pattern).
export const PSSR_VERDICTS = ["pass", "fail", "partial", "na"] as const;
export const PSSR_OUTCOMES = ["go", "conditional_go", "no_go", "deferred"] as const;
export const PSSR_OUTCOME_LABEL: Record<string, string> = {
  go: "Go",
  conditional_go: "Conditional go",
  no_go: "No-go",
  deferred: "Deferred"
};
