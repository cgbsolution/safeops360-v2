// Shared ERM Tier 3 (Controls · Vendor · Insurance) frontend types + constants.
// Mirrors app/schemas/erm_t3.py. Server fetch via backendFetch("/api/erm/..."),
// client mutate via fetch("/api/erm/...") (catch-all proxy).

// ── Chips / labels ────────────────────────────────────────────────────────────
export const RATING_CHIP: Record<string, string> = {
  EFFECTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  DEFICIENT: "bg-rose-200 text-rose-900 border-rose-300 font-semibold",
  NOT_ASSESSED: "bg-slate-100 text-slate-600 border-slate-200",
};
export const DEF_SEVERITY_CHIP: Record<string, string> = {
  DEFICIENCY: "bg-amber-100 text-amber-800 border-amber-200",
  SIGNIFICANT_DEFICIENCY: "bg-orange-100 text-orange-800 border-orange-200",
  MATERIAL_WEAKNESS: "bg-rose-200 text-rose-900 border-rose-300 font-semibold",
};
export const DEF_STATUS_CHIP: Record<string, string> = {
  OPEN: "bg-rose-100 text-rose-800 border-rose-200",
  REMEDIATION_ACTIVE: "bg-amber-100 text-amber-800 border-amber-200",
  RETESTING: "bg-blue-100 text-blue-800 border-blue-200",
  CLOSED: "bg-emerald-100 text-emerald-800 border-emerald-200",
};
export const CONTROL_TYPE_LABEL: Record<string, string> = {
  PREVENTIVE: "Preventive", DETECTIVE: "Detective", CORRECTIVE: "Corrective", DIRECTIVE: "Directive",
};
export const CONTROL_CATEGORY_LABEL: Record<string, string> = {
  FINANCIAL_REPORTING: "Financial Reporting", OPERATIONAL: "Operational", COMPLIANCE: "Compliance",
  IT_GENERAL: "IT General", ENTITY_LEVEL: "Entity-Level",
};
export const NATURE_LABEL: Record<string, string> = {
  MANUAL: "Manual", AUTOMATED: "Automated", IT_DEPENDENT_MANUAL: "IT-Dependent Manual",
};
export const STRENGTH_CHIP: Record<string, string> = {
  PRIMARY: "bg-primary-100 text-primary-800 border-primary-200 font-semibold",
  SECONDARY: "bg-slate-100 text-slate-700 border-slate-200",
  COMPENSATING: "bg-violet-100 text-violet-800 border-violet-200",
};

export const RISK_BAND_CHIP: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-200",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  CRITICAL: "bg-rose-200 text-rose-900 border-rose-300 font-semibold",
};
export const ESG_BAND_CHIP: Record<string, string> = {
  LEADING: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ADEQUATE: "bg-lime-100 text-lime-800 border-lime-200",
  DEVELOPING: "bg-amber-100 text-amber-800 border-amber-200",
  LAGGING: "bg-rose-200 text-rose-900 border-rose-300 font-semibold",
};
export const RISK_BAND_HEX: Record<string, string> = { LOW: "#2E8B57", MEDIUM: "#E6A817", HIGH: "#E67E22", CRITICAL: "#C0392B" };
export const ESG_BAND_HEX: Record<string, string> = { LEADING: "#2E8B57", ADEQUATE: "#7CB342", DEVELOPING: "#E6A817", LAGGING: "#C0392B" };
export const CRITICALITY_CHIP: Record<string, string> = {
  STRATEGIC: "bg-rose-200 text-rose-900 border-rose-300 font-semibold",
  CRITICAL: "bg-orange-100 text-orange-800 border-orange-200",
  IMPORTANT: "bg-amber-100 text-amber-800 border-amber-200",
  ROUTINE: "bg-slate-100 text-slate-600 border-slate-200",
};
export const ONBOARDING_CHIP: Record<string, string> = {
  PROSPECT: "bg-slate-100 text-slate-600 border-slate-200",
  DUE_DILIGENCE: "bg-blue-100 text-blue-800 border-blue-200",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CONDITIONAL: "bg-amber-100 text-amber-800 border-amber-200",
  SUSPENDED: "bg-rose-100 text-rose-800 border-rose-200",
  OFFBOARDED: "bg-slate-200 text-slate-500 border-slate-300",
};
export const VENDOR_FINDING_CHIP: Record<string, string> = {
  OBSERVATION: "bg-slate-100 text-slate-700 border-slate-200",
  CONCERN: "bg-amber-100 text-amber-800 border-amber-200",
  CRITICAL_GAP: "bg-rose-200 text-rose-900 border-rose-300 font-semibold",
};

