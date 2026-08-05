// Shared ERM Phase 2 frontend types + constants. Mirrors app/schemas/erm_p2.py.
// Server components fetch via backendFetch("/api/erm/..."); client mutate via
// fetch("/api/erm/...") (catch-all proxy).

export const KRI_STATUS_CHIP: Record<string, string> = {
  GREEN: "bg-emerald-100 text-emerald-800 border-emerald-200",
  AMBER: "bg-amber-100 text-amber-800 border-amber-200",
  RED: "bg-rose-100 text-rose-800 border-rose-200",
  NO_DATA: "bg-slate-100 text-slate-500 border-slate-200",
};
export const KRI_STATUS_HEX: Record<string, string> = {
  GREEN: "#2E8B57", AMBER: "#E6A817", RED: "#C0392B", NO_DATA: "#94a3b8",
};

export const APPETITE_LEVEL_CHIP: Record<string, string> = {
  AVERSE: "bg-rose-100 text-rose-800 border-rose-200",
  MINIMAL: "bg-orange-100 text-orange-800 border-orange-200",
  CAUTIOUS: "bg-amber-100 text-amber-800 border-amber-200",
  OPEN: "bg-sky-100 text-sky-800 border-sky-200",
  SEEKING: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export const GAUGE_CHIP: Record<string, string> = {
  WITHIN: "bg-emerald-100 text-emerald-800 border-emerald-200",
  APPROACHING: "bg-amber-100 text-amber-800 border-amber-200",
  BREACH: "bg-rose-100 text-rose-800 border-rose-200",
};

export const OBLIGATION_STATUS_CHIP: Record<string, string> = {
  COMPLIANT: "bg-emerald-100 text-emerald-800 border-emerald-200",
  DUE_SOON: "bg-amber-100 text-amber-800 border-amber-200",
  OVERDUE: "bg-rose-200 text-rose-900 border-rose-300 font-semibold",
  UNDER_RENEWAL: "bg-sky-100 text-sky-800 border-sky-200",
  NOT_APPLICABLE: "bg-slate-100 text-slate-500 border-slate-200",
};

export const TASK_STATUS_CHIP: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-700 border-slate-200",
  SUBMITTED: "bg-blue-100 text-blue-800 border-blue-200",
  VERIFIED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  OVERDUE: "bg-rose-200 text-rose-900 border-rose-300 font-semibold",
  WAIVED: "bg-violet-100 text-violet-800 border-violet-200",
};

export const LOSS_STATUS_CHIP: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  QUANTIFIED: "bg-blue-100 text-blue-800 border-blue-200",
  CLOSED: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export const BREACH_STATUS_CHIP: Record<string, string> = {
  OPEN: "bg-rose-200 text-rose-900 border-rose-300 font-semibold",
  UNDER_REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
  TREATMENT_MANDATED: "bg-orange-100 text-orange-800 border-orange-200",
  TEMPORARILY_ACCEPTED: "bg-sky-100 text-sky-800 border-sky-200",
  RESOLVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export const LOSS_TYPES = [
  "PROPERTY_DAMAGE", "BUSINESS_INTERRUPTION", "FINE_PENALTY", "MEDICAL_COMPENSATION",
  "PRODUCT_QUALITY", "THEFT_FRAUD", "THIRD_PARTY_LIABILITY", "OTHER",
] as const;

export function fmtInr(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)} Cr`;
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(1)} L`;
  return `₹${v.toLocaleString("en-IN")}`;
}

// ── Types ────────────────────────────────────────────────────────────────────
export type KriOut = {
  id: string; kriCode: string; name: string; description: string;
  categoryId: string; categoryCode: string | null; categoryName: string | null; categoryColor: string | null;
  linkedRiskIds: string[]; linkedRiskCount: number; unit: string; direction: string; indicatorType?: string; frequency: string;
  feedType: string; metricProviderKey: string | null; thresholdGreen: number; thresholdAmber: number;
  ownerId: string; ownerName: string | null; isActive: boolean; graceDays: number;
  currentStatus: string; currentValue: number | null; apiToken: string | null;
  sparkline: { periodLabel: string; value: number; status: string }[]; openBreaches: number; updatedAt: string | null;
};
export type KriListResponse = { items: KriOut[]; total: number; statusCounts: Record<string, number>; breachesOpen: number };
export type Reading = { id: string; kriId: string; periodLabel: string; periodEnd: string; value: number; status: string; source: string; enteredByName: string | null; notes: string | null; isCurrent: boolean; createdAt: string };
export type KriBreach = { id: string; kriId: string; kriCode: string | null; kriName: string | null; breachType: string; acknowledgedByName: string | null; acknowledgedAt: string | null; resolutionNotes: string | null; status: string; createdAt: string };
export type KriDetail = KriOut & { readings: Reading[]; breaches: KriBreach[]; linkedRisks: { id: string; riskCode: string; title: string; residualBand: string | null; residualScore: number | null }[]; thresholdAnnotations: any[] };

