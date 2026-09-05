"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { WizardSubmission } from "./wizard-types";
import { patchSubmission } from "./wizard-api";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function StepPeriod({
  submission,
  onSaved,
  isReadOnly
}: {
  submission: WizardSubmission;
  onSaved: (s: WizardSubmission) => void;
  isReadOnly: boolean;
}) {
  const [permanent, setPermanent] = useState(submission.totalEmployeeStrength);
  const [contract, setContract] = useState(submission.totalContractorStrength);
  const [days, setDays] = useState(submission.totalDaysWorked);
  const [shifts, setShifts] = useState(submission.totalShiftsWorked);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    permanent !== submission.totalEmployeeStrength ||
    contract !== submission.totalContractorStrength ||
    days !== submission.totalDaysWorked ||
    shifts !== submission.totalShiftsWorked;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await patchSubmission(submission.id, {
        totalEmployeeStrength: permanent,
        totalContractorStrength: contract,
        totalDaysWorked: days,
        totalShiftsWorked: shifts
      });
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
        <h2 className="text-lg font-semibold text-slate-900">Step 1 — Period & Strength</h2>
        <p className="text-sm text-slate-500 mt-1">
          Confirm the reporting period and enter end-of-period headcount and working days. Strength
          counts are the totals you'd report on your statutory return — granular department- and
          contractor-wise breakdowns come in Steps 2-4.
        </p>
      </div>

      {/* Period — fixed at submission creation, displayed for context */}
      <Card className="grid sm:grid-cols-3 gap-4 rounded-md bg-slate-50 border p-4 shadow-none">
        <Field label="Plant">
          <div className="text-sm font-medium">{submission.plant.name}</div>
          <div className="text-xs text-slate-500">{submission.plant.code}</div>
        </Field>
        <Field label="Reporting month">
          <div className="text-sm font-medium">
            {MONTHS[submission.reportingMonth]} {submission.reportingYear}
          </div>
        </Field>
        <Field label="Period">
          <div className="text-xs text-slate-700">
            {new Date(submission.reportingPeriodStart).toLocaleDateString("en-IN")} —{" "}
            {new Date(
              new Date(submission.reportingPeriodEnd).getTime() - 1
            ).toLocaleDateString("en-IN")}
          </div>
        </Field>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        <NumField
          label="Permanent + Trainee strength (end of period)"
          hint="Total employees on payroll on the last day of the month"
          value={permanent}
          onChange={setPermanent}
          disabled={isReadOnly}
        />
        <NumField
          label="Contract workmen strength (end of period)"
          hint="Total contract workmen on site on the last day"
          value={contract}
          onChange={setContract}
          disabled={isReadOnly}
        />
        <NumField
          label="Total working days"
          hint="Calendar days the plant operated; reduce for shutdowns"
          value={days}
          onChange={setDays}
          disabled={isReadOnly}
        />
        <NumField
          label="Total shifts worked"
          hint="Sum of A + B + C + G shifts across the month (optional)"
          value={shifts}
          onChange={setShifts}
          disabled={isReadOnly}
        />
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </Alert>
      )}

      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-slate-500">
          {dirty ? "Unsaved changes" : "All changes saved"}
        </div>
        <Button onClick={save} disabled={!dirty || saving || isReadOnly}>
          {saving ? "Saving…" : "Save Step 1"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      {children}
    </div>
  );
}

function NumField({
  label,
  hint,
  value,
  onChange,
  disabled
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        disabled={disabled}
      />
      {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}
