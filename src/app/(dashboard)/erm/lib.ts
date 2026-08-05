// Shared ERM frontend types + constants + helpers. Server components fetch via
// backendFetch("/api/erm/...") (mints JWT). Client components mutate via
// fetch("/api/erm/...") which the catch-all proxy forwards to the Python backend.
//
// Types mirror app/schemas/erm.py (the API contract).

export type Band = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const BANDS: Band[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

// Tailwind chip classes per band — matches the platform chip convention.
export const BAND_CHIP: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-200",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  CRITICAL: "bg-rose-100 text-rose-800 border-rose-200",
};

// Solid hex per band (heat-map cells, charts) — Meridian Standard 5×5 colours.
export const BAND_HEX: Record<string, string> = {
  LOW: "#2E8B57",
  MEDIUM: "#E6A817",
  HIGH: "#E67E22",
  CRITICAL: "#C0392B",
};

export const STATE_CHIP: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  SUBMITTED: "bg-blue-100 text-blue-800 border-blue-200",
  ASSESSED: "bg-indigo-100 text-indigo-800 border-indigo-200",
  TREATMENT_ACTIVE: "bg-violet-100 text-violet-800 border-violet-200",
  MONITORING: "bg-cyan-100 text-cyan-800 border-cyan-200",
  ACCEPTED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ESCALATED: "bg-rose-200 text-rose-900 border-rose-300 font-semibold",
  CLOSED: "bg-slate-200 text-slate-600 border-slate-300",
};

export const VELOCITY_LABEL: Record<string, string> = {
  SLOW: "Slow (>12 mo)",
  MODERATE: "Moderate",
  FAST: "Fast",
  VERY_FAST: "Very Fast (<1 wk)",
};

export const IMPACT_DIMENSIONS = [
  "FINANCIAL",
  "SAFETY",
  "REPUTATIONAL",
  "REGULATORY",
  "BUSINESS_INTERRUPTION",
] as const;
export type ImpactDimension = (typeof IMPACT_DIMENSIONS)[number];

export const DIMENSION_LABEL: Record<string, string> = {
  FINANCIAL: "Financial",
  SAFETY: "Safety",
  REPUTATIONAL: "Reputational",
  REGULATORY: "Regulatory",
  BUSINESS_INTERRUPTION: "Business Interruption",
};

export function bandForScore(score: number | null | undefined): Band | null {
  if (score == null) return null;
  if (score <= 4) return "LOW";
  if (score <= 9) return "MEDIUM";
  if (score <= 15) return "HIGH";
  return "CRITICAL";
}

export function chip(band: string | null | undefined): string {
  return BAND_CHIP[(band ?? "").toUpperCase()] ?? "bg-slate-100 text-slate-600 border-slate-200";
}

export const LINKAGE_LABEL: Record<string, string> = {
  TRIGGERS: "Triggers",
  AMPLIFIES: "Amplifies",
  CORRELATED: "Correlated with",
};

// ── API contract types (subset; mirror app/schemas/erm.py) ──────────────────
export type RiskListItem = {
  id: string;
  riskCode: string;
  title: string;
  categoryId: string;
  categoryCode: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  subCategoryCode: string | null;
  orgLevel: string;
  businessUnit: string | null;
  plantId: string | null;
  plantName: string | null;
  riskOwnerId: string;
  riskOwnerName: string | null;
  riskChampionId: string;
  riskChampionName: string | null;
  lifecycleState: string;
  velocity: string;
  sourceType: string;
  inherentScore: number | null;
  inherentBand: string | null;
  residualLikelihood: number | null;
  residualImpact: number | null;
  residualScore: number | null;
  residualBand: string | null;
  priorResidualScore: number | null;
  priorResidualBand: string | null;
  inherentExpectedLossInr?: number | null;
  residualExpectedLossInr?: number | null;
  residualWorstLossInr?: number | null;
  controlEffectivenessPct?: number | null;
  derivedResidualScore?: number | null;
  derivedResidualBand?: string | null;
  residualIsOverride?: boolean;
  residualOverrideVariance?: number | null;
  controlAlert?: boolean;
  kriAlert?: boolean;
  incidentAlert?: boolean;
  targetScore?: number | null;
  targetBand?: string | null;
  targetExpectedLossInr?: number | null;
  nextReviewDate: string | null;
  reviewOverdueDays: number;
  reviewBadge: string | null;
  openTreatments: number;
  appetiteThreshold: number | null;
  updatedAt: string;
};

