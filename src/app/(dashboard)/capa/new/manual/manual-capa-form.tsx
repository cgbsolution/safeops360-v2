"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { Alert } from "@/components/ui/alert";

const INPUT =
  "flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600";
const TEXTAREA =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600";

const PRIMARY_CATEGORIES = [
  "EQUIPMENT",
  "PROCESS",
  "MATERIAL",
  "HUMAN_FACTORS",
  "ENVIRONMENTAL",
  "DOCUMENTATION",
  "TRAINING",
  "SUPPLIER",
  "CUSTOMER",
  "REGULATORY"
];

const ACTION_TYPES = [
  { code: "CORRECTIVE_ONLY", label: "Corrective only" },
  { code: "PREVENTIVE_ONLY", label: "Preventive only" },
  { code: "CORRECTIVE_AND_PREVENTIVE", label: "Both" }
];

const SEVERITIES = ["LOW", "MODERATE", "HIGH", "CRITICAL"];
const PRIORITIES = ["LOW", "MODERATE", "HIGH", "URGENT"];

export function ManualCapaForm({
  sourceTypes,
  subCategories,
  plants,
  users
}: {
  sourceTypes: { id: string; code: string; name: string; categoryId: string }[];
  subCategories: { id: string; code: string; name: string; description: string | null }[];
  plants: { id: string; code: string; name: string }[];
  users: { id: string; name: string; email: string; plantId: string | null }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [plantId, setPlantId] = useState(plants[0]?.id ?? "");
  const [sourceTypeCode, setSourceTypeCode] = useState("MANUAL");
  const [title, setTitle] = useState("");
  const [problemDescription, setProblemDescription] = useState("");
  const [problemImpact, setProblemImpact] = useState("");
  const [detectionMethod, setDetectionMethod] = useState("");
  const [detectedAt, setDetectedAt] = useState(new Date().toISOString().slice(0, 10));
  const [primaryCategory, setPrimaryCategory] = useState("PROCESS");
  const [subCategoryCode, setSubCategoryCode] = useState("");
  const [actionType, setActionType] = useState("CORRECTIVE_AND_PREVENTIVE");
  const [severity, setSeverity] = useState("MODERATE");
  const [priority, setPriority] = useState("MODERATE");
  const [primaryOwnerUserId, setPrimaryOwnerUserId] = useState("");
  const [sourceMetadataRationale, setSourceMetadataRationale] = useState("");

  const plantUsers = users.filter((u) => !u.plantId || u.plantId === plantId);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Title required");
    if (problemDescription.length < 50)
      return setError("Problem description must be at least 50 characters");
    if (!primaryOwnerUserId) return setError("Primary owner required");

    startTransition(async () => {
      const res = await fetch("/api/capa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plantId,
          sourceTypeCode,
          sourceReferenceSummary:
            sourceTypeCode === "MANUAL"
              ? sourceMetadataRationale || "Manual CAPA — no source record"
              : null,
          sourceMetadata: {
            rationaleForCapa: sourceMetadataRationale || null,
            detectedThrough: detectionMethod || null
          },
          title: title.trim(),
          problemDescription: problemDescription.trim(),
          problemImpact: problemImpact || undefined,
          detectionMethod: detectionMethod || undefined,
          detectedAt: new Date(detectedAt).toISOString(),
          primaryCategory,
          subCategoryCode: subCategoryCode || undefined,
          actionType,
          severity,
          priority,
          primaryOwnerUserId
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Create failed (${res.status})`);
        return;
      }
      const created = await res.json();
      router.push(`/capa/${created.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-4xl">
      {error && (
        <Alert variant="destructive" className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm text-rose-900">
          {error}
        </Alert>
      )}

      <Section title="1 — Scope">
        <Grid>
          <Field label="Plant" required>
            <SelectField className={INPUT} value={plantId} onChange={setPlantId}
              options={plants.map((p) => ({ value: p.id, label: `${p.name}` }))}
            />
          </Field>
          <Field label="Source Type" required>
            <SelectField
              className={INPUT}
              value={sourceTypeCode}
              onChange={setSourceTypeCode}
              options={sourceTypes.map((s) => ({ value: s.code, label: `${s.name}` }))}
            />
          </Field>
        </Grid>
        {sourceTypeCode === "MANUAL" && (
          <Field label="Rationale for raising without a source record" required>
            <Textarea
              className={TEXTAREA}
              rows={2}
              value={sourceMetadataRationale}
              onChange={(e) => setSourceMetadataRationale(e.target.value)}
              placeholder="Why are you raising a CAPA without linking it to an incident / audit / complaint / etc.?" />
          </Field>
        )}
      </Section>

      <Section title="2 — Problem">
        <Field label="Title" required>
          <Input
            className={INPUT}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short summary that will appear in the CAPA list" />
        </Field>
        <Field label="Problem description (min 50 chars)" required>
          <Textarea
            className={TEXTAREA}
            rows={5}
            value={problemDescription}
            onChange={(e) => setProblemDescription(e.target.value)} />
          <div className="text-[10px] text-slate-500 mt-0.5">{problemDescription.length} / 50 chars</div>
        </Field>
        <Field label="Impact if not addressed">
          <Textarea
            className={TEXTAREA}
            rows={2}
            value={problemImpact}
            onChange={(e) => setProblemImpact(e.target.value)} />
        </Field>
        <Grid>
          <Field label="Detection method">
            <Input
              className={INPUT}
              value={detectionMethod}
              onChange={(e) => setDetectionMethod(e.target.value)}
              placeholder="How was this discovered?" />
          </Field>
          <Field label="Detected at" required>
            <Input
              type="date"
              className={INPUT}
              value={detectedAt}
              onChange={(e) => setDetectedAt(e.target.value)} />
          </Field>
        </Grid>
      </Section>

      <Section title="3 — Classification">
        <Grid>
          <Field label="Primary category" required>
            <SelectField
              className={INPUT}
              value={primaryCategory}
              onChange={setPrimaryCategory}
              options={PRIMARY_CATEGORIES.map((c) => ({ value: c, label: `${c.replace(/_/g, " ")}` }))}
            />
          </Field>
          <Field label="Sub-category">
            <SelectField
              className={INPUT}
              value={subCategoryCode}
              onChange={setSubCategoryCode}
              placeholder="— Select —"
              options={subCategories.map((s) => ({ value: s.code, label: `${s.name}` }))}
            />
          </Field>
          <Field label="Action type" required>
            <SelectField className={INPUT} value={actionType} onChange={setActionType}
              options={ACTION_TYPES.map((a) => ({ value: a.code, label: `${a.label}` }))}
            />
          </Field>
          <Field label="Severity" required>
            <SelectField className={INPUT} value={severity} onChange={setSeverity}
              options={SEVERITIES.map((s) => ({ value: s, label: `${s}` }))}
            />
          </Field>
          <Field label="Priority" required>
            <SelectField className={INPUT} value={priority} onChange={setPriority}
              options={PRIORITIES.map((p) => ({ value: p, label: `${p}` }))}
            />
          </Field>
        </Grid>
      </Section>

      <Section title="4 — Ownership">
        <Field label="Primary owner" required>
          <SelectField
            className={INPUT}
            value={primaryOwnerUserId}
            onChange={setPrimaryOwnerUserId}
            placeholder="— Select —"
            options={plantUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))}
          />
        </Field>
      </Section>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create CAPA"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>;
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
