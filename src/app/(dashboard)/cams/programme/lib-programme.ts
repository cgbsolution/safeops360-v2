// Annual Audit Programme — shared types + presentation.
//
// Backend: app/routers/programme.py, app/services/programme/*
// Design:  docs/cams/08-audit-programme.md
//
// The distinction to hold on to while reading these types: **a slot is not an
// engagement.** The slot carries the PLAN (a window, an intended lead, an
// estimate); the engagement is what happened. Everything interesting — timing
// drift, scope variance, non-execution — lives in the gap between them.

export type CycleStatus = "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "ACTIVE" | "CLOSED";
export type SlotStatus =
  | "PLANNED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED"
  | "DEFERRED" | "CANCELLED" | "WAIVED";
export type CoverageState =
  | "COVERED_FULL" | "COVERED_SAMPLED" | "PARTIAL" | "UNCOVERED" | "OVERDUE" | "WAIVED";

export type ProgrammeCycleRow = {
  id: string;
  cycleLabel: string;
  status: CycleStatus;
  periodStart: string;
  periodEnd: string;
  periodsPerCycle: number;
  // Governance provenance. `submittedByUserId` is what makes four-eyes
  // enforceable on the pair that matters: the owner guard does not stop a
  // delegate approving their own submission.
  submittedByUserId?: string | null;
  submittedForReviewAt?: string | null;
  approvedByUserId?: string | null;
  approvedAt?: string | null;
  approvedSnapshotHash?: string | null;
  activatedAt?: string | null;
  closedAt?: string | null;
};

export type ProgrammeRow = {
  id: string;
  programmeCode: string;
  name: string;
  objectives: string;
  scopeStatement?: string;
  standardRefs: string[];
  ownerUserId: string;
  status: string;
  fullCoverageThresholdPct: number;
  cycles: ProgrammeCycleRow[];
};

/** One reason approval is refused, attached to the scope unit that caused it. */
export type ApprovalBlocker = {
  code:
    | "OBJECTIVES_MISSING" | "NO_SCOPE_UNITS" | "APPROVER_MISSING"
    | "APPROVER_IS_OWNER" | "APPROVER_IS_SUBMITTER" | "WAIVER_UNAPPROVED"
    | "FREQUENCY_MISSING" | "NO_SLOT" | "OVERLAPPING_CYCLE";
  message: string;
  scopeUnitId: string | null;
  scopeUnitLabel: string | null;
  siteId: string | null;
  siteName: string | null;
};

export type ApprovalReport = {
  cycleId: string;
  status: CycleStatus;
  canApprove: boolean;
  transitionAllowed: boolean;
  ownerUserId: string | null;
  submittedByUserId: string | null;
  blockers: ApprovalBlocker[];
  scopeUnitCount: number;
  slotCount: number;
};

export type ReviewRow = {
  id: string;
  reviewDate: string;
  participantUserIds: string[];
  externalParticipants: { name?: string; organisation?: string; role?: string }[];
  programmeFindings: string;
  decisions: string;
  effectivenessAssessment: string | null;
  resultingAmendmentIds: string[];
  reviewedByUserId: string;
  createdAt?: string | null;
};

/**
 * What a slot's plan implies for the engagement it becomes.
 *
 * Derived server-side from the slot's scope units, the programme's standards
 * and the slot's window — the client renders it, never computes it, so a stale
 * tab cannot schedule against scope that has since changed.
 */
export type SlotPlan = {
  slotId: string;
  slotCode: string;
  cycleId: string;
  programmeId: string | null;
  programmeName: string | null;
  status: SlotStatus;
  origin: "INTERNAL" | "EXTERNAL" | "UNPLANNED";
  windowStart: string;
  windowEnd: string;
  periodIndex: number;
  siteId: string | null;
  siteName: string | null;
  siteIds: string[];
  /** `{siteId: name}` for every id in `siteIds` — the picker labels itself. */
  siteNames: Record<string, string>;
  multiSite: boolean;
  disciplineCodes: string[];
  standardRefs: string[];
  intendedLeadUserId: string | null;
  estimatedAuditorDays: number;
  samplingApproach: string;
  samplingJustification: string | null;
  industryCode: string | null;
  matchedDisciplineCodes: string[];
  // Planned disciplines no active library can materialise. Surfaced rather than
  // dropped — a slot that quietly schedules 3 of its 5 planned disciplines is
  // the scope variance the programme exists to expose.
  unmatchedDisciplineCodes: string[];
  suggestedTitle: string;
  scopeUnits: {
    id: string; dimension: string; siteId: string | null; siteName: string;
    dimensionKey: string; dimensionLabel: string;
  }[];
  alreadyMaterialised: boolean;
  engagementKind: string | null;
  engagementId: string | null;
};

