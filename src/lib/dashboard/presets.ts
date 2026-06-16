// ─────────────────────────────────────────────────────────────────────
// Persona presets for the configurable EHS dashboard (D3).
//
// Pre-built layouts a user applies as a starting point, then customises.
// Mirrors the shape of the existing MIS-dashboard persona framework
// (src/lib/manhours/personas.ts) — same "ordered widgets with a span"
// idea — but targets the 24-widget EHS catalog. Per the sprint decision,
// this EXTENDS rather than forks: role→persona mapping below is the one
// place new roles slot in.
//
// Pure data (no React/DB): imported by the server (seed a new user's
// layout) and the client (Presets dropdown).
// ─────────────────────────────────────────────────────────────────────

import type { WidgetSpan } from "./widget-catalog";

export interface LayoutItem {
  widgetId: string;
  span: WidgetSpan;
}

export interface DashboardPreset {
  key: string;
  label: string;
  description: string;
  items: LayoutItem[];
}

const n = (widgetId: string): LayoutItem => ({ widgetId, span: 1 });
const w = (widgetId: string): LayoutItem => ({ widgetId, span: 2 });
const f = (widgetId: string): LayoutItem => ({ widgetId, span: 3 });

// ── PRESET-01 · Plant Head ───────────────────────────────────────────
const PLANT_HEAD: DashboardPreset = {
  key: "plant-head",
  label: "Plant Head",
  description: "Compliance, incident streaks, risk profile and open actions at a plant level.",
  items: [
    w("compliance-score"),
    w("days-since-incident"),
    n("skill-matrix-compliance"),
    n("hira-risk-profile"),
    w("open-actions-by-age"),
    n("moc-activity"),
    f("heinrich-pyramid"),
    n("incident-status"),
    n("ptw-performance"),
    n("contractor-compliance"),
  ],
};

// ── PRESET-02 · HSE Manager ──────────────────────────────────────────
const HSE_MANAGER: DashboardPreset = {
  key: "hse-manager",
  label: "HSE Manager",
  description: "Leading & lagging indicators, hazards, investigations, CAPA and competency.",
  items: [
    // Row 1 — lagging KPIs (4 cards × span-1 in the 4-col grid)
    n("kpi-days-since-lti"),
    n("kpi-ltifr"),
    n("kpi-trir"),
    n("kpi-active-permits"),
    // Row 2 — leading KPIs
    n("kpi-observations-mtd"),
    n("kpi-nearmiss-12mo"),
    n("kpi-training-compliance"),
    n("kpi-inspection-compliance"),
    // Row 3 — trend chart (span-2) + Heinrich pyramid (span-2) side by side
    w("obs-nearmiss-trend"),
    w("heinrich-pyramid"),
    // Row 4 — deeper operational widgets
    n("hira-risk-profile"),
    n("incident-status"),
    n("ptw-performance"),
    w("capa-closure-trend"),
  ],
};

// ── PRESET-03 · L&D Manager / HR ─────────────────────────────────────
const LND_MANAGER: DashboardPreset = {
  key: "lnd-manager",
  label: "L&D Manager / HR",
  description: "Competency and training coverage, contractor readiness, role-change activity.",
  items: [
    w("skill-matrix-compliance"),
    n("kpi-training-compliance"),
    f("training-by-department"),
    n("contractor-compliance"),
    n("ptw-performance"),
    n("moc-activity"),
  ],
};

// ── PRESET-04 · Safety Officer (daily operational) ───────────────────
const SAFETY_OFFICER: DashboardPreset = {
  key: "safety-officer",
  label: "Safety Officer",
  description: "Daily operational view — permits, investigations, actions and observation quality.",
  items: [
    n("kpi-active-permits"),
    n("ptw-performance"),
    n("incident-status"),
    w("open-actions-by-age"),
    n("hira-risk-profile"),
    w("obs-nearmiss-trend"),
    n("observation-quality"),
  ],
};

// ── PRESET-05 · Environment Manager ──────────────────────────────────
const ENVIRONMENT_MANAGER: DashboardPreset = {
  key: "environment-manager",
  label: "Environment Manager",
  description: "Environmental aspects, compliance score, change and corrective-action activity.",
  items: [
    w("eai-significance"),
    n("compliance-score"),
    n("moc-activity"),
    w("capa-closure-trend"),
    f("top-repeat-hazards"),
  ],
};

export const DASHBOARD_PRESETS: Record<string, DashboardPreset> = {
  "plant-head": PLANT_HEAD,
  "hse-manager": HSE_MANAGER,
  "lnd-manager": LND_MANAGER,
  "safety-officer": SAFETY_OFFICER,
  "environment-manager": ENVIRONMENT_MANAGER,
};

export const PRESET_KEYS = Object.keys(DASHBOARD_PRESETS);

export const DEFAULT_PRESET_KEY = "hse-manager";

/** Map a user role code to its default persona preset. New roles are
 *  added here (the single extension point). */
export function presetForRole(role: string | null | undefined): string {
  switch (role) {
    case "PLANT_HEAD":
    case "ADMIN":
      return "plant-head";
    case "HSE_MANAGER":
    case "CORPORATE_HSE":
      return "hse-manager";
    case "SAFETY_OFFICER":
    case "PERMIT_ISSUER":
      return "safety-officer";
    case "LND_MANAGER":
    case "HR_MANAGER":
    case "HR":
      return "lnd-manager";
    case "ENVIRONMENT_MANAGER":
    case "ENV_MANAGER":
      return "environment-manager";
    default:
      return DEFAULT_PRESET_KEY;
  }
}

/** The preset layout as a plain LayoutItem[] (what gets persisted). */
export function presetLayout(key: string): LayoutItem[] {
  return (DASHBOARD_PRESETS[key] ?? DASHBOARD_PRESETS[DEFAULT_PRESET_KEY]).items.map((i) => ({ ...i }));
}