export type RiskListResponse = {
  items: RiskListItem[];
  total: number;
  categoryCounts: Record<string, number>;
  bandCounts: Record<string, number>;
  stateCounts: Record<string, number>;
};

export type Assessment = {
  id: string;
  riskId: string;
  assessmentType: "INHERENT" | "RESIDUAL";
  likelihood: number;
  impactScores: { dimension: string; level: number }[];
  dominantImpactDimension: string;
  overallImpact: number;
  totalScore: number;
  ratingBand: string;
  assessmentDate: string;
  assessedBy: string;
  assessedByName: string | null;
  rationale: string;
  isCurrent: boolean;
  createdAt: string;
};

export type Treatment = {
  id: string;
  capaNumber: string;
  title: string;
  treatmentStrategy: string;
  state: string;
  primaryOwnerUserId: string | null;
  primaryOwnerName: string | null;
  closureTargetDate: string | null;
  expectedResidualReduction: number | null;
  completionPercent: number | null;
  isOpen: boolean;
  overdue: boolean;
};

export type RiskDetail = RiskListItem & {
  description: string;
  tags: string[];
  causes: string[];
  consequences: string[];
  existingControls: string[];
  identifiedDate: string;
  rollupRuleId: string | null;
  closureJustification: string | null;
  acceptanceJustification: string | null;
  acceptedBy: string | null;
  acceptedByName: string | null;
  acceptedAt: string | null;
  escalatedAt: string | null;
  isRollup: boolean;
  version: number;
  targetLikelihood?: number | null;
  targetImpact?: number | null;
  targetDate?: string | null;
  targetRationale?: string | null;
  controlAlertAt?: string | null;
  derivedResidual?: DerivedResidual | null;
  incidentAlertReason?: string | null;
  openAppetiteBreaches?: { id: string; bandType: string; status: string; observedValue: number; thresholdValue: number }[];
  bowtie?: Bowtie | null;
  firstLineOwnerId?: string | null;
  firstLineOwnerName?: string | null;
  secondLineOwnerId?: string | null;
  secondLineOwnerName?: string | null;
  thirdLineAssurance?: string | null;
  currentInherent: Assessment | null;
  currentResidual: Assessment | null;
  assessmentHistory: Assessment[];
  treatments: Treatment[];
  linkages: {
    id: string;
    linkageType: string;
    notes: string;
    direction: "IN" | "OUT";
    otherRiskId: string;
    otherRiskCode: string | null;
    otherRiskTitle: string | null;
  }[];
  reviews: {
    id: string;
    reviewDate: string;
    reviewedBy: string;
    reviewedByName: string | null;
    outcome: string;
    notes: string;
  }[];
  contributingEntries: {
    id: string;
    sourceModule: string;
    sourceRegisterEntryId: string;
    sourceRef: string | null;
    contributingScore: number;
    contributingBand: string | null;
    drilldownUrl: string | null;
  }[];
  createdAt: string;
};

export type HeatMapCell = {
  likelihood: number;
  impact: number;
  count: number;
  score: number;
  band: string;
  riskIds: string[];
};

export type TopRiskRow = {
  rank: number;
  id: string;
  riskCode: string;
  title: string;
  categoryCode: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  residualScore: number | null;
  residualBand: string | null;
  trend: "UP" | "DOWN" | "FLAT";
  trendDelta: number;
  riskOwnerId: string;
  riskOwnerName: string | null;
  daysToReview: number | null;
};

export type CategoryBar = {
  categoryCode: string;
  categoryName: string;
  colorHex: string;
  low: number;
  medium: number;
  high: number;
  critical: number;
  total: number;
};

export type MovementRow = {
  id: string;
  riskCode: string;
  title: string;
  fromBand: string | null;
  toBand: string | null;
  direction: "UP" | "DOWN";
};

