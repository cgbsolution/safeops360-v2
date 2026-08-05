"use client";

// Type-aware Category / Sub-category pair for the Safety Observation forms.
//
// The bug this replaces: one shared master list fed both dropdowns regardless
// of Act vs Condition, so "Unsafe Condition: PPE non-compliance" was a
// selectable combination. Both lists are now fetched per act/condition axis
// from /api/observation-taxonomy, whose category response only includes
// categories that actually have sub-categories on that axis — so "Reactions of
// People" and "Positions of People" are ABSENT from the Condition list, not
// greyed out, not disabled with a tooltip. Nothing here hardcodes that; it
// falls out of the seed data.
//
// Only at-risk types (UNSAFE_ACT / UNSAFE_CONDITION) carry the STOP taxonomy —
// the sub-category labels are all deviation-phrased ("PPE not worn"), which
// would read as nonsense under a Safe Act. Safe observations render the legacy
// hazard-category dropdown instead; the parent form supplies it via
// `safeCategorySlot`.

import { useCallback, useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AlertCircle, Loader2 } from "lucide-react";

const MX = { navy: "#0B1F4D", gold: "#C9A961", ice: "#E8EEF7" };

export const AT_RISK_TYPES = ["UNSAFE_ACT", "UNSAFE_CONDITION"];

export function isAtRisk(type: string): boolean {
  return AT_RISK_TYPES.includes(type);
}

/** ACT / CONDITION for any of the four ObservationType values. Mirrors
 *  services/observation_taxonomy.axis_for_type — kept here only to decide what
 *  to render; the server re-derives it and is the authority. */
export function axisForType(type: string): "ACT" | "CONDITION" | null {
  if (type === "SAFE_ACT" || type === "UNSAFE_ACT") return "ACT";
  if (type === "SAFE_CONDITION" || type === "UNSAFE_CONDITION") return "CONDITION";
  return null;
}

type Category = { categoryCode: string; categoryLabel: string; stopReferenceCode: string };
type SubCategory = { subCategoryCode: string; subCategoryLabel: string; stopReferenceCode: string };

export type StopTaxonomyValue = { categoryCode: string; subCategoryCode: string };

