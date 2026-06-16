"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber } from "@/lib/utils";
import type { WizardSubmission } from "./wizard-types";
import { patchSubmission } from "./wizard-api";

interface DeductionField {
  key:
    | "hoursAnnualLeave"
    | "hoursSickLeave"
    | "hoursTraining"
    | "hoursMaternityLeave"
    | "hoursOther";
  label: string;
  hint: string;
}

const FIELDS: DeductionField[] = [
  { key: "hoursAnnualLeave", label: "Annual leave", hint: "Privilege/earned leave taken during the period" },
  { key: "hoursSickLeave", label: "Sick leave", hint: "Sick leave + casual sick days" },
  {
    key: "hoursTraining",
    label: "Off-job training",
    hint: "Classroom / off-site training. On-job toolbox talks DON'T count."
  },
  {
    key: "hoursMaternityLeave",
    label: "Maternity / paternity",
    hint: "Statutory parental leave"
  },
  {
    key: "hoursOther",
    label: "Other",
    hint: "Bereavement, jury duty, sabbatical, etc. — explain in submission notes"
  }
];

export function StepDeductions({
  submission,
  onSaved,
  isReadOnly
}: {
  submission: WizardSubmission;
  onSaved: (s: WizardSubmission) => void;
  isReadOnly: boolean;
}) {
  const [values, setValues] = useState<Record<DeductionField["key"], number>>({
    hoursAnnualLeave: submission.hoursAnnualLeave,
    hoursSickLeave: submission.hoursSickLeave,
    hoursTraining: submission.hoursTraining,
    hoursMaternityLeave: submission.hoursMaternityLeave,
    hoursOther: submission.hoursOther
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = FIELDS.some((f) => values[f.key] !== submission[f.key]);

  const sum = FIELDS.reduce((s, f) => s + values[f.key], 0);
  const gross = submission.totalManhoursAll;
  const netPreview = Math.max(0, gross - sum);
  const pct = gross > 0 ? (sum / gross) * 100 : 0;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await patchSubmission(submission.id, values);
      onSaved(updated);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Step 6 — Deductions</h2>
        <p className="text-sm text-slate-500 mt-1">
          Hours NOT counted toward exposure per IS 3786. Net exposure hours = total hours −
          deductions, and is the denominator for LTIFR / TRIR / Severity Rate. Typical
          deductions are 5-15% of gross hours; large deviations get flagged in Step 8.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label className="text-sm">{f.label}</Label>
            <Input
              type="number"
              min={0}
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: Number(e.target.value || 0) }))}
              disabled={isReadOnly}
            />
            <div className="text-[11px] text-slate-500">{f.hint}</div>
          </div>
        ))}
      </div>

      <div className="rounded-md border bg-slate-50 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Stat label="Gross hours" value={formatNumber(gross)} />
          <Stat label="Total deductions" value={formatNumber(sum)} hint={`${pct.toFixed(1)}% of gross`} />
          <Stat
            label="Net exposure (preview)"
            value={formatNumber(netPreview)}
            tone="primary"
            hint="updates on save"
          />
          <Stat
            label="Currently stored"
            value={formatNumber(submission.netExposureHours)}
            hint={
              Math.abs(submission.netExposureHours - netPreview) < 0.01
                ? "in sync"
                : "save to refresh"
            }
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-slate-500">{dirty ? "Unsaved changes" : "All changes saved"}</div>
        <Button onClick={save} disabled={!dirty || saving || isReadOnly}>
          {saving ? "Saving…" : "Save Step 6"}
        </Button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "primary";
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div
        className={
          tone === "primary" ? "text-2xl font-bold text-primary-800 tabular-nums" : "text-xl font-semibold text-slate-900 tabular-nums"
        }
      >
        {value}
      </div>
      {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}