export const POLICY_STATUS_CHIP: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  EXPIRING_SOON: "bg-amber-100 text-amber-800 border-amber-200",
  EXPIRED: "bg-rose-200 text-rose-900 border-rose-300 font-semibold",
  UNDER_RENEWAL: "bg-blue-100 text-blue-800 border-blue-200",
  LAPSED: "bg-slate-200 text-slate-500 border-slate-300",
};
export const CLAIM_STATUS_CHIP: Record<string, string> = {
  INTIMATED: "bg-slate-100 text-slate-700 border-slate-200",
  SURVEYOR_APPOINTED: "bg-blue-100 text-blue-800 border-blue-200",
  UNDER_ASSESSMENT: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-lime-100 text-lime-800 border-lime-200",
  PARTIALLY_SETTLED: "bg-cyan-100 text-cyan-800 border-cyan-200",
  SETTLED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REPUDIATED: "bg-rose-100 text-rose-800 border-rose-200",
};
export const GAP_TYPE_CHIP: Record<string, string> = {
  FULLY_COVERED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PARTIALLY_COVERED: "bg-amber-100 text-amber-800 border-amber-200",
  UNCOVERED: "bg-rose-200 text-rose-900 border-rose-300 font-semibold",
  UNINSURABLE_ACCEPTED: "bg-slate-200 text-slate-600 border-slate-300",
};
export const POLICY_TYPE_LABEL: Record<string, string> = {
  PROPERTY_FIRE: "Property / Fire", BUSINESS_INTERRUPTION: "Business Interruption", MARINE_TRANSIT: "Marine Transit",
  LIABILITY_PUBLIC: "Public Liability", LIABILITY_PRODUCT: "Product Liability", DIRECTORS_OFFICERS: "Directors & Officers",
  CYBER: "Cyber", EMPLOYEE_GROUP: "Group Mediclaim", MARINE_CARGO: "Marine Cargo", MACHINERY_BREAKDOWN: "Machinery Breakdown",
  ENVIRONMENTAL_LIABILITY: "Environmental Liability", OTHER: "Other",
};

export const CONTROL_TYPES = ["PREVENTIVE", "DETECTIVE", "CORRECTIVE", "DIRECTIVE"] as const;
export const CONTROL_NATURES = ["MANUAL", "AUTOMATED", "IT_DEPENDENT_MANUAL"] as const;
export const CONTROL_FREQUENCIES = ["CONTINUOUS", "DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL", "EVENT_DRIVEN"] as const;
export const CONTROL_CATEGORIES = ["FINANCIAL_REPORTING", "OPERATIONAL", "COMPLIANCE", "IT_GENERAL", "ENTITY_LEVEL"] as const;
export const TEST_METHODS = ["INQUIRY", "OBSERVATION", "INSPECTION", "REPERFORMANCE"] as const;
export const VENDOR_CRITICALITIES = ["STRATEGIC", "CRITICAL", "IMPORTANT", "ROUTINE"] as const;
export const VENDOR_TIERS = ["TIER_1", "TIER_2", "TIER_3"] as const;
export const ASSESS_METHODS = ["SELF_ASSESSMENT", "DESK_REVIEW", "ONSITE_AUDIT", "THIRD_PARTY_RATING"] as const;
export const POLICY_TYPES = ["PROPERTY_FIRE", "BUSINESS_INTERRUPTION", "MARINE_TRANSIT", "LIABILITY_PUBLIC", "LIABILITY_PRODUCT", "DIRECTORS_OFFICERS", "CYBER", "EMPLOYEE_GROUP", "MARINE_CARGO", "MACHINERY_BREAKDOWN", "ENVIRONMENTAL_LIABILITY", "OTHER"] as const;

