"use client";

// Full entry editor — covers spec §4.3 sections 1 through 9.
//
// Sections 1 and 3 (activity, initial risk) are rendered read-only here; they
// were set at creation and changes go through a major-revision review.
// Section 2 (hazards) IS editable — consequence and the hazard-row regulatory
// citation are ISO 45001 cl.6.1.2.1 elements that have to be maintainable
// after creation, not frozen at it. Sections 4–9 are editable inline.
//
// Edits are classified server-side as material or minor: a material change
// (risk scores, hazard rows, control effectiveness, proposal status) drops the
// entry out of APPROVED into IN_REVIEW and has to be re-approved. See
// _classify_entry_change in routers/hira.py.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Save, ChevronDown, ShieldAlert, FileWarning } from "lucide-react";
import { RiskMatrixGrid } from "@/components/hira/risk-matrix-grid";
import { UserPicker } from "@/components/ui/user-picker";
import { parseApiError } from "@/lib/api-error";

type Likelihood = { id: string; score: number; label: string; description: string };
type Severity = { id: string; score: number; label: string; description: string };
type Cell = {
  likelihoodScore: number;
  severityScore: number;
  riskScore: number;
  riskLevel: string;
  colorHex: string;
  actionRequired: string;
  responseTimeDays: number;
};

type ExistingControl = {
  id: string;
  controlId: string | null;
  hierarchy: string;
  description: string;
  effectiveness: string | null;
  verificationMethod: string | null;
  verificationFreq: string | null;
  responsibleRole: string | null;
  evidenceAttached: boolean;
  documentReference: string | null;
  sortOrder: number;
};

type RecommendedControl = {
  id: string;
  hierarchy: string;
  description: string;
  rationale: string | null;
  estimatedCostBand: string | null;
  proposedImplementationDate: Date | null;
  responsibleId: string | null;
  status: string;
  capaId: string | null;
  evidenceAttached: boolean;
  documentReference: string | null;
};

type EntryHazard = {
  id: string;
  hazardId: string;
  contextualDescription: string | null;
  consequence: string | null;
  regulationRef: string | null;
  regulationSection: string | null;
  hazardRequiresPermit: boolean;
  hazardPermitTypes: string[];
  hazard: { id: string; code: string; category: string; name: string };
};

type RegulationRef = {
  id: string;
  regulation: string;
  section: string | null;
  requirementSummary: string | null;
};

type Capa = {
  id: string;
  number: string;
  description: string;
  status: string;
};

type EntryShape = {
  id: string;
  studyId: string;
  sequenceNumber: number;
  groupLabel: string | null;
  activityDescription: string;
  routine: string;
  frequency: string;
  typicalDurationMin: number | null;
  subLocation: string | null;
  area: { id: string; name: string } | null;
  personsEmployees: number;
  personsContractors: number;
  personsVisitors: number;
  personsPublic: number;
  affectedPersonGroups: string | null;
  equipmentUsed: string[];
  materialsUsed: string[];
  energySourcesPresent: string[];
  initialLikelihoodScore: number;
  initialLikelihoodRationale: string | null;
  initialSeverityScore: number;
  initialSeverityRationale: string | null;
  initialRiskScore: number;
  initialRiskLevel: string;
  initialRiskColor: string | null;
  initialLikelihood: Likelihood | null;
  initialSeverity: Severity | null;
  residualLikelihoodId: string | null;
  residualSeverityId: string | null;
  residualLikelihoodScore: number | null;
  residualSeverityScore: number | null;
  residualLikelihoodRationale: string | null;
  residualSeverityRationale: string | null;
  residualRiskScore: number | null;
  residualRiskLevel: string | null;
  residualRiskColor: string | null;
  residualAcceptable: boolean | null;
  residualAcceptanceRationale: string | null;
  residualAutoCalculated: boolean | null;
  initialAlarpRegion: string | null;
  residualAlarpRegion: string | null;
  alarpStatus: string | null;
  alarpFurtherControlsConsidered: boolean | null;
  alarpFurtherControlsDescription: string | null;
  alarpRiskReductionBenefit: string | null;
  alarpCostBand: string | null;
  alarpGrosslyDisproportionate: boolean | null;
  alarpJustification: string | null;
  alarpDemonstratedById: string | null;
  alarpDemonstratedAt: string | null;
  targetLikelihoodScore: number | null;
  targetSeverityScore: number | null;
  targetRiskScore: number | null;
  targetRiskLevel: string | null;
  targetRiskColor: string | null;
  targetAlarpRegion: string | null;
  targetRationale: string | null;
  unacceptableOverrideById: string | null;
  unacceptableOverrideAt: string | null;
  unacceptableOverrideJustification: string | null;
  unacceptableOverrideExpiresAt: string | null;
  unacceptableOverrideActive: boolean;
  status: string;
  versionNumber: number;
  triggersTrainingProgramIds: string[];
  triggersInspectionTypeIds: string[];
  influencesPtwRiskLevel: boolean;
  influencesPtwPermitTypes: string[];
  linkedEmergencyProcIds: string[];
  linkedEnvironmentalAspects: string[];
  lastReviewedAt: Date | null;
  nextReviewDue: Date | null;
  reviewCount: number;
  lastReviewType: string | null;
  hazards: EntryHazard[];
  existingControls: ExistingControl[];
  recommendedControls: RecommendedControl[];
  regulationRefs: RegulationRef[];
  capas: Capa[];
  study: { riskMatrixId: string };
};

const INPUT =
  "flex h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600";
const TEXTAREA =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600";

const HIERARCHY = [
  { code: "ELIMINATION", label: "Elimination" },
  { code: "SUBSTITUTION", label: "Substitution" },
  { code: "ENGINEERING", label: "Engineering" },
  { code: "ADMINISTRATIVE", label: "Administrative" },
  { code: "PPE", label: "PPE" }
];
const HIERARCHY_RANK: Record<string, number> = {
  ELIMINATION: 1,
  SUBSTITUTION: 2,
  ENGINEERING: 3,
  ADMINISTRATIVE: 4,
  PPE: 5
};

const EFFECTIVENESS = [
  { code: "EFFECTIVE", label: "Effective", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { code: "PARTIALLY_EFFECTIVE", label: "Partially effective", color: "bg-amber-100 text-amber-800 border-amber-300" },
  { code: "INEFFECTIVE", label: "Ineffective", color: "bg-rose-100 text-rose-800 border-rose-300" },
  { code: "NOT_VERIFIED", label: "Not verified", color: "bg-slate-100 text-slate-800 border-slate-300" }
];

// ── Residual-from-controls model ──────────────────────────────────────
// MIRRORS backend routers/hira.py (_suggest_residual_scores) — keep in sync.
// Each control removes a base number of scale-steps from likelihood and/or
// severity depending on its hierarchy, scaled by effectiveness. Multiple
// controls on one axis get diminishing returns (strongest full, rest at half).
const CONTROL_REDUCTION: Record<string, [number, number]> = {
  ELIMINATION: [4, 3],
  SUBSTITUTION: [2, 2],
  ENGINEERING: [2, 1],
  ADMINISTRATIVE: [1, 0],
  PPE: [0, 1]
};
const EFFECTIVENESS_FACTOR: Record<string, number> = {
  EFFECTIVE: 1.0,
  PARTIALLY_EFFECTIVE: 0.6,
  NOT_VERIFIED: 0.3,
  INEFFECTIVE: 0.0
};
// Unrated control → credited as partially effective so adding it visibly moves
// the residual (matches DEFAULT_EFFECTIVENESS_FACTOR in the backend).
const DEFAULT_EFFECTIVENESS_FACTOR = 0.6;

function axisReduction(contribs: number[]): number {
  const xs = contribs.filter((c) => c > 0).sort((a, b) => b - a);
  if (xs.length === 0) return 0;
  const total = xs[0] + 0.5 * xs.slice(1).reduce((a, b) => a + b, 0);
  return Math.floor(total + 0.5); // round half up (matches Python int(x + 0.5))
}

function suggestResidualScores(
  initialL: number,
  initialS: number,
  controls: { hierarchy: string; effectiveness: string | null }[]
): { likelihoodScore: number; severityScore: number; likelihoodReduction: number; severityReduction: number } {
  const lC: number[] = [];
  const sC: number[] = [];
  for (const c of controls) {
    const base = CONTROL_REDUCTION[(c.hierarchy || "").toUpperCase()];
    if (!base) continue;
    const factor = c.effectiveness
      ? EFFECTIVENESS_FACTOR[c.effectiveness] ?? DEFAULT_EFFECTIVENESS_FACTOR
      : DEFAULT_EFFECTIVENESS_FACTOR;
    lC.push(base[0] * factor);
    sC.push(base[1] * factor);
  }
  const likelihoodReduction = axisReduction(lC);
  const severityReduction = axisReduction(sC);
  return {
    likelihoodScore: Math.max(1, initialL - likelihoodReduction),
    severityScore: Math.max(1, initialS - severityReduction),
    likelihoodReduction,
    severityReduction
  };
}

const COST_BANDS = [
  { code: "LOW", label: "Low" },
  { code: "MEDIUM", label: "Medium" },
  { code: "HIGH", label: "High" },
  { code: "VERY_HIGH", label: "Very high" }
];

// ALARP tolerability banding — must mirror the backend DEFAULT_ALARP_BANDS.
const ALARP_DEFAULT_BANDS: Record<string, string> = {
  LOW: "BROADLY_ACCEPTABLE",
  MODERATE: "TOLERABLE",
  HIGH: "TOLERABLE",
  CRITICAL: "UNACCEPTABLE"
};

const ALARP_REGION_META: Record<
  string,
  { label: string; chip: string; banner: string; blurb: string }
> = {
  BROADLY_ACCEPTABLE: {
    label: "Broadly Acceptable",
    chip: "bg-emerald-100 text-emerald-800 border-emerald-300",
    banner: "border-emerald-300 bg-emerald-50 text-emerald-900",
    blurb:
      "Risk is broadly acceptable. No further action required beyond maintaining the existing controls and periodic review."
  },
  TOLERABLE: {
    label: "Tolerable — if ALARP",
    chip: "bg-amber-100 text-amber-900 border-amber-300",
    banner: "border-amber-300 bg-amber-50 text-amber-900",
    blurb:
      "Risk is tolerable only if reduced As Low As Reasonably Practicable. Complete the ALARP demonstration below — further reduction must be pursued unless its cost is grossly disproportionate to the benefit."
  },
  UNACCEPTABLE: {
    label: "Unacceptable",
    chip: "bg-rose-100 text-rose-800 border-rose-300",
    banner: "border-rose-300 bg-rose-50 text-rose-900",
    blurb:
      "Risk is unacceptable and must be reduced by adding controls. If it is accepted despite this, a documented acceptance rationale and senior sign-off are required."
  }
};

// ── ALARP cost-benefit guidance (advisory, safety-weighted) ──────────
// Predefined levels that turn the empirical forecast (residual→target) and the
// recommended-control costs into a *suggested* "grossly disproportionate?"
// verdict. Advisory only — the assessor always makes the final call.
const COST_WEIGHT: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 4, VERY_HIGH: 8 };
// Cost/effort implied by a control's place in the hierarchy — used to suggest a
// cost band when a recommended control has no explicit one.
const HIERARCHY_COST: Record<string, string> = {
  ELIMINATION: "HIGH",
  SUBSTITUTION: "HIGH",
  ENGINEERING: "MEDIUM",
  ADMINISTRATIVE: "LOW",
  PPE: "LOW"
};
// Benefit buckets from the residual→target risk-score reduction (predefined).
function benefitBucket(delta: number): "none" | "small" | "moderate" | "large" {
  if (delta <= 0) return "none";
  if (delta <= 2) return "small";
  if (delta <= 5) return "moderate";
  return "large";
}
const BENEFIT_WEIGHT: Record<string, number> = { none: 0, small: 1, moderate: 3, large: 6 };
// HSE gross-disproportion factor — the higher the residual risk, the more the
// cost must outweigh the benefit before acceptance is reasonable.
const RISK_GD_FACTOR: Record<string, number> = { LOW: 1, MODERATE: 2, HIGH: 3, CRITICAL: 4 };
// Safety-weighted: cost must exceed the risk-weighted benefit by this multiple
// before "accept as ALARP" is suggested.
const GROSS_DISPROPORTION_MULTIPLE = 3;