export type DepartmentBar = {
  businessUnit: string;
  low: number;
  medium: number;
  high: number;
  critical: number;
  total: number;
};

export type RootCauseSummary = {
  label: string;
  categoryCode: string | null;
  categoryName: string | null;
  occurrences: number;
  riskReach: number;
  isRecurringDriver: boolean;
};

export type PendingApprovalItem = {
  type: string; // RISK | TREATMENT
  code?: string | null;
  title?: string | null;
  href: string;
  state?: string | null;
  ownerName?: string | null;
};

export type DashboardSummary = {
  totalActiveRisks: number;
  criticalResidual: number;
  highResidual: number;
  mediumResidual: number;
  lowResidual: number;
  overdueReviews: number;
  openTreatments: number;
  overdueTreatments: number;
  mitigationProgressPct: number;
  escalatedThisQuarter: number;
  pendingApprovals?: number;
  pendingApprovalItems?: PendingApprovalItem[];
  inherentHeatMap: HeatMapCell[];
  residualHeatMap: HeatMapCell[];
  categoryBars: CategoryBar[];
  departmentBars: DepartmentBar[];
  topRootCauses: RootCauseSummary[];
  topRisks: TopRiskRow[];
  movement: MovementRow[];
};

export type Category = {
  id: string;
  code: string;
  name: string;
  description: string;
  colorHex: string;
  displayOrder: number;
  isSystemCategory: boolean;
  isActive: boolean;
  subCategories: { id: string; categoryId: string; code: string; name: string; description: string; isActive: boolean }[];
};

export type ScoringMatrix = {
  id: string;
  name: string;
  version: number;
  isDefault: boolean;
  isActive: boolean;
  likelihoodLevels: { level: number; label: string; probabilityGuide: string; frequencyGuide: string }[];
  impactLevels: { level: number; dimension: string; label: string; descriptor: string }[];
  ratingBands: { name: string; minScore: number; maxScore: number; colorHex: string }[];
  notes: string | null;
};

export type NetworkGraph = {
  nodes: {
    id: string;
    riskCode: string;
    title: string;
    categoryCode: string | null;
    categoryColor: string | null;
    residualScore: number | null;
    residualBand: string | null;
    lifecycleState: string;
  }[];
  edges: { id: string; source: string; target: string; linkageType: string; notes: string }[];
};

export type RollupRule = {
  id: string;
  name: string;
  sourceRegister: string;
  filterCriteria: { siteIds?: string[]; minRiskBand?: string; sourceModules?: string[] };
  aggregationMode: string;
  targetCategoryCode: string;
  targetSubCategoryCode: string;
  scoringMode: string;
  isActive: boolean;
  lastRunAt: string | null;
  lastRunSummary: Record<string, number> | null;
  linkedEntryCount: number;
};

export type TreatmentTrackerRow = {
  id: string;
  capaNumber: string;
  title: string;
  treatmentStrategy: string;
  riskId: string;
  riskCode: string;
  riskTitle: string;
  parentResidualBand: string | null;
  state: string;
  primaryOwnerUserId: string | null;
  primaryOwnerName: string | null;
  closureTargetDate: string | null;
  overdue: boolean;
  expectedResidualReduction: number | null;
  achievedResidualReduction: number | null;
  reductionShortfall?: boolean | null;
  costInr?: number | null;
  expectedLossReductionInr?: number | null;
  riskReductionPerRupee?: number | null;
  completionPercent?: number | null;
};