export type SlotDetail = {
  slot: SlotRow & { cycleId: string; ownerUserId: string | null; actualAuditorDays: number | null };
  plan: SlotPlan;
  programme: { id: string; name: string; programmeCode: string } | null;
  cycle: ProgrammeCycleRow | null;
  amendments: AmendmentRow[];
};

export type PeriodCell = {
  periodIndex: number;
  state: CoverageState;
  assessed: number;
  total: number;
  pct: number | null;
  label: string;
  engagements: {
    engagementKind: string; engagementId: string; code: string; status: string;
    assessed: number; total: number; scorePct: number | null; samplingApproach: string;
  }[];
};

export type CoverageAggregate = {
  counts: Record<CoverageState, number>;
  considered: number;
  covered: number;
  coveragePct: number | null;
  gaps: number;
  overdue: number;
  waived: number;
  sampledOnly: number;
};

export type ScopeUnitCoverage = CoverageAggregate & {
  scopeUnitId: string;
  dimension: string;
  dimensionKey: string;
  dimensionLabel: string;
  siteId: string | null;
  /** Resolved server-side. Never a cuid — see `siteText()`. */
  siteName: string;
  riskWeight: number;
  requiredPerCycle: number | null;
  rationale: string;
  // `isWaived` (bool) is distinct from the aggregate's `waived` (count). Naming
  // them the same collapsed the intersection type to `never` — and in the
  // backend payload the count was silently overwriting the flag.
  isWaived: boolean;
  waiverReason: string | null;
  periods: PeriodCell[];
  shortfall: number;
};

export type CoverageResponse = {
  cycleId: string;
  thresholdPct: number;
  periods: { periodIndex: number; start: string; end: string; closed: boolean; label: string }[];
  scopeUnits: ScopeUnitCoverage[];
  summary: CoverageAggregate & {
    scopeUnitCount: number; slotCount: number; materialisedSlotCount: number;
    unplannedSlotCount: number; externalSlotCount: number; collisionCount: number;
  };
  bySite: (CoverageAggregate & { siteId: string | null; siteName: string })[];
  gaps: {
    scopeUnitId: string; siteId: string | null; siteName: string;
    dimensionKey: string; dimensionLabel: string;
    periodIndex: number; state: CoverageState; riskWeight: number; assessedLabel: string;
  }[];
  auditorLoad: {
    userId: string; totalDays: number; byPeriod: Record<string, number>;
    slots: { slotId: string; slotCode: string; windowStart: string; windowEnd: string; periodIndex: number; days: number }[];
    collisions: { a: string; b: string; reason: string }[];
  }[];
};

export type VarianceRow = {
  slotId: string;
  slotCode: string;
  status: SlotStatus;
  origin: "INTERNAL" | "EXTERNAL" | "UNPLANNED";
  windowStart: string;
  windowEnd: string;
  engagement: {
    engagementKind: string; engagementId: string; code: string; title: string;
    status: string; actualDate: string | null; scorePct: number | null;
  } | null;
  timingDriftDays: number | null;
  isLate: boolean;
  plannedScopeKeys: string[];
  actualScopeKeys: string[];
  scopeVariance: string[];
  hasScopeVariance: boolean;
  estimatedAuditorDays: number;
  actualAuditorDays: number | null;
  notExecuted: boolean;
  amendmentCount: number;
};

export type AmendmentRow = {
  id: string;
  slotId: string | null;
  amendmentType: string;
  reason: string;
  beforeValue: Record<string, unknown> | null;
  afterValue: Record<string, unknown> | null;
  approvedByUserId: string;
  approvedAt: string | null;
};

export type ScopeUnitRow = {
  id: string;
  dimension: string;
  siteId: string | null;
  /** Resolved server-side. Never a cuid — see `siteText()`. */
  siteName: string;
  dimensionKey: string;
  dimensionLabel: string;
  requiredPerCycle: number | null;
  riskWeight: number;
  rationale: string;
  isWaived: boolean;
  waiverReason: string | null;
};

export type SlotRow = {
  id: string;
  slotCode: string;
  windowStart: string;
  windowEnd: string;
  periodIndex: number;
  origin: "INTERNAL" | "EXTERNAL" | "UNPLANNED";
  externalBody: string | null;
  engagementKind: string | null;
  engagementId: string | null;
  intendedLeadUserId: string | null;
  estimatedAuditorDays: number;
  samplingApproach: string;
  samplingJustification: string | null;
  status: SlotStatus;
  amendmentCount: number;
  scopeUnitIds: string[];
  // Supplied by the server so the state machine lives in ONE place
  // (lifecycle.SLOT_TRANSITIONS) rather than being re-implemented here and
  // drifting from it.
  allowedTransitions: SlotStatus[];
  notes: string | null;
};

