// Shared ERM Phase 3 (BCM + Scenario) frontend types + constants. Mirrors
// app/schemas/erm_p3.py. Server fetch via backendFetch("/api/erm/bcm/..."),
// client mutate via fetch("/api/erm/bcm/...") (catch-all proxy).

export const CRITICALITY_CHIP: Record<string, string> = {
  VITAL: "bg-rose-200 text-rose-900 border-rose-300 font-semibold",
  ESSENTIAL: "bg-orange-100 text-orange-800 border-orange-200",
  IMPORTANT: "bg-amber-100 text-amber-800 border-amber-200",
  DEFERRABLE: "bg-slate-100 text-slate-600 border-slate-200",
};

export const PLAN_STATUS_CHIP: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  IN_REVIEW: "bg-blue-100 text-blue-800 border-blue-200",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REVIEW_DUE: "bg-amber-100 text-amber-800 border-amber-200",
  RETIRED: "bg-slate-200 text-slate-500 border-slate-300",
};

export const PLAN_HEALTH_CHIP: Record<string, string> = {
  HEALTHY: "bg-emerald-100 text-emerald-800 border-emerald-200",
  STALE: "bg-amber-100 text-amber-800 border-amber-200",
  AT_RISK: "bg-rose-100 text-rose-800 border-rose-200",
  DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
};

