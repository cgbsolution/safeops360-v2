// ────────────────────────────────────────────────────────────────────────
// MIS Dashboard personas + role-to-persona mapping.
//
// Brief asks for 4 personas (HSE Manager, Plant Head, Corporate HSE,
// CEO) — each with its own default widget layout. C5 hardcodes the
// layouts here; drag-drop editing + user-saved overrides land in a
// future commit, but the layout shape stays compatible with eventual
// persistence (it's already a JSON-serialisable structure).
//
// Adding a new persona is a 2-step:
//   1. Add to PERSONA_KEYS
//   2. Add the corresponding layout to PERSONA_LAYOUTS
// ────────────────────────────────────────────────────────────────────────

import type { KpiCode } from "./kpi-registry";

export const PERSONA_KEYS = ["plant-hse-manager", "plant-head", "corporate-hse", "ceo"] as const;
export type PersonaKey = (typeof PERSONA_KEYS)[number];

export const PERSONA_LABELS: Record<PersonaKey, string> = {
  "plant-hse-manager": "Plant HSE Manager",
  "plant-head": "Plant Head",
  "corporate-hse": "Corporate HSE",
  ceo: "CEO / Board"
};

/** Map a user role to its default persona. ADMIN gets the highest-
 *  level view; users without a recognised role get an empty result —
 *  the dashboard page handles that with a friendly fallback. */
export function personaForRole(role: string | null | undefined): PersonaKey | null {
  if (!role) return null;
  switch (role) {
    case "HSE_MANAGER":
      return "plant-hse-manager";
    case "PLANT_HEAD":
      return "plant-head";
    case "CORPORATE_HSE":
      return "corporate-hse";
    case "CEO":
    case "MD":
    case "DIRECTOR":
      return "ceo";
    case "ADMIN":
      return "corporate-hse"; // most expansive view
    default:
      return null;
  }
}

// ─── Widget catalog ───────────────────────────────────────────────

/** The discriminator the dashboard renderer switches on. Keep this
 *  in sync with the actual widget components in src/components/widgets/. */
export type WidgetKind =
  | "DAYS_SINCE_LTI"
  | "KPI_TILE"
  | "KPI_GAUGE"
  | "KPI_TREND_LINE"
  | "MULTI_KPI_TREND"
  | "PLANT_COMPARISON_BAR"
  | "PERFORMANCE_SCORECARD"
  | "OPEN_ITEMS_COUNTER"
  | "SUBMISSION_STATUS_MINI"
  | "HEINRICH_PYRAMID";

export interface WidgetConfig {
  kind: WidgetKind;
  /** Span across the 12-column grid. Renderer enforces. */
  cols: 3 | 4 | 6 | 8 | 12;
  /** Display title override — falls back to widget default if omitted. */
  title?: string;
  /** Per-widget data hints (KPI code, scope-overrides, etc.). */
  options?: {
    kpiCode?: KpiCode;
    /** "company" forces company-wide scope regardless of user.plantId.
     *  Default is "user-plant" — uses session.user.plantId. */
    scopeMode?: "user-plant" | "company";
    /** For MULTI_KPI_TREND. */
    kpiCodes?: KpiCode[];
    /** Months of history to plot (trend widgets). Default 12. */
    months?: number;
  };
}

export interface PersonaLayout {
  title: string;
  description: string;
  /** Default scope hint used by every widget unless overridden. */
  defaultScope: "user-plant" | "company";
  widgets: WidgetConfig[];
}

// ─── Layouts ──────────────────────────────────────────────────────

const PLANT_HSE_MANAGER_LAYOUT: PersonaLayout = {
  title: "Plant HSE Manager",
  description: "Operational view of your plant's safety performance.",
  defaultScope: "user-plant",
  widgets: [
    { kind: "DAYS_SINCE_LTI", cols: 4 },
    { kind: "KPI_TILE", cols: 4, options: { kpiCode: "LTIFR" } },
    { kind: "KPI_TILE", cols: 4, options: { kpiCode: "TRIR" } },

    { kind: "KPI_TILE", cols: 3, options: { kpiCode: "NEAR_MISS_RATE" } },
    { kind: "KPI_TILE", cols: 3, options: { kpiCode: "OBSERVATION_RATE" } },
    { kind: "KPI_TILE", cols: 3, options: { kpiCode: "TRAINING_COMPLIANCE" } },
    { kind: "KPI_TILE", cols: 3, options: { kpiCode: "INSPECTION_COMPLIANCE" } },

    { kind: "HEINRICH_PYRAMID", cols: 6 },
    { kind: "OPEN_ITEMS_COUNTER", cols: 6 },

    { kind: "MULTI_KPI_TREND", cols: 12, options: { kpiCodes: ["LTIFR", "NEAR_MISS_RATE"], months: 12 } },
    { kind: "SUBMISSION_STATUS_MINI", cols: 12 }
  ]
};

