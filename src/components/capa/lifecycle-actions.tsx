"use client";

// All CAPA lifecycle mutation forms in one place — RCA submit, action
// add/update, verification submit, closure, recurrence check.
// Surfaced as inline expandable forms on the detail page tabs.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RcaEditor } from "@/components/incidents/rca-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import {
  CAPA_RCA_METHODS,
  deriveCapaCauses,
  emptyDataFor,
  generateRcaSummary,
  isEmptyRcaData,
  normaliseRcaMethod,
  type CapaRcaMethod,
  type RcaMethod
} from "@/lib/rca/types";

// How sure the analyst is about a root cause. One list so the picker and
// any later summary cannot disagree about the wording.
const CONFIDENCE_OPTIONS = ["LOW", "MEDIUM", "HIGH"].map((c) => ({ value: c, label: c }));

const INPUT =
  "flex h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600";
const TEXTAREA =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600";

const ROOT_CAUSE_CATEGORIES = [
  "HUMAN",
  "PROCESS",
  "EQUIPMENT",
  "MATERIAL",
  "ENVIRONMENT",
  "MEASUREMENT",
  "METHOD",
  "MANAGEMENT"
];

const VERIFICATION_RESULTS = [
  { code: "EFFECTIVE", label: "Effective — proceeds to closure" },
  { code: "PARTIALLY_EFFECTIVE", label: "Partially effective" },
  { code: "INEFFECTIVE", label: "Ineffective — loop back to actions" },
  { code: "INCONCLUSIVE", label: "Inconclusive — extend measurement" }
];

// ─── RCA Submission Form ──────────────────────────────────────────────

