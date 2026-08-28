// ─────────────────────────────────────────────────────────────────────
//  KPI Registry — single source of truth for every safety KPI computed
//  anywhere in the platform.
//
//  Every entry declares:
//    • how the numerator is sourced (which Prisma model + where filter
//      + aggregation kind), or DERIVED from other KPIs
//    • whether the denominator is exposure hours (default for rates)
//      or NONE (percentage / streak / cost KPIs)
//    • the multiplier (1e6 for IS 3786, 200k for OSHA)
//    • benchmark bands (world-class / excellent / average / poor)
//    • whether higher values are good
//
//  No formulas anywhere else in the codebase. The KpiEngine
//  (./kpi-engine) is the only consumer; UI surfaces import
//  COMPUTED RESULTS, never the formulas themselves.
//
//  Adding a new KPI is two steps:
//    1. Add the literal to `KPI_CODES`.
//    2. Add the matching entry to `KPI_REGISTRY`.
//  TypeScript catches any mismatch at compile time.
// ─────────────────────────────────────────────────────────────────────

export const KPI_CODES = [
  "LTIFR",
  "TRIFR",
  "TRIR",
  "IFR",
  "DART_RATE",
  "SEVERITY_RATE",
  "FSI",
  "NEAR_MISS_RATE",
  "OBSERVATION_RATE",
  "HEINRICH_RATIO",
  "CAPA_CLOSURE_RATE",
  "TRAINING_COMPLIANCE",
  "FIRE_CHEMICAL_COMPLIANCE",
  "INSPECTION_COMPLIANCE",
  "PTW_FLRA_COMPLIANCE",
  "DAYS_SINCE_LAST_LTI",
  "COST_OF_INCIDENTS"
] as const;

export type KpiCode = (typeof KPI_CODES)[number];

/** Performance band. Colour palette is decided by the engine, not here,
 *  so the visual style stays consistent across the platform. */
export type KpiBand = "WORLD_CLASS" | "EXCELLENT" | "AVERAGE" | "POOR";

export interface KpiBenchmarks {
  worldClass: number;
  excellent: number;
  average: number;
  poor: number;
}

/** Source-table identifiers. The string must match the property name
 *  on the Prisma client (e.g. `prisma.incident`). Models with unusual
 *  casing (e.g. `prisma.fLRA`) aren't included here — KPIs that need
 *  them go through CUSTOM handlers in the engine. */
export type KpiSource =
  | "incident"
  | "nearMiss"
  | "observation"
  | "permit"
  | "trainingRecord"
  | "inspection"
  | "manhoursSubmission";

/** Discriminated union of numerator strategies. */
export type KpiNumeratorSpec =
  | {
      kind: "MODULE_COUNT";
      source: KpiSource;
      /** Plain Prisma `where` fragment. Period bounds + scope filters
       *  (plantId etc.) are layered in by the engine. */
      where?: Record<string, unknown>;
    }
  | {
      kind: "MODULE_SUM";
      source: KpiSource;
      sumField: string;
      where?: Record<string, unknown>;
    }
  | {
      kind: "DAYS_SINCE";
      source: KpiSource;
      where?: Record<string, unknown>;
    }
  | {
      // Non-trivial computations that don't fit the count/sum mould —
      // implemented in the engine's switch (computeCustomNumerator).
      // Listed by tag so the registry stays free of Prisma imports.
      kind: "CUSTOM";
      tag:
        | "SEVERITY_NUMERATOR"
        | "CAPA_CLOSURE"
        | "TRAINING_COMPLIANCE"
        | "FIRE_CHEMICAL_COMPLIANCE"
        | "INSPECTION_COMPLIANCE"
        | "PTW_FLRA_COMPLIANCE"
        | "COST_OF_INCIDENTS";
    }
  | {
      kind: "DERIVED";
      sourceKpis: KpiCode[];
      tag: "FSI" | "HEINRICH_RATIO";
    };

export type KpiDenominatorSpec =
  | { kind: "EXPOSURE_HOURS" }
  | { kind: "NONE" };

export interface KpiDefinition {
  code: KpiCode;
  name: string;
  /** Human-readable formula shown in drill-down UI and audit exports. */
  formula: string;
  /** Reference standard cited in audits / Inspector reports. */
  statutoryReference?: string;

  numerator: KpiNumeratorSpec;
  denominator: KpiDenominatorSpec;
  /** Multiplier applied after numerator/denominator. 1 when not a rate. */
  multiplier: number;