const PLANT_HEAD_LAYOUT: PersonaLayout = {
  title: "Plant Head",
  description: "Plant performance against targets, contractor + departmental breakdown.",
  defaultScope: "user-plant",
  widgets: [
    { kind: "DAYS_SINCE_LTI", cols: 4 },
    { kind: "KPI_GAUGE", cols: 4, options: { kpiCode: "LTIFR" } },
    { kind: "KPI_GAUGE", cols: 4, options: { kpiCode: "SEVERITY_RATE" } },

    { kind: "KPI_TILE", cols: 3, options: { kpiCode: "TRIFR" } },
    { kind: "KPI_TILE", cols: 3, options: { kpiCode: "DART_RATE" } },
    { kind: "KPI_TILE", cols: 3, options: { kpiCode: "FSI" } },
    { kind: "KPI_TILE", cols: 3, options: { kpiCode: "HEINRICH_RATIO" } },

    { kind: "KPI_TREND_LINE", cols: 8, options: { kpiCode: "LTIFR", months: 24 } },
    { kind: "HEINRICH_PYRAMID", cols: 4 },

    { kind: "PERFORMANCE_SCORECARD", cols: 8 },
    { kind: "OPEN_ITEMS_COUNTER", cols: 4 }
  ]
};

const CORPORATE_HSE_LAYOUT: PersonaLayout = {
  title: "Corporate HSE",
  description: "Group-wide safety performance + plant-vs-plant comparison.",
  defaultScope: "company",
  widgets: [
    { kind: "DAYS_SINCE_LTI", cols: 3, options: { scopeMode: "company" } },
    { kind: "KPI_GAUGE", cols: 3, options: { kpiCode: "LTIFR", scopeMode: "company" } },
    { kind: "KPI_TILE", cols: 3, options: { kpiCode: "TRIFR", scopeMode: "company" } },
    { kind: "KPI_TILE", cols: 3, options: { kpiCode: "SEVERITY_RATE", scopeMode: "company" } },

    { kind: "PLANT_COMPARISON_BAR", cols: 6, options: { kpiCode: "LTIFR" } },
    { kind: "PLANT_COMPARISON_BAR", cols: 6, options: { kpiCode: "HEINRICH_RATIO" } },

    { kind: "PERFORMANCE_SCORECARD", cols: 12 },

    { kind: "MULTI_KPI_TREND", cols: 8, options: { kpiCodes: ["LTIFR", "TRIFR", "NEAR_MISS_RATE"], scopeMode: "company", months: 12 } },
    { kind: "OPEN_ITEMS_COUNTER", cols: 4, options: { scopeMode: "company" } },

    { kind: "SUBMISSION_STATUS_MINI", cols: 12, options: { scopeMode: "company" } }
  ]
};

const CEO_LAYOUT: PersonaLayout = {
  title: "Executive",
  description: "Strategic safety performance + cost view across the group.",
  defaultScope: "company",
  widgets: [
    { kind: "DAYS_SINCE_LTI", cols: 4, options: { scopeMode: "company" } },
    { kind: "KPI_GAUGE", cols: 4, options: { kpiCode: "LTIFR", scopeMode: "company" } },
    { kind: "KPI_TILE", cols: 4, options: { kpiCode: "COST_OF_INCIDENTS", scopeMode: "company" } },

    { kind: "PERFORMANCE_SCORECARD", cols: 12 },

    { kind: "KPI_TREND_LINE", cols: 6, options: { kpiCode: "LTIFR", scopeMode: "company", months: 24 } },
    { kind: "PLANT_COMPARISON_BAR", cols: 6, options: { kpiCode: "LTIFR" } }
  ]
};

export const PERSONA_LAYOUTS: Record<PersonaKey, PersonaLayout> = {
  "plant-hse-manager": PLANT_HSE_MANAGER_LAYOUT,
  "plant-head": PLANT_HEAD_LAYOUT,
  "corporate-hse": CORPORATE_HSE_LAYOUT,
  ceo: CEO_LAYOUT
};

// ─── Performance scorecard weights ───────────────────────────────

/** Composite plant-score weights. Configurable in a follow-up via a
 *  PerformanceScoreConfig table; hardcoded here as the C5 default.
 *  Weights MUST sum to 100. */
export const SCORECARD_WEIGHTS: { code: KpiCode; weight: number; invert: boolean }[] = [
  { code: "LTIFR", weight: 25, invert: true },
  { code: "TRIFR", weight: 15, invert: true },
  { code: "SEVERITY_RATE", weight: 15, invert: true },
  { code: "NEAR_MISS_RATE", weight: 10, invert: false },
  { code: "TRAINING_COMPLIANCE", weight: 10, invert: false },
  { code: "INSPECTION_COMPLIANCE", weight: 10, invert: false },
  { code: "CAPA_CLOSURE_RATE", weight: 10, invert: false },
  { code: "PTW_FLRA_COMPLIANCE", weight: 5, invert: false }
];

// Sanity check: weights sum to 100. Fails fast on edit.
const _total = SCORECARD_WEIGHTS.reduce((s, w) => s + w.weight, 0);
if (_total !== 100) {
  throw new Error(`SCORECARD_WEIGHTS must sum to 100 (got ${_total})`);
}