export type BoardPack = {
  id: string;
  title: string;
  quarterLabel: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  sections: Record<string, boolean>;
  commentary: Record<string, string>;
  snapshotHash: string | null;
  generatedAt: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

// ── ₹ formatting (Indian crore/lakh) — exposure & loss figures ──────────────
export function fmtInr(n: number | null | undefined): string {
  if (n == null) return "—";
  const a = Math.abs(n);
  if (a >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  if (a >= 1e3) return `₹${(n / 1e3).toFixed(0)} K`;
  return `₹${Math.round(n)}`;
}

// ── ADVANCED (CRO-grade) contract types — mirror app/schemas/erm.py ──────────
export type ControlContribution = {
  controlId: string;
  controlCode: string;
  name: string;
  controlType: string;
  mitigationStrength: string;
  rating: string;
  axis: "LIKELIHOOD" | "IMPACT";
  contribution: number;
};

export type DerivedResidual = {
  inherentLikelihood: number | null;
  inherentImpact: number | null;
  inherentScore: number | null;
  preventiveEffectivenessPct: number;
  mitigatingEffectivenessPct: number;
  combinedEffectivenessPct: number;
  derivedLikelihood: number | null;
  derivedImpact: number | null;
  derivedResidualScore: number | null;
  derivedResidualBand: string | null;
  derivedResidualExpectedLossInr: number | null;
  assertedResidualScore: number | null;
  overrideVariance: number | null;
  mappedControlCount: number;
  ratedControlCount: number;
  backTestedControlCount?: number;
  contributingControls: ControlContribution[];
  inherentExpectedLossInr: number | null;
  controlRiskReductionInr: number | null;
};

export type BowtieBarrier = {
  id: string;
  description: string;
  barrierType: "PREVENTIVE" | "MITIGATING";
  controlId: string | null;
  controlCode: string | null;
  status: "WORKED" | "FAILED" | "ABSENT" | "UNTESTED";
};
export type Bowtie = {
  topEvent: string;
  threats: { id: string; description: string; preventiveBarriers: BowtieBarrier[] }[];
  consequences: { id: string; description: string; mitigatingBarriers: BowtieBarrier[] }[];
};

export type ExposureRow = {
  rank: number;
  id: string;
  riskCode: string;
  title: string;
  categoryCode: string | null;
  categoryName: string | null;
  residualBand: string | null;
  residualExpectedLossInr: number;
  residualWorstLossInr: number;
  pctOfTotal: number;
  cumulativePct: number;
};
export type EnterpriseExposure = {
  totalExpectedLossInr: number;
  totalWorstLossInr: number;
  quantifiedRiskCount: number;
  unquantifiedRiskCount: number;
  topDrivers: ExposureRow[];
  byCategory: { categoryCode: string; categoryName: string; colorHex: string | null; riskCount: number; expectedLossInr: number; pctOfTotal: number }[];
  bySite: { plantId: string | null; plantName: string; riskCount: number; expectedLossInr: number; concentrationIndex: number }[];
  portfolioConcentrationIndex: number;
  top5SharePct: number;
};

export type MonteCarlo = {
  iterations: number;
  riskCount: number;
  meanLossInr: number;
  p50LossInr: number;
  p90LossInr: number;
  p95LossInr: number;
  p99LossInr: number;
  maxLossInr: number;
  expectedLossInr: number;
  correlated?: boolean;
  linkageCount?: number;
  independentP99LossInr?: number;
  contagionTailUpliftInr?: number;
  distribution: { bucketFromInr: number; bucketToInr: number | null; count: number; pct: number }[];
};

export type ReverseStress = {
  thresholdInr: number;
  breached: boolean;
  minRisksToBreach: number | null;
  combinedWorstLossInr: number;
  breakingCombination: { riskId: string; riskCode: string; title: string; worstLossInr: number; residualBand: string | null }[];
  portfolioWorstCaseInr: number;
  headroomInr: number;
};

export type CorrelatedExposure = {
  standaloneExpectedLossInr: number;
  correlatedExpectedLossInr: number;
  diversificationGapInr: number;
  topContagionSources: {
    sourceRiskId: string;
    sourceRiskCode: string;
    sourceExpectedLossInr: number;
    directTargets: { riskId: string; riskCode: string; title: string; linkageType: string; addedExpectedLossInr: number; stressedExpectedLossInr: number }[];
    totalAddedExpectedLossInr: number;
    affectedCount: number;
  }[];
  linkageCount: number;
};

export type FrameworkCoverage = {
  frameworks: {
    framework: string;
    version: string;
    metCount: number;
    partialCount: number;
    gapCount: number;
    coveragePct: number;
    clauses: { clause: string; title: string; capability: string; status: "MET" | "PARTIAL" | "GAP"; evidence: string }[];
  }[];
  overallCoveragePct: number;
};