export function inrCompact(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(2)} Cr`;
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)} L`;
  return `₹${v.toLocaleString("en-IN")}`;
}

// ── Types — Controls ──────────────────────────────────────────────────────────
export type ControlListItem = {
  id: string; controlCode: string; name: string; controlType: string; nature: string; frequency: string; category: string;
  controlOwnerId: string; controlOwnerName: string | null; siteId: string | null; siteName: string | null; isKeyControl: boolean;
  currentDesignRating: string | null; currentOperatingRating: string | null; lastTestDate: string | null; nextTestDueDate: string | null;
  testOverdue: boolean; openDeficiencyCount: number; mappedRiskCount: number; isActive: boolean; updatedAt: string | null;
};
export type ControlListResponse = { items: ControlListItem[]; total: number; categoryCounts: Record<string, number> };
export type Mapping = { id: string; controlId: string; riskId: string | null; processId: string | null; obligationId: string | null; mitigationStrength: string; coverageNotes: string; targetType: string; targetCode: string | null; targetLabel: string | null };
export type TestPlan = { id: string; controlId: string; testCycleLabel: string; testMethod: string; sampleSizePlanned: number; testFrequencyPerYear: number; assignedTesterId: string; assignedTesterName: string | null; scheduledDate: string };
export type ControlTest = { id: string; controlId: string; testPlanId: string | null; testType: string; testDate: string; testerId: string; testerName: string | null; method: string; sampleSize: number; exceptionsFound: number; conclusion: string; workpaperNotes: string; evidenceAttachmentIds: string[]; deficiencyId: string | null };
export type Deficiency = { id: string; deficiencyCode: string; controlId: string; controlCode: string | null; controlName: string | null; sourceTestId: string; severity: string; description: string; rootCause: string | null; remediationCapaId: string | null; remediationCapaState: string | null; status: string; identifiedRiskImpact: string | null; reportedToAuditCommittee: boolean; auditCommitteeReference: string | null; ageDays: number; createdAt: string };
export type DeficiencyListResponse = { items: Deficiency[]; total: number; severityCounts: Record<string, number> };
export type ControlDetail = ControlListItem & { description: string; assertions: string[]; controlDesignNotes: string; processName: string | null; mappings: Mapping[]; testPlans: TestPlan[]; tests: ControlTest[]; deficiencies: Deficiency[]; createdAt: string };
export type ControlsDashboard = { keyControls: number; testedThisCyclePct: number; effectivePct: number; openDeficiencies: number; materialWeaknesses: number; overdueTests: number; ratingDistribution: Record<string, number>; deficiencyBySeverity: Record<string, number>; overdueList: { controlCode: string; name: string; owner: string | null; nextTestDueDate: string | null }[]; unreportedMaterialWeaknesses: { deficiencyCode: string; controlCode: string | null; description: string }[] };
export type MatrixCell = { controlId: string; controlCode: string; name: string; mitigationStrength: string; operatingRating: string | null };
export type MatrixRow = { riskId: string; riskCode: string; title: string; residualBand: string | null; controls: MatrixCell[]; hasPrimaryControl: boolean; primaryControlDeficient: boolean };
export type RiskControlMatrix = { rows: MatrixRow[]; orphanControls: { controlId: string; controlCode: string; name: string }[] };

