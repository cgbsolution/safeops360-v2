// Shared types + presentation constants for the ERM Cross-Domain RCA module.
// Mirrors the Pydantic API contract in app/schemas/rca.py.

export type RiskDomain =
  | "OPERATIONAL" | "FINANCIAL" | "COMPLIANCE" | "EXTERNAL"
  | "REPUTATIONAL" | "CYBER" | "STRATEGIC" | "ESG";
export type RcaOriginType = "EVENT" | "RISK" | "LOSS_EVENT";
export type RcaMethodology =
  | "FIVE_WHY" | "FISHBONE" | "FTA" | "BOWTIE" | "TAPROOT" | "CAUSE_MAP" | "NARRATIVE";
export type RcaStatus = "DRAFT" | "IN_ANALYSIS" | "PEER_REVIEW" | "APPROVED" | "SUPERSEDED";
export type CausalRole = "ROOT" | "CONTRIBUTING" | "DIRECT";
export type ContributionType = "CAUSED" | "ELEVATED" | "REVEALED" | "RECURRING_DRIVER";

export interface SubCauseOut {
  id: string; categoryId: string; code: string; name: string;
  description?: string; applicableDomains: string[]; synonyms: string[]; isActive: boolean;
}
export interface CategoryOut {
  id: string; code: string; name: string; description?: string; colorHex: string;
  displayOrder: number; isActive: boolean; subCauses: SubCauseOut[];
}
export interface IdentifiedCauseOut {
  id: string; subCauseId: string; enterpriseCategoryId: string; causalRole: CausalRole;
  description?: string | null; confidence?: string | null; sortOrder: number;
  subCauseName?: string | null; subCauseCode?: string | null;
  categoryName?: string | null; categoryCode?: string | null;
}
export interface RiskLinkOut {
  id: string; riskId: string; contributionType: ContributionType; weight?: number | null;
  note?: string | null; riskCode?: string | null; riskTitle?: string | null; riskResidualBand?: string | null;
}
export interface LinkedRiskRef {
  riskId: string; riskCode?: string | null; riskTitle?: string | null;
}
export interface RcaListItem {
  id: string; rcaCode: string; title: string; originType: RcaOriginType; primaryDomain: RiskDomain;
  methodology: RcaMethodology; status: RcaStatus; analystId: string; plantId?: string | null;
  occurrenceDate?: string | null; createdAt: string; causeCount: number; linkedRiskCount: number;
  sourceRiskId?: string | null; sourceLossEventId?: string | null; sourceEventId?: string | null;
  sourceCode?: string | null; sourceHref?: string | null; linkedRisks?: LinkedRiskRef[];
}
export interface RcaListResponse { items: RcaListItem[]; total: number; }
export interface RcaDetail {
  id: string; rcaCode: string; title: string; originType: RcaOriginType;
  sourceEventId?: string | null; sourceRiskId?: string | null; sourceLossEventId?: string | null;
  primaryDomain: RiskDomain; methodology: RcaMethodology; status: RcaStatus;
  analysisPayload: Record<string, unknown>; narrative?: string | null;
  analystId: string; approverId?: string | null; approvedAt?: string | null; occurrenceDate?: string | null;
  plantId?: string | null; createdAt: string; updatedAt: string;
  identifiedCauses: IdentifiedCauseOut[]; riskLinks: RiskLinkOut[]; capaIds: string[]; sourceLabel?: string | null;
}
export interface CauseAnalytic {
  subCauseId: string; subCauseCode: string; subCauseName: string; enterpriseCategoryId: string;
  categoryCode: string; categoryName: string; occurrences: number; riskReach: number;
  domainSpread: number; domains: string[]; rcaCount: number; isRecurringDriver: boolean;
}
export interface CategoryRollup {
  enterpriseCategoryId: string; categoryCode: string; categoryName: string; colorHex: string;
  occurrences: number; riskReach: number; domainSpread: number; domains: string[]; subCauseCount: number;
}
export interface CauseAnalyticsResponse {
  computedAt: string; domainFilter?: string | null; causes: CauseAnalytic[];
  categories: CategoryRollup[]; recurringDriverThreshold: number; note: string;
}
export interface CauseDetailRisk {
  riskId: string; riskCode: string; riskTitle: string;
  residualBand?: string | null; residualScore?: number | null;
}
export interface CauseDetailRca {
  rcaId: string; rcaCode: string; title: string; originType: RcaOriginType; primaryDomain: RiskDomain;
}
export interface CauseDetail {
  subCauseCode: string; subCauseName: string; categoryCode: string; categoryName: string;
  occurrences: number; riskReach: number; domainSpread: number; domains: string[];
  risks: CauseDetailRisk[]; rcas: CauseDetailRca[];
}
export interface ContributingCause {
  subCauseId: string; subCauseName: string; categoryCode: string; categoryName: string;
  count: number; rcaCodes: string[]; latestOccurrence?: string | null;
}
export interface ContributingCausesResponse { riskId: string; causes: ContributingCause[]; note: string; }
export interface GraphNode {
  id: string; type: "cause" | "category" | "risk"; label: string; sublabel?: string | null;
  domain?: string | null; colorHex?: string | null; band?: string | null;
}
export interface GraphEdge {
  id: string; source: string; target: string; contributionType?: string | null; weight?: number | null;
}
export interface CauseRiskGraph { nodes: GraphNode[]; edges: GraphEdge[]; focusSubCauseId?: string | null; }

