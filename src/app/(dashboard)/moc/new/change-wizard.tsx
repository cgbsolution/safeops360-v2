"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Plus, X, AlertTriangle, Search } from "lucide-react";
import { UserPicker } from "@/components/ui/user-picker";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  CLASSIFICATIONS,
  ORIGINS,
  ORIGIN_LABEL,
  URGENCY_LABEL,
  HAZARD_CATEGORIES,
  HAZARD_LABEL,
  IMPACT_DEPARTMENTS,
  IMPACT_DEPT_LABEL,
  RISK_CHIP,
  bandForScore
} from "../_meta";

const STEPS = ["Identify", "Risk & hazard", "Impact & stakeholders", "Approval routing", "Review"] as const;
type StepIdx = 0 | 1 | 2 | 3 | 4;

type Matrix = { likelihood: number; severity: number; score: number; band: string } | null;
type EquipItem = { id: string; label: string };
type Reviewer = { specificUserId: string; name: string; role: string };
type DeptState = Record<string, { affected: boolean; reviewerUserId?: string }>;

export function ChangeWizard({ plantId }: { plantId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<StepIdx>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Step 1 — Identify
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("equipment");
  const [subcategory, setSubcategory] = useState("");
  const [classification, setClassification] = useState("minor");
  const [origin, setOrigin] = useState("operational_request");
  const [urgency, setUrgency] = useState<"standard" | "emergency">("standard");
  const [isTemporary, setIsTemporary] = useState(false);
  const [temporaryExpiryDate, setTemporaryExpiryDate] = useState("");
  const [equipment, setEquipment] = useState<EquipItem[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [processes, setProcesses] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [linkedMocIds, setLinkedMocIds] = useState<string[]>([]);
  const [businessJustification, setBusinessJustification] = useState("");
  const [expectedBenefits, setExpectedBenefits] = useState("");
  const [costEstimate, setCostEstimate] = useState("");
  const [proposedImplementationDate, setProposedImplementationDate] = useState("");
  const [targetCompletionDate, setTargetCompletionDate] = useState("");

  // Step 2 — Risk & hazard
  const [psmApplicable, setPsmApplicable] = useState(false);
  const [psmCoveredProcess, setPsmCoveredProcess] = useState("");
  const [psmSafeguards, setPsmSafeguards] = useState("");
  const [riskPre, setRiskPre] = useState<Matrix>(null);
  const [hazards, setHazards] = useState<string[]>([]);
  const [mitigations, setMitigations] = useState("");
  const [riskResidual, setRiskResidual] = useState<Matrix>(null);

  // Step 3 — Impact & stakeholders
  const [dept, setDept] = useState<DeptState>(
    Object.fromEntries(IMPACT_DEPARTMENTS.map((d) => [d, { affected: false }]))
  );
  const [communicationPlan, setCommunicationPlan] = useState("");
  const [trainingRequired, setTrainingRequired] = useState(false);
  const [trainingCertificateId, setTrainingCertificateId] = useState("");

  // Step 4 — Approval routing
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [escalationDays, setEscalationDays] = useState("5");
  const [suggestions, setSuggestions] = useState<Reviewer[]>([]);

  const affectedDepts = useMemo(
    () => IMPACT_DEPARTMENTS.filter((d) => dept[d]?.affected),
    [dept]
  );

  // Pull suggested reviewers whenever the affected departments change while on Step 4.
  useEffect(() => {
    if (step !== 3 || affectedDepts.length === 0) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/moc/suggested-reviewers?plantId=${plantId}&departments=${affectedDepts.join(",")}`)
      .then((r) => (r.ok ? r.json() : { allHeads: [] }))
      .then((j: { allHeads?: { userId: string; name: string; role: string }[] }) => {
        if (cancelled) return;
        const heads = (j.allHeads ?? []).map((h) => ({
          specificUserId: h.userId,
          name: h.name,
          role: h.role
        }));
        setSuggestions(heads);
      })
      .catch(() => setSuggestions([]));
    return () => {
      cancelled = true;
    };
  }, [step, affectedDepts, plantId]);

  function stepError(s: StepIdx): string | null {
    if (s === 0) {
      if (!title.trim()) return "A title is required.";
      if (!description.trim()) return "A description is required.";
      if (isTemporary && !temporaryExpiryDate) return "A temporary change requires an expiration date.";
      return null;
    }
    if (s === 1) {
      if (!riskPre) return "Capture the pre-change risk rating (likelihood × severity).";
      return null;
    }
    if (s === 3) {
      // Any affected department should have a reviewer routed.
      if (affectedDepts.length > 0 && reviewers.length === 0)
        return "Add at least one reviewer for the affected departments.";
      return null;
    }
    return null;
  }

  function next() {
    const err = stepError(step);
    if (err) {
      setTouched(true);
      setError(err);
      return;
    }
    setTouched(false);
    setError(null);
    setStep((s) => (Math.min(s + 1, 4) as StepIdx));
  }
  function back() {
    setTouched(false);
    setError(null);
    setStep((s) => (Math.max(s - 1, 0) as StepIdx));
  }

  async function submit(doSubmit: boolean) {
    // Drafts need only a title + description; a full submission validates the
    // identify + risk steps.
    if (!title.trim() || !description.trim()) {
      setError("A title and description are required.");
      setStep(0);
      return;
    }
    if (doSubmit) {
      for (const s of [0, 1] as StepIdx[]) {
        const err = stepError(s);
        if (err) {
          setError(err);
          setStep(s);
          return;
        }
      }
    }
    setBusy(true);
    setError(null);
    const payload = {
      plantId,
      title: title.trim(),
      description: description.trim(),
      category,
      subcategory: subcategory.trim() || null,
      classification,
      origin,
      urgency,
      isTemporary,
      temporaryExpiryDate: isTemporary && temporaryExpiryDate ? temporaryExpiryDate : null,
      affectedEquipmentIds: equipment.map((e) => e.id),
      affectedLocations: locations,
      affectedProcesses: processes,
      affectedRoles: roles,
      affectedDepartments: affectedDepts,
      linkedMocIds,
      businessJustification: businessJustification.trim() || null,
      expectedBenefits: expectedBenefits.trim() || null,
      costEstimate: costEstimate ? Number(costEstimate) : null,
      proposedImplementationDate: proposedImplementationDate || null,
      targetCompletionDate: targetCompletionDate || null,
      psmApplicable,
      psmDetails: psmApplicable
        ? { coveredProcess: psmCoveredProcess.trim(), affectedSafeguards: psmSafeguards.trim() }
        : null,
      riskMatrixPre: riskPre,
      riskMatrixResidual: riskResidual,
      hazardCategories: hazards,
      mitigations: mitigations.trim() || null,
      departmentImpact: {
        departments: dept,
        communicationPlan: communicationPlan.trim()
      },
      trainingRequired,
      trainingCertificateId: trainingRequired && trainingCertificateId.trim() ? trainingCertificateId.trim() : null,
      reviewers: reviewers.map((r) => ({ role: r.role, specificUserId: r.specificUserId, isRequired: true })),
      escalationDays: Number(escalationDays) || 5,
      submit: doSubmit
    };
    try {
      const res = await fetch("/api/moc/change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || j.detail || "Couldn't create change request.");
        setBusy(false);
        return;
      }
      toast({
        variant: "success",
        title: doSubmit ? "Change request submitted" : "Draft saved",
        description: j.number
      });
      router.push(`/moc/${j.id}`);
    } catch {
      setError("Network error — please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Stepper */}
      <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
        <ol className="flex flex-wrap items-center gap-2">
          {STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                    done ? "bg-emerald-600 text-white" : active ? "bg-primary-700 text-white" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {done ? <Check size={14} /> : i + 1}
                </span>
                <span className={cn("text-sm font-medium", active ? "text-primary-700" : done ? "text-slate-700" : "text-slate-400")}>
                  {label}
                </span>
                {i < STEPS.length - 1 && <ChevronRight size={16} className="text-slate-300" />}
              </li>
            );
          })}
        </ol>
      </Card>

      {error && (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</Alert>
      )}

      <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
        {step === 0 && (
          <IdentifyStep
            {...{
              title, setTitle, description, setDescription, category, setCategory, subcategory, setSubcategory,
              classification, setClassification, origin, setOrigin, urgency, setUrgency, isTemporary, setIsTemporary,
              temporaryExpiryDate, setTemporaryExpiryDate, equipment, setEquipment, locations, setLocations,
              processes, setProcesses, roles, setRoles, linkedMocIds, setLinkedMocIds, businessJustification,
              setBusinessJustification, expectedBenefits, setExpectedBenefits, costEstimate, setCostEstimate,
              proposedImplementationDate, setProposedImplementationDate, targetCompletionDate, setTargetCompletionDate,
              plantId, touched
            }}
          />
        )}
        {step === 1 && (
          <RiskStep
            {...{
              category, psmApplicable, setPsmApplicable, psmCoveredProcess, setPsmCoveredProcess, psmSafeguards,
              setPsmSafeguards, riskPre, setRiskPre, hazards, setHazards, mitigations, setMitigations, riskResidual,
              setRiskResidual, touched
            }}
          />
        )}
        {step === 2 && (
          <ImpactStep
            {...{ dept, setDept, communicationPlan, setCommunicationPlan, trainingRequired, setTrainingRequired, trainingCertificateId, setTrainingCertificateId }}
          />
        )}
        {step === 3 && (
          <RoutingStep
            {...{ plantId, affectedDepts, reviewers, setReviewers, suggestions, escalationDays, setEscalationDays, touched }}
          />
        )}
        {step === 4 && (
          <ReviewStep
            {...{ title, category, classification, urgency, isTemporary, temporaryExpiryDate, riskPre, riskResidual, hazards, affectedDepts, reviewers, trainingRequired, equipment }}
          />
        )}
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline"
          type="button"
          onClick={back}
          disabled={step === 0 || busy} className="gap-1 rounded-lg px-4 py-2 text-sm">
          <ChevronLeft size={16} /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline"
            type="button"
            onClick={() => submit(false)}
            disabled={busy} className="rounded-lg px-4 py-2 text-sm">
            Save as draft
          </Button>
          {step < 4 ? (
            <Button variant="default"
              type="button"
              onClick={next} className="gap-1 rounded-lg px-4 py-2 text-sm text-white">
              Next <ChevronRight size={16} />
            </Button>
          ) : (
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={busy}
              className="rounded-lg bg-primary-700 px-5 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Submit change request"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared field + chip helpers ────────────────────────────────────────────
function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs font-medium text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-rose-600">*</span>}
      </Label>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </div>
  );
}

function ChipInput({ label, placeholder, items, setItems }: { label: string; placeholder: string; items: string[]; setItems: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (v && !items.includes(v)) setItems([...items, v]);
    setDraft("");
  }
  return (
    <Field label={label}>
      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          placeholder={placeholder} />
        <Button variant="outline" type="button" onClick={add} className="shrink-0 rounded-lg px-2" aria-label={`Add ${label}`}>
          <Plus size={16} />
        </Button>
      </div>
      {items.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
              {c}
              <Button variant="ghost" type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="opacity-60 hover:opacity-100" aria-label={`Remove ${c}`}>
                <X size={12} />
              </Button>
            </span>
          ))}
        </div>
      )}
    </Field>
  );
}

// ── Risk matrix picker (likelihood × severity → band) ───────────────────────
function RiskMatrixPicker({ label, value, onChange }: { label: string; value: Matrix; onChange: (m: Matrix) => void }) {
  const likelihood = value?.likelihood ?? 0;
  const severity = value?.severity ?? 0;
  function set(l: number, s: number) {
    if (l === 0 || s === 0) {
      onChange(null);
      return;
    }
    const score = l * s;
    onChange({ likelihood: l, severity: s, score, band: bandForScore(score) ?? "low" });
  }
  const band = value?.band;
  return (
    <Card className="rounded-lg border border-slate-200 p-4 shadow-none">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800">{label}</h4>
        {value && (
          <span className={cn("rounded border px-2 py-0.5 text-xs font-medium capitalize", RISK_CHIP[band ?? ""] ?? "")}>
            {band} · {value.score}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">Likelihood (1–5)</div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <Button key={n} type="button" variant="outline" onClick={() => set(n, severity)} className={cn("h-8 w-8 rounded border text-sm font-medium", likelihood === n ? "border-primary-600 bg-primary-700 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-primary-400")}>
                {n}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">Severity (1–5)</div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <Button key={n} type="button" variant="outline" aria-pressed={severity === n} onClick={() => set(likelihood, n)} className={cn("h-8 w-8 rounded border p-0 text-sm font-medium", severity === n && "border-primary-600 bg-primary-700 text-white hover:bg-primary-800 hover:text-white")}>
                {n}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Equipment searchable multi-select ───────────────────────────────────────
function EquipmentSelect({ plantId, items, setItems }: { plantId: string; items: EquipItem[]; setItems: (v: EquipItem[]) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; code: string; name: string; location: string }[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(`/api/moc/equipment?plantId=${plantId}&q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((rows: { id: string; code: string; name: string; location: string }[]) => {
          if (!cancelled) setResults(Array.isArray(rows) ? rows : []);
        })
        .catch(() => setResults([]));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, plantId]);
  function add(r: { id: string; code: string; name: string }) {
    if (!items.some((e) => e.id === r.id)) setItems([...items, { id: r.id, label: `${r.code} · ${r.name}` }]);
    setQ("");
    setResults([]);
    setOpen(false);
  }
  return (
    <Field label="Affected equipment / assets" hint="Search the plant asset registry.">
      <div className="relative">
        <Card className="flex items-center gap-2 rounded-lg border border-slate-300 px-2 shadow-none">
          <Search size={14} className="text-slate-400" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="w-full py-2 text-sm outline-none"
            placeholder="Type an asset code or name…" />
        </Card>
        {open && results.length > 0 && (
          <Card className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {results.map((r) => (
              <Button variant="ghost" key={r.id} type="button" onClick={() => add(r)} className="block w-full px-3 py-2 text-left text-sm">
                <span className="font-mono text-xs text-slate-500">{r.code}</span> {r.name}
                <span className="text-xs text-slate-400"> · {r.location}</span>
              </Button>
            ))}
          </Card>
        )}
      </div>
      {items.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((e) => (
            <span key={e.id} className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-800">
              {e.label}
              <Button variant="ghost" type="button" onClick={() => setItems(items.filter((x) => x.id !== e.id))} className="opacity-60 hover:opacity-100" aria-label="Remove">
                <X size={12} />
              </Button>
            </span>
          ))}
        </div>
      )}
    </Field>
  );
}

