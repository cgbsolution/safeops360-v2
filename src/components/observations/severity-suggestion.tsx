"use client";

/**
 * Severity — pre-filled from the deterministic suggestion engine, always
 * editable, reason required when the observer disagrees.
 *
 * The problem this solves: Severity was a free dropdown with no relationship to
 * the STOP taxonomy, so identical hazard classifications were rated Low by one
 * observer and High by the next — which makes the category heat-map and every
 * severity trend unreadable.
 *
 * Rules the implementation holds to:
 *
 *   • **Nothing about severity is decided in the browser.** The suggested value,
 *     the rationale, the severity ladder and the minimum reason length all come
 *     from `/api/observations/severity-suggestion`. There is no copy of the
 *     matrix here to drift out of sync, and the server re-resolves at submit
 *     anyway — this component cannot grant or dodge the override requirement.
 *
 *   • **No rule ⇒ exactly the old behaviour.** A combination with no seeded rule
 *     renders a plain dropdown: no suggestion label, no reason field, no error.
 *     Reporting must never be blocked by unconfigured policy.
 *
 *   • **Suggested ≠ imposed.** The select is never disabled. The suggestion is
 *     a starting point with its reasoning attached, and disagreement is a
 *     first-class outcome that gets recorded rather than prevented.
 */

import * as React from "react";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, AlertTriangle, MapPin } from "lucide-react";

const MX = { navy: "#0B1F4D", gold: "#C9A961", ice: "#E8EEF7" };

export type SeveritySuggestion = {
  suggested: string | null;
  baseSeverity: string | null;
  tierApplied: string | null;
  tierSource: string | null;
  tierUplifted: boolean;
  rationale: string | null;
  matrixRuleId: string | null;
  observationType: string | null;
  categoryCode: string | null;
  subCategoryCode: string | null;
  severityLadder: string[];
  minOverrideReasonChars: number;
};

const FALLBACK_LADDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function severityLabel(value: string | null | undefined) {
  if (!value) return "";
  return value.charAt(0) + value.slice(1).toLowerCase();
}

/**
 * Fetches the suggestion whenever any input to it changes.
 *
 * Deliberately fires on `areaId` too: the area hazard tier can lift the base
 * severity a rung, so a suggestion computed before the area was picked would be
 * quietly wrong on a HighHazard area.
 */
