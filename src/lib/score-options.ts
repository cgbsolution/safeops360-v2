import type { SelectOption } from "@/components/ui/select-field";

/**
 * A plain 1–5 scale, as the pickers take it.
 *
 * Every 5×5 matrix in the app — ERM likelihood and impact, the vendor
 * assessment domains — offered this as `[1,2,3,4,5].map(...)` written out at
 * each call site. The values are strings because that is what a listbox holds;
 * callers that store a number wrap with `Number(value)` on change.
 *
 * Scales whose levels are *named* (the incident 5×5, "3 — Moderate") stay with
 * their module: the wording is domain-specific and must not drift into here.
 */
export const SCORE_1_TO_5: SelectOption[] = [1, 2, 3, 4, 5].map((n) => ({
  value: String(n),
  label: String(n)
}));