// ── Step 1: Identify ────────────────────────────────────────────────────────
function IdentifyStep(p: any) {
  return (
    <div className="space-y-4">
      <Field label="Title" required>
        <Input value={p.title} onChange={(e: any) => p.setTitle(e.target.value)} className={cn("w-full rounded-lg border p-2 text-sm", p.touched && !p.title.trim() ? "border-rose-300" : "border-slate-300")} placeholder="e.g. Replace bag filter on Kiln-2 with higher-capacity unit" />
      </Field>
      <Field label="Description" required>
        <Textarea value={p.description} onChange={(e: any) => p.setDescription(e.target.value)} rows={3} className={cn("w-full rounded-lg border p-2 text-sm", p.touched && !p.description.trim() ? "border-rose-300" : "border-slate-300")} placeholder="What is changing, and from what to what?" />
      </Field>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Change type">
          <SelectField value={p.category} onChange={(e: any) => p.setCategory(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm"
            options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
          />
        </Field>
        <Field label="Subcategory">
          <Input value={p.subcategory} onChange={(e: any) => p.setSubcategory(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm" placeholder="optional" />
        </Field>
        <Field label="Classification">
          <SelectField value={p.classification} onChange={(e: any) => p.setClassification(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm"
            options={CLASSIFICATIONS.map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) }))}
          />
        </Field>
        <Field label="Origin">
          <SelectField value={p.origin} onChange={(e: any) => p.setOrigin(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm"
            options={ORIGINS.map((o) => ({ value: o, label: ORIGIN_LABEL[o] }))}
          />
        </Field>
        <Field label="Urgency">
          <SelectField
            value={p.urgency}
            onChange={p.setUrgency}
            ariaLabel="Urgency"
            className="w-full rounded-lg p-2 text-sm"
            options={Object.entries(URGENCY_LABEL).map(([v, l]) => ({ value: v, label: String(l) }))}
          />
        </Field>
      </div>
      {p.urgency === "emergency" && (
        <Alert variant="warning" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>Emergency changes may start implementation before full approval, but require retroactive approval within 72 hours and cannot be closed until it is recorded.</span>
        </Alert>
      )}

      <EquipmentSelect plantId={p.plantId} items={p.equipment} setItems={p.setEquipment} />
      <div className="grid gap-4 md:grid-cols-3">
        <ChipInput label="Affected locations" placeholder="Add a location…" items={p.locations} setItems={p.setLocations} />
        <ChipInput label="Affected processes" placeholder="Add a process…" items={p.processes} setItems={p.setProcesses} />
        <ChipInput label="Affected roles" placeholder="Add a role…" items={p.roles} setItems={p.setRoles} />
      </div>
      <ChipInput label="Related / linked MOCs" placeholder="Add a MOC number or id…" items={p.linkedMocIds} setItems={p.setLinkedMocIds} />

      <div className="flex items-end gap-2">
        <Checkbox id="isTemporary" checked={p.isTemporary} onChange={(e: any) => p.setIsTemporary(e.target.checked)} className="h-4 w-4" />
        <Label htmlFor="isTemporary" className="text-sm text-slate-700">This is a temporary change</Label>
      </div>
      {p.isTemporary && (
        <Field label="Expiration date" required hint="Required for temporary changes — the owner is reminded at T-7 and T-1 days.">
          <Input type="date" value={p.temporaryExpiryDate} onChange={(e: any) => p.setTemporaryExpiryDate(e.target.value)} className={cn("w-56 rounded-lg border p-2 text-sm", p.touched && !p.temporaryExpiryDate ? "border-rose-300" : "border-slate-300")} />
        </Field>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Cost estimate (INR)">
          <Input type="number" value={p.costEstimate} onChange={(e: any) => p.setCostEstimate(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm" placeholder="optional" />
        </Field>
        <Field label="Proposed implementation">
          <Input type="date" value={p.proposedImplementationDate} onChange={(e: any) => p.setProposedImplementationDate(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
        </Field>
        <Field label="Target completion">
          <Input type="date" value={p.targetCompletionDate} onChange={(e: any) => p.setTargetCompletionDate(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
        </Field>
      </div>
      <Field label="Business justification">
        <Textarea value={p.businessJustification} onChange={(e: any) => p.setBusinessJustification(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
      </Field>
      <Field label="Expected benefits">
        <Textarea value={p.expectedBenefits} onChange={(e: any) => p.setExpectedBenefits(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
      </Field>
    </div>
  );
}

// ── Step 2: Risk & hazard ───────────────────────────────────────────────────
function RiskStep(p: any) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2">
        <Checkbox id="psm" checked={p.psmApplicable} onChange={(e: any) => p.setPsmApplicable(e.target.checked)} className="mt-1 h-4 w-4" />
        <Label htmlFor="psm" className="text-sm text-slate-700">
          Process Safety Management (PSM) applies to this change
        </Label>
      </div>
      {p.psmApplicable && (
        <Card className="grid gap-4 md:grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-none">
          <Field label="PSM-covered process">
            <Input value={p.psmCoveredProcess} onChange={(e: any) => p.setPsmCoveredProcess(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm" placeholder="e.g. Ammonia refrigeration" />
          </Field>
          <Field label="Affected safeguards">
            <Input value={p.psmSafeguards} onChange={(e: any) => p.setPsmSafeguards(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm" placeholder="e.g. Relief valve setpoint, interlock IL-12" />
          </Field>
        </Card>
      )}

      <RiskMatrixPicker label="Pre-change risk rating *" value={p.riskPre} onChange={p.setRiskPre} />
      {p.touched && !p.riskPre && <span className="block text-xs text-rose-600">Capture the pre-change risk rating.</span>}

      <Field label="Hazard categories">
        <div className="flex flex-wrap gap-2">
          {HAZARD_CATEGORIES.map((h) => {
            const on = p.hazards.includes(h);
            return (
              <Button key={h} type="button" variant="outline" size="sm" aria-pressed={on} onClick={() => p.setHazards(on ? p.hazards.filter((x: string) => x !== h) : [...p.hazards, h])} className={cn("rounded-full px-3 py-1 text-xs font-medium", on && "border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100")}>
                {HAZARD_LABEL[h]}
              </Button>
            );
          })}
        </div>
      </Field>

      <Field label="Mitigations / controls">
        <Textarea value={p.mitigations} onChange={(e: any) => p.setMitigations(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 p-2 text-sm" placeholder="Controls that bring the risk down to the residual rating…" />
      </Field>

      <RiskMatrixPicker label="Post-mitigation residual risk rating" value={p.riskResidual} onChange={p.setRiskResidual} />
    </div>
  );
}

// ── Step 3: Impact & stakeholders ───────────────────────────────────────────
function ImpactStep(p: any) {
  return (
    <div className="space-y-5">
      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-800">Department impact</h4>
        <p className="mb-3 text-xs text-slate-500">Flag each affected department — affected departments require a reviewer in the next step.</p>
        <div className="grid gap-2 md:grid-cols-2">
          {IMPACT_DEPARTMENTS.map((d) => {
            const affected = p.dept[d]?.affected;
            return (
              <Label key={d} className={cn("flex items-center justify-between rounded-lg border px-3 py-2 text-sm cursor-pointer", affected ? "border-primary-300 bg-primary-50" : "border-slate-200")}>
                <span className="text-slate-700">{IMPACT_DEPT_LABEL[d]}</span>
                <Checkbox checked={!!affected} onChange={(e) => p.setDept({ ...p.dept, [d]: { ...p.dept[d], affected: e.target.checked } })} className="h-4 w-4" />
              </Label>
            );
          })}
        </div>
      </div>

      <Field label="Communication / training plan" hint="Who needs to be informed or trained before implementation?">
        <Textarea value={p.communicationPlan} onChange={(e: any) => p.setCommunicationPlan(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
      </Field>

      <div className="flex items-start gap-2">
        <Checkbox id="trainingReq" checked={p.trainingRequired} onChange={(e: any) => p.setTrainingRequired(e.target.checked)} className="mt-1 h-4 w-4" />
        <Label htmlFor="trainingReq" className="text-sm text-slate-700">
          Training is required before go-live
          <span className="block text-xs text-slate-400">The change cannot be approved for implementation until an active training certificate is linked.</span>
        </Label>
      </div>
      {p.trainingRequired && (
        <Field label="Training certificate ID" hint="Paste an ACTIVE TrainingCertificate id now, or link it on the detail page before approval.">
          <Input value={p.trainingCertificateId} onChange={(e: any) => p.setTrainingCertificateId(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm" placeholder="TrainingCertificate.id" />
        </Field>
      )}

      <Card className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 shadow-none">
        Supporting documents (drawings, P&IDs, vendor specs, risk assessments) are attached on the change-request page once it is created.
      </Card>
    </div>
  );
}

// ── Step 4: Approval routing ────────────────────────────────────────────────
function RoutingStep(p: any) {
  const [role, setRole] = useState("Reviewer");
  function addUser(userId: string | null, user: any) {
    if (!userId || p.reviewers.some((r: Reviewer) => r.specificUserId === userId)) return;
    p.setReviewers([...p.reviewers, { specificUserId: userId, name: user?.name ?? userId, role: role.trim() || "Reviewer" }]);
  }
  function addSuggestion(s: Reviewer) {
    if (p.reviewers.some((r: Reviewer) => r.specificUserId === s.specificUserId)) return;
    p.setReviewers([...p.reviewers, s]);
  }
  return (
    <div className="space-y-5">
      {p.affectedDepts.length > 0 ? (
        <Card className="rounded-lg border border-slate-200 p-4 shadow-none">
          <h4 className="mb-2 text-sm font-semibold text-slate-800">Suggested reviewers</h4>
          <p className="mb-3 text-xs text-slate-500">Department heads for the affected departments ({p.affectedDepts.join(", ")}).</p>
          {p.suggestions.length === 0 ? (
            <p className="text-xs text-slate-400">No department heads found for these departments — add reviewers manually below.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {p.suggestions.map((s: Reviewer) => (
                <Button key={s.specificUserId} type="button" variant="outline" size="sm" onClick={() => addSuggestion(s)} className="gap-1 rounded-full px-3 py-1 text-xs">
                  <Plus size={12} /> {s.name}
                </Button>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <p className="text-xs text-slate-500">No departments flagged as affected — add reviewers manually.</p>
      )}

      <Card className="rounded-lg border border-slate-200 p-4 shadow-none">
        <h4 className="mb-2 text-sm font-semibold text-slate-800">Add a reviewer</h4>
        <div className="grid gap-3 md:grid-cols-[1fr,200px]">
          <UserPicker value={null} onChange={addUser} filter={{ plantId: p.plantId }} placeholder="Search users…" />
          <Input value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg border border-slate-300 p-2 text-sm" placeholder="Role (e.g. Safety head)" />
        </div>
      </Card>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-800">Approval chain ({p.reviewers.length})</h4>
        {p.reviewers.length === 0 ? (
          <p className={cn("text-xs", p.touched && p.affectedDepts.length > 0 ? "text-rose-600" : "text-slate-400")}>No reviewers added yet.</p>
        ) : (
          <ol className="space-y-2">
            {p.reviewers.map((r: Reviewer, i: number) => (
              <li key={r.specificUserId} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <span>
                  <span className="mr-2 text-slate-400">{i + 1}.</span>
                  <span className="font-medium text-slate-800">{r.name}</span>
                  <span className="ml-2 text-xs text-slate-500">{r.role}</span>
                </span>
                <Button variant="ghost" type="button" onClick={() => p.setReviewers(p.reviewers.filter((x: Reviewer) => x.specificUserId !== r.specificUserId))} aria-label="Remove reviewer">
                  <X size={14} />
                </Button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <Field label="Escalation SLA (days)" hint="If a reviewer hasn't acted within this many days, their manager is notified and the MOC is flagged overdue.">
        <Input type="number" min={1} value={p.escalationDays} onChange={(e: any) => p.setEscalationDays(e.target.value)} className="w-32 rounded-lg border border-slate-300 p-2 text-sm" />
      </Field>
    </div>
  );
}

// ── Step 5: Review ──────────────────────────────────────────────────────────
function ReviewStep(p: any) {
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{k}</span>
      <span className="text-right font-medium text-slate-800">{v}</span>
    </div>
  );
  return (
    <div className="space-y-1">
      <Row k="Title" v={p.title || "—"} />
      <Row k="Change type" v={CATEGORY_LABEL[p.category] ?? p.category} />
      <Row k="Classification" v={p.classification} />
      <Row k="Urgency" v={URGENCY_LABEL[p.urgency]} />
      <Row k="Temporary" v={p.isTemporary ? `Yes — expires ${p.temporaryExpiryDate || "?"}` : "No"} />
      <Row k="Pre-change risk" v={p.riskPre ? <span className={cn("rounded border px-2 py-0.5 text-xs capitalize", RISK_CHIP[p.riskPre.band] ?? "")}>{p.riskPre.band} · {p.riskPre.score}</span> : "—"} />
      <Row k="Residual risk" v={p.riskResidual ? <span className={cn("rounded border px-2 py-0.5 text-xs capitalize", RISK_CHIP[p.riskResidual.band] ?? "")}>{p.riskResidual.band} · {p.riskResidual.score}</span> : "—"} />
      <Row k="Hazards" v={p.hazards.length ? p.hazards.map((h: string) => HAZARD_LABEL[h]).join(", ") : "—"} />
      <Row k="Affected equipment" v={p.equipment.length || "—"} />
      <Row k="Affected departments" v={p.affectedDepts.length ? p.affectedDepts.map((d: string) => IMPACT_DEPT_LABEL[d]).join(", ") : "—"} />
      <Row k="Reviewers" v={p.reviewers.length || "—"} />
      <Row k="Training required" v={p.trainingRequired ? "Yes" : "No"} />
    </div>
  );
}