export function RcaSubmitForm({ capaId, currentState }: { capaId: string; currentState: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [methodology, setMethodology] = useState<CapaRcaMethod | "">("");
  const [methodologyRationale, setMethodologyRationale] = useState("");
  // The analysis itself, in whichever shape the chosen method uses.
  const [analysis, setAnalysis] = useState<unknown>(null);
  const [rcaSummary, setRcaSummary] = useState("");
  // Until the submitter types their own conclusion the summary box mirrors the
  // one generated from the template. Typing in it stops the mirroring, so an
  // edit is never overwritten by the next keystroke in the analysis above.
  const [summaryTouched, setSummaryTouched] = useState(false);
  const [rootCauses, setRootCauses] = useState<
    { description: string; category: string; confidence: string }[]
  >([{ description: "", category: "PROCESS", confidence: "MEDIUM" }]);

  // Only the six methods with a template drive the editor. 8D, Is/Is-Not and
  // "None required" are recorded as a narrative and have no tree to draw.
  const templatedMethod: RcaMethod | null = normaliseRcaMethod(methodology || null);
  const derived = useMemo(
    () => (templatedMethod ? deriveCapaCauses(templatedMethod, analysis) : null),
    [templatedMethod, analysis]
  );
  const generatedSummary = useMemo(
    () => (templatedMethod ? generateRcaSummary(templatedMethod, analysis) : null),
    [templatedMethod, analysis]
  );
  const effectiveSummary = summaryTouched ? rcaSummary : rcaSummary || generatedSummary || "";

  const canSubmit = ["SUBMITTED", "UNDER_RCA", "DRAFT"].includes(currentState);
  if (!canSubmit) return null;

  // Switching method throws away the previous template's contents, so it asks
  // first — but only when there is something to lose. Leaving or entering the
  // templated set counts as the same switch.
  function pickMethod(next: string) {
    const canonical = normaliseRcaMethod(next || null);
    if (templatedMethod && canonical !== templatedMethod && !isEmptyRcaData(templatedMethod, analysis)) {
      const ok = window.confirm(
        "Switching root-cause method will clear the analysis you have entered. Continue?"
      );
      if (!ok) return;
    }
    setMethodology(next ? (next as CapaRcaMethod) : "");
    setAnalysis(canonical ? emptyDataFor(canonical) : null);
  }

  function addRootCause() {
    setRootCauses((arr) => [...arr, { description: "", category: "PROCESS", confidence: "MEDIUM" }]);
  }
  function updateRootCause(i: number, patch: Partial<{ description: string; category: string; confidence: string }>) {
    setRootCauses((arr) => arr.map((rc, j) => (i === j ? { ...rc, ...patch } : rc)));
  }
  function removeRootCause(i: number) {
    setRootCauses((arr) => arr.filter((_, j) => i !== j));
  }
  // Fills the root-cause rows from what the template already says, rather than
  // making the analyst retype their own conclusion. Categories stay at the
  // default — the template does not carry one and guessing would be wrong.
  function pullRootCausesFromAnalysis() {
    if (!derived?.rootCauses.length) return;
    setRootCauses(
      derived.rootCauses.map((description) => ({ description, category: "PROCESS", confidence: "MEDIUM" }))
    );
  }

  function submit() {
    setError(null);
    if (!methodology) {
      setError("Pick a methodology.");
      return;
    }
    const summary = effectiveSummary.trim();
    if (methodology !== "NONE_REQUIRED" && !summary) {
      setError(
        templatedMethod
          ? "RCA summary is required — fill in the analysis above or write the conclusion yourself."
          : "RCA summary is required."
      );
      return;
    }
    const typedRcs = rootCauses.filter((rc) => rc.description.trim());
    // Typed rows win; the template's own conclusion is the fallback so a fully
    // drawn analysis is never rejected for a box the analyst had no reason to
    // fill in twice.
    const validRcs =
      typedRcs.length > 0
        ? typedRcs
        : (derived?.rootCauses ?? []).map((description) => ({
            description,
            category: "PROCESS",
            confidence: "MEDIUM"
          }));
    if (methodology !== "NONE_REQUIRED" && validRcs.length === 0) {
      setError("At least one root cause is required (or pick “None required”).");
      return;
    }
    const hasAnalysis = !!templatedMethod && !isEmptyRcaData(templatedMethod, analysis);
    startTransition(async () => {
      const res = await fetch(`/api/capa/${capaId}/submit-rca`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rcaMethodology: methodology,
          rcaMethodologyRationale: methodologyRationale || undefined,
          rcaSummary: summary || "Not required",
          rootCauses: validRcs,
          // The levels above the root cause. Sending [] used to blank the
          // Why-Why ladder the RCA tab renders, on every single submit.
          contributingFactors: derived?.contributingFactors ?? [],
          rcaAnalysisPayload: hasAnalysis ? analysis : undefined
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Submit failed (${res.status})`);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <div className="mt-4">
        <Button onClick={() => setOpen(true)}>Submit Root Cause Analysis</Button>
      </div>
    );
  }

  return (
    <Card className="mt-4 rounded-xl border bg-slate-50 p-4 space-y-3 shadow-none">
      <h3 className="text-sm font-semibold">Submit RCA</h3>
      {error && (
        <Alert variant="destructive" className="rounded border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm text-rose-900">{error}</Alert>
      )}
      <Field label="Methodology" required>
        <SelectField className={INPUT} value={methodology} onChange={pickMethod}
          placeholder="— Pick a method to load its template —"
          options={CAPA_RCA_METHODS.map((m) => ({ value: m.code, label: `${m.label}` }))}
        />
        <p className="mt-1 text-xs text-slate-500">
          5-Why for simple causal chains. Fishbone (Ishikawa) across the 6M categories. FTA for
          gate logic, Bowtie for barriers, TapRoot for high-severity events, Cause Map for
          impact-led chains. 8D and Is/Is-Not are recorded as a narrative.
        </p>
      </Field>

      {templatedMethod && (
        <Card className="rounded-lg border bg-white p-3 shadow-none">
          <RcaEditor method={templatedMethod} value={analysis} onChange={setAnalysis} readOnly={false} />
        </Card>
      )}
      {!!methodology && !templatedMethod && methodology !== "NONE_REQUIRED" && (
        <p className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-600">
          {CAPA_RCA_METHODS.find((m) => m.code === methodology)?.label} has no structured
          template here — record the conclusion in the summary below and attach the worked
          document on the Overview tab.
        </p>
      )}

      <Field label="Why this methodology?">
        <Input
          className={INPUT}
          value={methodologyRationale}
          onChange={(e) => setMethodologyRationale(e.target.value)} />
      </Field>
      <Field label="RCA summary" required={methodology !== "NONE_REQUIRED"}>
        <Textarea
          className={TEXTAREA}
          rows={3}
          value={effectiveSummary}
          onChange={(e) => {
            setSummaryTouched(true);
            setRcaSummary(e.target.value);
          }}
          placeholder="Conclusion of the analysis — what does the team believe caused the problem?" />
        {!summaryTouched && generatedSummary && (
          <p className="mt-1 text-[11px] text-slate-500">
            Drafted from the analysis above and kept in step with it. Edit to write your own.
          </p>
        )}
      </Field>

      {!!derived?.contributingFactors.length && (
        <Alert variant="brand" className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-800">
            Contributing levels read from the analysis ({derived.contributingFactors.length})
          </div>
          <ol className="mt-1 space-y-0.5 text-xs text-violet-900">
            {derived.contributingFactors.map((f, i) => (
              <li key={i}>
                {i + 1}. {f}
              </li>
            ))}
          </ol>
          <p className="mt-1 text-[11px] text-violet-700">
            Saved with the CAPA as the chain above the root cause.
          </p>
        </Alert>
      )}

      {methodology !== "NONE_REQUIRED" && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <div className="text-xs font-medium text-slate-600">
              Identified root causes <span className="text-rose-600">*</span>
            </div>
            {!!derived?.rootCauses.length && (
              <Button variant="link"
                type="button"
                onClick={pullRootCausesFromAnalysis} className="text-[11px] hover:underline">
                Fill from analysis ({derived.rootCauses.length})
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {rootCauses.map((rc, i) => (
              <Card key={i} className="rounded border bg-white p-2 grid grid-cols-12 gap-2 items-end shadow-none">
                <div className="col-span-6">
                  <Label className="block text-[10px] uppercase text-slate-500 mb-0.5">Description</Label>
                  <Input
                    className={INPUT}
                    value={rc.description}
                    onChange={(e) => updateRootCause(i, { description: e.target.value })} />
                </div>
                <div className="col-span-3">
                  <Label className="block text-[10px] uppercase text-slate-500 mb-0.5">Category</Label>
                  <SelectField
                    className={INPUT}
                    value={rc.category}
                    onChange={(value) => updateRootCause(i, { category: value })}
                    options={ROOT_CAUSE_CATEGORIES.map((c) => ({ value: c, label: `${c}` }))}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="block text-[10px] uppercase text-slate-500 mb-0.5">Confidence</Label>
                  <SelectField
                    className={INPUT}
                    value={rc.confidence}
                    ariaLabel="Confidence"
                    onChange={(value) => updateRootCause(i, { confidence: value })}
                    options={CONFIDENCE_OPTIONS}
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button variant="link"
                    type="button"
                    onClick={() => removeRootCause(i)} className="text-xs hover:underline">
                    ✕
                  </Button>
                </div>
              </Card>
            ))}
            <Button variant="link"
              type="button"
              onClick={addRootCause} className="text-xs hover:underline">
              + Add another root cause
            </Button>
          </div>
        </div>
      )}
      <div className="flex gap-2 pt-2 border-t">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Submitting…" : "Submit RCA"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

// ─── Add Action Form ──────────────────────────────────────────────────

export function AddActionForm({
  capaId,
  defaultActionType = "CORRECTIVE",
  users
}: {
  capaId: string;
  defaultActionType?: string;
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [actionType, setActionType] = useState(defaultActionType);
  const [description, setDescription] = useState("");
  const [rationale, setRationale] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
  );
  const [costEstimate, setCostEstimate] = useState("");

  function submit() {
    setError(null);
    if (!description.trim()) return setError("Description required");
    if (!ownerUserId) return setError("Owner required");

    startTransition(async () => {
      const res = await fetch(`/api/capa/${capaId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType,
          description: description.trim(),
          rationale: rationale || undefined,
          ownerUserId,
          dueDate: new Date(dueDate).toISOString(),
          costEstimate: costEstimate ? Number(costEstimate) : undefined
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Add failed (${res.status})`);
        return;
      }
      setOpen(false);
      setDescription("");
      setRationale("");
      setCostEstimate("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button variant="link"
        type="button"
        onClick={() => setOpen(true)} className="text-xs hover:underline">
        + Add action
      </Button>
    );
  }

  return (
    <Card className="rounded border bg-slate-50 p-3 space-y-2 shadow-none">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">Add Action</h3>
      {error && (
        <Alert variant="destructive" className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-900">{error}</Alert>
      )}
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-4">
          <Label className="block text-[10px] uppercase text-slate-500 mb-0.5">Action type</Label>
          <SelectField className={INPUT} value={actionType} onChange={setActionType}
            options={[
            { value: "IMMEDIATE_CONTAINMENT", label: "Immediate Containment" },
            { value: "CORRECTIVE", label: "Corrective" },
            { value: "PREVENTIVE", label: "Preventive" }
          ]}
          />
        </div>
        <div className="col-span-5">
          <Label className="block text-[10px] uppercase text-slate-500 mb-0.5">Owner</Label>
          <SelectField className={INPUT} value={ownerUserId} onChange={setOwnerUserId}
            placeholder="— Select —"
            options={users.map((u) => ({ value: u.id, label: `${u.name}` }))}
          />
        </div>
        <div className="col-span-3">
          <Label className="block text-[10px] uppercase text-slate-500 mb-0.5">Due date</Label>
          <Input type="date" className={INPUT} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <Textarea
        className={TEXTAREA}
        rows={2}
        placeholder="Action description"
        value={description}
        onChange={(e) => setDescription(e.target.value)} />
      <Textarea
        className={TEXTAREA}
        rows={2}
        placeholder="Rationale (optional)"
        value={rationale}
        onChange={(e) => setRationale(e.target.value)} />
      <Input
        type="number"
        className={INPUT}
        placeholder="Cost estimate (optional)"
        value={costEstimate}
        onChange={(e) => setCostEstimate(e.target.value)} />
      <div className="flex gap-2">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Adding…" : "Add Action"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

// ─── Update Action Form (inline on action card) ───────────────────────

export function ActionStatusControls({
  capaId,
  actionId,
  currentStatus
}: {
  capaId: string;
  actionId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showEvidence, setShowEvidence] = useState(false);
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState<string | null>(null);

  function patch(payload: Record<string, unknown>) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/capa/${capaId}/actions/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Update failed (${res.status})`);
        return;
      }
      setShowEvidence(false);
      setEvidence("");
      router.refresh();
    });
  }

  if (currentStatus === "COMPLETED") {
    return <span className="text-[10px] text-emerald-700">Completed</span>;
  }

  return (
    <div>
      {error && <div className="text-[10px] text-rose-700 mt-1">{error}</div>}
      <div className="flex gap-1 mt-1">
        {currentStatus === "PROPOSED" && (
          <Button variant="outline"
            type="button"
            disabled={pending}
            onClick={() => patch({ status: "APPROVED" })} className="text-[10px] px-1.5 py-0.5 rounded">
            Approve
          </Button>
        )}
        {(currentStatus === "APPROVED" || currentStatus === "PROPOSED") && (
          <Button variant="outline"
            type="button"
            disabled={pending}
            onClick={() => patch({ status: "IN_PROGRESS" })} className="text-[10px] px-1.5 py-0.5 rounded">
            Start
          </Button>
        )}
        {currentStatus !== "COMPLETED" && currentStatus !== "CANCELLED" && (
          <Button variant="success"
            type="button"
            disabled={pending}
            onClick={() => setShowEvidence(true)} className="text-[10px] px-1.5 py-0.5 rounded">
            Mark complete
          </Button>
        )}
      </div>
      {showEvidence && (
        <Card className="mt-2 rounded border bg-white p-2 space-y-1 shadow-none">
          <Label className="block text-[10px] uppercase text-slate-500">Evidence of completion</Label>
          <Textarea
            className={TEXTAREA}
            rows={2}
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)} />
          <div className="flex gap-1">
            <Button variant="success"
              type="button"
              disabled={pending || !evidence.trim()}
              onClick={() => patch({ status: "COMPLETED", evidenceOfCompletion: evidence.trim() })} className="text-[10px] px-2 py-0.5 rounded text-white">
              Confirm
            </Button>
            <Button variant="outline"
              type="button"
              onClick={() => setShowEvidence(false)} className="text-[10px] px-2 py-0.5 rounded">
              Cancel
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Verification Submit Form ─────────────────────────────────────────

export function VerifySubmitForm({
  capaId,
  currentState,
  verificationMethods
}: {
  capaId: string;
  currentState: string;
  verificationMethods: { id: string; code: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [methodCode, setMethodCode] = useState(verificationMethods[0]?.code ?? "");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [result, setResult] = useState("EFFECTIVE");
  const [evidence, setEvidence] = useState("");
  const [measurementDays, setMeasurementDays] = useState("30");

  const canSubmit = currentState === "PENDING_VERIFICATION" || currentState === "ACTIONS_IN_PROGRESS";
  if (!canSubmit && currentState !== "VERIFIED") return null;

  function submit() {
    setError(null);
    if (!evidence.trim()) return setError("Evidence is required.");
    startTransition(async () => {
      const res = await fetch(`/api/capa/${capaId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationMethodCode: methodCode || undefined,
          verificationSuccessCriteria: successCriteria || undefined,
          verificationResult: result,
          verificationEvidence: evidence.trim(),
          measurementPeriodDays: Number(measurementDays) || 30
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Verify failed (${res.status})`);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="mt-4">
        Submit Verification
      </Button>
    );
  }

  return (
    <Card className="mt-4 rounded-xl border bg-slate-50 p-4 space-y-3 shadow-none">
      <h3 className="text-sm font-semibold">Submit Effectiveness Verification</h3>
      {error && (
        <Alert variant="destructive" className="rounded border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm text-rose-900">{error}</Alert>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Verification method">
          <SelectField className={INPUT} value={methodCode} onChange={setMethodCode}
            options={verificationMethods.map((m) => ({ value: m.code, label: `${m.name}` }))}
          />
        </Field>
        <Field label="Measurement period (days)">
          <Input
            type="number"
            className={INPUT}
            value={measurementDays}
            onChange={(e) => setMeasurementDays(e.target.value)} />
        </Field>
      </div>
      <Field label="Success criteria">
        <Textarea
          className={TEXTAREA}
          rows={2}
          value={successCriteria}
          onChange={(e) => setSuccessCriteria(e.target.value)}
          placeholder="What does success look like? What metric / observation / test confirms it?" />
      </Field>
      <Field label="Result" required>
        <SelectField className={INPUT} value={result} onChange={setResult}
          options={VERIFICATION_RESULTS.map((r) => ({ value: r.code, label: `${r.label}` }))}
        />
      </Field>
      <Field label="Evidence" required>
        <Textarea
          className={TEXTAREA}
          rows={3}
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="Document what you observed / measured / reviewed and what it showed." />
      </Field>
      <div className="flex gap-2 pt-2 border-t">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Submitting…" : "Submit Verification"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

// ─── Close + Recurrence Check Forms ───────────────────────────────────

export function CloseCapaForm({ capaId, currentState }: { capaId: string; currentState: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [closureNotes, setClosureNotes] = useState("");
  const [finalCost, setFinalCost] = useState("");

  if (currentState !== "VERIFIED") return null;

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/capa/${capaId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closureNotes: closureNotes || undefined,
          finalCost: finalCost ? Number(finalCost) : undefined,
          finalCostCurrency: finalCost ? "INR" : undefined
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Close failed (${res.status})`);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Close CAPA</Button>;
  }
  return (
    <Alert variant="success" className="rounded-xl border bg-emerald-50 border-emerald-200 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-emerald-900">Close CAPA</h3>
      {error && (
        <Alert variant="destructive" className="rounded border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm text-rose-900">{error}</Alert>
      )}
      <Field label="Closure notes">
        <Textarea
          className={TEXTAREA}
          rows={3}
          value={closureNotes}
          onChange={(e) => setClosureNotes(e.target.value)}
          placeholder="Final summary for the audit trail." />
      </Field>
      <Field label="Actual cost (INR)">
        <Input
          type="number"
          className={INPUT}
          value={finalCost}
          onChange={(e) => setFinalCost(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Closing…" : "Confirm Close"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </Alert>
  );
}

export function RecurrenceCheckForm({
  capaId,
  currentState,
  dueDate
}: {
  capaId: string;
  currentState: string;
  dueDate: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [recurred, setRecurred] = useState<"yes" | "no" | "">("");
  const [notes, setNotes] = useState("");

  if (currentState !== "CLOSED" && currentState !== "CLOSED_RECURRED") return null;

  function submit() {
    setError(null);
    if (!recurred) return setError("Pick yes or no.");
    startTransition(async () => {
      const res = await fetch(`/api/capa/${capaId}/recurrence-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurrenceDetected: recurred === "yes",
          notes: notes || undefined
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Check failed (${res.status})`);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="outline">
        Complete Recurrence Check
      </Button>
    );
  }
  return (
    <Card className="rounded-xl border bg-slate-50 p-4 space-y-3 shadow-none">
      <h3 className="text-sm font-semibold">Recurrence Check</h3>
      <div className="text-xs text-slate-600">
        {dueDate
          ? `Scheduled for ${new Date(dueDate).toLocaleDateString()}. Has the same issue recurred since closure?`
          : "Has the same issue recurred since closure?"}
      </div>
      {error && (
        <Alert variant="destructive" className="rounded border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm text-rose-900">{error}</Alert>
      )}
      <div className="flex gap-2">
        {(["no", "yes"] as const).map((v) => (
          <Label
            key={v}
            className={`flex-1 rounded-md border px-3 py-2 cursor-pointer text-sm ${
              recurred === v ? "bg-primary-50 border-primary-500" : "border-slate-300"
            }`}>
            <Input
              type="radio"
              name="recurred"
              value={v}
              checked={recurred === v}
              onChange={() => setRecurred(v)}
              className="mr-2" />
            {v === "no" ? "No recurrence — CAPA stays closed" : "Recurred — flag for re-investigation"}
          </Label>
        ))}
      </div>
      <Field label="Notes">
        <Textarea className={TEXTAREA} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Submitting…" : "Submit Check"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

function Field({
  label,
  required,
  children
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="block text-xs font-medium text-slate-600 mb-1">
        {label} {required && <span className="text-rose-600">*</span>}
      </Label>
      {children}
    </div>
  );
}
