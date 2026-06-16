"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm text-rose-900">
          {error}
        </div>
      )}

      <Section title="1 — Scope">
        <Grid>
          <Field label="Plant" required>
            <select className={INPUT} value={plantId} onChange={(e) => setPlantId(e.target.value)}>
              {plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Source Type" required>
            <select
              className={INPUT}
              value={sourceTypeCode}
              onChange={(e) => setSourceTypeCode(e.target.value)}
            >
              {sourceTypes.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </Grid>
        {sourceTypeCode === "MANUAL" && (
          <Field label="Rationale for raising without a source record" required>
            <textarea
              className={TEXTAREA}
              rows={2}
              value={sourceMetadataRationale}
              onChange={(e) => setSourceMetadataRationale(e.target.value)}
              placeholder="Why are you raising a CAPA without linking it to an incident / audit / complaint / etc.?"
            />
          </Field>
        )}
      </Section>

      <Section title="2 — Problem">
        <Field label="Title" required>
          <input
            className={INPUT}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short summary that will appear in the CAPA list"
          />
        </Field>
        <Field label="Problem description (min 50 chars)" required>
          <textarea
            className={TEXTAREA}
            rows={5}
            value={problemDescription}
            onChange={(e) => setProblemDescription(e.target.value)}
          />
          <div className="text-[10px] text-slate-500 mt-0.5">{problemDescription.length} / 50 chars</div>
        </Field>
        <Field label="Impact if not addressed">
          <textarea
            className={TEXTAREA}
            rows={2}
            value={problemImpact}
            onChange={(e) => setProblemImpact(e.target.value)}
          />
        </Field>
        <Grid>
          <Field label="Detection method">
            <input
              className={INPUT}
              value={detectionMethod}
              onChange={(e) => setDetectionMethod(e.target.value)}
              placeholder="How was this discovered?"
            />
          </Field>
          <Field label="Detected at" required>
            <input
              type="date"
              className={INPUT}
              value={detectedAt}
              onChange={(e) => setDetectedAt(e.target.value)}
            />
          </Field>
        </Grid>
      </Section>

      <Section title="3 — Classification">
        <Grid>
          <Field label="Primary category" required>
            <select
              className={INPUT}
              value={primaryCategory}
              onChange={(e) => setPrimaryCategory(e.target.value)}
            >
              {PRIMARY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sub-category">
            <select
              className={INPUT}
              value={subCategoryCode}
              onChange={(e) => setSubCategoryCode(e.target.value)}
            >
              <option value="">— Select —</option>
              {subCategories.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Action type" required>
            <select className={INPUT} value={actionType} onChange={(e) => setActionType(e.target.value)}>
              {ACTION_TYPES.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Severity" required>
            <select className={INPUT} value={severity} onChange={(e) => setSeverity(e.target.value)}>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority" required>
            <select className={INPUT} value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
        </Grid>
      </Section>

      <Section title="4 — Ownership">
        <Field label="Primary owner" required>
          <select
            className={INPUT}
            value={primaryOwnerUserId}
            onChange={(e) => setPrimaryOwnerUserId(e.target.value)}
          >
            <option value="">— Select —</option>
            {plantUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
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
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label} {required && <span className="text-rose-600">*</span>}
      </label>
      {children}
    </div>
  );
}
