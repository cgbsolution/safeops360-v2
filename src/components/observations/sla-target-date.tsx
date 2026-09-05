"use client";

/**
 * Target Closure Date — auto-calculated from the SLA matrix, read-only, with a
 * reason-required override.
 *
 * The preview resolves on Severity + Type + STOP Category. Behavioural vs
 * Physical comes from the configurable `ObservationCategoryGroup` mapping, so
 * for an at-risk observation the date settles once a category is chosen; safe
 * observations carry no STOP category and fall back to the axis.
 *
 * Two distinct gaps both fall back to a plain editable date input, so neither
 * ever blocks a submission (spec §2.1):
 *   • NO_POLICY        — no matrix row for this severity × group
 *   • PENDING_DECISION — the category has no agreed Behavioural/Physical
 *                        classification yet. Deliberately NOT resolved either
 *                        way; the reporter is told why.
 */

import * as React from "react";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Info, AlertTriangle, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export type SlaPreview = {
  matched: boolean;
  categoryGroup: string | null;
  categoryGroupSource?: string | null;
  reason?: "PENDING_DECISION" | "NO_POLICY" | null;
  severity: string;
  slaDays: number | null;
  targetDate: string | null;
  label: string | null;
  scope?: string | null;
};

export const MIN_OVERRIDE_REASON = 10;

export function useSlaPreview(
  plantId: string,
  type: string,
  severity: string,
  date: string,
  categoryCode?: string
) {
  const [preview, setPreview] = React.useState<SlaPreview | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!plantId || !type || !severity) return;
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams({ plantId, type, severity });
    // Omitted for the SAFE_* types, which carry no STOP category — the server
    // falls back to the axis for those.
    if (categoryCode) params.set("categoryCode", categoryCode);
    if (date) params.set("date", new Date(date).toISOString());

    fetch(`/api/observations/sla-config/preview?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive) setPreview(data);
      })
      .catch(() => {
        // A failed preview must not block the form — fall back to manual entry
        // rather than leaving the user with a dead read-only field.
        if (alive) setPreview(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [plantId, type, severity, date, categoryCode]);

  return { preview, loading };
}

function toDateInput(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

export function SlaTargetDateField({
  preview,
  loading,
  overrideDate,
  overrideReason,
  onOverrideDate,
  onOverrideReason,
  minDate,
}: {
  preview: SlaPreview | null;
  loading: boolean;
  overrideDate: string;
  overrideReason: string;
  onOverrideDate: (v: string) => void;
  onOverrideReason: (v: string) => void;
  minDate: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const autoDate = toDateInput(preview?.targetDate);

  // No policy → plain manual field. Nothing about this path is disabled: an
  // unconfigured matrix is a config gap, not a reason to block reporting.
  if (!loading && preview && !preview.matched) {
    const pending = preview.reason === "PENDING_DECISION";
    return (
      <div className="space-y-1.5">
        <DatePicker
          name="targetDate"
          min={minDate}
          value={overrideDate}
          onChange={onOverrideDate}
          ariaLabel="Target closure date"
        />
        <p className="flex items-start gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {pending ? (
            <>
              This category is awaiting a closure-policy decision — set the date manually.
              It has not been classified as behavioural or physical yet, so no SLA applies.
            </>
          ) : (
            <>
              No SLA policy configured for {preview.severity} /{" "}
              {preview.categoryGroup?.toLowerCase() ?? "this category"} — set the date manually.
            </>
          )}
        </p>
      </div>
    );
  }

  if (loading || !preview) {
    return (
      <DatePicker name="targetDate" min={minDate} value="" onChange={() => {}} disabled placeholder="Calculating…" />
    );
  }

  // Policy matched. The date is submitted by the server regardless of what the
  // client sends, so this input is display-only until an override is started.
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <DatePicker
          value={editing ? overrideDate : autoDate}
          min={minDate}
          disabled={!editing}
          onChange={onOverrideDate}
          ariaLabel="Target closure date"
          className={editing ? "" : "bg-muted/50 text-muted-foreground disabled:opacity-100"}
        />
        {!editing ? (
          <button
            type="button"
            onClick={() => {
              onOverrideDate(autoDate);
              setEditing(true);
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-input px-2.5 py-2 text-xs hover:bg-accent"
            title="Override the SLA date (reason required)"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              onOverrideDate("");
              onOverrideReason("");
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-input px-2.5 py-2 text-xs hover:bg-accent"
            title="Discard the override and go back to the SLA date"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        )}
      </div>

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {preview.label}
        {preview.scope === "PLANT" && " · plant-specific policy"}
      </p>

      {editing && (
        <Card className="space-y-1.5 rounded-md border-amber-200 bg-amber-50/60 p-2.5 shadow-none">
          <Label htmlFor="override-reason" className="block text-xs text-amber-900">
            Why does this observation need a different closure date?
          </Label>
          <Textarea
            id="override-reason"
            rows={2}
            value={overrideReason}
            onChange={(e) => onOverrideReason(e.target.value)}
            placeholder="e.g. Contractor mobilisation for the guard replacement is booked for the 14th."
            className="bg-background text-sm"
          />
          <p className="text-xs text-amber-800">
            {overrideReason.trim().length < MIN_OVERRIDE_REASON
              ? `${MIN_OVERRIDE_REASON - overrideReason.trim().length} more character(s) required — this is recorded in the audit trail.`
              : "Recorded in the closure-date audit trail with your name."}
          </p>
        </Card>
      )}

      {/* Submitted only on the manual/override path; with a policy in force the
          server computes the date and ignores any client value. */}
      {editing && <input type="hidden" name="targetDate" value={overrideDate} />}
    </div>
  );
}