export const CRISIS_STATUS_CHIP: Record<string, string> = {
  ACTIVATED: "bg-rose-200 text-rose-900 border-rose-300 font-semibold",
  MANAGED: "bg-orange-100 text-orange-800 border-orange-200",
  STAND_DOWN: "bg-sky-100 text-sky-800 border-sky-200",
  CLOSED: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export const SEVERITY_LABEL: Record<number, string> = { 1: "Sev 1 — Site", 2: "Sev 2 — Corporate", 3: "Sev 3 — Enterprise" };

export const EXERCISE_STATUS_CHIP: Record<string, string> = {
  PLANNED: "bg-slate-100 text-slate-700 border-slate-200",
  IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-slate-200 text-slate-500 border-slate-300",
};

export const FINDING_SEVERITY_CHIP: Record<string, string> = {
  OBSERVATION: "bg-slate-100 text-slate-700 border-slate-200",
  MINOR_GAP: "bg-amber-100 text-amber-800 border-amber-200",
  MAJOR_GAP: "bg-rose-200 text-rose-900 border-rose-300 font-semibold",
};

export const READINESS_CHIP: Record<string, string> = {
  NO_PLAN: "bg-rose-200 text-rose-900 border-rose-300 font-semibold",
  PLAN_EXISTS: "bg-amber-100 text-amber-800 border-amber-200",
  PLAN_TESTED: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export const SIGNAL_CHIP: Record<string, string> = {
  WEAK: "bg-slate-100 text-slate-600 border-slate-200",
  EMERGING: "bg-amber-100 text-amber-800 border-amber-200",
  STRONG: "bg-rose-100 text-rose-800 border-rose-200",
};

export const PROB_LABEL: Record<string, string> = { REMOTE: "Remote", POSSIBLE: "Possible", PLAUSIBLE: "Plausible", LIKELY: "Likely" };
export const DEP_TYPES = ["UPSTREAM_PROCESS", "IT_SYSTEM", "EQUIPMENT", "VENDOR", "PEOPLE_SKILL", "UTILITY", "FACILITY"] as const;
export const SCENARIO_CATEGORIES = ["NATURAL_DISASTER", "CYBER_ATTACK", "SUPPLY_DISRUPTION", "UTILITY_FAILURE", "PANDEMIC_WORKFORCE", "MARKET_SHOCK", "REGULATORY_SHOCK", "REPUTATIONAL_EVENT", "GEOPOLITICAL"] as const;
export const PLAN_TYPES = ["BUSINESS_CONTINUITY", "DISASTER_RECOVERY_IT", "CRISIS_MANAGEMENT", "EMERGENCY_RESPONSE_LINK"] as const;
export const EXERCISE_TYPES = ["DESK_CHECK", "TABLETOP", "SIMULATION", "FULL_INTERRUPTION_TEST", "CALL_TREE_TEST"] as const;

export const BAND_HEX: Record<string, string> = { LOW: "#2E8B57", MEDIUM: "#E6A817", HIGH: "#E67E22", CRITICAL: "#C0392B" };

export function fmtRto(hours: number): string {
  if (hours < 24) return `${hours}h`;
  if (hours < 168) return `${Math.round(hours / 24)}d`;
  return `${Math.round(hours / 168)}w`;
}

// ── Types ────────────────────────────────────────────────────────────────────
export type ProcessListItem = {
  id: string; processCode: string; name: string; siteId: string | null; siteName: string | null;
  ownerId: string; ownerName: string | null; departmentName: string; rtoHours: number; rpoHours: number | null;
  mtpdHours: number; criticality: string; biaStatus: string; nextBiaReviewDate: string | null; reviewOverdue: boolean;
  unmitigatedSpofCount: number; planCoverageCount: number; isCovered: boolean; linkedRiskIds: string[]; updatedAt: string | null;
};
export type ProcessListResponse = { items: ProcessListItem[]; total: number; criticalityCounts: Record<string, number> };
export type Dependency = { id: string; processId: string; dependencyType: string; name: string; description: string | null; isSinglePointOfFailure: boolean; workaround: string | null; workaroundDurationHours: number | null; linkedEntityRef: string | null; unmitigatedSpof: boolean };
export type ProcessDetail = ProcessListItem & { description: string; peakPeriods: string | null; impactProfile: any[]; criticalityOverrideJustification: string | null; approvedBy: string | null; lastBiaDate: string | null; dependencies: Dependency[]; coveringPlans: { id: string; planCode: string; title: string; status: string }[]; linkedRisks: { id: string; riskCode: string; title: string; residualBand: string | null }[]; createdAt: string };

export type BcmDashboard = { criticalProcesses: number; coveragePct: number; coveredCritical: number; totalCritical: number; coverageGaps: { processCode: string; name: string; criticality: string; siteId: string | null }[]; unmitigatedSpofs: number; plansReviewDue: number; exercisesOverdue: number; openExerciseCapas: number; exerciseProgramme: { exerciseCode: string; title: string; type: string; scheduledDate: string; status: string }[]; recentCrises: { crisisCode: string; title: string; status: string; severityLevel: number; activatedAt: string }[]; activeCrises: number };
export type DependencyMap = { nodes: { id: string; label: string; nodeType: string; criticality: string | null; isSpof: boolean; siteId: string | null }[]; edges: { id: string; source: string; target: string; dependencyType: string; isSpof: boolean }[] };

export type PlanListItem = { id: string; planCode: string; title: string; planType: string; siteId: string | null; siteName: string | null; ownerId: string; ownerName: string | null; coveredProcessCount: number; version: number; status: string; healthChip: string; nextReviewDate: string | null; lastExercisedAt: string | null; exerciseOverdue: boolean; updatedAt: string | null };
export type PlanListResponse = { items: PlanListItem[]; total: number; statusCounts: Record<string, number> };
export type RecoveryTask = { id: string; planId: string; orderIndex: number; title: string; detail: string | null; responsibleRoleName: string; targetHoursFromActivation: number };
export type PlanDetail = PlanListItem & { scopeStatement: string; activationCriteria: string[]; sections: { orderIndex: number; heading: string; contentRichText: string; attachments?: string[] }[]; strategySummary: string; fserPlanRef: string | null; versionSnapshots: any[]; recoveryTasks: RecoveryTask[]; coveredProcesses: { id: string; processCode: string; name: string; criticality: string }[]; approvedBy: string | null; approvedAt: string | null; openExerciseCapas: number; createdAt: string };

export type TeamRole = { id: string; roleName: string; siteId: string | null; primaryUserId: string; alternateUserId: string; primaryUserName: string | null; alternateUserName: string | null; responsibilities: string; escalationOrder: number; vacancy: boolean };
export type CallTree = { id: string; name: string; siteId: string | null; nodes: any[]; publishedAt: string | null; staleContacts: number };
export type LogEntry = { id: string; crisisId: string; timestamp: string; enteredBy: string; enteredByName: string | null; entryType: string; content: string; recoveryTaskId: string | null };
export type CrisisListItem = { id: string; crisisCode: string; title: string; siteId: string | null; siteName: string | null; status: string; severityLevel: number; activatedAt: string; activatedByName: string | null; standDownAt: string | null; durationMinutes: number | null; logEntryCount: number; postCrisisReviewDone: boolean };
export type CrisisDetail = CrisisListItem & { activatedPlanIds: string[]; linkedRiskIds: string[]; linkedIncidentId: string | null; reviewNote: string | null; reviewCapaId: string | null; cachedPlanContent: any[]; recoveryTasks: (RecoveryTask & { planCode: string; checked: boolean })[]; logEntries: LogEntry[]; teamRoster: { roleName: string; primary: string | null; alternate: string | null; escalationOrder: number }[]; fserPanel: any | null; createdAt: string };

export type Finding = { id: string; exerciseId: string; description: string; severity: string; capaId: string | null };
export type Exercise = { id: string; exerciseCode: string; title: string; exerciseType: string; scheduledDate: string; siteId: string | null; siteName: string | null; testedPlanIds: string[]; testedScenarioId: string | null; facilitatorId: string; facilitatorName: string | null; participants: string[]; objectives: string[]; status: string; conductedDate: string | null; outcome: string | null; rtoAchievedHours: number | null; callTreeStats: any | null; reportRichText: string | null; findings: Finding[]; openCapaCount: number };
export type ExerciseListResponse = { items: Exercise[]; total: number; statusCounts: Record<string, number> };

export type Scenario = { id: string; scenarioCode: string; title: string; category: string; narrative: string; probabilityQualitative: string; timeHorizon: string; affectedRiskIds: string[]; affectedProcessIds: string[]; impactEstimates: any[]; whatIfAdjustments: { riskId: string; stressedLikelihood: number; stressedImpact: number }[]; mitigationReadiness: string; status: string; lastReviewedAt: string | null; topImpactLevel: number | null; updatedAt: string | null };
export type StressedCell = { likelihood: number; impact: number; count: number; band: string; riskIds: string[] };
export type StressedHeatMap = { scenarioId: string; scenarioTitle: string; baseline: StressedCell[]; stressed: StressedCell[]; movements: { riskId: string; riskCode: string; title: string; fromL: number; fromI: number; toL: number; toI: number }[] };
export type HorizonItem = { id: string; title: string; description: string; category: string; signalStrength: string; potentialCategoryIds: string[]; watchedBy: string; watchedByName: string | null; reviewDate: string; disposition: string | null; promotedEntityId: string | null; dispositionNote: string | null; reviewOverdue: boolean };