export function useSeveritySuggestion({
  observationType,
  categoryCode,
  subCategoryCode,
  plantId,
  areaId,
  enabled = true,
}: {
  observationType: string;
  categoryCode?: string;
  subCategoryCode?: string;
  plantId?: string;
  areaId?: string;
  enabled?: boolean;
}) {
  const [suggestion, setSuggestion] = React.useState<SeveritySuggestion | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    // Both halves of the taxonomy pair are required — §3 fires the call once
    // Category AND Sub-category are set, because a category alone maps to
    // several rules with different base severities.
    if (!enabled || !observationType || !categoryCode || !subCategoryCode) {
      setSuggestion(null);
      return;
    }
    let alive = true;
    setLoading(true);

    const params = new URLSearchParams({
      observationType,
      category: categoryCode,
      subCategory: subCategoryCode,
    });
    if (plantId) params.set("plantId", plantId);
    if (areaId) params.set("areaId", areaId);

    fetch(`/api/observations/severity-suggestion?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive) setSuggestion(data);
      })
      .catch(() => {
        // A failed lookup falls back to manual selection rather than leaving
        // the observer with a dead field. The server still re-resolves at
        // submit, so nothing is lost except the on-screen hint.
        if (alive) setSuggestion(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [enabled, observationType, categoryCode, subCategoryCode, plantId, areaId]);

  return { suggestion, loading };
}

export function SeveritySuggestionField({
  value,
  onChange,
  suggestion,
  loading,
  reason,
  onReasonChange,
  name = "severity",
  suppressInitialPrefill = false,
}: {
  value: string;
  onChange: (next: string) => void;
  suggestion: SeveritySuggestion | null;
  loading: boolean;
  reason: string;
  onReasonChange: (next: string) => void;
  name?: string;
  /**
   * Edit forms pass `true`. Opening a saved record must never rewrite the
   * severity somebody already decided on — the first suggestion is absorbed
   * silently. Reclassifying the record afterwards still re-prefills, because
   * that produces a different suggestion key.
   */
  suppressInitialPrefill?: boolean;
}) {
  const suggested = suggestion?.suggested ?? null;
  const ladder = suggestion?.severityLadder?.length ? suggestion.severityLadder : FALLBACK_LADDER;
  const minChars = suggestion?.minOverrideReasonChars ?? 10;

  // Re-prefill whenever the CLASSIFICATION changes, not on every render. A
  // manual severity choice therefore sticks — until the observer reclassifies
  // the observation, at which point the old choice was made about a different
  // hazard and the fresh suggestion should win.
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const onReasonRef = React.useRef(onReasonChange);
  onReasonRef.current = onReasonChange;
  const appliedKey = React.useRef<string | null>(null);

  const suggestionKey = suggested
    ? `${suggestion?.observationType}|${suggestion?.categoryCode}|${suggestion?.subCategoryCode}|${suggested}`
    : null;

  const seenAny = React.useRef(false);

  React.useEffect(() => {
    if (!suggestionKey || !suggested) return;
    if (appliedKey.current === suggestionKey) return;
    const isFirst = !seenAny.current;
    seenAny.current = true;
    appliedKey.current = suggestionKey;
    // Absorb the first suggestion without applying it on an edit form — see
    // `suppressInitialPrefill`. The key is still recorded, so a later
    // reclassification is correctly treated as a change and does prefill.
    if (suppressInitialPrefill && isFirst) return;
    onChangeRef.current(suggested);
    // The old justification described a divergence that no longer exists.
    onReasonRef.current("");
  }, [suggestionKey, suggested, suppressInitialPrefill]);

  const diverged = Boolean(suggested && value && value !== suggested);
  const shortfall = minChars - reason.trim().length;

  return (
    <div className="space-y-1.5">
      {/* Never disabled — not while loading either. A slow lookup must not make
          the field feel broken, and the server re-resolves regardless. */}
      <SelectField
        name={name}
        required
        value={value}
        onChange={onChange}
        ariaLabel="Severity"
        options={ladder.map((s) => ({ value: s, label: severityLabel(s) }))}
      />

      {/* Persistent inline label, not a tooltip — §3.2. It has to survive the
          observer looking away to read the rationale. */}
      {suggested && !diverged && (
        <p
          className="flex items-start gap-1.5 text-xs"
          style={{ color: MX.navy }}
          title={suggestion?.rationale ?? undefined}
        >
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: MX.gold }} />
          <span>
            <strong className="font-semibold">Suggested: {severityLabel(suggested)}</strong>
            <span className="text-slate-500">
              {" "}
              — based on the sub-category
              {suggestion?.tierUplifted ? " and this area's hazard tier" : ""}.
            </span>
          </span>
        </p>
      )}

      {/* The tier is called out only when it actually changed the answer.
          Naming a Standard area on every observation is noise. */}
      {suggested && suggestion?.tierUplifted && (
        <p className="flex items-start gap-1.5 text-xs text-slate-500">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Raised from {severityLabel(suggestion.baseSeverity)} because this{" "}
            {suggestion.tierSource === "area" ? "area" : "plant"} is rated{" "}
            <strong className="font-medium">{suggestion.tierApplied}</strong>.
          </span>
        </p>
      )}

      {suggestion?.rationale && suggested && (
        <p className="pl-5 text-xs italic text-slate-500">{suggestion.rationale}</p>
      )}

      {/* §3.4 — the reason field appears only on divergence, and only when
          there was a suggestion to diverge from. */}
      {diverged && (
        <div
          className="space-y-1.5 rounded-md border p-2.5"
          style={{ borderColor: MX.gold, background: `${MX.gold}14` }}
        >
          <label
            className="flex items-start gap-1.5 text-xs font-medium"
            style={{ color: MX.navy }}
            htmlFor="severityOverrideReason"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: MX.gold }} />
            <span>
              Why does this differ from the suggested {severityLabel(suggested)}?
            </span>
          </label>
          <Textarea
            id="severityOverrideReason"
            name="severityOverrideReason"
            rows={2}
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="e.g. The guard was missing on the infeed side, where the operator's hands are within reach of the nip point."
            className="bg-background text-sm"
          />
          <p className="text-xs" style={{ color: MX.navy }}>
            {shortfall > 0
              ? `${shortfall} more character(s) required — this is recorded against the record and used to correct the severity matrix.`
              : "Recorded with your name. Repeated overrides on this sub-category are what get the suggestion fixed."}
          </p>
        </div>
      )}

      {/* Echoed for diagnostics only. The server recomputes the suggestion and
          that value — not this one — decides whether a reason was required. */}
      {suggested && <input type="hidden" name="suggestedSeverity" value={suggested} />}

      {/* No rule for this combination: nothing is rendered above the select, so
          the field behaves exactly as it did before this feature existed. */}
      {!loading && suggestion && !suggested && (
        <p className="text-xs text-slate-500">
          No severity guidance is configured for this classification yet — use your judgement.
        </p>
      )}
    </div>
  );
}
