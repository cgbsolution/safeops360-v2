"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { UserPicker } from "@/components/ui/user-picker";
import { type Category, type ScoringMatrix } from "../../lib";
import { AssessForm } from "../[id]/detail-view";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

const ORG_LEVELS = ["ENTERPRISE", "BUSINESS_UNIT", "FUNCTION", "SITE"] as const;
const VELOCITIES = ["SLOW", "MODERATE", "FAST", "VERY_FAST"] as const;
const VELOCITY_LABEL: Record<string, string> = {
  SLOW: "Slow (>12 mo)",
  MODERATE: "Moderate",
  FAST: "Fast",
  VERY_FAST: "Very Fast (<1 wk)",
};

const STEPS = ["Identify", "Context", "Ownership", "Initial Assessment"] as const;
type StepIdx = 0 | 1 | 2 | 3;

export function NewRiskWizard({ categories, matrix }: { categories: Category[]; matrix: ScoringMatrix | null }) {
  const router = useRouter();
  const [step, setStep] = useState<StepIdx>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Step 1 — Identify
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");
  const [orgLevel, setOrgLevel] = useState<(typeof ORG_LEVELS)[number]>("ENTERPRISE");
  const [businessUnit, setBusinessUnit] = useState("");
  const [plantId, setPlantId] = useState("");
  const [velocity, setVelocity] = useState<(typeof VELOCITIES)[number]>("MODERATE");
  const [tagsRaw, setTagsRaw] = useState("");

  // Step 2 — Context
  const [causes, setCauses] = useState<string[]>([]);
  const [consequences, setConsequences] = useState<string[]>([]);
  const [existingControls, setExistingControls] = useState<string[]>([]);

  // Step 3 — Ownership
  const [riskOwnerId, setRiskOwnerId] = useState<string | null>(null);
  const [riskChampionId, setRiskChampionId] = useState<string | null>(null);
  const [reviewOverrideDays, setReviewOverrideDays] = useState("");

  // Step 4 — Initial Assessment
  const [inherent, setInherent] = useState<any | null>(null);
  const [residual, setResidual] = useState<any | null>(null);
  const [wantResidual, setWantResidual] = useState(false);

  // Business unit / department master (canonical list from the backend).
  const [businessUnits, setBusinessUnits] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/erm/business-units")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: unknown) => {
        if (!cancelled && Array.isArray(rows)) {
          setBusinessUnits(rows.filter((x): x is string => typeof x === "string"));
        }
      })
      .catch(() => {
        /* non-fatal — the field falls back to whatever is already selected */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId],
  );
  const subCategories = selectedCategory?.subCategories ?? [];

  const tags = useMemo(
    () => tagsRaw.split(",").map((t) => t.trim()).filter(Boolean),
    [tagsRaw],
  );

  // ── Per-step validation ────────────────────────────────────────────────────
  function stepError(s: StepIdx): string | null {
    if (s === 0) {
      if (!title.trim()) return "A risk title is required.";
      if (!categoryId) return "Select a category.";
      return null;
    }
    if (s === 2) {
      if (!riskOwnerId) return "A Risk Owner is mandatory.";
      if (!riskChampionId) return "A Risk Champion is mandatory.";
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
    setStep((s) => (Math.min(s + 1, 3) as StepIdx));
  }

  function back() {
    setTouched(false);
    setError(null);
    setStep((s) => (Math.max(s - 1, 0) as StepIdx));
  }

  async function submit() {
    if (!inherent) {
      setError("Capture the inherent assessment before submitting.");
      return;
    }
    // Re-check mandatory ownership defensively.
    const ownErr = stepError(2);
    if (ownErr) {
      setError(ownErr);
      setStep(2);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        title: title.trim(),
        description: description.trim(),
        categoryId,
        subCategoryId: subCategoryId || null,
        orgLevel,
        businessUnit: businessUnit.trim() || null,
        plantId: plantId.trim() || null,
        riskOwnerId,
        riskChampionId,
        velocity,
        tags,
        causes,
        consequences,
        existingControls,
        reviewOverrideDays: reviewOverrideDays ? Number(reviewOverrideDays) : null,
        inherentAssessment: inherent,
        residualAssessment: wantResidual ? residual : null,
      };
      const res = await fetch("/api/erm/risks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.detail || j.error || `Failed to create risk (${res.status}).`);
        setBusy(false);
        return;
      }
      const created = j as { id?: string };
      if (created?.id) {
        router.push("/erm/register/" + created.id);
      } else {
        setError("Risk created but no id returned.");
        setBusy(false);
      }
    } catch (e: any) {
      setError(e?.message ?? "Network error creating risk.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Stepper */}
      <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
        <ol className="flex flex-wrap items-center gap-2">
          {STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors " +
                    (done
                      ? "bg-emerald-600 text-white"
                      : active
                        ? "bg-primary-700 text-white"
                        : "bg-slate-100 text-slate-500")
                  }
                >
                  {done ? <Check size={14} /> : i + 1}
                </span>
                <span
                  className={
                    "text-sm font-medium " +
                    (active ? "text-primary-700" : done ? "text-slate-700" : "text-slate-400")
                  }
                >
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
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            categories={categories}
            categoryId={categoryId}
            setCategoryId={(id) => {
              setCategoryId(id);
              setSubCategoryId("");
            }}
            subCategories={subCategories}
            subCategoryId={subCategoryId}
            setSubCategoryId={setSubCategoryId}
            orgLevel={orgLevel}
            setOrgLevel={setOrgLevel}
            businessUnit={businessUnit}
            setBusinessUnit={setBusinessUnit}
            businessUnits={businessUnits}
            plantId={plantId}
            setPlantId={setPlantId}
            velocity={velocity}
            setVelocity={setVelocity}
            tagsRaw={tagsRaw}
            setTagsRaw={setTagsRaw}
            tags={tags}
            touched={touched}
          />
        )}

        {step === 1 && (
          <ContextStep
            causes={causes}
            setCauses={setCauses}
            consequences={consequences}
            setConsequences={setConsequences}
            existingControls={existingControls}
            setExistingControls={setExistingControls}
          />
        )}

        {step === 2 && (
          <OwnershipStep
            riskOwnerId={riskOwnerId}
            setRiskOwnerId={setRiskOwnerId}
            riskChampionId={riskChampionId}
            setRiskChampionId={setRiskChampionId}
            reviewOverrideDays={reviewOverrideDays}
            setReviewOverrideDays={setReviewOverrideDays}
            touched={touched}
          />
        )}

        {step === 3 && (
          <AssessStep
            matrix={matrix}
            inherent={inherent}
            setInherent={setInherent}
            residual={residual}
            setResidual={setResidual}
            wantResidual={wantResidual}
            setWantResidual={setWantResidual}
          />
        )}
      </Card>

      {/* Button row */}
      <div className="flex items-center justify-between">
        <Button variant="outline"
          type="button"
          onClick={back}
          disabled={step === 0 || busy} className="gap-1 rounded-lg px-4 py-2 text-sm">
          <ChevronLeft size={16} /> Back
        </Button>
        {step < 3 ? (
          <Button variant="default"
            type="button"
            onClick={next} className="gap-1 rounded-lg px-4 py-2 text-sm text-white">
            Next <ChevronRight size={16} />
          </Button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={busy || !inherent}
            className="inline-flex items-center gap-1 rounded-lg bg-primary-700 px-5 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create Risk"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Step 1: Identify ──────────────────────────────────────────────────────────
function IdentifyStep(props: {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  categories: Category[];
  categoryId: string;
  setCategoryId: (v: string) => void;
  subCategories: Category["subCategories"];
  subCategoryId: string;
  setSubCategoryId: (v: string) => void;
  orgLevel: string;
  setOrgLevel: (v: (typeof ORG_LEVELS)[number]) => void;
  businessUnit: string;
  setBusinessUnit: (v: string) => void;
  businessUnits: string[];
  plantId: string;
  setPlantId: (v: string) => void;
  velocity: string;
  setVelocity: (v: (typeof VELOCITIES)[number]) => void;
  tagsRaw: string;
  setTagsRaw: (v: string) => void;
  tags: string[];
  touched: boolean;
}) {
  const {
    title,
    setTitle,
    description,
    setDescription,
    categories,
    categoryId,
    setCategoryId,
    subCategories,
    subCategoryId,
    setSubCategoryId,
    orgLevel,
    setOrgLevel,
    businessUnit,
    setBusinessUnit,
    businessUnits,
    plantId,
    setPlantId,
    velocity,
    setVelocity,
    tagsRaw,
    setTagsRaw,
    tags,
    touched,
  } = props;
  return (
    <div className="space-y-4">
      <Field label="Risk title" required>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 160))}
          maxLength={160}
          className={
            "w-full rounded-lg border p-2 text-sm " +
            (touched && !title.trim() ? "border-rose-300" : "border-slate-300")
          }
          placeholder="e.g. Single-source dependency on key polymer supplier" />
        <span className="mt-1 block text-right text-[10px] text-slate-400">{title.length}/160</span>
      </Field>

      <Field label="Risk statement / description">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          placeholder="Due to [cause], [event] may occur, resulting in [consequence]" />
      </Field>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Category" required>
          <SelectField
            value={categoryId}
            onChange={setCategoryId}
            className={
              "w-full rounded-lg border p-2 text-sm " +
              (touched && !categoryId ? "border-rose-300" : "border-slate-300")
            }
            placeholder="Select a category…"
            options={categories.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
          />
        </Field>

        <Field label="Sub-category">
          <SelectField
            value={subCategoryId}
            onChange={setSubCategoryId}
            disabled={!subCategories.length}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
            placeholder={subCategories.length ? "Select a sub-category…" : "—"}
            options={subCategories.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))}
          />
        </Field>

        <Field label="Org level">
          <SelectField
            value={orgLevel}
            onChange={(value) => setOrgLevel(value as (typeof ORG_LEVELS)[number])}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
            options={ORG_LEVELS.map((o) => ({ value: o, label: `${o.replace(/_/g, " ")}` }))}
          />
        </Field>

        <Field label="Business unit">
          <SelectField
            value={businessUnit}
            onChange={setBusinessUnit}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
            placeholder="Select a business unit…"
            options={businessUnits.map((bu) => ({ value: bu, label: `${bu}` }))}
          />
        </Field>

        <Field label="Plant / site id">
          <Input
            value={plantId}
            onChange={(e) => setPlantId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
            placeholder="Optional" />
        </Field>

        <Field label="Velocity">
          <SelectField
            value={velocity}
            onChange={(value) => setVelocity(value as (typeof VELOCITIES)[number])}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
            options={VELOCITIES.map((v) => ({ value: v, label: `${VELOCITY_LABEL[v]}` }))}
          />
        </Field>
      </div>

      <Field label="Tags (comma-separated)">
        <Input
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          placeholder="e.g. supply-chain, single-source, ESG" />
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((t, i) => (
              <span key={i} className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                {t}
              </span>
            ))}
          </div>
        )}
      </Field>
    </div>
  );
}

