// ─────────────────────────────────────────────────────────────────────
// Widget catalog — the single source of truth for the configurable
// dashboard (UI Depth sprint, Deliverable 3 + the 16 new D1 widgets).
//
// Pure metadata only (no React, no DB) so it can be imported on both the
// server (RBAC gating, layout validation) and the client (gallery, grid).
// The actual viz components are mapped by id in
// src/components/dashboard/widgets/registry.tsx, and the data loaders by
// id in src/lib/dashboard/widget-data.ts.
// ─────────────────────────────────────────────────────────────────────

/** Column span on the 3-col grid. 1 = narrow, 2 = wide, 3 = full-width. */
export type WidgetSpan = 1 | 2 | 3;

export type WidgetCategory = "Performance" | "Safety" | "Risk" | "People" | "Operations" | "AI";

export interface WidgetMeta {
  id: string;
  title: string;
  description: string;
  category: WidgetCategory;
  /** Default span when added from the gallery. */
  defaultSpan: WidgetSpan;
  /** Spans the user may resize this widget to. */
  allowedSpans: WidgetSpan[];
  /** Persona keys this widget is relevant to (for gallery hints). */
  personas: string[];
  /** Module key — used to hide the widget when that module is inactive
   *  for the tenant, and to resolve the RBAC permission below. */
  module?: string;
  /** Existing-module RBAC permission. When set and the user lacks it, the
   *  widget renders an access-restricted state instead of data. */
  permission?: string;
  /** True for the 8 pre-existing dashboard widgets (vs the 16 new ones). */
  existing?: boolean;
}

// ─── The catalog ─────────────────────────────────────────────────────
// 16 new widgets + the pre-existing KPI cards / charts the presets refer
// to. Ids are stable contract keys (used in saved layouts + the API).