  /** Exclusion rules — documented for audit context. The engine applies
   *  module-specific exclusions through the `where` clause; this array
   *  is the human-readable rationale shown in drill-down. */
  exclusionRules?: string[];

  benchmarks?: KpiBenchmarks;
  /** Single fixed target where benchmarks don't apply
   *  (e.g. PTW_FLRA_COMPLIANCE always targets 100%). */
  targetValue?: number;

  /** Up is good (true) vs down is good (false). Drives band colour. */
  higherIsBetter: boolean;
  isPercentage?: boolean;
  isStreakMetric?: boolean;

  displayFormat: "decimal_2_places" | "integer" | "currency_indian" | "percent";
}

// ─── Registry ──────────────────────────────────────────────────────

export const KPI_REGISTRY: Record<KpiCode, KpiDefinition> = {
  LTIFR: {
    code: "LTIFR",
    name: "Lost Time Injury Frequency Rate",
    formula: "(LTIs × 1,000,000) ÷ Net Exposure Hours",
    statutoryReference: "IS 3786:1983",
    numerator: {
      kind: "MODULE_COUNT",
      source: "incident",
      where: { type: { in: ["LTI", "FATALITY"] } }
    },
    denominator: { kind: "EXPOSURE_HOURS" },
    multiplier: 1_000_000,
    exclusionRules: [
      "Commuting incidents excluded",
      "Off-site incidents not on company business excluded",
      "Pre-existing conditions unrelated to work excluded"
    ],
    benchmarks: { worldClass: 1.0, excellent: 2.0, average: 5.0, poor: 10.0 },
    higherIsBetter: false,
    displayFormat: "decimal_2_places"
  },

  TRIFR: {
    code: "TRIFR",
    name: "Total Recordable Injury Frequency Rate",
    formula: "(Recordable Injuries × 1,000,000) ÷ Net Exposure Hours",
    statutoryReference: "OSHA 29 CFR 1904 (per-million variant)",
    numerator: {
      kind: "MODULE_COUNT",
      source: "incident",
      // FAC (FIRST_AID) excluded per OSHA recordability rules.
      where: { type: { in: ["MTC", "RWC", "LTI", "FATALITY"] } }
    },
    denominator: { kind: "EXPOSURE_HOURS" },
    multiplier: 1_000_000,
    benchmarks: { worldClass: 2.0, excellent: 4.0, average: 8.0, poor: 15.0 },
    higherIsBetter: false,
    displayFormat: "decimal_2_places"
  },

  TRIR: {
    code: "TRIR",
    name: "Total Recordable Incident Rate",
    formula: "(Recordable Injuries × 200,000) ÷ Net Exposure Hours",
    statutoryReference: "OSHA 29 CFR 1904",
    numerator: {
      kind: "MODULE_COUNT",
      source: "incident",
      where: { type: { in: ["MTC", "RWC", "LTI", "FATALITY"] } }
    },
    denominator: { kind: "EXPOSURE_HOURS" },
    multiplier: 200_000,
    benchmarks: { worldClass: 0.5, excellent: 1.0, average: 3.0, poor: 5.0 },
    higherIsBetter: false,
    displayFormat: "decimal_2_places"
  },

  IFR: {
    code: "IFR",
    name: "Injury Frequency Rate",
    // All personal-injury incidents (first-aid inclusive) per million hours —
    // the broad injury-frequency measure Indian industry reports as "IFR",
    // distinct from TRIFR (which excludes first-aid) and TRIR (×200k base).
    formula: "(All Injuries × 1,000,000) ÷ Net Exposure Hours",
    statutoryReference: "IS 3786:1983 (injury frequency)",
    numerator: {
      kind: "MODULE_COUNT",
      source: "incident",
      where: { type: { in: ["FIRST_AID", "MTC", "RWC", "LTI", "FATALITY"] } }
    },
    denominator: { kind: "EXPOSURE_HOURS" },
    multiplier: 1_000_000,
    benchmarks: { worldClass: 3.0, excellent: 6.0, average: 12.0, poor: 20.0 },
    higherIsBetter: false,
    displayFormat: "decimal_2_places"
  },

  DART_RATE: {
    code: "DART_RATE",
    name: "Days Away, Restricted, Transferred Rate",
    formula: "(DART Cases × 200,000) ÷ Net Exposure Hours",
    statutoryReference: "OSHA 29 CFR 1904",
    numerator: {
      kind: "MODULE_COUNT",
      source: "incident",
      where: { type: { in: ["RWC", "LTI", "FATALITY"] } }
    },
    denominator: { kind: "EXPOSURE_HOURS" },
    multiplier: 200_000,
    benchmarks: { worldClass: 0.3, excellent: 0.7, average: 2.0, poor: 4.0 },
    higherIsBetter: false,
    displayFormat: "decimal_2_places"
  },

  SEVERITY_RATE: {
    code: "SEVERITY_RATE",
    name: "Severity Rate",
    // Per IS 3786 each fatality is charged at 6,000 days. Engine
    // composes (sum of LTI lost-days) + (6000 × fatality count) in
    // CUSTOM numerator handler.
    formula: "(Days Lost + 6000 × Fatalities) × 1,000,000 ÷ Net Exposure Hours",
    statutoryReference: "IS 3786:1983",
    numerator: { kind: "CUSTOM", tag: "SEVERITY_NUMERATOR" },
    denominator: { kind: "EXPOSURE_HOURS" },
    multiplier: 1_000_000,
    benchmarks: { worldClass: 50, excellent: 150, average: 500, poor: 1500 },
    higherIsBetter: false,
    displayFormat: "decimal_2_places"
  },

  FSI: {
    code: "FSI",
    name: "Frequency-Severity Index",
    formula: "√((LTIFR × Severity Rate) ÷ 1000)",
    statutoryReference: "IS 3786:1983",
    numerator: { kind: "DERIVED", sourceKpis: ["LTIFR", "SEVERITY_RATE"], tag: "FSI" },
    denominator: { kind: "NONE" },
    multiplier: 1,
    higherIsBetter: false,
    displayFormat: "decimal_2_places"
  },

  NEAR_MISS_RATE: {
    code: "NEAR_MISS_RATE",
    name: "Near Miss Reporting Rate",
    formula: "(Near Misses × 1,000,000) ÷ Net Exposure Hours",
    statutoryReference: "Internal leading indicator",
    numerator: {
      kind: "MODULE_COUNT",
      source: "nearMiss"
      // No status filter — all reported NMs count, even open ones.
      // Higher reporting culture is the signal.
    },
    denominator: { kind: "EXPOSURE_HOURS" },
    multiplier: 1_000_000,
    benchmarks: { worldClass: 1000, excellent: 500, average: 200, poor: 50 },
    higherIsBetter: true,
    displayFormat: "decimal_2_places"
  },

  OBSERVATION_RATE: {
    code: "OBSERVATION_RATE",
    name: "Safety Observation Reporting Rate",
    formula: "(Observations × 1,000,000) ÷ Net Exposure Hours",
    numerator: { kind: "MODULE_COUNT", source: "observation" },
    denominator: { kind: "EXPOSURE_HOURS" },
    multiplier: 1_000_000,
    benchmarks: { worldClass: 5000, excellent: 2000, average: 800, poor: 200 },
    higherIsBetter: true,
    displayFormat: "decimal_2_places"
  },

  HEINRICH_RATIO: {
    code: "HEINRICH_RATIO",
    name: "Heinrich Ratio (Near Miss : Incident)",
    formula: "Near Misses ÷ Total Recordable Incidents",
    numerator: { kind: "DERIVED", sourceKpis: ["NEAR_MISS_RATE", "TRIFR"], tag: "HEINRICH_RATIO" },
    denominator: { kind: "NONE" },
    multiplier: 1,
    benchmarks: { worldClass: 300, excellent: 100, average: 30, poor: 10 },
    higherIsBetter: true,
    displayFormat: "decimal_2_places"
  },

  CAPA_CLOSURE_RATE: {
    code: "CAPA_CLOSURE_RATE",
    name: "CAPA On-Time Closure Rate",
    formula: "(CAPAs Closed On Time ÷ Total CAPAs Due) × 100",
    numerator: { kind: "CUSTOM", tag: "CAPA_CLOSURE" },
    denominator: { kind: "NONE" },
    multiplier: 1,
    benchmarks: { worldClass: 95, excellent: 85, average: 70, poor: 50 },
    higherIsBetter: true,
    isPercentage: true,
    displayFormat: "percent"
  },

  TRAINING_COMPLIANCE: {
    code: "TRAINING_COMPLIANCE",
    name: "Training Compliance Rate",
    formula: "(Employees with Valid Mandatory Training ÷ Total Employees) × 100",
    numerator: { kind: "CUSTOM", tag: "TRAINING_COMPLIANCE" },
    denominator: { kind: "NONE" },
    multiplier: 1,
    benchmarks: { worldClass: 98, excellent: 95, average: 85, poor: 70 },
    higherIsBetter: true,
    isPercentage: true,
    displayFormat: "percent"
  },

  // Fire + Chemical routine checklist completion. Sourced from the BACKEND
  // read model (`/api/fire/compliance`), not from Prisma — see
  // lib/manhours/fire-chemical-compliance.ts for that decision and why the
  // alternative would have been a second implementation of this number.
  //
  // NOT in SCORECARD_WEIGHTS, deliberately. Those weights sum to exactly 100
  // with a fail-fast check, so adding this one means taking weight away from
  // the other eight — which silently re-bands every plant's historic composite
  // score. Whether fire/chemical compliance should carry weight, and at whose
  // expense, is a product decision, not a side effect of wiring up a data
  // source. It is computed and reported; weighting is a follow-up.
  FIRE_CHEMICAL_COMPLIANCE: {
    code: "FIRE_CHEMICAL_COMPLIANCE",
    name: "Fire & Chemical Checklist Compliance",
    formula: "(Routine Checklists Completed ÷ Checklists Due) × 100",
    numerator: { kind: "CUSTOM", tag: "FIRE_CHEMICAL_COMPLIANCE" },
    denominator: { kind: "NONE" },
    multiplier: 1,
    benchmarks: { worldClass: 98, excellent: 95, average: 85, poor: 70 },
    higherIsBetter: true,
    isPercentage: true,
    displayFormat: "percent"
  },

  INSPECTION_COMPLIANCE: {
    code: "INSPECTION_COMPLIANCE",
    name: "Inspection Compliance Rate",
    formula: "(Inspections Completed On Time ÷ Total Scheduled) × 100",
    numerator: { kind: "CUSTOM", tag: "INSPECTION_COMPLIANCE" },
    denominator: { kind: "NONE" },
    multiplier: 1,
    benchmarks: { worldClass: 98, excellent: 95, average: 85, poor: 70 },
    higherIsBetter: true,
    isPercentage: true,
    displayFormat: "percent"
  },

  PTW_FLRA_COMPLIANCE: {
    code: "PTW_FLRA_COMPLIANCE",
    name: "PTW-FLRA Linkage Compliance",
    formula: "(PTWs with Linked FLRA ÷ Total PTWs Activated) × 100",
    numerator: { kind: "CUSTOM", tag: "PTW_FLRA_COMPLIANCE" },
    denominator: { kind: "NONE" },
    multiplier: 1,
    targetValue: 100, // Should ALWAYS be 100% — anything else is a process failure
    higherIsBetter: true,
    isPercentage: true,
    displayFormat: "percent"
  },

  DAYS_SINCE_LAST_LTI: {
    code: "DAYS_SINCE_LAST_LTI",
    name: "Days Since Last LTI",
    formula: "DATEDIFF(NOW, MAX(LTI.occurredAt))",
    numerator: {
      kind: "DAYS_SINCE",
      source: "incident",
      where: { type: { in: ["LTI", "FATALITY"] } }
    },
    denominator: { kind: "NONE" },
    multiplier: 1,
    higherIsBetter: true,
    isStreakMetric: true,
    displayFormat: "integer"
  },

  COST_OF_INCIDENTS: {
    code: "COST_OF_INCIDENTS",
    name: "Total Cost of Incidents",
    formula: "SUM(Incident.costTotal)",
    numerator: { kind: "CUSTOM", tag: "COST_OF_INCIDENTS" },
    denominator: { kind: "NONE" },
    multiplier: 1,
    higherIsBetter: false,
    displayFormat: "currency_indian"
  }
};

// ─── Sanity checks (run at module load — fails fast on typos) ──

for (const code of KPI_CODES) {
  if (!KPI_REGISTRY[code]) {
    throw new Error(`KPI_REGISTRY missing entry for code: ${code}`);
  }
  if (KPI_REGISTRY[code].code !== code) {
    throw new Error(`KPI_REGISTRY entry "${code}" has mismatched code: ${KPI_REGISTRY[code].code}`);
  }
}
