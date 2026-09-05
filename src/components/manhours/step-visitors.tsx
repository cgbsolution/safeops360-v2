"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { WizardSubmission } from "./wizard-types";
import { putVisitors, fetchSubmission } from "./wizard-api";
import { Alert } from "@/components/ui/alert";

export function StepVisitors({
  submission,
  onSaved,
  isReadOnly
}: {
  submission: WizardSubmission;
  onSaved: (s: WizardSubmission) => void;
  isReadOnly: boolean;
}) {
  const initial = submission.visitors;
  const [count, setCount] = useState(initial?.totalVisitorCount ?? 0);
  const [hours, setHours] = useState(initial?.totalVisitorHours ?? 0);
  const [notable, setNotable] = useState(initial?.notableVisits ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    count !== (initial?.totalVisitorCount ?? 0) ||
    hours !== (initial?.totalVisitorHours ?? 0) ||
    notable !== (initial?.notableVisits ?? "");

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await putVisitors(submission.id, {
        totalVisitorCount: count,
        totalVisitorHours: hours,
        notableVisits: notable.trim() || null
      });
      const fresh = await fetchSubmission(submission.id);
      onSaved(fresh);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // Default rule-of-thumb: 2 hours per visit. Surface as a helper
  // when the user has entered count but not hours.
  const suggested = hours === 0 && count > 0 ? count * 2 : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Step 5 — Visitor Records</h2>
        <p className="text-sm text-slate-500 mt-1">
          Visitors are tracked for total exposure but are typically excluded from employee-denominator KPIs.
          A reasonable estimate is fine — most plants don't capture visitor hours precisely.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Total visitor count</Label>
          <Input
            type="number"
            min={0}
            value={count}
            onChange={(e) => setCount(Number(e.target.value || 0))}
            disabled={isReadOnly}
          />
          <div className="text-[11px] text-slate-500">All visitors who entered the plant during the period.</div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Total visitor hours</Label>
          <Input
            type="number"
            min={0}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value || 0))}
            disabled={isReadOnly}
          />
          <div className="text-[11px] text-slate-500">
            Default rule of thumb: 2 hours per visit. {suggested != null && (
              <Button variant="link"
                type="button" className="underline"
                onClick={() => setHours(suggested)}>
                Use {suggested} ({count} × 2)
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Notable visits (optional)</Label>
        <Textarea
          value={notable}
          onChange={(e) => setNotable(e.target.value)}
          placeholder="e.g. Factory Inspector audit on 12 Apr; HSE corporate review week of 22 Apr"
          rows={4}
          disabled={isReadOnly}
        />
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</Alert>
      )}

      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-slate-500">{dirty ? "Unsaved changes" : "All changes saved"}</div>
        <Button onClick={save} disabled={!dirty || saving || isReadOnly}>
          {saving ? "Saving…" : "Save Step 5"}
        </Button>
      </div>
    </div>
  );
}