// ── Step 2: Context ───────────────────────────────────────────────────────────
function ContextStep(props: {
  causes: string[];
  setCauses: (v: string[]) => void;
  consequences: string[];
  setConsequences: (v: string[]) => void;
  existingControls: string[];
  setExistingControls: (v: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      <ChipInput
        label="Causes"
        tone="bg-amber-50 text-amber-800 border-amber-100"
        placeholder="Add a cause…"
        items={props.causes}
        setItems={props.setCauses}
      />
      <ChipInput
        label="Consequences"
        tone="bg-rose-50 text-rose-800 border-rose-100"
        placeholder="Add a consequence…"
        items={props.consequences}
        setItems={props.setConsequences}
      />
      <ChipInput
        label="Existing controls"
        tone="bg-emerald-50 text-emerald-800 border-emerald-100"
        placeholder="Add a control…"
        items={props.existingControls}
        setItems={props.setExistingControls}
      />
    </div>
  );
}

function ChipInput({
  label,
  tone,
  placeholder,
  items,
  setItems,
}: {
  label: string;
  tone: string;
  placeholder: string;
  items: string[];
  setItems: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v) return;
    if (!items.includes(v)) setItems([...items, v]);
    setDraft("");
  }
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</h3>
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
        <Button variant="outline"
          type="button"
          onClick={add} className="shrink-0 rounded-lg px-2"
          aria-label={`Add ${label}`}>
          <Plus size={16} />
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <span className="text-xs text-slate-400">None yet.</span>
        ) : (
          items.map((c, i) => (
            <span key={i} className={"inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs " + tone}>
              {c}
              <Button variant="ghost"
                type="button"
                onClick={() => setItems(items.filter((_, j) => j !== i))} className="opacity-60 hover:opacity-100"
                aria-label={`Remove ${c}`}>
                <X size={12} />
              </Button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}

// ── Step 3: Ownership ─────────────────────────────────────────────────────────
function OwnershipStep(props: {
  riskOwnerId: string | null;
  setRiskOwnerId: (v: string | null) => void;
  riskChampionId: string | null;
  setRiskChampionId: (v: string | null) => void;
  reviewOverrideDays: string;
  setReviewOverrideDays: (v: string) => void;
  touched: boolean;
}) {
  const { riskOwnerId, setRiskOwnerId, riskChampionId, setRiskChampionId, reviewOverrideDays, setReviewOverrideDays, touched } =
    props;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Risk owner" required>
        <UserPicker
          value={riskOwnerId}
          onChange={(id) => setRiskOwnerId(id)}
          required
          placeholder="Select the accountable risk owner"
        />
        {touched && !riskOwnerId && <span className="mt-1 block text-xs text-rose-600">A Risk Owner is mandatory.</span>}
      </Field>

      <Field label="Risk champion" required>
        <UserPicker
          value={riskChampionId}
          onChange={(id) => setRiskChampionId(id)}
          required
          placeholder="Select the risk champion"
        />
        {touched && !riskChampionId && (
          <span className="mt-1 block text-xs text-rose-600">A Risk Champion is mandatory.</span>
        )}
      </Field>

      <Field label="Review override (days)">
        <Input
          type="number"
          min={1}
          value={reviewOverrideDays}
          onChange={(e) => setReviewOverrideDays(e.target.value)}
          className="w-40 rounded-lg border border-slate-300 p-2 text-sm"
          placeholder="Optional" />
        <span className="mt-1 block text-xs text-slate-400">
          Overrides the band-derived review cadence. Leave blank to use the default.
        </span>
      </Field>
    </div>
  );
}

// ── Step 4: Initial Assessment ────────────────────────────────────────────────
function AssessStep(props: {
  matrix: ScoringMatrix | null;
  inherent: any | null;
  setInherent: (v: any) => void;
  residual: any | null;
  setResidual: (v: any) => void;
  wantResidual: boolean;
  setWantResidual: (v: boolean) => void;
}) {
  const { matrix, inherent, setInherent, residual, setResidual, wantResidual, setWantResidual } = props;
  return (
    <div className="space-y-5">
      <Card className="rounded-lg border border-slate-200 p-4 shadow-none">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">
            Inherent assessment <span className="text-rose-600">*</span>
          </h3>
          {inherent && <span className="text-xs font-medium text-emerald-600">✓ captured</span>}
        </div>
        <AssessForm matrix={matrix} forceType="INHERENT" busy={false} onSubmit={(b) => setInherent(b)} />
      </Card>

      <Label className="flex items-center gap-2 text-sm text-slate-700">
        <Checkbox
         
          checked={wantResidual}
          onChange={(e) => setWantResidual(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300" />
        Also capture an initial residual assessment (optional — reflects controls already in place)
      </Label>

      {wantResidual && (
        <Card className="rounded-lg border border-slate-200 p-4 shadow-none">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Residual assessment</h3>
            {residual && <span className="text-xs font-medium text-emerald-600">✓ captured</span>}
          </div>
          <AssessForm matrix={matrix} forceType="RESIDUAL" busy={false} onSubmit={(b) => setResidual(b)} />
        </Card>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs font-medium text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-rose-600">*</span>}
      </Label>
      {children}
    </div>
  );
}
