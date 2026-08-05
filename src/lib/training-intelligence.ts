// Shared types + presentation metadata for the Training Intelligence surface —
// the person-risk dashboard that auto-flags workers with repeat safety-event
// involvement. Pure types + consts (no JSX) so both server and client
// components can import it.
//
// Backend contract lives under /api/training-engine/person-risk*. Colours
// follow the house convention: elevated → amber, high → orange, critical →
// rose; module badges INCIDENT → rose, NEAR_MISS → amber, OBSERVATION → sky.

// ─── Person-risk types ───────────────────────────────────────────────────────

export type RiskBand = "elevated" | "high" | "critical";

export type PersonRiskStatus =
  | "flagged"
  | "acknowledged"
  | "training_assigned"
  | "cleared";

export type RecommendedCompetency = {
  competencyId: string;
  name: string;
  fromEvents: number;
};

export type PersonRiskFlag = {
  id: string;
  plantId: string;
  personUserId: string;
  worker?: { name: string; role: string; department: string | null } | null;
  riskScore: number;
  riskBand: RiskBand;
  windowDays: number;
  incidentCount: number;
  nearMissCount: number;
  observationCount: number;
  sifCount: number;
  totalEvents: number;
  recommendedCompetencies: RecommendedCompetency[];
  mappedCompetencyIds: string[];
  assignmentIds: string[];
  status: PersonRiskStatus;
  flaggedAt: string | null;
  lastEvaluatedAt: string | null;
  acknowledgedBy: string | null;
  clearedBy: string | null;
};

export type PersonRiskListResponse = {
  items: PersonRiskFlag[];
  summary: {
    total: number;
    byBand: Record<string, number>;
    byStatus: Record<string, number>;
    critical: number;
    high: number;
  };
};

export type ContributingRecord = {
  module: string;
  id: string;
  ref: string | null;
  date: string | null;
  role: string | null;
  severity: string | null;
  sif: boolean;
};

export type PersonRiskFlagDetail = {
  id: string;
  status: PersonRiskStatus;
  assignmentIds: string[];
  acknowledgedBy: string | null;
  clearedBy: string | null;
  clearReason: string | null;
};

export type PersonRiskDetail = {
  personUserId: string;
  worker: {
    id: string;
    name: string;
    role: string;
    department: string | null;
    plantId: string;
    designation: string | null;
  };
  windowDays: number;
  flagged: boolean;
  riskScore: number;
  riskBand: RiskBand;
  reasons: string[];
  counts: {
    incident: number;
    nearMiss: number;
    observation: number;
    sif: number;
    total: number;
  };
  contributingRecords: ContributingRecord[];
  recommendedCompetencies: RecommendedCompetency[];
  flag: PersonRiskFlagDetail | null;
};

// ─── Mutation responses ──────────────────────────────────────────────────────

export type AssignResponse = { assigned: number; flagId: string; competencies: string[] };
export type FlagActionResponse = { id: string; status: PersonRiskStatus };
export type ScanResponse = { evaluated: number; flagged: number; assigned: number };

// ─── Presentation metadata ───────────────────────────────────────────────────

// Risk bands: elevated → amber, high → orange, critical → rose.
export const RISK_BAND_META: Record<
  RiskBand,
  { label: string; chip: string; text: string; dot: string }
> = {
  elevated: {
    label: "Elevated",
    chip: "bg-amber-100 text-amber-800 border-amber-200",
    text: "text-amber-700",
    dot: "bg-amber-500"
  },
  high: {
    label: "High",
    chip: "bg-orange-100 text-orange-800 border-orange-200",
    text: "text-orange-700",
    dot: "bg-orange-500"
  },
  critical: {
    label: "Critical",
    chip: "bg-rose-100 text-rose-800 border-rose-200",
    text: "text-rose-700",
    dot: "bg-rose-500"
  }
};

export const PERSON_RISK_STATUS_META: Record<
  string,
  { label: string; chip: string }
> = {
  flagged: { label: "Flagged", chip: "bg-rose-100 text-rose-800 border-rose-200" },
  acknowledged: { label: "Acknowledged", chip: "bg-sky-100 text-sky-800 border-sky-200" },
  training_assigned: {
    label: "Training assigned",
    chip: "bg-primary-100 text-primary-700 border-primary-200"
  },
  cleared: { label: "Cleared", chip: "bg-emerald-100 text-emerald-800 border-emerald-200" }
};

// Contributing-event module badges. Deep-link back to the source record.
export const EVENT_MODULE_META: Record<
  string,
  { label: string; chip: string; abbr: string }
> = {
  INCIDENT: { label: "Incident", chip: "bg-rose-100 text-rose-800 border-rose-200", abbr: "INC" },
  NEAR_MISS: { label: "Near Miss", chip: "bg-amber-100 text-amber-800 border-amber-200", abbr: "NM" },
  OBSERVATION: { label: "Observation", chip: "bg-sky-100 text-sky-800 border-sky-200", abbr: "OBS" }
};
