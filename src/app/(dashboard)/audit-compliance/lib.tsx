// Shared types + UI helpers for the Audit & Compliance module.
// Types mirror the FastAPI serialization in
// safeops_360_bakend/app/services/audit_compliance.py.

import { cn } from "@/lib/utils";

export type AuditValue = "pass" | "partial" | "fail" | "na" | "yes" | "no" | null;

export type CheckpointResponse = {
  id: string;
  checkpointCode: string;
  checkpointQuestion: string;
  guidance: string;
  requirementReference: string;
  standard: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  criticality: string;
  responseType: string;
  sequence: number;
  requiresPhotoOnFail: boolean;
  autoTriggerCapaOnFail: boolean;
  capaSeverity: string | null;
  linkedSafeopsModule: string | null;
  isCustom?: boolean;
  routedToUserId: string | null;
  auditorResponse: {
    value: AuditValue;
    text_observation?: string;
    auditor_notes?: string;
    photos?: { url: string; storagePath?: string; caption?: string }[];
    is_saved?: boolean;
    responded_at?: string;
  } | null;
  auditeeResponse: {
    respondent_user_id?: string;
    response_text?: string;
    action_taken?: string;
    action_date?: string | null;
    photos?: { url: string; storagePath?: string; caption?: string }[];
    status?: string;
    responded_at?: string;
  } | null;
  auditorReview: {
    reviewer_user_id?: string;
    decision?: string;
    comments?: string;
    reviewed_at?: string;
  } | null;
  plantManagerReview: {
    reviewer_user_id?: string;
    decision?: string;
    comments?: string;
    reviewed_at?: string;
  } | null;
  capa: {
    auto_triggered?: boolean;
    capa_id?: string;
    capa_number?: string;
    capa_status?: string;
  } | null;
  overallStatus: string;
  answeredAt: string | null;
};

export type CategoryScore = {
  category_id: string;
  category_name: string;
  total: number;
  passed: number;
  partial: number;
  failed: number;
  na: number;
  score_pct: number;
};

export type AuditScore = {
  total_checkpoints: number;
  answered: number;
  passed: number;
  partially_passed: number;
  failed: number;
  not_applicable: number;
  overall_score_pct: number;
  category_scores: CategoryScore[];
  critical_failures: number;
  major_failures: number;
  minor_failures: number;
  audit_passed: boolean | null;
};

export type AuditRow = {
  id: string;
  auditNumber: string;
  title: string;
  plantId: string;
  industryCode: string;
  auditType: string;
  status: string;
  scheduledDate: string | null;
  leadAuditorUserId: string;
  plantManagerUserId: string | null;
  auditees: { userId: string; responsibleCategories: string[] }[];
  totalCheckpoints: number | null;
  answeredCheckpoints: number;
  overallCompliancePct: number | null;
  auditPassed: boolean | null;
  openCapaCount: number;
  criticalFailureCount: number;
  submittedAt: string | null;
  closedAt: string | null;
  createdByUserId: string;
  plantHeadAcceptance: { reviewer_user_id?: string; decision?: string; comments?: string; accepted_at?: string } | null;
  camsEngagementId: string | null;
};

export type AuditDetail = AuditRow & {
  scopeDepartments: string[];
  scopeAreas: string[];
  scopeDescription: string;
  scheduledStartTime: string;
  estimatedDurationHours: number;
  coAuditors: string[];
  actualStartAt: string | null;
  actualEndAt: string | null;
  score: AuditScore | null;
  openingRemarks: string;
  closingRemarks: string;
  responses: CheckpointResponse[];
  progress: {
    total: number;
    answered: number;
    completionPct: number;
    categories: { categoryId: string; categoryName: string; categoryColor: string; total: number; answered: number; failed: number; partial: number }[];
  };
};

export type ProgrammeDashboard = {
  total: number;
  open: number;
  closed: number;
  averageCompliancePct: number | null;
  openCapas: number;
  criticalFindings: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  nextScheduled: { id: string; auditNumber: string; title: string; auditType: string; scheduledDate: string } | null;
};

export type AuditDashboard = {
  auditId: string;
  auditNumber: string;
  title: string;
  status: string;
  score: AuditScore;
  criticalCompliance: { total: number; compliant: number; pct: number };
  donut: { pass: number; partial: number; fail: number; na: number; not_answered: number };
};

export type AuditLibrary = {
  id: string;
  industryCode: string;
  industryName: string;
  version: string;
  checkpointCount: number;
  categories: { category_code: string; category_name: string; category_color: string; category_icon: string; checkpointCount: number }[];
};

export type AuditTemplate = {
  id: string;
  name: string;
  description: string;
  auditType: string;
  baseIndustry: string;
  checkpointConfiguration: any;
  version: string;
};

export type PlantUser = { id: string; name: string; role: string; department: string };

// ── UI helpers ───────────────────────────────────────────────────────

export const STATUS_CHIP: Record<string, string> = {
  scheduled: "bg-slate-100 text-slate-600",
  in_progress: "bg-sky-100 text-sky-800",
  pending_plant_head: "bg-violet-100 text-violet-800",
  auditee_response: "bg-amber-100 text-amber-900",
  auditor_review: "bg-indigo-100 text-indigo-800",
  pending_acceptance: "bg-violet-100 text-violet-800",
  closed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-100 text-slate-400",
  // legacy (in-flight audits created before the workflow change)
  submitted_pending_response: "bg-amber-100 text-amber-900",
  response_in_progress: "bg-amber-100 text-amber-900",
  under_review: "bg-indigo-100 text-indigo-800",
};

export const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  pending_plant_head: "Awaiting Plant Head",
  auditee_response: "Auditee Response",
  auditor_review: "Auditor Review",
  pending_acceptance: "Awaiting Acceptance",
  closed: "Closed",
  cancelled: "Cancelled",
  // legacy
  submitted_pending_response: "Awaiting Responses",
  response_in_progress: "Responses In Progress",
  under_review: "Under Review",
};

export const CRITICALITY_CHIP: Record<string, string> = {
  critical: "bg-rose-100 text-rose-700",
  major: "bg-amber-100 text-amber-800",
  minor: "bg-slate-100 text-slate-600",
  informational: "bg-sky-100 text-sky-700",
};

export const VALUE_META: Record<string, { label: string; chip: string; dot: string }> = {
  pass: { label: "Pass", chip: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
  partial: { label: "Partial", chip: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  fail: { label: "Fail", chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  na: { label: "N/A", chip: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
};

export function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function Chip({ map, value, label, className }: { map: Record<string, string>; value: string; label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", map[value] ?? "bg-slate-100 text-slate-600", className)}>
      {(label ?? value).replace(/_/g, " ")}
    </span>
  );
}

export function complianceColor(pct: number | null | undefined): string {
  if (pct == null) return "text-slate-400";
  if (pct >= 90) return "text-emerald-600";
  if (pct >= 75) return "text-amber-600";
  return "text-rose-600";
}

export function complianceBg(pct: number | null | undefined): string {
  if (pct == null) return "bg-slate-300";
  if (pct >= 90) return "bg-emerald-500";
  if (pct >= 75) return "bg-amber-500";
  return "bg-rose-500";
}

export const INDUSTRY_LABEL: Record<string, string> = {
  GARMENTS_TEXTILE: "Garments / Textile",
  CEMENT: "Cement",
  STEEL_METALS: "Steel & Metals",
  CHEMICAL_PROCESS: "Chemical / Process",
  MANUFACTURING_GENERIC: "Manufacturing",
  PHARMA_LIFE_SCIENCES: "Pharma / Life Sciences",
};