// ── Types — Vendor ────────────────────────────────────────────────────────────
export type VendorListItem = {
  id: string; vendorCode: string; masterDataRef: string | null; legalName: string; category: string; criticality: string; tier: string;
  relationshipOwnerId: string; relationshipOwnerName: string | null; annualSpendInr: number | null; isSingleSource: boolean;
  onboardingStatus: string; currentRiskScore: number | null; currentRiskBand: string | null; currentEsgScore: number | null;
  currentEsgBand: string | null; nextReviewDate: string | null; reviewOverdue: boolean; isActive: boolean; updatedAt: string | null;
};
export type VendorListResponse = { items: VendorListItem[]; total: number; riskBandCounts: Record<string, number>; esgBandCounts: Record<string, number> };
export type VendorAssessment = { id: string; vendorId: string; lens: string; assessmentDate: string; assessorId: string; assessorName: string | null; method: string; domainScores: { domainKey: string; rawScore: number; weightPct: number; evidenceNotes?: string }[]; weightedScore: number; band: string; summaryNotes: string; validUntil: string; isCurrent: boolean; findings: { id: string; lens: string; severity: string; description: string; capaId: string | null; targetCloseDate: string | null }[] };
export type VendorDetail = VendorListItem & { siteScope: string[]; linkedProcessIds: string[]; linkedRiskIds: string[]; linkedRisks: { id: string; riskCode: string; title: string; residualBand: string | null }[]; linkedProcesses: { id: string; processCode: string; name: string; criticality: string }[]; assessments: VendorAssessment[]; createdAt: string };
export type ScoringConfig = { id: string; lens: string; domains: { domainKey: string; label: string; weightPct: number; guidance: string }[]; bandThresholds: { band: string; minScore: number; maxScore: number; colorHex: string }[] };
export type VendorDashboard = { activeVendors: number; strategicCritical: number; highCriticalRisk: number; laggingEsg: number; singleSource: number; overdueReviews: number; riskBandDistribution: Record<string, number>; esgBandDistribution: Record<string, number>; spendWeightedLaggingPct: number; onboardingPipeline: Record<string, number> };
export type EsgPortfolio = { totalSpend: number; spendByBand: { band: string; spend: number; pct: number; colorHex: string }[]; spendByCategory: { category: string; spend: number; pct: number }[]; laggingWatchlist: { vendorCode: string; legalName: string; category: string; annualSpendInr: number | null; esgScore: number | null }[]; laggingSpendPct: number };

// ── Types — Insurance ─────────────────────────────────────────────────────────
export type PolicyListItem = {
  id: string; policyCode: string; policyName: string; policyType: string; insurerName: string; policyNumber: string;
  sumInsuredInr: number; premiumAnnualInr: number; coverageEndDate: string; status: string; daysToExpiry: number | null;
  coveredRiskCount: number; openClaimCount: number; ownerId: string; ownerName: string | null; isActive: boolean; updatedAt: string | null;
};
export type PolicyListResponse = { items: PolicyListItem[]; total: number; statusCounts: Record<string, number> };
export type Claim = { id: string; claimCode: string; policyId: string; policyCode: string | null; lossEventId: string | null; lossEventCode: string | null; claimDate: string; description: string; claimedAmountInr: number; status: string; settledAmountInr: number | null; settlementDate: string | null; remarks: string | null };
export type PolicyDetail = PolicyListItem & { brokerName: string | null; siteScope: string[]; deductibleInr: number | null; coverageStartDate: string; renewalLeadDays: number; keyExclusions: string[]; coveredRiskIds: string[]; coveredProcessIds: string[]; coveredRisks: { id: string; riskCode: string; title: string; residualBand: string | null }[]; coveredProcesses: { id: string; processCode: string; name: string }[]; claims: Claim[]; createdAt: string };
export type CoverageGapLine = { riskId: string; isInsurable: boolean; coveredByPolicyIds: string[]; gapType: string; gapNotes: string; recommendedAction?: string | null; riskCode?: string; title?: string; residualBand?: string };
export type CoverageGap = { id: string; assessmentCycleLabel: string; reviewDate: string; reviewedBy: string; reviewedByName: string | null; lines: CoverageGapLine[]; summaryNotes: string; uncoveredCount: number; totalCriticalRisks: number; createdAt: string };
export type InsuranceDashboard = { activePolicies: number; totalSumInsured: number; annualPremium: number; expiringSoon: number; openClaimsValue: number; uncoveredCriticalRisks: number; renewalCalendar: { policyCode: string; policyName: string; coverageEndDate: string; daysToExpiry: number; status: string }[]; coverageByType: { policyType: string; sumInsured: number }[]; openClaims: { claimCode: string; policyCode: string | null; claimedAmountInr: number; status: string }[] };

export type Tier3Summary = { controls: ControlsDashboard | null; vendor: VendorDashboard | null; insurance: InsuranceDashboard | null };
