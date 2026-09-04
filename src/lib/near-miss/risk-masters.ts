/**
 * Near Miss site masters — the Risk Calculator, the hazard checklist and the
 * near-miss category tiles, all transcribed from Page Industries' paper near
 * miss card.
 *
 * These are constants rather than database masters for the same reason
 * DEPARTMENTS in src/lib/observation-masters.ts is: the MasterItem tables that
 * would otherwise hold them (HAZARD_CATEGORY, ENERGY_SOURCE) are shared with
 * the Incident and Permit forms and carry a different, generic set. Forking
 * them here would silently change those forms too. The lists below change
 * about as often as the printed card does.
 *
 * The codes are the contract with the database — `NearMiss.hazardCategories`,
 * `nearMissCategory` and the risk columns store them verbatim. Rename a label
 * freely; never a code.
 */

// ─── Risk Calculator: RR = L × S ───────────────────────────────────────
// Two independent 1-3 scales. The printed card lays them out as one table
// with a shared LEVEL column, which reads as though probability and severity
// move together — they do not, and the rating is their product.

export type RiskLevel = 1 | 2 | 3;

export const PROBABILITY_LEVELS: { level: RiskLevel; label: string }[] = [
  { level: 1, label: "Unlikely / Remote" },
  { level: 2, label: "Likely / Occasional" },
  { level: 3, label: "Certain" }
];

export const SEVERITY_LEVELS: { level: RiskLevel; label: string }[] = [
  {
    level: 1,
    label:
      "Negligible / minor injury / minimal environmental impact / minor theft"
  },
  {
    level: 2,
    label:
      "Major injuries beyond first aid / major spillage contained within unit / forced entry / minimal loss of critical info"
  },
  {
    level: 3,
    label:
      "Serious accidents / fatality / major spills spread outside unit / counterfeiting"
  }
];

export const RISK_CATEGORIES = ["LOW_RISK", "MEDIUM_RISK", "HIGH_RISK"] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  LOW_RISK: "LOW RISK",
  MEDIUM_RISK: "MEDIUM RISK",
  HIGH_RISK: "HIGH RISK"
};

/**
 * Rating → category. The card bands the six ratings L × S can actually
 * produce: 1,2 low · 3,4 medium · 6,9 high.
 *
 * 5, 7 and 8 are unreachable by multiplication but ARE selectable, because the
 * coordinator can set the rating by hand. They are banded by continuing the
 * card's own boundaries — 5 sits with 3,4; 7 and 8 sit with 6,9 — which
 * extends the card without contradicting any row printed on it.
 */
const RATING_TO_CATEGORY: Record<number, RiskCategory> = {
  1: "LOW_RISK",
  2: "LOW_RISK",
  3: "MEDIUM_RISK",
  4: "MEDIUM_RISK",
  5: "MEDIUM_RISK",
  6: "HIGH_RISK",
  7: "HIGH_RISK",
  8: "HIGH_RISK",
  9: "HIGH_RISK"
};

/** Every rating the coordinator can pick. L × S tops out at 9. */
export const RISK_RATINGS: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Every level the coordinator can pick — the card's LEVEL column. */
export const RISK_LEVELS: RiskLevel[] = [1, 2, 3];

/**
 * LEVEL and RISK CATEGORY are the same column read two ways: the card's level
 * 1 row is LOW RISK, level 2 is MEDIUM, level 3 is HIGH. Keeping them as one
 * value is what lets the form offer the level as a number box and still
 * record a category.
 */
const LEVEL_TO_CATEGORY: Record<RiskLevel, RiskCategory> = {
  1: "LOW_RISK",
  2: "MEDIUM_RISK",
  3: "HIGH_RISK"
};

export function categoryForLevel(level: RiskLevel | null): RiskCategory | null {
  return level ? LEVEL_TO_CATEGORY[level] : null;
}

export function levelForCategory(category: RiskCategory | null | ""): RiskLevel | null {
  if (!category) return null;
  const found = (Object.keys(LEVEL_TO_CATEGORY) as unknown as RiskLevel[]).find(
    (l) => LEVEL_TO_CATEGORY[l] === category
  );
  return found ?? null;
}

/** The workflow's own severity band. The card has no CRITICAL tier, so this
 *  form never produces one — see the note on auto-promotion in the router. */
export const CATEGORY_TO_SEVERITY: Record<RiskCategory, "LOW" | "MEDIUM" | "HIGH"> = {
  LOW_RISK: "LOW",
  MEDIUM_RISK: "MEDIUM",
  HIGH_RISK: "HIGH"
};