export const WIDGET_CATALOG: WidgetMeta[] = [
  // ── 16 new widgets ──────────────────────────────────────────────
  {
    id: "open-actions-by-age",
    title: "Open Actions by Age",
    description: "CAPA / corrective actions bucketed by how long they've been open. Aging actions are an audit red flag.",
    category: "Operations",
    defaultSpan: 2,
    allowedSpans: [2, 3],
    personas: ["plant-head", "hse-manager", "quality-manager"],
    module: "CAPA",
    permission: "CAPA.READ",
  },
  {
    id: "capa-closure-trend",
    title: "CAPA Closure Rate Trend",
    description: "Rolling 12-month opened-vs-closed. If openings outpace closures, backlog is growing.",
    category: "Operations",
    defaultSpan: 2,
    allowedSpans: [2, 3],
    personas: ["hse-manager", "quality-manager", "plant-head"],
    module: "CAPA",
    permission: "CAPA.READ",
  },
  {
    id: "compliance-score",
    title: "Regulatory Compliance Score",
    description: "Composite health across training, inspection, competency and PPE compliance.",
    category: "Performance",
    defaultSpan: 1,
    allowedSpans: [1, 2],
    personas: ["plant-head", "corporate-hse", "hse-manager"],
  },
  {
    id: "hira-risk-profile",
    title: "HIRA Risk Profile",
    description: "Residual risk distribution across active HIRA entries, with 3-month trend deltas.",
    category: "Risk",
    defaultSpan: 1,
    allowedSpans: [1, 2],
    personas: ["hse-manager", "plant-head", "corporate-hse"],
    module: "HIRA",
    permission: "HIRA.READ",
  },
  {
    id: "ptw-performance",
    title: "PTW Performance",
    description: "Permit performance this month — active, on-time closures, competency blocks, cycle time.",
    category: "Operations",
    defaultSpan: 1,
    allowedSpans: [1, 2],
    personas: ["safety-officer", "permit-issuer", "hse-manager"],
    module: "PTW",
  },
  {
    id: "inspection-performance",
    title: "Inspection Performance Summary",
    description: "Inspection health — completed, overdue, findings open, and pass rates by type.",
    category: "Operations",
    defaultSpan: 2,
    allowedSpans: [2, 3],
    personas: ["hse-manager", "maintenance-head", "safety-officer"],
    module: "INSPECTION",
  },
  {
    id: "moc-activity",
    title: "MOC Activity",
    description: "Change-management pipeline with overdue, expiring-temporary, and approval-cycle alerts.",
    category: "Operations",
    defaultSpan: 1,
    allowedSpans: [1, 2],
    personas: ["hse-manager", "plant-head", "moc-coordinator"],
    module: "MOC",
  },
  {
    id: "skill-matrix-compliance",
    title: "Skill Matrix Compliance",
    description: "Workforce competency health — valid vs expiring vs lapsed, with safety-critical focus.",
    category: "People",
    defaultSpan: 1,
    allowedSpans: [1, 2],
    personas: ["hse-manager", "lnd-manager", "plant-head"],
    module: "SKILL_MATRIX",
  },
  {
    id: "top-repeat-hazards",
    title: "Top Repeat Hazards",
    description: "Hazard categories recurring across HIRA, near-miss and incidents — systemic exposure.",
    category: "Risk",
    defaultSpan: 3,
    allowedSpans: [2, 3],
    personas: ["hse-manager", "plant-head", "corporate-hse"],
  },
  {
    id: "incident-status",
    title: "Incident Investigation Status",
    description: "Open investigations by stage, with stalled and LTI-open urgency indicators.",
    category: "Safety",
    defaultSpan: 1,
    allowedSpans: [1, 2],
    personas: ["hse-manager", "safety-officer", "plant-head"],
    module: "INCIDENT",
    permission: "INCIDENT.READ",
  },
  {
    id: "training-by-department",
    title: "Training Coverage by Department",
    description: "Which departments carry the most training gaps — for L&D planning.",
    category: "People",
    defaultSpan: 2,
    allowedSpans: [2, 3],
    personas: ["lnd-manager", "hse-manager", "department-head"],
    module: "TRAINING",
  },
  {
    id: "days-since-incident",
    title: "Days Since Last Incident by Type",
    description: "Days-since counters for LTI, RWC, MTC and First Aid — the site-entry streak board.",
    category: "Safety",
    defaultSpan: 2,
    allowedSpans: [1, 2],
    personas: ["plant-head", "hse-manager", "safety-officer"],
    module: "INCIDENT",
    permission: "INCIDENT.READ",
  },
  {
    id: "contractor-compliance",
    title: "Contractor Compliance",
    description: "Contractor workforce snapshot — training, competency and PPE validity.",
    category: "People",
    defaultSpan: 1,
    allowedSpans: [1, 2],
    personas: ["contractor-coordinator", "hse-manager", "safety-officer"],
  },
  {
    id: "eai-significance",
    title: "EAI Significance Overview",
    description: "Environmental aspect health — significant aspects controlled, obligations due.",
    category: "Risk",
    defaultSpan: 2,
    allowedSpans: [1, 2],
    personas: ["environment-manager", "hse-manager", "plant-head"],
    module: "EAI",
    permission: "EAI.READ",
  },
  {
    id: "observation-quality",
    title: "Safety Observation Quality Score",
    description: "Are submitted observations specific enough to act on? Quality tiers over 6 months.",
    category: "Safety",
    defaultSpan: 1,
    allowedSpans: [1, 2],
    personas: ["hse-manager", "safety-officer", "plant-head"],
    module: "OBSERVATION",
    permission: "OBSERVATION.READ",
  },
  {
    id: "permit-agent-activity",
    title: "Permit Risk Reviewer Agent",
    description: "AI permit-review activity — permits reviewed, concerns surfaced and acted on.",
    category: "AI",
    defaultSpan: 1,
    allowedSpans: [1, 2],
    personas: ["hse-manager", "plant-head", "corporate-hse"],
    module: "PTW",
  },

  {
    id: "ai-insights",
    title: "AI Insights",
    description: "AI-detected safety patterns, anomalies and leading indicators synthesised across all active modules in real time.",
    category: "AI",
    defaultSpan: 2,
    allowedSpans: [2, 3],
    personas: ["hse-manager", "plant-head", "corporate-hse"],
    existing: true,
  },

  // ── Pre-existing widgets (the "8 current" + charts presets refer to) ──
  {
    id: "kpi-days-since-lti",
    title: "Days Since Last LTI",
    description: "Calendar days since the most recent lost-time injury or fatality.",
    category: "Performance",
    defaultSpan: 1,
    allowedSpans: [1],
    personas: ["plant-head", "hse-manager"],
    existing: true,
  },
  {
    id: "kpi-ltifr",
    title: "LTIFR",
    description: "Lost-time injury frequency rate, rolling 12 months per million hours.",
    category: "Performance",
    defaultSpan: 1,
    allowedSpans: [1],
    personas: ["hse-manager", "plant-head", "corporate-hse"],
    existing: true,
  },
  {
    id: "kpi-trir",
    title: "TRIR",
    description: "Total recordable incident rate, rolling 12 months per 200k hours.",
    category: "Performance",
    defaultSpan: 1,
    allowedSpans: [1],
    personas: ["hse-manager", "plant-head"],
    existing: true,
  },
  {
    id: "kpi-active-permits",
    title: "Active Permits",
    description: "Permits currently in execution.",
    category: "Operations",
    defaultSpan: 1,
    allowedSpans: [1],
    personas: ["safety-officer", "hse-manager"],
    module: "PTW",
    existing: true,
  },
  {
    id: "kpi-observations-mtd",
    title: "Observations MTD",
    description: "Safety observations logged month-to-date.",
    category: "Safety",
    defaultSpan: 1,
    allowedSpans: [1],
    personas: ["hse-manager", "safety-officer"],
    module: "OBSERVATION",
    permission: "OBSERVATION.READ",
    existing: true,
  },
  {
    id: "kpi-nearmiss-12mo",
    title: "Near Miss",
    description: "Near misses reported over the trailing 12 months — leading indicator.",
    category: "Safety",
    defaultSpan: 1,
    allowedSpans: [1],
    personas: ["hse-manager", "safety-officer"],
    existing: true,
  },
  {
    id: "kpi-training-compliance",
    title: "Training Compliance",
    description: "Share of training records currently valid and passed.",
    category: "People",
    defaultSpan: 1,
    allowedSpans: [1],
    personas: ["lnd-manager", "hse-manager"],
    module: "TRAINING",
    existing: true,
  },
  {
    id: "kpi-inspection-compliance",
    title: "Inspection Compliance",
    description: "Share of inspections completed on schedule.",
    category: "Operations",
    defaultSpan: 1,
    allowedSpans: [1],
    personas: ["hse-manager", "maintenance-head"],
    module: "INSPECTION",
    existing: true,
  },
  {
    id: "heinrich-pyramid",
    title: "Heinrich Pyramid",
    description: "Rolling 12-month event mix from unsafe acts up to fatalities.",
    category: "Safety",
    defaultSpan: 2,
    allowedSpans: [2, 3],
    personas: ["plant-head", "hse-manager"],
    existing: true,
  },
  {
    id: "obs-nearmiss-trend",
    title: "Observations & Near Miss Trend",
    description: "Monthly observation and near-miss volume over the last 12 months.",
    category: "Safety",
    defaultSpan: 2,
    allowedSpans: [2, 3],
    personas: ["hse-manager", "safety-officer", "plant-head"],
    existing: true,
  },
];

// ─── Lookups ─────────────────────────────────────────────────────────

export const WIDGET_BY_ID: Record<string, WidgetMeta> = Object.fromEntries(
  WIDGET_CATALOG.map((w) => [w.id, w])
);

export const WIDGET_CATEGORIES: WidgetCategory[] = [
  "Performance",
  "Safety",
  "Risk",
  "People",
  "Operations",
  "AI",
];

export function getWidget(id: string): WidgetMeta | undefined {
  return WIDGET_BY_ID[id];
}