export const DOMAINS: RiskDomain[] = [
  "OPERATIONAL", "FINANCIAL", "COMPLIANCE", "EXTERNAL", "REPUTATIONAL", "CYBER", "STRATEGIC", "ESG",
];
export const DOMAIN_COLOR: Record<string, string> = {
  OPERATIONAL: "#C0392B", FINANCIAL: "#1E6FB8", COMPLIANCE: "#B45309", EXTERNAL: "#5D6D7E",
  REPUTATIONAL: "#8E44AD", CYBER: "#16A085", STRATEGIC: "#6B4FA0", ESG: "#047857",
};
export const DOMAIN_LABEL: Record<string, string> = {
  OPERATIONAL: "Operational", FINANCIAL: "Financial", COMPLIANCE: "Compliance", EXTERNAL: "External",
  REPUTATIONAL: "Reputational", CYBER: "Cyber", STRATEGIC: "Strategic", ESG: "ESG",
};
export const ORIGIN_LABEL: Record<RcaOriginType, string> = {
  EVENT: "Event", RISK: "Risk", LOSS_EVENT: "Loss",
};
export const ORIGIN_CHIP: Record<RcaOriginType, string> = {
  EVENT: "bg-rose-50 text-rose-700 border-rose-200",
  RISK: "bg-indigo-50 text-indigo-700 border-indigo-200",
  LOSS_EVENT: "bg-amber-50 text-amber-700 border-amber-200",
};
export const STATUS_CHIP: Record<RcaStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
  IN_ANALYSIS: "bg-blue-50 text-blue-700 border-blue-200",
  PEER_REVIEW: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SUPERSEDED: "bg-slate-100 text-slate-400 border-slate-200",
};
export const METHOD_LABEL: Record<RcaMethodology, string> = {
  FIVE_WHY: "5-Why", FISHBONE: "Fishbone", FTA: "Fault Tree", BOWTIE: "Bow-tie",
  TAPROOT: "TapRooT", CAUSE_MAP: "Cause Map", NARRATIVE: "Narrative",
};
export const ROLE_LABEL: Record<CausalRole, string> = {
  ROOT: "Root cause", CONTRIBUTING: "Contributing", DIRECT: "Direct/immediate",
};
export const CONTRIB_LABEL: Record<ContributionType, string> = {
  CAUSED: "Caused", ELEVATED: "Elevated", REVEALED: "Revealed", RECURRING_DRIVER: "Recurring driver",
};

export function fmtDate(d?: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}
