"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, AlertTriangle, XCircle, Info, RotateCw } from "lucide-react";
import type { WizardSubmission } from "./wizard-types";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import {
  fetchValidation,
  patchSubmission,
  submitSubmission
} from "./wizard-api";
import type {
  ValidationIssue,
  ValidationReport
} from "@/lib/manhours/validation";

export function StepValidate({
  submission,
  onSaved,
  onSubmitted,
  isReadOnly
}: {
  submission: WizardSubmission;
  onSaved: (s: WizardSubmission) => void;
  onSubmitted: () => void;
  isReadOnly: boolean;
}) {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(submission.submissionNotes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);

  async function refreshReport() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchValidation(submission.id);
      setReport(r);
    } catch (e: any) {
      setError(e?.message ?? "Validation failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission.id]);

  async function saveNotes() {
    setSavingNotes(true);
    try {
      const updated = await patchSubmission(submission.id, { submissionNotes: notes });
      onSaved(updated);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  }

  async function doSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      // Save current notes first so they go in with the SUBMITTED row.
      if (notes !== (submission.submissionNotes ?? "")) {
        await patchSubmission(submission.id, { submissionNotes: notes });
      }
      await submitSubmission(submission.id, notes || null);
      onSubmitted();
    } catch (e: any) {
      // Server returns the report on 422 — show it inline so the user
      // sees what changed since their last refresh.
      setError(e?.message ?? "Submit failed");
      if (e?.report) setReport(e.report);
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Step 8 — Validate & Submit</h2>
          <p className="text-sm text-slate-500 mt-1">
            System validation runs end-to-end against the data captured in Steps 1-7. FAIL items
            block submit; WARN items don't, but you should explain them in the notes field.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshReport} disabled={loading}>
          <RotateCw size={14} className={loading ? "animate-spin" : ""} /> Re-run
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</Alert>
      )}

      {report && (
        <>
          <ReportSummary report={report} />
          <IssueList issues={report.issues} />
        </>
      )}

      <div className="space-y-2">
        <div className="text-sm font-medium text-slate-900">Submission notes</div>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Explain any deviations the validator flagged (shutdown, ramp-up, festival impact, contractor mobilisation, etc.). Plant Head review goes faster with context."
          rows={4}
          disabled={isReadOnly}
        />
        <div className="flex items-center justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={saveNotes}
            disabled={savingNotes || isReadOnly || notes === (submission.submissionNotes ?? "")}
          >
            {savingNotes ? "Saving…" : "Save notes"}
          </Button>
        </div>
      </div>

      <Card className="rounded-md border bg-slate-50 p-4 flex items-start justify-between gap-3 shadow-none">
        <div className="text-sm text-slate-700">
          <div className="font-medium">Ready to submit?</div>
          <div className="text-xs text-slate-500 mt-1">
            Submit moves this record from DRAFT to SUBMITTED. The Plant Head review queue picks it up;
            you'll be locked out of edits until they return it (if needed).
          </div>
        </div>
        <Button
          onClick={doSubmit}
          disabled={
            isReadOnly ||
            submitting ||
            loading ||
            !report ||
            !report.canSubmit
          }
        >
          {submitting ? "Submitting…" : "Submit for review"}
        </Button>
      </Card>
    </div>
  );
}

// ── Issue presentation ──────────────────────────────────────────

function ReportSummary({ report }: { report: ValidationReport }) {
  const total = report.summary.fail + report.summary.warn + report.summary.info;
  return (
    <div className="grid grid-cols-3 gap-3">
      <SummaryTile
        icon={<XCircle size={18} className="text-rose-700" />}
        count={report.summary.fail}
        label="Blocking"
        tone={report.summary.fail > 0 ? "rose" : "slate"}
      />
      <SummaryTile
        icon={<AlertTriangle size={18} className="text-amber-700" />}
        count={report.summary.warn}
        label="Warnings"
        tone={report.summary.warn > 0 ? "amber" : "slate"}
      />
      <SummaryTile
        icon={<Info size={18} className="text-sky-700" />}
        count={report.summary.info}
        label="Info"
        tone="slate"
      />
      {total === 0 && (
        <Alert variant="success" className="col-span-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={16} /> All checks passed. Ready to submit.
        </Alert>
      )}
    </div>
  );
}

function SummaryTile({
  icon,
  count,
  label,
  tone
}: {
  icon: React.ReactNode;
  count: number;
  label: string;
  tone: "rose" | "amber" | "slate";
}) {
  const cls =
    tone === "rose"
      ? "border-rose-200 bg-rose-50"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50"
        : "border-slate-200 bg-slate-50";
  return (
    <div className={`rounded-md border p-3 ${cls}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs uppercase tracking-wider text-slate-600">{label}</span>
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{count}</div>
    </div>
  );
}

function IssueList({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <div className="space-y-2">
      {issues
        .slice()
        .sort((a, b) => levelRank(b.level) - levelRank(a.level))
        .map((i, idx) => (
          <div
            key={`${i.code}-${idx}`}
            className={`rounded-md border p-3 text-sm ${
              i.level === "FAIL"
                ? "border-rose-200 bg-rose-50"
                : i.level === "WARN"
                  ? "border-amber-200 bg-amber-50"
                  : "border-sky-200 bg-sky-50"
            }`}
          >
            <div className="flex items-start gap-2">
              {i.level === "FAIL" ? (
                <XCircle size={16} className="text-rose-700 flex-shrink-0 mt-0.5" />
              ) : i.level === "WARN" ? (
                <AlertTriangle size={16} className="text-amber-700 flex-shrink-0 mt-0.5" />
              ) : (
                <Info size={16} className="text-sky-700 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-medium text-slate-900">{i.message}</div>
                {i.details && <div className="text-xs text-slate-600 mt-0.5">{i.details}</div>}
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1 font-mono">{i.code}</div>
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}

function levelRank(l: ValidationIssue["level"]): number {
  return l === "FAIL" ? 3 : l === "WARN" ? 2 : 1;
}