export function StopTaxonomyFields({
  type,
  value,
  onChange,
  safeCategorySlot,
  disabled
}: {
  type: string;
  value: StopTaxonomyValue;
  onChange: (next: StopTaxonomyValue) => void;
  /** Rendered instead of the STOP pair when the type is a safe observation. */
  safeCategorySlot?: React.ReactNode;
  disabled?: boolean;
}) {
  const axis = axisForType(type);
  const atRisk = isAtRisk(type);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [loadError, setLoadError] = useState("");
  // Set when a type switch invalidated the current category (§5.3) — the
  // observer is told the selection was dropped rather than left wondering.
  const [clearedNotice, setClearedNotice] = useState("");

  // onChange identity changes every parent render in the uncontrolled create
  // form; hold it in a ref so it can't retrigger the fetch effects.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  const apply = useCallback((next: StopTaxonomyValue) => {
    onChangeRef.current(next);
  }, []);

  // ── Categories: refetch whenever the Act/Condition axis changes ──
  useEffect(() => {
    if (!atRisk || !axis) {
      setCategories([]);
      setSubCategories([]);
      setClearedNotice("");
      return;
    }
    let alive = true;
    setLoadingCats(true);
    setLoadError("");
    fetch(`/api/observation-taxonomy/categories?type=${axis}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Could not load categories"))))
      .then((data) => {
        if (!alive) return;
        const items: Category[] = data.items ?? [];
        setCategories(items);

        // §5.3 — a category that isn't eligible on the new axis (Reactions /
        // Positions of People under Condition) must not stay silently selected.
        const current = valueRef.current.categoryCode;
        if (current && !items.some((c) => c.categoryCode === current)) {
          const label = current.replace(/_/g, " ").toLowerCase();
          setClearedNotice(
            `"${label}" isn't observable as ${axis === "CONDITION" ? "a condition" : "an act"} — ` +
              "please pick a category again."
          );
          apply({ categoryCode: "", subCategoryCode: "" });
        } else {
          setClearedNotice("");
        }
      })
      .catch((e) => {
        if (alive) setLoadError(e?.message ?? "Could not load categories");
      })
      .finally(() => {
        if (alive) setLoadingCats(false);
      });
    return () => {
      alive = false;
    };
  }, [axis, atRisk, apply]);

  // ── Sub-categories: only once BOTH axis and category are set (§5.2) ──
  useEffect(() => {
    if (!atRisk || !axis || !value.categoryCode) {
      setSubCategories([]);
      return;
    }
    let alive = true;
    setLoadingSubs(true);
    fetch(
      `/api/observation-taxonomy/subcategories?type=${axis}&category=${encodeURIComponent(value.categoryCode)}`
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Could not load sub-categories"))))
      .then((data) => {
        if (!alive) return;
        const items: SubCategory[] = data.items ?? [];
        setSubCategories(items);
        // Drop a sub-category that doesn't belong to the new (axis, category).
        const current = valueRef.current.subCategoryCode;
        if (current && !items.some((s) => s.subCategoryCode === current)) {
          apply({ categoryCode: valueRef.current.categoryCode, subCategoryCode: "" });
        }
      })
      .catch((e) => {
        if (alive) setLoadError(e?.message ?? "Could not load sub-categories");
      })
      .finally(() => {
        if (alive) setLoadingSubs(false);
      });
    return () => {
      alive = false;
    };
  }, [axis, atRisk, value.categoryCode, apply]);

  if (!atRisk) return <>{safeCategorySlot}</>;

  const axisWord = axis === "CONDITION" ? "condition" : "act";

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="categoryCode">
          Category<span className="text-rose-600 ml-0.5">*</span>
          <span
            className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ background: MX.ice, color: MX.navy }}
          >
            DuPont STOP
          </span>
        </Label>
        <Select
          name="categoryCode"
          required
          disabled={disabled || loadingCats}
          value={value.categoryCode}
          onChange={(e) => {
            setClearedNotice("");
            // Changing category always invalidates the sub-category (§5.2).
            onChange({ categoryCode: e.target.value, subCategoryCode: "" });
          }}
        >
          <option value="">
            {loadingCats ? "Loading…" : `— Select a category observable as an unsafe ${axisWord} —`}
          </option>
          {categories.map((c) => (
            <option key={c.categoryCode} value={c.categoryCode}>
              {c.categoryLabel} ({c.stopReferenceCode})
            </option>
          ))}
        </Select>
        <p className="text-xs text-slate-500">
          {loadingCats ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 size={11} className="animate-spin" /> Loading categories for this observation type…
            </span>
          ) : (
            `Showing the ${categories.length} categories that apply to an unsafe ${axisWord}.`
          )}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subCategoryCode">
          Sub-category<span className="text-rose-600 ml-0.5">*</span>
        </Label>
        <Select
          name="subCategoryCode"
          required
          disabled={disabled || !value.categoryCode || loadingSubs}
          value={value.subCategoryCode}
          onChange={(e) => onChange({ categoryCode: value.categoryCode, subCategoryCode: e.target.value })}
        >
          <option value="">
            {!value.categoryCode
              ? "— Select a category first —"
              : loadingSubs
                ? "Loading…"
                : "— Select a sub-category —"}
          </option>
          {subCategories.map((s) => (
            <option key={s.subCategoryCode} value={s.subCategoryCode}>
              {s.subCategoryLabel}
            </option>
          ))}
        </Select>
      </div>

      {clearedNotice && (
        <div
          className="sm:col-span-2 flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: MX.gold, background: `${MX.gold}1A`, color: MX.navy }}
        >
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>{clearedNotice}</span>
        </div>
      )}

      {loadError && (
        <div className="sm:col-span-2 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>{loadError}. Reload the page — the taxonomy master may not be seeded yet.</span>
        </div>
      )}
    </>
  );
}