const PERMIT_TYPES = [
  "HOT_WORK",
  "CONFINED_SPACE",
  "WORK_AT_HEIGHT",
  "EXCAVATION",
  "ELECTRICAL_LOTO",
  "GENERAL_COLD"
];

export function EntryEditor({
  entry,
  matrix,
  controlLibrary,
  requireChangeReason,
  canApprove,
  canOverride = false,
  trainingPrograms = [],
  inspectionTemplates = [],
  plantId
}: {
  entry: EntryShape;
  matrix: {
    likelihoods: Likelihood[];
    severities: Severity[];
    cells: Cell[];
    acceptableResidual: Record<string, string>;
    alarpBands: Record<string, string> | null;
  };
  controlLibrary: { id: string; code: string; hierarchy: string; description: string }[];
  requireChangeReason: boolean;
  /** Whether the viewer holds HIRA.APPROVE for this entry. Gates the
   *  re-approval action only — the endpoint enforces it independently. */
  canApprove: boolean;
  /** Whether the viewer holds HIRA.OVERRIDE_UNACCEPTABLE (Plant Head /
   *  Corporate HSE). Gates authoring the Unacceptable-risk override. */
  canOverride?: boolean;
  trainingPrograms?: { id: string; name: string }[];
  inspectionTemplates?: { id: string; name: string }[];
  /** Plant the parent study belongs to — scopes the responsible-person picker
   *  on a recommended control to people who actually work at this site. */
  plantId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);

  // Section 2 — hazards (local working copy). Editable now: the consequence
  // and regulatory citation on a hazard row have to stay maintainable.
  const [hazards, setHazards] = useState<EntryHazard[]>(entry.hazards);

  // Section 4 — existing controls (local working copy)
  const [isDirty, setIsDirty] = useState(false);
  const [existingControls, setExistingControls] = useState<ExistingControl[]>(entry.existingControls);

  // Live entry status — updated from the save response so the re-approval
  // banner appears without a full reload.
  const [entryStatus, setEntryStatus] = useState(entry.status);
  const [reapprovalRaised, setReapprovalRaised] = useState(false);

  // Unacceptable-risk override (elevated, time-bounded). Local live copy so the
  // banner + approve gate update without a full reload.
  const [overrideActive, setOverrideActive] = useState(entry.unacceptableOverrideActive);
  const [overrideExpiresAt, setOverrideExpiresAt] = useState(entry.unacceptableOverrideExpiresAt);
  const [overrideJustification, setOverrideJustification] = useState("");
  const [overrideDays, setOverrideDays] = useState(90);

  // Section 5 — residual risk
  // Auto mode: residual is derived from the controls. Default to auto for an
  // as-yet-unassessed entry, but respect an explicit stored flag; legacy rows
  // that already have a hand-picked residual (flag null) stay manual so we
  // never silently recompute an approved risk rating.
  const [autoResidual, setAutoResidual] = useState<boolean>(
    entry.residualAutoCalculated ?? entry.residualLikelihoodScore == null
  );
  const [residualL, setResidualL] = useState<number | undefined>(
    entry.residualLikelihoodScore ?? undefined
  );
  const [residualS, setResidualS] = useState<number | undefined>(
    entry.residualSeverityScore ?? undefined
  );
  const [residualLRationale, setResidualLRationale] = useState(entry.residualLikelihoodRationale ?? "");
  const [residualSRationale, setResidualSRationale] = useState(entry.residualSeverityRationale ?? "");
  const [acceptanceRationale, setAcceptanceRationale] = useState(entry.residualAcceptanceRationale ?? "");

  // Section 5b — ALARP demonstration (structured cost-benefit test for the
  // tolerable region). Mirrors the backend evaluation in routers/hira.py.
  const [alarpFurtherConsidered, setAlarpFurtherConsidered] = useState<boolean | null>(
    entry.alarpFurtherControlsConsidered
  );
  const [alarpFurtherDesc, setAlarpFurtherDesc] = useState(entry.alarpFurtherControlsDescription ?? "");
  const [alarpBenefit, setAlarpBenefit] = useState(entry.alarpRiskReductionBenefit ?? "");
  const [alarpCostBand, setAlarpCostBand] = useState(entry.alarpCostBand ?? "");
  const [alarpGrossly, setAlarpGrossly] = useState<boolean | null>(entry.alarpGrosslyDisproportionate);
  const [alarpJustification, setAlarpJustification] = useState(entry.alarpJustification ?? "");

  // Section 6 — recommended controls
  const [recommendedControls, setRecommendedControls] = useState<RecommendedControl[]>(
    entry.recommendedControls
  );

  // Section 6b — target (forecast) risk after the recommended controls land.
  const [targetL, setTargetL] = useState<number | undefined>(entry.targetLikelihoodScore ?? undefined);
  const [targetS, setTargetS] = useState<number | undefined>(entry.targetSeverityScore ?? undefined);
  const [targetRationale, setTargetRationale] = useState(entry.targetRationale ?? "");

  // Section 7 — cross-module links
  const [triggersTraining, setTriggersTraining] = useState<string[]>(entry.triggersTrainingProgramIds);
  const [triggersInspection, setTriggersInspection] = useState<string[]>(entry.triggersInspectionTypeIds);
  const [influencesPtw, setInfluencesPtw] = useState<boolean>(entry.influencesPtwRiskLevel);
  const [ptwPermitTypes, setPtwPermitTypes] = useState<string[]>(entry.influencesPtwPermitTypes);

  // Section 8 — regulation refs
  const [regulationRefs, setRegulationRefs] = useState<RegulationRef[]>(entry.regulationRefs);

  // Change reason
  const [changeReason, setChangeReason] = useState("");

  // Auto-calc suggestion — derived live from the existing-controls working copy.
  const residualSuggestion = useMemo(
    () =>
      suggestResidualScores(
        entry.initialLikelihoodScore,
        entry.initialSeverityScore,
        existingControls.map((c) => ({ hierarchy: c.hierarchy, effectiveness: c.effectiveness }))
      ),
    [entry.initialLikelihoodScore, entry.initialSeverityScore, existingControls]
  );

  // Effective residual scores: derived from controls in auto mode, otherwise
  // the assessor's manual matrix pick.
  const effResidualL = autoResidual ? residualSuggestion.likelihoodScore : residualL;
  const effResidualS = autoResidual ? residualSuggestion.severityScore : residualS;

  // Computed: residual risk cell
  const residualCell = useMemo(() => {
    if (!effResidualL || !effResidualS) return null;
    return (
      matrix.cells.find((c) => c.likelihoodScore === effResidualL && c.severityScore === effResidualS) ?? null
    );
  }, [effResidualL, effResidualS, matrix.cells]);

  // Computed: residual level, ALARP region, and acceptability.
  const acceptableThreshold = matrix.acceptableResidual[entry.routine.toLowerCase()] as string | undefined;
  const residualLevel = residualCell?.riskLevel;
  const order = ["LOW", "MODERATE", "HIGH", "CRITICAL"];

  const alarpBands = matrix.alarpBands ?? ALARP_DEFAULT_BANDS;
  const regionForLevel = (lvl: string | null | undefined): string | null =>
    lvl ? alarpBands[lvl] ?? ALARP_DEFAULT_BANDS[lvl] ?? null : null;
  const initialRegion = regionForLevel(entry.initialRiskLevel);
  const residualRegion = regionForLevel(residualLevel);
  const regionMeta = residualRegion ? ALARP_REGION_META[residualRegion] : null;

  // Target (forecast) risk cell + its ALARP region.
  const targetCell = useMemo(() => {
    if (!targetL || !targetS) return null;
    return matrix.cells.find((c) => c.likelihoodScore === targetL && c.severityScore === targetS) ?? null;
  }, [targetL, targetS, matrix.cells]);
  const targetLevel = targetCell?.riskLevel ?? null;
  const targetRegion = regionForLevel(targetLevel);
  // Guard: a forecast should reduce risk, not raise it above today's residual.
  const targetWorseThanResidual =
    !!targetLevel && !!residualLevel && order.indexOf(targetLevel) > order.indexOf(residualLevel);

  // ── Advisory ALARP cost-benefit guidance ──
  // Empirical benefit from the forecast (residual→target) + a suggested cost
  // band from the recommended controls → a safety-weighted suggested verdict.
  const alarpGuidance = useMemo(() => {
    // Suggested cost band = the costliest recommended control (explicit band, or
    // inferred from its hierarchy).
    let suggestedCost: string | null = null;
    let maxRank = 0;
    for (const rc of recommendedControls) {
      const band = rc.estimatedCostBand || HIERARCHY_COST[(rc.hierarchy || "").toUpperCase()] || null;
      if (band && (COST_WEIGHT[band] ?? 0) > maxRank) {
        maxRank = COST_WEIGHT[band];
        suggestedCost = band;
      }
    }

    const residualScore = residualCell?.riskScore ?? null;
    const targetScore = targetCell?.riskScore ?? null;
    if (residualScore == null || targetScore == null || !residualLevel) {
      return { hasTarget: false, suggestedCost, benefit: null, suggestion: null };
    }

    const delta = residualScore - targetScore;
    const bucket = benefitBucket(delta);
    const benefit = {
      delta,
      bucket,
      residualScore,
      targetScore,
      residualLevel: residualLevel ?? "",
      targetLevel: targetLevel ?? "",
      bandImproved: !!residualRegion && !!targetRegion && residualRegion !== targetRegion
    };

    // Verdict suggestion — needs a cost band (chosen, else suggested).
    const costBand = alarpCostBand || suggestedCost;
    let suggestion: { grossly: boolean; label: string; reason: string } | null = null;
    if (costBand && COST_WEIGHT[costBand]) {
      const riskFactor = RISK_GD_FACTOR[residualLevel] ?? 2;
      const adjBenefit = BENEFIT_WEIGHT[bucket] * riskFactor;
      const costW = COST_WEIGHT[costBand];
      const grossly = bucket === "none" ? costW > 0 : costW > adjBenefit * GROSS_DISPROPORTION_MULTIPLE;
      const bandTxt = costBand.toLowerCase().replace("_", " ");
      suggestion = grossly
        ? {
            grossly: true,
            label: "May accept as ALARP",
            reason:
              bucket === "none"
                ? "The forecast target shows no further reduction, so additional controls buy nothing."
                : `Cost (${bandTxt}, weight ${costW}) grossly exceeds the risk-weighted benefit (${bucket} × risk ${riskFactor} = ${adjBenefit}).`
          }
        : {
            grossly: false,
            label: "Implement — reasonably practicable",
            reason: `Risk-weighted benefit (${bucket} × risk ${riskFactor} = ${adjBenefit}) is not grossly outweighed by the cost (${bandTxt}, weight ${costW}).`
          };
    }
    return { hasTarget: true, suggestedCost, benefit, suggestion };
  }, [recommendedControls, residualCell, targetCell, residualLevel, targetLevel, residualRegion, targetRegion, alarpCostBand]);

  const benefitSummaryText = alarpGuidance.benefit
    ? `Forecast: residual ${alarpGuidance.benefit.residualLevel} (${alarpGuidance.benefit.residualScore}) → target ${alarpGuidance.benefit.targetLevel} (${alarpGuidance.benefit.targetScore}); ${alarpGuidance.benefit.delta > 0 ? `${alarpGuidance.benefit.delta}-point reduction` : "no reduction"} (${alarpGuidance.benefit.bucket} benefit).`
    : "";

  // ALARP demonstration is complete when further controls were considered, the
  // cost was judged grossly disproportionate to the benefit, and it's justified.
  const alarpDemonstrated =
    alarpFurtherConsidered !== null && alarpGrossly === true && alarpJustification.trim().length > 0;
  const alarpStatus =
    residualRegion === "TOLERABLE"
      ? alarpDemonstrated
        ? "DEMONSTRATED"
        : "REQUIRED"
      : residualRegion
        ? "NOT_REQUIRED"
        : null;

  // Mirrors backend _evaluate_alarp: region gate + stricter-only legacy threshold.
  const thresholdOk =
    residualLevel && acceptableThreshold
      ? order.indexOf(residualLevel) <= order.indexOf(acceptableThreshold)
      : true;
  const regionOk =
    residualRegion === "BROADLY_ACCEPTABLE"
      ? true
      : residualRegion === "TOLERABLE"
        ? alarpDemonstrated
        : residualRegion === "UNACCEPTABLE"
          ? false
          : null;
  const residualAcceptable = regionOk === null ? null : regionOk && thresholdOk;

  // Gate for handing the entry to an approver. Mirrors what the server will
  // check at approve() time, so the assessor is told what is missing here
  // rather than being 409'd after the hand-off.
  const notReadyReason =
    existingControls.length === 0
      ? "Record the controls that are already in place (Section 4) — the residual is derived from them."
      : !residualLevel
        ? "Set the residual risk (Section 5) before submitting."
        : residualRegion === "UNACCEPTABLE"
          ? "The residual is Unacceptable. Reduce it with additional controls, or obtain a Plant Head / Corporate HSE override, before submitting."
          : residualRegion === "TOLERABLE" && !alarpDemonstrated
            ? "The residual is Tolerable, so the ALARP demonstration in Section 5 must be completed — further controls considered, a cost/effort verdict, and a written justification."
            : "";
  const readyForReview = notReadyReason === "";

  function save() {
    setError(null);
    setSuccess(false);
    if (requireChangeReason && !changeReason.trim()) {
      setError("This study is approved/active. A change reason is required.");
      return;
    }
    // Consequence is required per ISO 45001 cl.6.1.2.1. Rows that arrived
    // already blank are grandfathered by the server, so only flag a row the
    // user has actually touched — otherwise a legacy entry becomes unsavable.
    const blanked = hazards.filter((h) => {
      const original = entry.hazards.find((o) => o.id === h.id);
      const wasPopulated = !!original?.consequence?.trim();
      return !h.consequence?.trim() && wasPopulated;
    });
    if (blanked.length > 0) {
      setError(
        `Consequence cannot be cleared once recorded: ${blanked
          .map((h) => h.hazard?.name ?? "hazard")
          .join(", ")}`
      );
      return;
    }
    // Note: an Unacceptable residual can be SAVED freely (assessment is honest
    // work-in-progress). It just cannot be APPROVED — the approve endpoint
    // blocks it unless an elevated Unacceptable-risk override is in force.

    startTransition(async () => {
      // 1. PATCH the entry main row.
      // In auto mode the server derives residual L/S from the controls, so we
      // only send the manual likelihood/severity when the assessor overrode.
      const entryPatch: any = {
        residualAutoCalculated: autoResidual,
        ...(autoResidual
          ? {}
          : {
              residualLikelihoodId:
                residualL && residualS
                  ? matrix.likelihoods.find((l) => l.score === residualL)?.id
                  : null,
              residualSeverityId:
                residualL && residualS
                  ? matrix.severities.find((s) => s.score === residualS)?.id
                  : null
            }),
        residualLikelihoodRationale: residualLRationale || null,
        residualSeverityRationale: residualSRationale || null,
        residualAcceptanceRationale: acceptanceRationale || null,
        // ALARP demonstration (server derives status, region and sign-off).
        alarpFurtherControlsConsidered: alarpFurtherConsidered,
        alarpFurtherControlsDescription: alarpFurtherDesc || null,
        alarpRiskReductionBenefit: alarpBenefit || null,
        alarpCostBand: alarpCostBand || null,
        alarpGrosslyDisproportionate: alarpGrossly,
        alarpJustification: alarpJustification || null,
        // Target (forecast) risk after recommended controls.
        targetLikelihoodId:
          targetL && targetS ? matrix.likelihoods.find((l) => l.score === targetL)?.id : null,
        targetSeverityId:
          targetL && targetS ? matrix.severities.find((s) => s.score === targetS)?.id : null,
        targetRationale: targetRationale || null,
        triggersTrainingProgramIds: triggersTraining,
        triggersInspectionTypeIds: triggersInspection,
        influencesPtwRiskLevel: influencesPtw,
        influencesPtwPermitTypes: ptwPermitTypes,
        affectedPersonGroups: entry.affectedPersonGroups,
        changeReason: requireChangeReason ? changeReason : undefined
        // changeTrigger is deliberately NOT sent. It used to be hardcoded to
        // "CORRECTION", which made every version look like a typo fix. The
        // server now classifies the edit and stamps MATERIAL_REVISION or
        // MINOR_REVISION itself.
      };

      const res = await fetch(`/api/hira/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entryPatch)
      });
      if (!res.ok) {
        setError(await parseApiError(res, "Save failed"));
        return;
      }
      const patchData = await res.json().catch(() => ({} as any));

      // Any of the child syncs can independently report that it forced a
      // re-approval; collect them all rather than letting the last one win.
      let raisedReapproval = false;
      let latestStatus: string = patchData?.status ?? entryStatus;

      // Steps 2-5 are part of the SAME logical save as the PATCH above, which
      // has already archived a version. skipVersion stops each child sync
      // filing its own HiraVersion row — four rows per Save, with the version
      // counter racing ahead of them, is what collided on the
      // (entryId, versionNumber) unique key and 500'd every later save.
      // changeReason still goes along so a standalone call is accepted.
      const childQs = requireChangeReason
        ? `?changeReason=${encodeURIComponent(changeReason)}&skipVersion=true`
        : "";

      // 2. Sync hazards. Wholesale replace keyed on hazardId — the server
      // reconciles in place so hazard-row ids (and any permit linked to them)
      // survive the save.
      const hzRes = await fetch(`/api/hira/entries/${entry.id}/hazards${childQs}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          hazards.map((h, i) => ({
            hazardId: h.hazardId,
            contextualDescription: h.contextualDescription,
            consequence: h.consequence,
            regulationRef: h.regulationRef,
            regulationSection: h.regulationSection,
            sortOrder: i
          }))
        )
      });
      if (!hzRes.ok) {
        setError(`Hazards — ${await parseApiError(hzRes, "save failed")}`);
        return;
      }
      const hzData = await hzRes.json().catch(() => ({} as any));
      if (hzData?.reapprovalRequired) raisedReapproval = true;
      if (hzData?.entryStatus) latestStatus = hzData.entryStatus;

      // 3. Sync existing controls (separate endpoint — implemented next)
      // For now we POST the whole array as a replace; granular CRUD comes next.
      const ecRes = await fetch(`/api/hira/entries/${entry.id}/existing-controls${childQs}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controls: existingControls })
      });
      if (!ecRes.ok) {
        setError(`Existing controls — ${await parseApiError(ecRes, "save failed")}`);
        return;
      }
      const ecData = await ecRes.json().catch(() => ({} as any));
      if (ecData?.reapprovalRequired) raisedReapproval = true;
      if (ecData?.entryStatus) latestStatus = ecData.entryStatus;

      // 4. Sync recommended controls
      const rcRes = await fetch(`/api/hira/entries/${entry.id}/recommended-controls${childQs}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controls: recommendedControls })
      });
      if (!rcRes.ok) {
        setError(`Recommended controls — ${await parseApiError(rcRes, "save failed")}`);
        return;
      }
      const rcData = await rcRes.json().catch(() => ({} as any));
      if (rcData?.reapprovalRequired) raisedReapproval = true;
      if (rcData?.entryStatus) latestStatus = rcData.entryStatus;

      // 5. Sync regulation refs
      const rrRes = await fetch(`/api/hira/entries/${entry.id}/regulation-refs`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refs: regulationRefs })
      });
      if (!rrRes.ok) {
        setError(`Regulation refs — ${await parseApiError(rrRes, "save failed")}`);
        return;
      }

      setSavedVersion(patchData?.versionNumber ?? null);
      setEntryStatus(latestStatus);
      setReapprovalRaised(raisedReapproval || latestStatus === "IN_REVIEW");
      setSuccess(true);
      setIsDirty(false);
      setChangeReason("");
      router.refresh();
    });
  }

  function updateHazard(id: string, patch: Partial<EntryHazard>) {
    setHazards((arr) => arr.map((h) => (h.id === id ? { ...h, ...patch } : h)));
    setIsDirty(true);
  }

  // Re-approval. Only reachable when a material edit has knocked the entry out
  // of APPROVED; the server enforces HIRA.APPROVE and the IN_REVIEW precondition
  // regardless of what the UI shows.
  function submitForApproval() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/hira/entries/${entry.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: null })
      });
      if (!res.ok) {
        setError(await parseApiError(res, "Re-approval failed"));
        return;
      }
      const data = await res.json().catch(() => ({} as any));
      setEntryStatus(data?.status ?? "APPROVED");
      setReapprovalRaised(false);
      setSuccess(true);
      router.refresh();
    });
  }

  // Hand the finished assessment to the approver. POST
  // /entries/{id}/submit-for-review has existed since Phase 1 but nothing in the
  // UI called it, so a DRAFT entry could never reach IN_REVIEW — and the
  // approve action below only appears from IN_REVIEW. The result was that no
  // HIRA entry could be approved through the app at all.
  function submitForReview() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/hira/entries/${entry.id}/submit-for-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: null })
      });
      if (!res.ok) {
        setError(await parseApiError(res, "Submit for review failed"));
        return;
      }
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      setEntryStatus((data?.status as string) ?? "IN_REVIEW");
      setSuccess(true);
      router.refresh();
    });
  }

  // Elevated Unacceptable-risk override. Records the time-bounded authorisation
  // that lets an Unacceptable residual be approved. HIRA.OVERRIDE_UNACCEPTABLE
  // is re-enforced server-side.
  function authorizeOverride() {
    setError(null);
    if (overrideJustification.trim().length < 10) {
      setError("A justification of at least 10 characters is required to authorise the override.");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/hira/entries/${entry.id}/override-unacceptable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ justification: overrideJustification.trim(), expiresInDays: overrideDays })
      });
      if (!res.ok) {
        setError(await parseApiError(res, "Override failed"));
        return;
      }
      const data = await res.json().catch(() => ({} as any));
      setOverrideActive(!!data?.unacceptableOverrideActive);
      setOverrideExpiresAt(data?.unacceptableOverrideExpiresAt ?? null);
      setOverrideJustification("");
      setSuccess(true);
      router.refresh();
    });
  }

  // Helper handlers for existing controls
  function addExistingControl() {
    setExistingControls((arr) => [
      ...arr,
      {
        id: `new-${Date.now()}-${arr.length}`,
        controlId: null,
        hierarchy: "ENGINEERING",
        description: "",
        effectiveness: null,
        verificationMethod: null,
        verificationFreq: null,
        responsibleRole: null,
        evidenceAttached: false,
        documentReference: null,
        sortOrder: arr.length
      }
    ]);
    setIsDirty(true);
  }
  function updateExistingControl(id: string, patch: Partial<ExistingControl>) {
    setExistingControls((arr) => arr.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setIsDirty(true);
  }
  function removeExistingControl(id: string) {
    setExistingControls((arr) => arr.filter((c) => c.id !== id));
    setIsDirty(true);
  }

  function addRecommendedControl() {
    setRecommendedControls((arr) => [
      ...arr,
      {
        id: `new-${Date.now()}-${arr.length}`,
        hierarchy: "ENGINEERING",
        description: "",
        rationale: null,
        estimatedCostBand: null,
        proposedImplementationDate: null,
        responsibleId: null,
        status: "PROPOSED",
        capaId: null,
        evidenceAttached: false,
        documentReference: null
      }
    ]);
    setIsDirty(true);
  }
  function updateRecommendedControl(id: string, patch: Partial<RecommendedControl>) {
    setRecommendedControls((arr) => arr.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setIsDirty(true);
  }
  function removeRecommendedControl(id: string) {
    setRecommendedControls((arr) => arr.filter((c) => c.id !== id));
    setIsDirty(true);
  }

  function addRegRef() {
    setRegulationRefs((arr) => [...arr, { id: `new-${Date.now()}-${arr.length}`, regulation: "", section: null, requirementSummary: null }]);
    setIsDirty(true);
  }
  function updateRegRef(id: string, patch: Partial<RegulationRef>) {
    setRegulationRefs((arr) => arr.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setIsDirty(true);
  }
  function removeRegRef(id: string) {
    setRegulationRefs((arr) => arr.filter((r) => r.id !== id));
    setIsDirty(true);
  }

  // Sort existing controls by hierarchy rank for display
  const sortedExisting = [...existingControls].sort(
    (a, b) => (HIERARCHY_RANK[a.hierarchy] ?? 99) - (HIERARCHY_RANK[b.hierarchy] ?? 99) || a.sortOrder - b.sortOrder
  );

  // Recommended visible only if there are some OR residual is unacceptable
  const showRecommended = recommendedControls.length > 0 || residualAcceptable === false;

  return (
    <div className="space-y-6">
      {/* Section 1 — Activity (read-only) */}
      <Section title="1 — Activity (read-only)">
        <div className="text-sm text-slate-800 whitespace-pre-wrap">{entry.activityDescription}</div>
        <Grid>
          <ReadField label="Routine">{entry.routine}</ReadField>
          <ReadField label="Frequency">{entry.frequency}</ReadField>
          <ReadField label="Area">{entry.area?.name ?? "—"}</ReadField>
          <ReadField label="Sub-location">{entry.subLocation ?? "—"}</ReadField>
          <ReadField label="Duration (min)">{entry.typicalDurationMin ?? "—"}</ReadField>
          <ReadField label="Persons exposed">
            E:{entry.personsEmployees} · C:{entry.personsContractors} · V:{entry.personsVisitors} · P:{entry.personsPublic}
          </ReadField>
        </Grid>
        {entry.affectedPersonGroups && (
          <ReadField label="Affected person groups">{entry.affectedPersonGroups}</ReadField>
        )}
      </Section>

      {/* Section 2 — Hazards (editable) */}
      <Section title={`2 — Hazards (${hazards.length})`}>
        {hazards.length === 0 ? (
          <div className="text-sm text-slate-500">No hazards identified.</div>
        ) : (
          <ul className="space-y-3">
            {hazards.map((h) => (
              <li key={h.id} className="rounded border bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm">{h.hazard?.name ?? "Hazard"}</div>
                  <div className="flex items-center gap-1.5">
                    {h.hazardRequiresPermit && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                        <ShieldAlert size={11} /> Permit required
                      </span>
                    )}
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                      {(h.hazard?.category ?? "").replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                <div className="mt-2">
                  <label className="block text-[10px] uppercase text-slate-500 mb-0.5">
                    How this hazard manifests in this activity
                  </label>
                  <textarea
                    className={TEXTAREA}
                    rows={2}
                    value={h.contextualDescription ?? ""}
                    onChange={(e) =>
                      updateHazard(h.id, { contextualDescription: e.target.value || null })
                    }
                    placeholder="Optional context"
                  />
                </div>

                {/* Consequence — always rendered, never hidden when empty, so a
                    missing value is visible rather than silently absent. */}
                <div className="mt-2">
                  <label className="block text-[10px] uppercase text-slate-500 mb-0.5">
                    Consequence <span className="text-rose-600">*</span>
                  </label>
                  <textarea
                    className={`${TEXTAREA} ${
                      !h.consequence?.trim() ? "border-amber-400 bg-amber-50/40" : ""
                    }`}
                    rows={2}
                    value={h.consequence ?? ""}
                    onChange={(e) => updateHazard(h.id, { consequence: e.target.value || null })}
                    placeholder="Worst credible outcome if this hazard is realised"
                  />
                  {!h.consequence?.trim() && (
                    <div className="mt-1 flex items-start gap-1 text-[11px] text-amber-800">
                      <FileWarning size={12} className="mt-0.5 shrink-0" />
                      <span>
                        Not recorded. ISO 45001 cl.6.1.2.1 expects the consequence as a distinct
                        element — add it on the next revision of this row.
                      </span>
                    </div>
                  )}
                </div>

                {/* Hazard-row regulatory citation — distinct from the entry-level
                    Section 8 list, which cites the activity rather than the hazard. */}
                <div className="mt-2 grid grid-cols-12 gap-2">
                  <div className="col-span-7">
                    <label className="block text-[10px] uppercase text-slate-500 mb-0.5">
                      Regulation (this hazard)
                    </label>
                    <input
                      className={INPUT}
                      value={h.regulationRef ?? ""}
                      onChange={(e) => updateHazard(h.id, { regulationRef: e.target.value || null })}
                      placeholder="e.g. Factories Act 1948"
                    />
                  </div>
                  <div className="col-span-5">
                    <label className="block text-[10px] uppercase text-slate-500 mb-0.5">
                      Section / rule
                    </label>
                    <input
                      className={INPUT}
                      value={h.regulationSection ?? ""}
                      onChange={(e) =>
                        updateHazard(h.id, { regulationSection: e.target.value || null })
                      }
                      placeholder="e.g. s. 36A"
                    />
                  </div>
                </div>

                {h.hazardRequiresPermit && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-2">
                    <span className="text-xs text-amber-900">
                      This hazard requires a work permit
                      {h.hazardPermitTypes?.length
                        ? ` (${h.hazardPermitTypes.map((t) => t.replace(/_/g, " ")).join(", ")})`
                        : ""}
                      .
                    </span>
                    {isDirty ? (
                      <span className="text-[11px] text-amber-800">
                        Save this entry before raising a permit.
                      </span>
                    ) : (
                      <a
                        href={`/ptw/new?hiraEntryId=${entry.id}&hiraEntryHazardId=${h.id}`}
                        className="inline-flex items-center gap-1 rounded border border-amber-400 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                      >
                        <ShieldAlert size={12} /> Create PTW
                      </a>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Section 3 — Initial risk (read-only) */}
      <Section title="3 — Initial Risk (read-only)">
        <div className="flex items-center gap-4">
          <RiskChip level={entry.initialRiskLevel} score={entry.initialRiskScore} large />
          <div className="text-sm text-slate-700">
            <div>
              <span className="text-slate-500">Likelihood:</span> {entry.initialLikelihood?.label} (
              {entry.initialLikelihoodScore})
            </div>
            <div>
              <span className="text-slate-500">Severity:</span> {entry.initialSeverity?.label} (
              {entry.initialSeverityScore})
            </div>
          </div>
        </div>
        {(entry.initialLikelihoodRationale || entry.initialSeverityRationale) && (
          <Grid>
            <ReadField label="Likelihood rationale">{entry.initialLikelihoodRationale ?? "—"}</ReadField>
            <ReadField label="Severity rationale">{entry.initialSeverityRationale ?? "—"}</ReadField>
          </Grid>
        )}
      </Section>

      {/* Section 4 — Existing controls */}
      <Section
        title={`4 — Existing Controls (${existingControls.length})`}
        cta={
          <button
            type="button"
            onClick={addExistingControl}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-slate-300 hover:border-primary-500 hover:text-primary-700"
          >
            <Plus size={12} /> Add control
          </button>
        }
      >
        {sortedExisting.length === 0 ? (
          <div className="rounded border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
            No controls recorded. Document what's in place today.
          </div>
        ) : (
          <div className="space-y-2">
            {sortedExisting.map((c) => (
              <div key={c.id} className="rounded border bg-white p-3">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-3">
                    <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Hierarchy</label>
                    <select
                      className={INPUT}
                      value={c.hierarchy}
                      onChange={(e) => updateExistingControl(c.id, { hierarchy: e.target.value, controlId: null })}
                    >
                      {HIERARCHY.map((h) => (
                        <option key={h.code} value={h.code}>
                          {h.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] uppercase text-slate-500 mb-0.5">From library</label>
                    <select
                      className={INPUT}
                      value={c.controlId ?? ""}
                      onChange={(e) => {
                        const lib = controlLibrary.find((x) => x.id === e.target.value);
                        updateExistingControl(c.id, {
                          controlId: e.target.value || null,
                          ...(lib
                            ? { hierarchy: lib.hierarchy, description: lib.description }
                            : {})
                        });
                      }}
                    >
                      <option value="">— Custom —</option>
                      {controlLibrary
                        .filter((l) => l.hierarchy === c.hierarchy)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.description.slice(0, 60)}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Effectiveness</label>
                    <select
                      className={INPUT}
                      value={c.effectiveness ?? ""}
                      onChange={(e) =>
                        updateExistingControl(c.id, { effectiveness: e.target.value || null })
                      }
                    >
                      <option value="">— Select —</option>
                      {EFFECTIVENESS.map((e) => (
                        <option key={e.code} value={e.code}>
                          {e.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Responsible role</label>
                    <input
                      className={INPUT}
                      value={c.responsibleRole ?? ""}
                      placeholder="e.g. Supervisor"
                      onChange={(e) =>
                        updateExistingControl(c.id, { responsibleRole: e.target.value || null })
                      }
                    />
                  </div>
                  <div className="col-span-1 flex items-end justify-end">
                    <button
                      type="button"
                      onClick={() => removeExistingControl(c.id)}
                      className="text-rose-600 hover:bg-rose-50 rounded p-1.5 mb-0.5"
                      aria-label="Remove control"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <textarea
                  className={`${TEXTAREA} mt-2`}
                  rows={2}
                  placeholder="Control description"
                  value={c.description}
                  onChange={(e) => updateExistingControl(c.id, { description: e.target.value })}
                />
                <div className="grid grid-cols-12 gap-2 mt-2 items-end">
                  <div className="col-span-5">
                    <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Verification method</label>
                    <input
                      className={INPUT}
                      value={c.verificationMethod ?? ""}
                      onChange={(e) =>
                        updateExistingControl(c.id, { verificationMethod: e.target.value || null })
                      }
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Frequency</label>
                    <input
                      className={INPUT}
                      value={c.verificationFreq ?? ""}
                      placeholder="e.g. Quarterly"
                      onChange={(e) =>
                        updateExistingControl(c.id, { verificationFreq: e.target.value || null })
                      }
                    />
                  </div>
                  <div className="col-span-4 flex flex-col gap-1">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={c.evidenceAttached}
                        onChange={(e) =>
                          updateExistingControl(c.id, {
                            evidenceAttached: e.target.checked,
                            documentReference: e.target.checked ? c.documentReference : null
                          })
                        }
                      />
                      Evidence on file
                    </label>
                    {c.evidenceAttached && (
                      <input
                        className={INPUT}
                        placeholder="Document / record reference"
                        value={c.documentReference ?? ""}
                        onChange={(e) =>
                          updateExistingControl(c.id, { documentReference: e.target.value || null })
                        }
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Section 5 — Residual risk */}
      <Section title="5 — Residual Risk (after controls)">
        {/* Auto-calc / manual-override mode bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            {autoResidual ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border bg-violet-100 text-violet-800 border-violet-300">
                ⚙ Auto-calculated from controls
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border bg-amber-100 text-amber-900 border-amber-300">
                ✎ Manual override
              </span>
            )}
            <span className="text-xs text-slate-500">
              {autoResidual
                ? "Residual updates automatically as you add or rate controls above."
                : "You set this residual by hand; changing controls no longer moves it."}
            </span>
          </div>
          {!autoResidual && (
            <button
              type="button"
              onClick={() => {
                setAutoResidual(true);
                setIsDirty(true);
              }}
              className="text-xs px-2.5 py-1 rounded border border-violet-300 text-violet-700 hover:bg-violet-50"
            >
              ↺ Auto-calculate from controls
            </button>
          )}
        </div>

        {autoResidual && (
          <div className="rounded-md border border-violet-200 bg-violet-50/60 px-3 py-2 text-xs text-violet-900">
            {residualSuggestion.likelihoodReduction === 0 && residualSuggestion.severityReduction === 0 ? (
              <>
                No reduction yet — the residual equals the initial rating. Add controls above (or raise their
                effectiveness) to lower it. Higher-hierarchy controls (elimination &gt; substitution &gt; engineering
                &gt; administrative &gt; PPE) reduce more.
              </>
            ) : (
              <>
                Derived from {existingControls.length} control{existingControls.length === 1 ? "" : "s"}: likelihood{" "}
                <strong>−{residualSuggestion.likelihoodReduction}</strong>, severity{" "}
                <strong>−{residualSuggestion.severityReduction}</strong> from the initial rating (L
                {entry.initialLikelihoodScore}/S{entry.initialSeverityScore}). Higher-hierarchy, more-effective
                controls reduce more. Click any cell to override this manually.
              </>
            )}
          </div>
        )}

        <p className="text-sm text-slate-600 mb-3">
          {autoResidual
            ? "The highlighted cell is derived from the controls above — adjust the controls to change it, or click a different cell to set the residual manually."
            : "With the controls above in place, click the matrix cell that reflects how the activity actually plays out today. Be honest about control effectiveness."}
        </p>
        <RiskMatrixGrid
          likelihoods={matrix.likelihoods}
          severities={matrix.severities}
          cells={matrix.cells}
          mode="selection"
          selectedLikelihood={effResidualL}
          selectedSeverity={effResidualS}
          onSelect={(l, s) => {
            // Clicking a cell is a manual override — leave auto mode.
            setAutoResidual(false);
            setResidualL(l);
            setResidualS(s);
            setIsDirty(true);
          }}
          caption={autoResidual ? "Residual Risk — auto-calculated from controls" : "Residual Risk — after stated controls"}
        />

        {residualCell && (
          <div
            className="mt-3 rounded-md border p-3"
            style={{ backgroundColor: residualCell.colorHex + "22" }}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium" style={{ color: residualCell.colorHex }}>
                  {residualCell.riskLevel} residual risk — score {residualCell.riskScore}
                </div>
                <div className="text-xs text-slate-700 mt-1">{residualCell.actionRequired}</div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {regionMeta && (
                  <span className={`text-xs px-2 py-0.5 rounded border font-medium ${regionMeta.chip}`}>
                    ALARP: {regionMeta.label}
                  </span>
                )}
                {residualAcceptable !== null && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded border ${
                      residualAcceptable
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : "bg-rose-100 text-rose-800 border-rose-300"
                    }`}
                  >
                    {residualAcceptable ? "✓ Acceptable" : "✗ Not yet acceptable"}
                  </span>
                )}
              </div>
            </div>
            {regionMeta && (
              <div className={`mt-2 rounded border px-2.5 py-1.5 text-xs ${regionMeta.banner}`}>
                {regionMeta.blurb}
              </div>
            )}
          </div>
        )}

        <Grid>
          <Field label="Likelihood rationale">
            <textarea
              className={TEXTAREA}
              rows={2}
              value={residualLRationale}
              onChange={(e) => { setResidualLRationale(e.target.value); setIsDirty(true); }}
            />
          </Field>
          <Field label="Severity rationale">
            <textarea
              className={TEXTAREA}
              rows={2}
              value={residualSRationale}
              onChange={(e) => { setResidualSRationale(e.target.value); setIsDirty(true); }}
            />
          </Field>
        </Grid>

        {/* ALARP demonstration — the reasonably-practicable test for a tolerable residual */}
        {residualRegion === "TOLERABLE" && (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50/40 p-3">
            <div className="flex items-center justify-between mb-2 gap-2">
              <h4 className="text-sm font-semibold text-amber-900">ALARP demonstration</h4>
              <span
                className={`text-[11px] px-2 py-0.5 rounded border font-medium ${
                  alarpStatus === "DEMONSTRATED"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : "bg-amber-100 text-amber-900 border-amber-300"
                }`}
              >
                {alarpStatus === "DEMONSTRATED" ? "✓ Demonstrated" : "Required — not yet demonstrated"}
              </span>
            </div>
            <p className="text-xs text-amber-800 mb-3">
              To accept a tolerable residual, show that reducing it further is not reasonably practicable — i.e. the
              cost/effort of additional controls is grossly disproportionate to the risk reduction gained.
            </p>

            <div className="space-y-3">
              <Field label="Were further risk-reduction controls considered?">
                <div className="flex gap-2">
                  {[
                    { v: true, l: "Yes" },
                    { v: false, l: "No" }
                  ].map((o) => (
                    <button
                      key={o.l}
                      type="button"
                      onClick={() => {
                        setAlarpFurtherConsidered(o.v);
                        setIsDirty(true);
                      }}
                      className={`px-3 py-1.5 text-sm rounded border ${
                        alarpFurtherConsidered === o.v
                          ? "bg-primary-600 text-white border-primary-600"
                          : "bg-white text-slate-700 border-slate-300 hover:border-primary-400"
                      }`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </Field>

              {alarpFurtherConsidered && (
                <Field label="Which further controls were evaluated?">
                  <textarea
                    className={TEXTAREA}
                    rows={2}
                    value={alarpFurtherDesc}
                    onChange={(e) => {
                      setAlarpFurtherDesc(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="e.g. full local exhaust ventilation, interlocked guarding, process automation…"
                  />
                </Field>
              )}

              {/* Additional risk-reduction benefit — quantified from the forecast */}
              <Field label="Additional risk-reduction benefit (from the forecast target)">
                {alarpGuidance.benefit ? (
                  <div className="rounded border border-slate-200 bg-white px-2.5 py-2 text-xs">
                    <div className="font-medium text-slate-800">
                      Residual {alarpGuidance.benefit.residualLevel} ({alarpGuidance.benefit.residualScore}) → Target{" "}
                      {alarpGuidance.benefit.targetLevel} ({alarpGuidance.benefit.targetScore})
                      {" — "}
                      {alarpGuidance.benefit.delta > 0
                        ? `${alarpGuidance.benefit.delta}-point reduction`
                        : "no reduction modelled"}{" "}
                      <span className="text-slate-500">
                        ({alarpGuidance.benefit.bucket} benefit
                        {alarpGuidance.benefit.bandImproved ? ", band improves" : ""})
                      </span>
                    </div>
                    <button
                      type="button"
                      className="mt-1 text-[11px] text-primary-600 hover:underline"
                      onClick={() => {
                        setAlarpBenefit(benefitSummaryText);
                        setIsDirty(true);
                      }}
                    >
                      Use this in the record
                    </button>
                  </div>
                ) : (
                  <div className="rounded border border-dashed border-amber-300 bg-amber-50/60 px-2.5 py-2 text-xs text-amber-800">
                    Set a <strong>Target risk</strong> forecast (in the Recommended Controls section) to quantify the
                    benefit empirically.
                  </div>
                )}
                <textarea
                  className={`${TEXTAREA} mt-2`}
                  rows={2}
                  value={alarpBenefit}
                  onChange={(e) => {
                    setAlarpBenefit(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="Optional note on the benefit (or click “Use this in the record” above)…"
                />
              </Field>

              <Field label="Cost / effort band of further controls">
                <select
                  className={INPUT}
                  value={alarpCostBand}
                  onChange={(e) => {
                    setAlarpCostBand(e.target.value);
                    setIsDirty(true);
                  }}
                >
                  <option value="">— select —</option>
                  {COST_BANDS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.label}
                    </option>
                  ))}
                </select>
                {alarpGuidance.suggestedCost && alarpCostBand !== alarpGuidance.suggestedCost && (
                  <button
                    type="button"
                    className="mt-1 text-[11px] text-primary-600 hover:underline"
                    onClick={() => {
                      setAlarpCostBand(alarpGuidance.suggestedCost!);
                      setIsDirty(true);
                    }}
                  >
                    Suggested: {COST_BANDS.find((b) => b.code === alarpGuidance.suggestedCost)?.label} — from the
                    recommended controls. Apply
                  </button>
                )}
              </Field>

              <Field label="Is the cost / effort grossly disproportionate to the benefit?">
                {alarpGuidance.suggestion ? (
                  <div
                    className={`mb-2 rounded border px-2.5 py-1.5 text-xs ${
                      alarpGuidance.suggestion.grossly
                        ? "border-amber-300 bg-amber-50 text-amber-900"
                        : "border-sky-300 bg-sky-50 text-sky-900"
                    }`}
                  >
                    <span className="font-medium">Suggested: {alarpGuidance.suggestion.label}.</span>{" "}
                    {alarpGuidance.suggestion.reason}
                    <span className="block mt-0.5 text-[10px] opacity-70">
                      Advisory only — you make the final call.
                    </span>
                  </div>
                ) : (
                  alarpGuidance.hasTarget && (
                    <div className="mb-2 text-[11px] text-slate-500">
                      Choose a cost / effort band to get a suggested verdict.
                    </div>
                  )
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAlarpGrossly(true);
                      setIsDirty(true);
                    }}
                    className={`px-3 py-1.5 text-sm rounded border ${
                      alarpGrossly === true
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : alarpGuidance.suggestion?.grossly === true
                          ? "bg-white text-slate-700 border-emerald-400 ring-1 ring-emerald-300"
                          : "bg-white text-slate-700 border-slate-300 hover:border-emerald-400"
                    }`}
                  >
                    Yes — risk is ALARP (accept)
                    {alarpGuidance.suggestion?.grossly === true && alarpGrossly !== true && (
                      <span className="ml-1 text-[10px] text-emerald-600">★ suggested</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAlarpGrossly(false);
                      setIsDirty(true);
                    }}
                    className={`px-3 py-1.5 text-sm rounded border ${
                      alarpGrossly === false
                        ? "bg-rose-600 text-white border-rose-600"
                        : alarpGuidance.suggestion?.grossly === false
                          ? "bg-white text-slate-700 border-sky-400 ring-1 ring-sky-300"
                          : "bg-white text-slate-700 border-slate-300 hover:border-rose-400"
                    }`}
                  >
                    No — further reduction is practicable
                    {alarpGuidance.suggestion?.grossly === false && alarpGrossly !== false && (
                      <span className="ml-1 text-[10px] text-sky-600">★ suggested</span>
                    )}
                  </button>
                </div>
              </Field>

              {alarpGrossly === false && (
                <div className="rounded border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-800">
                  Further reduction is reasonably practicable — add the control(s) as recommended actions below and
                  re-assess the residual. This residual is not yet ALARP.
                </div>
              )}

              <Field label="ALARP justification">
                <textarea
                  className={TEXTAREA}
                  rows={2}
                  value={alarpJustification}
                  onChange={(e) => {
                    setAlarpJustification(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="Record the reasoning for the verdict above — basis for gross disproportion, standards / good practice relied on, residual accepted…"
                />
              </Field>

              {entry.alarpDemonstratedAt && alarpStatus === "DEMONSTRATED" && (
                <div className="text-[11px] text-slate-500">
                  Last signed off {new Date(entry.alarpDemonstratedAt).toLocaleDateString()}.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Unacceptable region — warn-only: allow save but require a rationale */}
        {/* Unacceptable region — hard-blocked from approval. The ONLY way past
            is an elevated, time-bounded override; there is no free-text
            'acceptance'. */}
        {residualRegion === "UNACCEPTABLE" && (
          <div className="mt-4 rounded-md border-2 border-rose-400 bg-rose-50 p-3">
            <div className="flex items-start gap-2">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-rose-700" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-rose-900">
                  Unacceptable residual risk — cannot be approved
                </div>
                <div className="text-xs text-rose-800 mt-0.5">
                  Per ALARP, an Unacceptable risk must be reduced (add controls until the residual leaves the
                  Unacceptable band) or the activity stopped. It cannot simply be accepted.
                </div>

                {overrideActive ? (
                  <div className="mt-2 rounded border border-rose-300 bg-white px-2.5 py-2 text-xs text-rose-900">
                    <span className="font-semibold">⚠ Override in force</span>
                    {overrideExpiresAt && (
                      <> — expires {new Date(overrideExpiresAt).toLocaleDateString()}, then auto-flags for review.</>
                    )}
                    {entry.unacceptableOverrideJustification && (
                      <div className="mt-1 text-rose-800 italic">“{entry.unacceptableOverrideJustification}”</div>
                    )}
                  </div>
                ) : canOverride ? (
                  <div className="mt-2 space-y-2">
                    <div className="text-xs font-medium text-rose-900">
                      Elevated override (Plant Head / Corporate HSE)
                    </div>
                    <textarea
                      className={TEXTAREA}
                      rows={2}
                      value={overrideJustification}
                      onChange={(e) => setOverrideJustification(e.target.value)}
                      placeholder="Justification for accepting an Unacceptable residual (min 10 chars) — compensating measures, statutory basis, time-bound plan to reduce…"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-xs text-rose-900">Auto-review after</label>
                      <select
                        className="h-9 rounded-md border border-rose-300 bg-white px-2 text-sm"
                        value={overrideDays}
                        onChange={(e) => setOverrideDays(Number(e.target.value))}
                      >
                        {[30, 60, 90, 180].map((d) => (
                          <option key={d} value={d}>
                            {d} days
                          </option>
                        ))}
                      </select>
                      <Button onClick={authorizeOverride} disabled={pending} variant="destructive">
                        {pending ? "Authorising…" : "Authorise override"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-rose-800">
                    You cannot authorise acceptance of an Unacceptable risk. Reduce the residual, or escalate to a{" "}
                    <strong>Plant Head</strong> or <strong>Corporate HSE</strong> for an override.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* Section 6 — Recommended controls */}
      {showRecommended && (
        <Section
          title={`6 — Recommended Additional Controls (${recommendedControls.length})`}
          cta={
            <button
              type="button"
              onClick={addRecommendedControl}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-slate-300 hover:border-primary-500 hover:text-primary-700"
            >
              <Plus size={12} /> Add proposal
            </button>
          }
        >
          {recommendedControls.length === 0 ? (
            <div className="rounded border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
              Residual risk exceeds the acceptability threshold. Propose additional controls.
            </div>
          ) : (
            <div className="space-y-2">
              {recommendedControls.map((rc) => (
                <div key={rc.id} className="rounded border bg-white p-3">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-3">
                      <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Hierarchy</label>
                      <select
                        className={INPUT}
                        value={rc.hierarchy}
                        onChange={(e) => updateRecommendedControl(rc.id, { hierarchy: e.target.value })}
                      >
                        {HIERARCHY.map((h) => (
                          <option key={h.code} value={h.code}>
                            {h.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Cost band</label>
                      <select
                        className={INPUT}
                        value={rc.estimatedCostBand ?? ""}
                        onChange={(e) =>
                          updateRecommendedControl(rc.id, { estimatedCostBand: e.target.value || null })
                        }
                      >
                        <option value="">— —</option>
                        {COST_BANDS.map((cb) => (
                          <option key={cb.code} value={cb.code}>
                            {cb.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Proposed date</label>
                      <input
                        type="date"
                        className={INPUT}
                        value={rc.proposedImplementationDate ? new Date(rc.proposedImplementationDate).toISOString().slice(0, 10) : ""}
                        onChange={(e) =>
                          updateRecommendedControl(rc.id, {
                            proposedImplementationDate: e.target.value ? new Date(e.target.value) : null
                          })
                        }
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Status</label>
                      <select
                        className={INPUT}
                        value={rc.status}
                        onChange={(e) => updateRecommendedControl(rc.id, { status: e.target.value })}
                      >
                        {["PROPOSED", "APPROVED", "IN_PROGRESS", "IMPLEMENTED", "DEFERRED", "REJECTED"].map((s) => (
                          <option key={s} value={s}>
                            {s.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1 flex items-end justify-end">
                      <button
                        type="button"
                        onClick={() => removeRecommendedControl(rc.id)}
                        className="text-rose-600 hover:bg-rose-50 rounded p-1.5 mb-0.5"
                        aria-label="Remove proposal"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <textarea
                    className={`${TEXTAREA} mt-2`}
                    rows={2}
                    placeholder="Proposed control"
                    value={rc.description}
                    onChange={(e) => updateRecommendedControl(rc.id, { description: e.target.value })}
                  />
                  <textarea
                    className={`${TEXTAREA} mt-2`}
                    rows={2}
                    placeholder="Rationale — why this would close the gap"
                    value={rc.rationale ?? ""}
                    onChange={(e) => updateRecommendedControl(rc.id, { rationale: e.target.value || null })}
                  />
                  <div className="mt-2">
                    <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Responsible person</label>
                    <UserPicker
                      value={rc.responsibleId ?? null}
                      onChange={(userId) => updateRecommendedControl(rc.id, { responsibleId: userId })}
                      filter={{ plantId }}
                      placeholder="Select the action owner…"
                    />
                  </div>

                  {/* Evidence — ungated, exactly like Section 4's existing-control
                      pair. Deliberately NOT conditional on status=COMPLETED:
                      evidence often lands before the status is moved, and a
                      status-gated field just loses it. */}
                  <div className="mt-2 rounded border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={rc.evidenceAttached}
                        onChange={(e) =>
                          updateRecommendedControl(rc.id, {
                            evidenceAttached: e.target.checked,
                            documentReference: e.target.checked ? rc.documentReference : null
                          })
                        }
                      />
                      Evidence on file
                    </label>
                    {rc.evidenceAttached && (
                      <input
                        className={`${INPUT} mt-1.5`}
                        placeholder="Document / record reference"
                        value={rc.documentReference ?? ""}
                        onChange={(e) =>
                          updateRecommendedControl(rc.id, {
                            documentReference: e.target.value || null
                          })
                        }
                      />
                    )}
                  </div>

                  {rc.capaId && (
                    <div className="mt-2 text-xs text-slate-500">
                      Linked CAPA: <code className="px-1 rounded bg-slate-100">{rc.capaId.slice(0, 8)}…</code>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Target (forecast) risk — projected residual once these controls land */}
          <div className="mt-4 rounded-md border border-indigo-200 bg-indigo-50/40 p-3">
            <h4 className="text-sm font-semibold text-indigo-900">Target risk — forecast after these controls</h4>
            <p className="text-xs text-indigo-800 mt-0.5 mb-3">
              Where will the residual land once the recommended controls are implemented? This projects the ALARP
              reduction pathway — it does not change today&apos;s residual.
            </p>

            {/* Reduction pathway: Initial → Residual (today) → Target */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <PathwayStep label="Initial" level={entry.initialRiskLevel} region={initialRegion} />
              <span className="text-slate-400">→</span>
              <PathwayStep label="Residual (today)" level={residualLevel ?? null} region={residualRegion} />
              <span className="text-slate-400">→</span>
              <PathwayStep label="Target" level={targetLevel} region={targetRegion} muted={!targetLevel} />
            </div>

            <RiskMatrixGrid
              likelihoods={matrix.likelihoods}
              severities={matrix.severities}
              cells={matrix.cells}
              mode="selection"
              selectedLikelihood={targetL}
              selectedSeverity={targetS}
              onSelect={(l, s) => { setTargetL(l); setTargetS(s); setIsDirty(true); }}
              caption="Target Risk — after recommended controls"
            />

            {targetL && targetS && (
              <button
                type="button"
                onClick={() => { setTargetL(undefined); setTargetS(undefined); setIsDirty(true); }}
                className="mt-2 text-xs text-slate-500 hover:text-rose-600"
              >
                Clear target
              </button>
            )}

            {targetWorseThanResidual && (
              <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                Target risk is higher than today&apos;s residual — a forecast should reduce risk, not raise it. Re-check the
                target cell.
              </div>
            )}
            {targetRegion === "BROADLY_ACCEPTABLE" && !targetWorseThanResidual && (
              <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
                ✓ These controls are forecast to bring the risk into the Broadly Acceptable region.
              </div>
            )}

            {targetCell && (
              <div className="mt-3">
                <Field label="What gets us there? (controls / assumptions)">
                  <textarea
                    className={TEXTAREA}
                    rows={2}
                    value={targetRationale}
                    onChange={(e) => { setTargetRationale(e.target.value); setIsDirty(true); }}
                    placeholder="Which recommended controls drive this target, and any assumptions (effectiveness, timeline)…"
                  />
                </Field>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Section 7 — Cross-module links */}
      <Section title="7 — Cross-Module Linkages">
        <PickerList
          label="Triggers training"
          values={triggersTraining}
          options={trainingPrograms}
          onChange={(v) => { setTriggersTraining(v); setIsDirty(true); }}
          emptyFallbackPlaceholder="Paste training program ID and press Enter"
          emptyHint="Which training programs this hazard should trigger. Add from the list."
        />
        <PickerList
          label="Triggers inspection"
          values={triggersInspection}
          options={inspectionTemplates}
          onChange={(v) => { setTriggersInspection(v); setIsDirty(true); }}
          emptyFallbackPlaceholder="Paste inspection template ID and press Enter"
          emptyHint="Which inspection templates this hazard should trigger. Add from the list."
        />
        <div className="mt-3 flex flex-col gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={influencesPtw}
              onChange={(e) => { setInfluencesPtw(e.target.checked); setIsDirty(true); }}
            />
            This entry influences PTW risk level for permits in this area
          </label>
          {influencesPtw && (
            <div className="ml-6 flex flex-wrap gap-2">
              {PERMIT_TYPES.map((p) => (
                <label
                  key={p}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border cursor-pointer ${
                    ptwPermitTypes.includes(p)
                      ? "bg-primary-100 text-primary-800 border-primary-300"
                      : "bg-white text-slate-700 border-slate-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={ptwPermitTypes.includes(p)}
                    onChange={(e) => {
                      setPtwPermitTypes((arr) =>
                        e.target.checked ? [...arr, p] : arr.filter((x) => x !== p)
                      );
                      setIsDirty(true);
                    }}
                  />
                  {p.replace(/_/g, " ")}
                </label>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* Section 8 — Regulatory references */}
      <Section
        collapsible
        defaultOpen={regulationRefs.length > 0}
        title={`8 — Regulatory References (${regulationRefs.length})`}
        cta={
          <button
            type="button"
            onClick={addRegRef}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-slate-300 hover:border-primary-500 hover:text-primary-700"
          >
            <Plus size={12} /> Add reference
          </button>
        }
      >
        {regulationRefs.length === 0 ? (
          <div className="text-sm text-slate-500">No regulatory references attached.</div>
        ) : (
          <div className="space-y-2">
            {regulationRefs.map((r) => (
              <div key={r.id} className="rounded border bg-white p-3 grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Regulation</label>
                  <input
                    className={INPUT}
                    value={r.regulation}
                    onChange={(e) => updateRegRef(r.id, { regulation: e.target.value })}
                    placeholder="e.g. Factories Act 1948"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Section</label>
                  <input
                    className={INPUT}
                    value={r.section ?? ""}
                    onChange={(e) => updateRegRef(r.id, { section: e.target.value || null })}
                    placeholder="e.g. §41B"
                  />
                </div>
                <div className="col-span-4">
                  <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Requirement summary</label>
                  <input
                    className={INPUT}
                    value={r.requirementSummary ?? ""}
                    onChange={(e) => updateRegRef(r.id, { requirementSummary: e.target.value || null })}
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeRegRef(r.id)}
                    className="text-rose-600 hover:bg-rose-50 rounded p-1.5"
                    aria-label="Remove reference"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Section 9 — Review metadata (read-only) */}
      <Section collapsible defaultOpen={false} title="9 — Review Metadata">
        <Grid>
          <ReadField label="Last reviewed">
            {entry.lastReviewedAt ? new Date(entry.lastReviewedAt).toLocaleDateString() : "Not yet reviewed"}
          </ReadField>
          <ReadField label="Next review due">
            {entry.nextReviewDue ? new Date(entry.nextReviewDue).toLocaleDateString() : "—"}
          </ReadField>
          <ReadField label="Review count">{entry.reviewCount}</ReadField>
          <ReadField label="Last review type">{entry.lastReviewType ?? "—"}</ReadField>
        </Grid>
        {entry.capas.length > 0 && (
          <div className="mt-3">
            <div className="text-xs font-medium text-slate-600 mb-1">Linked CAPAs</div>
            <ul className="text-sm space-y-1">
              {entry.capas.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1">
                  <span className="font-mono text-xs">{c.number}</span>
                  <span className="text-xs">{c.description.slice(0, 80)}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200">{c.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-white border-t border-slate-200">
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-2 rounded border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm text-rose-900"
          >
            {error}
          </div>
        )}
        {success && (
          <div
            role="status"
            aria-live="polite"
            className="mb-2 rounded border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-900"
          >
            Saved. {savedVersion ? `Version ${savedVersion} created.` : ""}
          </div>
        )}

        {/* Ready-for-approval gate. A DRAFT entry that has a residual and, where
            the region demands it, a completed ALARP demonstration is ready to be
            handed to the approver. */}
        {(entryStatus === "DRAFT" || entryStatus === "FLAGGED_FOR_REVIEW") && (
          <div
            role="status"
            aria-live="polite"
            className="mb-2 rounded border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900"
          >
            <div className="flex items-start gap-2">
              <FileWarning size={15} className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="font-medium">
                  {readyForReview
                    ? "Assessment complete — ready to submit for approval."
                    : "Finish the assessment before submitting it for approval."}
                </div>
                <div className="mt-0.5 text-xs">
                  {readyForReview
                    ? "Submitting moves the entry to In Review and hands it to a holder of HIRA.APPROVE. You can still edit it while it is in review."
                    : notReadyReason}
                </div>
              </div>
              <Button
                onClick={submitForReview}
                disabled={pending || isDirty || !readyForReview}
                data-testid="hira-entry-submit-review"
              >
                {pending ? "Submitting…" : "Submit for approval"}
              </Button>
            </div>
            {isDirty && <div className="mt-1.5 pl-6 text-xs">Save your pending changes first.</div>}
          </div>
        )}

        {/* Re-approval gate. A material change (risk scores, hazard rows,
            control effectiveness, proposal status) drops the entry out of
            APPROVED server-side; this is the way back. */}
        {(entryStatus === "IN_REVIEW" || entryStatus === "PENDING_REAPPROVAL") && (
          <div
            role="status"
            aria-live="polite"
            className="mb-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            <div className="flex items-start gap-2">
              <ShieldAlert size={15} className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="font-medium">
                  {entryStatus === "PENDING_REAPPROVAL"
                    ? "A material change withdrew this entry's approval — re-approval required."
                    : "This entry is awaiting approval."}
                </div>
                <div className="text-xs mt-0.5">
                  {entryStatus === "PENDING_REAPPROVAL"
                    ? "The assessed risk or the basis for accepting it has changed, so the previous sign-off no longer covers it. Re-approve to return the entry to APPROVED."
                    : "The assessor has handed this entry over. Check the hazards, the controls and the ALARP demonstration, then approve to move it to APPROVED."}
                </div>
              </div>
              {canApprove && (
                <Button
                  onClick={submitForApproval}
                  disabled={pending || isDirty || (residualRegion === "UNACCEPTABLE" && !overrideActive)}
                  variant="success"
                >
                  {pending
                    ? "Approving…"
                    : entryStatus === "PENDING_REAPPROVAL"
                      ? "Re-approve entry"
                      : "Approve entry"}
                </Button>
              )}
            </div>
            {canApprove && isDirty && (
              <div className="text-xs mt-1.5 pl-6">Save your pending changes first.</div>
            )}
            {canApprove && residualRegion === "UNACCEPTABLE" && !overrideActive && (
              <div className="text-xs mt-1.5 pl-6 text-rose-800">
                Residual is Unacceptable — reduce it or obtain an override before approving.
              </div>
            )}
            {!canApprove && (
              <div className="text-xs mt-1.5 pl-6">
                You do not hold HIRA.APPROVE — route this to the study approver.
              </div>
            )}
          </div>
        )}

        {requireChangeReason && (
          <div className="mb-2">
            <input
              className={INPUT}
              placeholder="Change reason (required — captured on the new version)"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
            />
          </div>
        )}
        <div className="flex gap-2 items-center">
          <Button onClick={save} disabled={pending || !isDirty}>
            <Save size={14} className="mr-1" /> {pending ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setHazards(entry.hazards.map(h => ({...h})));
              setExistingControls(entry.existingControls.map(c => ({...c})));
              setRecommendedControls(entry.recommendedControls.map(c => ({...c})));
              setRegulationRefs(entry.regulationRefs.map(r => ({...r})));
              setAutoResidual(entry.residualAutoCalculated ?? entry.residualLikelihoodScore == null);
              setResidualL(entry.residualLikelihoodScore ?? undefined);
              setResidualS(entry.residualSeverityScore ?? undefined);
              setResidualLRationale(entry.residualLikelihoodRationale ?? "");
              setResidualSRationale(entry.residualSeverityRationale ?? "");
              setAcceptanceRationale(entry.residualAcceptanceRationale ?? "");
              setTriggersTraining(entry.triggersTrainingProgramIds);
              setTriggersInspection(entry.triggersInspectionTypeIds);
              setInfluencesPtw(entry.influencesPtwRiskLevel);
              setPtwPermitTypes(entry.influencesPtwPermitTypes);
              setChangeReason("");
              setIsDirty(false);
              router.refresh();
            }}
            disabled={pending}
          >
            Discard changes
          </Button>
          <div className="ml-auto text-xs text-slate-500">
            Version {entry.versionNumber} · status {entry.status}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  cta,
  children,
  collapsible = false,
  defaultOpen = true
}: {
  title: string;
  cta?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = collapsible ? open : true;
  return (
    <section className="rounded-xl border bg-white p-5">
      <div className={`flex items-center justify-between ${isOpen ? "mb-4" : ""}`}>
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-600 hover:text-slate-800"
          >
            <ChevronDown size={14} className={`transition-transform ${isOpen ? "" : "-rotate-90"}`} />
            {title}
          </button>
        ) : (
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600">{title}</h2>
        )}
        {cta}
      </div>
      {isOpen && <div className="space-y-3">{children}</div>}
    </section>
  );
}

const LEVEL_CHIP: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-300",
  MODERATE: "bg-amber-100 text-amber-800 border-amber-300",
  HIGH: "bg-orange-100 text-orange-900 border-orange-300",
  CRITICAL: "bg-rose-200 text-rose-900 border-rose-400 font-semibold"
};

// One step in the Initial → Residual → Target ALARP reduction pathway.
function PathwayStep({
  label,
  level,
  region,
  muted
}: {
  label: string;
  level: string | null;
  region: string | null;
  muted?: boolean;
}) {
  const regionMeta = region ? ALARP_REGION_META[region] : null;
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      {level ? (
        <span
          className={`inline-block px-2 py-0.5 text-xs rounded border ${
            LEVEL_CHIP[level] ?? "bg-slate-100 text-slate-800 border-slate-200"
          }`}
        >
          {level}
        </span>
      ) : (
        <span className="text-xs text-slate-400">{muted ? "not set" : "—"}</span>
      )}
      {regionMeta && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${regionMeta.chip}`}>{regionMeta.label}</span>
      )}
    </div>
  );
}

// Name-based multiselect over {id,name} options. Falls back to the raw-id
// ChipList when no options are available (e.g. the caller lacks read access to
// the source registry), so the field never becomes unusable.
function PickerList({
  label,
  values,
  options,
  onChange,
  emptyFallbackPlaceholder,
  emptyHint
}: {
  label: string;
  values: string[];
  options: { id: string; name: string }[];
  onChange: (v: string[]) => void;
  emptyFallbackPlaceholder?: string;
  emptyHint?: string;
}) {
  if (!options || options.length === 0) {
    return <ChipList label={label} values={values} onChange={onChange} placeholder={emptyFallbackPlaceholder} />;
  }
  const nameById = new Map(options.map((o) => [o.id, o.name]));
  const available = options.filter((o) => !values.includes(o.id));
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {values.length === 0 && <span className="text-xs text-slate-400">{emptyHint ?? "None selected."}</span>}
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-primary-50 text-primary-800 border border-primary-200"
          >
            {nameById.get(v) ?? v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-primary-400 hover:text-rose-600"
              aria-label="Remove"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <select
        className={INPUT}
        value=""
        onChange={(e) => {
          const id = e.target.value;
          if (id && !values.includes(id)) onChange([...values, id]);
        }}
      >
        <option value="">+ Add…</option>
        {available.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ReadField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm text-slate-800 mt-0.5">{children}</div>
    </div>
  );
}

function RiskChip({ level, score, large }: { level: string; score: number; large?: boolean }) {
  const colors: Record<string, string> = {
    LOW: "bg-emerald-100 text-emerald-800 border-emerald-300",
    MODERATE: "bg-amber-100 text-amber-800 border-amber-300",
    HIGH: "bg-orange-100 text-orange-900 border-orange-300",
    CRITICAL: "bg-rose-200 text-rose-900 border-rose-400 font-semibold"
  };
  return (
    <span
      className={`inline-block ${
        large ? "px-3 py-1 text-base" : "px-2 py-0.5 text-xs"
      } rounded border ${colors[level] ?? "bg-slate-100 text-slate-800 border-slate-200"}`}
    >
      {level} · {score}
    </span>
  );
}

function ChipList({
  label,
  values,
  onChange,
  placeholder
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-700 border"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-slate-400 hover:text-rose-600"
              aria-label="Remove"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        className={INPUT}
        value={input}
        placeholder={placeholder}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && input.trim()) {
            e.preventDefault();
            if (!values.includes(input.trim())) onChange([...values, input.trim()]);
            setInput("");
          }
        }}
      />
    </div>
  );
}