export type RecommendationRow = {
  id?: string;
  scopeUnitId: string;
  currentFrequency: number | null;
  recommendedFrequency: number;
  score: number;
  band: "INCREASE" | "HOLD" | "REDUCE";
  inputs: {
    input: string; label: string; rawValue: number | null; available: boolean;
    weight: number; contribution: number; detail?: string;
  }[];
  unavailableInputs: string[];
  reductionVetoedBy: string[];
  narrative: string;
  computedAt?: string | null;
  acceptedAt?: string | null;
  acceptedFrequency?: number | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  // Open = neither accepted nor rejected. Accept/reject is offered only on these.
  isOpen?: boolean;
};

export type IntegrityReport = {
  cycleId: string;
  slotsNonPlannedWithoutEngagementOrAmendment: string[];
  scopeUnitsWithoutFrequencyOrWaiver: string[];
  clean: boolean;
};

// ── Presentation ─────────────────────────────────────────────────────

// Six states, and the two that matter most are visually distinct from green.
// "We sampled 8 of 40 and passed" is a different assurance claim from "we
// verified all 40", so COVERED_SAMPLED never renders as COVERED_FULL.
export const COVERAGE_META: Record<CoverageState, { label: string; dot: string; cell: string; glyph: string }> = {
  COVERED_FULL: { label: "Covered", dot: "bg-emerald-500", cell: "bg-emerald-50 text-emerald-800 border-emerald-200", glyph: "●" },
  COVERED_SAMPLED: { label: "Covered by sample", dot: "bg-teal-500", cell: "bg-teal-50 text-teal-800 border-teal-200", glyph: "▨" },
  PARTIAL: { label: "Partial", dot: "bg-amber-500", cell: "bg-amber-50 text-amber-900 border-amber-200", glyph: "◐" },
  UNCOVERED: { label: "Not covered", dot: "bg-slate-300", cell: "bg-slate-50 text-slate-500 border-slate-200", glyph: "○" },
  OVERDUE: { label: "Overdue", dot: "bg-rose-500", cell: "bg-rose-50 text-rose-800 border-rose-200", glyph: "!" },
  WAIVED: { label: "Waived", dot: "bg-violet-400", cell: "bg-violet-50 text-violet-700 border-violet-200", glyph: "—" },
};

export const CYCLE_STATUS_CHIP: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-300",
  UNDER_REVIEW: "bg-amber-50 text-amber-800 border-amber-200",
  APPROVED: "bg-sky-50 text-sky-800 border-sky-200",
  ACTIVE: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CLOSED: "bg-slate-100 text-slate-500 border-slate-200",
};

export const SLOT_STATUS_CHIP: Record<string, string> = {
  PLANNED: "bg-slate-100 text-slate-700 border-slate-300",
  SCHEDULED: "bg-sky-50 text-sky-800 border-sky-200",
  IN_PROGRESS: "bg-violet-50 text-violet-800 border-violet-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  DEFERRED: "bg-amber-50 text-amber-800 border-amber-200",
  CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
  WAIVED: "bg-violet-50 text-violet-700 border-violet-200",
};

export const ORIGIN_LABEL: Record<string, string> = {
  INTERNAL: "Internal",
  EXTERNAL: "External body",
  UNPLANNED: "Unplanned",
};

export const BAND_META: Record<string, { label: string; chip: string }> = {
  INCREASE: { label: "Increase frequency", chip: "bg-rose-50 text-rose-700 border-rose-200" },
  HOLD: { label: "Hold", chip: "bg-slate-100 text-slate-700 border-slate-300" },
  REDUCE: { label: "Candidate for reduction", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

/**
 * The one site-display rule on this module's screens.
 *
 * A `siteId` is a Plant cuid, and a cuid is not something an auditor or a plant
 * head can read — so nothing here ever renders one. The backend already
 * resolves `siteName` on every programme payload; this only covers the cases it
 * cannot: an older payload shape (`siteName` absent) and a null site, which
 * means estate-wide scope rather than missing data.
 *
 * `short` drops the estate-wide wording to a lowercase inline form for the
 * places it sits mid-sentence next to a discipline.
 */
export function siteText(
  site: { siteId?: string | null; siteName?: string | null } | null | undefined,
  opts: { short?: boolean } = {}
): string {
  const name = site?.siteName?.trim();
  if (name) return name;
  // No name and no id = the scope really is the whole estate.
  if (!site?.siteId) return opts.short ? "estate-wide" : "Estate-wide";
  // An id with no name resolved: a deleted plant, or a payload that predates
  // the enrichment. Say so — the cuid itself tells the reader nothing.
  return "Unknown site";
}

export function fmtDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export function pctLabel(v: number | null | undefined): string {
  return v == null ? "—" : `${v}%`;
}

/** Drift reads as "12 days late" / "3 days early" — a bare signed number does not. */
export function driftLabel(days: number | null): string {
  if (days == null) return "—";
  if (days === 0) return "on window";
  return days > 0 ? `${days}d late` : `${Math.abs(days)}d early`;
}