export function riskRating(probability: number | null, severity: number | null) {
  if (!probability || !severity) return null;
  return probability * severity;
}

export function riskCategoryFor(rating: number | null): RiskCategory | null {
  if (rating == null) return null;
  return RATING_TO_CATEGORY[rating] ?? null;
}

// ─── Hazard checklist ──────────────────────────────────────────────────
// "Tick the hazard you observed" from the card. Multi-select; OTHER opens a
// free-text box because the card's own last cell is a blank line.

export const HAZARD_OTHER = "OTHER_UNSAFE_ACT_CONDITION";

export const HAZARD_CATEGORIES: { code: string; label: string }[] = [
  { code: "SLIP_TRIP_HAZARD", label: "Slip / trip hazard" },
  { code: "POOR_HOUSEKEEPING", label: "Poor housekeeping" },
  { code: "EQUIPMENT_DEFICIENCY", label: "Equipment deficiency" },
  { code: "OVERHEAD_LOAD", label: "Overhead load" },
  { code: "UNSAFE_EQUIPMENT", label: "Unsafe equipment" },
  { code: "SHARP_EDGES", label: "Sharp edges" },
  { code: "CHEMICAL_SPILLAGE", label: "Chemicals spillage" },
  { code: "STRUCTURAL_DAMAGE", label: "Structural damage" },
  { code: "PERMIT_NON_COMPLIANCE", label: "Permit non-compliance" },
  { code: "MATERIAL_MOVEMENT", label: "Material movement" },
  { code: "PROCEDURE_NON_COMPLIANCE", label: "Procedure non-compliance" },
  { code: "SUDDEN_LOUD_NOISE", label: "Sudden loud noise" },
  { code: "AWKWARD_POSTURE", label: "Awkward posture" },
  { code: "PPE_NON_COMPLIANCE", label: "PPE non-compliance" },
  { code: "ELECTRICAL_HAZARD", label: "Electrical hazard" },
  { code: "MANUAL_HANDLING", label: "Manual handling" },
  { code: HAZARD_OTHER, label: "Other unsafe acts / conditions" }
];

// ─── Near miss category ────────────────────────────────────────────────
// The pictogram grid on the card. Pick exactly one. Images live in
// public/near-miss-categories and are the site's own signs, resized from the
// originals — see the note in the form.

export const NEAR_MISS_CATEGORY_OTHER = "OTHER";

export const NEAR_MISS_CATEGORIES: { code: string; label: string; image: string }[] = [
  { code: "ABOUT_TO_FALL_FROM_EDGE", label: "About to fall from an edge", image: "about-to-fall-from-edge" },
  { code: "ABOUT_TO_TOUCH_HOT_SURFACE", label: "About to touch hot surface", image: "about-to-touch-hot-surface" },
  { code: "ABOUT_TO_HIT_BY_LOW_HEIGHT_OBJECTS", label: "About to hit by low height objects", image: "about-to-hit-by-low-height-objects" },
  { code: "ESCAPED_CRUSHING_OF_HANDS", label: "Just escaped from crushing of hands", image: "escaped-crushing-of-hands" },
  { code: "MILD_ELECTRIC_SHOCK_OR_SPARK", label: "Mild electric shock or spark", image: "mild-electric-shock-or-spark" },
  { code: "SLIPPED_ON_FLOOR_OR_STAIRS", label: "Slipped on floor and/or stairs", image: "slipped-on-floor-or-stairs" },
  { code: "ESCAPED_FROM_SHARP_OBJECTS", label: "Just escaped from sharp objects", image: "escaped-from-sharp-objects" },
  { code: "TRIPPED_ON_FLOOR", label: "Tripped on floor", image: "tripped-on-floor" },
  { code: "ESCAPED_FROM_FALLING_OBJECT", label: "Just escaped from falling object", image: "escaped-from-falling-object" },
  { code: "ABOUT_TO_HIT_BY_MATERIAL_MOVEMENT", label: "About to hit by material movement equipment", image: "about-to-hit-by-material-movement" },
  { code: NEAR_MISS_CATEGORY_OTHER, label: "Others (please specify)", image: "other" }
];

export const NEAR_MISS_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  NEAR_MISS_CATEGORIES.map((c) => [c.code, c.label])
);

export const HAZARD_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  HAZARD_CATEGORIES.map((h) => [h.code, h.label])
);
