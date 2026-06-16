"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CheckCircle2, AlertCircle, Send, Loader2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

function safeParseList(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    return [];
  } catch {
    return [];
  }
}

function safeParseObject(s: string | null | undefined): Record<string, string> {
  if (!s) return {};
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) out[k] = String(v);
      return out;
    }
    return {};
  } catch {
    return {};
  }
}

// Inspector executes the inspection here. Renders the equipment's checklist,
// captures per-item results + overall result + notes, then advances the
// workflow via /api/workflow/submit-execution. Persists checklist/result via
// PATCH /api/inspections/[id] before submitting so a failed network call
// still leaves the data captured.
export function InspectionExecutionPanel({
  inspectionId,
  taskId,
  taskName,
  taskDueAt,
  checklistTemplateJson,
  initialChecklistResultJson,
  initialResult,
  initialObservations
}: {
  inspectionId: string;
  taskId: string;
  taskName: string;
  taskDueAt: Date | string | null;
  checklistTemplateJson: string | null;
  initialChecklistResultJson: string | null;
  initialResult: string | null;
  initialObservations: string | null;
}) {
  const router = useRouter();
  const checklistItems = useMemo(() => safeParseList(checklistTemplateJson), [checklistTemplateJson]);
  const [results, setResults] = useState<Record<string, string>>(() => safeParseObject(initialChecklistResultJson));
  const [overall, setOverall] = useState<string>(initialResult ?? "Pass");
  const [observations, setObservations] = useState(initialObservations ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");

    if (checklistItems.length > 0 && Object.keys(results).length === 0) {
      setError("Mark at least one checklist item before submitting.");
      return;
    }

    setBusy(true);

    // Step 1: persist the inspection data (per-item results, overall result,
    // observations). The PATCH endpoint also auto-creates the Observation if
    // result is Fail/Partial.
    const patch = await fetch(`/api/inspections/${inspectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        checklistResult: Object.keys(results).length > 0 ? JSON.stringify(results) : undefined,
        result: overall,
        observations: observations || null
      })
    });
    if (!patch.ok) {
      const j = await patch.json().catch(() => ({}));
      setError(j.error ?? "Failed to save inspection results");
      setBusy(false);
      return;
    }

    // Step 2: advance the workflow to Section Head verification.
    const advance = await fetch("/api/workflow/submit-execution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId,
        comments: observations || `Inspection completed — overall result: ${overall}`
      })
    });
    setBusy(false);
    if (!advance.ok) {
      const j = await advance.json().catch(() => ({}));
      setError(j.error ?? "Failed to advance workflow");
      return;
    }
    router.refresh();
  }

  return (
    <Card className="border-amber-300 ring-2 ring-amber-100">
      <CardHeader className="bg-amber-50 rounded-t-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-amber-900 flex items-center gap-2">
              <AlertCircle size={18} /> Inspection Assigned to You
            </CardTitle>
            <CardDescription className="text-amber-700">{taskName}</CardDescription>
          </div>
          {taskDueAt && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-amber-600">Due</div>
              <div className="text-xs text-amber-900 font-medium">{formatDateTime(taskDueAt)}</div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <p className="text-sm text-slate-700">
          Walk the equipment, mark each checklist item, capture overall result + observations.
          A Fail / Partial result will auto-create a Safety Observation for follow-up.
        </p>

        <div className="space-y-2">
          <Label>Overall Result<span className="text-rose-600">*</span></Label>
          <Select value={overall} onChange={(e) => setOverall(e.target.value)}>
            <option value="Pass">Pass</option>
            <option value="Partial">Partial / Minor</option>
            <option value="Fail">Fail</option>
          </Select>
        </div>

        {checklistItems.length > 0 ? (
          <div>
            <Label>Checklist Items</Label>
            <div className="mt-2 space-y-2 border rounded-md p-3 bg-white">
              {checklistItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex-1 min-w-0">{item}</span>
                  <Select
                    className="w-32"
                    value={results[item] ?? "Pass"}
                    onChange={(e) => setResults({ ...results, [item]: e.target.value })}
                  >
                    <option>Pass</option>
                    <option>Marginal</option>
                    <option>Fail</option>
                    <option>N/A</option>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-amber-800 bg-amber-50/60 border border-amber-200 rounded p-2">
            No checklist template configured for this equipment — capture overall result + observations.
          </p>
        )}

        <div className="space-y-2">
          <Label>Field Observations</Label>
          <Textarea
            rows={3}
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Anomalies, damage, environmental conditions, follow-up needed..."
          />
        </div>

        {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</div>}

        <div className="flex gap-2 pt-1">
          <Button onClick={submit} disabled={busy} variant="success">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {busy ? "Submitting…" : "Submit for Verification"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