export type BandGauge = { bandType: string; thresholdValue: number; observedValue: number; state: string };
export type AppetiteDashRow = { categoryId: string; categoryCode: string | null; categoryName: string | null; categoryColor: string | null; appetiteLevel: string | null; statementExcerpt: string; statementId: string | null; status: string | null; gauges: BandGauge[]; openBreaches: number };
export type AppetiteStatement = { id: string; categoryId: string; categoryCode: string | null; categoryName: string | null; categoryColor: string | null; statementText: string; appetiteLevel: string; version: number; status: string; approvedByName: string | null; approvalReference: string | null; approvedAt: string | null; effectiveFrom: string | null; toleranceBands: { bandType: string; thresholdValue: number }[]; updatedAt: string | null };
export type AppetiteBreach = { id: string; appetiteStatementId: string; categoryId: string; categoryCode: string | null; categoryName: string | null; bandType: string; observedValue: number; thresholdValue: number; triggeringEntityIds: string[]; triggeringEntities: { id: string; type: string; code: string; title: string }[]; detectedAt: string; status: string; committeeDecision: string | null; decisionByName: string | null; reviewByDate: string | null; ageDays: number };

export type Obligation = { id: string; obligationCode: string; title: string; obligationType: string; statuteReference: string; regulatorName: string; siteId: string | null; siteName: string | null; ownerId: string; ownerName: string | null; frequency: string; validFrom: string | null; validUntil: string | null; renewalLeadDays: number; conditions: string[]; linkedRiskIds: string[]; status: string; isActive: boolean; openTaskCount: number; nextDueDate: string | null; updatedAt: string | null };
export type ObligationListResponse = { items: Obligation[]; total: number; statusCounts: Record<string, number>; typeCounts: Record<string, number> };
export type ComplianceTask = { id: string; obligationId: string; obligationCode: string | null; obligationTitle: string | null; taskType: string; periodLabel: string; dueDate: string; status: string; attestedByName: string | null; attestedAt: string | null; verifiedByName: string | null; verifiedAt: string | null; capaId: string | null; waiverJustification: string | null; remarks: string | null; overdueDays: number; attachmentCount: number };
export type ComplianceAttachment = { id: string; taskId: string; fileName: string; mimeType: string | null; caption: string | null; uploadedByName: string | null; uploadedAt: string };
export type ObligationDetail = Obligation & { tasks: ComplianceTask[]; attachments: ComplianceAttachment[]; linkedRisks: { id: string; riskCode: string; title: string; residualBand: string | null }[] };
export type ComplianceDashboard = { totalObligations: number; compliantPct: number; dueSoon: number; overdue: number; underRenewal: number; typeCounts: Record<string, number>; siteSplit: Record<string, number>; renewalCalendar: { obligationCode: string; title: string; validUntil: string | null; daysToExpiry: number | null; status: string }[]; overdueTable: { obligationCode: string; title: string; owner: string | null; siteName: string | null; validUntil: string | null }[] };

export type LossEvent = { id: string; eventCode: string; title: string; description: string; eventDate: string; siteId: string | null; siteName: string | null; categoryId: string; categoryCode: string | null; categoryName: string | null; categoryColor: string | null; subCategoryId: string | null; linkedRiskIds: string[]; source: string; sourceIncidentId: string | null; isNearMiss: boolean; grossLossInr: number; recoveredInr: number; netLossInr: number; potentialLossInr: number | null; lossTypes: string[]; status: string; closureNotes: string | null; sourceUpdatedFlag: boolean; updatedAt: string | null };
export type LossListResponse = { items: LossEvent[]; total: number; statusCounts: Record<string, number>; netLossTotal: number; nearMissPotentialTotal: number };
export type CalibrationRow = { riskId: string; riskCode: string; title: string; categoryCode: string | null; residualScore: number | null; residualBand: string | null; actualNetLoss12m: number; lossEventCount: number; flag: string | null };
export type LossAnalytics = { netLossByCategory: { categoryCode: string; categoryName: string; colorHex: string; netLoss: number }[]; lossTrendByQuarter: { quarter: string; netLoss: number }[]; topLosses: { eventCode: string; title: string; netLoss: number; categoryCode: string | null }[]; nearMissPotential: { eventCode: string; title: string; potentialLoss: number | null }[]; calibration: CalibrationRow[] };

export type MetricCatalogEntry = { key: string; sourceModule: string; label: string; unit: string; direction: string; frequency: string; previewValue: number | null };
