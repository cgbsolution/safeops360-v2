"use client";

// Generic source-intake form for CAPAs from sources whose parent module
// doesn't exist yet (audit, customer complaint, quality NCR, calibration,
// environmental, management review). Each source supplies its own set of
// extra fields that become `sourceMetadata` JSON; the universal CAPA fields
// (problem description, severity, owner, etc.) are unchanged across sources.

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

const SEVERITIES = ["LOW", "MODERATE", "HIGH", "CRITICAL"];
const PRIORITIES = ["LOW", "MODERATE", "HIGH", "URGENT"];

export type SourceIntakeField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "datetime-local" | "number" | "select";
  required?: boolean;
  placeholder?: string;
  options?: { code: string; label: string }[];
  hint?: string;
};

export type SourceIntakeConfig = {
  sourceTypeCode: string;
  sourceLabel: string;
  defaultPrimaryCategory: string;
  defaultSeverity: string;
  intro: string;
  fields: SourceIntakeField[];
};

export function SourceIntakeForm({
  config,
  plants,
  users
}: {
  config: SourceIntakeConfig;
  plants: { id: string; code: string; name: string }[];
  users: { id: string; name: string; email: string; plantId: string | null }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [plantId, setPlantId] = useState(plants[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [problemDescription, setProblemDescription] = useState("");
  const [problemImpact, setProblemImpact] = useState("");
  const [detectedAt, setDetectedAt] = useState(new Date().toISOString().slice(0, 10));
  const [primaryCategory, setPrimaryCategory] = useState(config.defaultPrimaryCategory);
  const [severity, setSeverity] = useState(config.defaultSeverity);
  const [priority, setPriority] = useState(config.defaultSeverity === "CRITICAL" ? "URGENT" : "MODERATE");
  const [primaryOwnerUserId, setPrimaryOwnerUserId] = useState("");
  const [sourceMeta, setSourceMeta] = useState<Record<string, string>>({});

  const plantUsers = users.filter((u) => !u.plantId || u.plantId === plantId);

  function setMetaField(key: string, value: string) {
    setSourceMeta((m) => ({ ...m, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Title required");
    if (problemDescription.length < 50)
      return setError("Problem description must be at least 50 characters");
    if (!primaryOwnerUserId) return setError("Primary owner required");

    for (const f of config.fields) {
      if (f.required && !sourceMeta[f.key]) {
        return setError(`${f.label} is required`);
      }
    }

    // Build a human-readable reference summary from the first 2-3 source fields
    const summaryFields = config.fields.slice(0, 3).map((f) => sourceMeta[f.key]).filter(Boolean);
    const sourceReferenceSummary = summaryFields.length
      ? `${config.sourceLabel}: ${summaryFields.join(" · ")}`
      : config.sourceLabel;

    startTransition(async () => {
      const res = await fetch("/api/capa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plantId,
          sourceTypeCode: config.sourceTypeCode,
          sourceReferenceSummary,
          sourceMetadata: sourceMeta,
          title: title.trim(),
          problemDescription: problemDescription.trim(),
          problemImpact: problemImpact || undefined,
          detectedAt: new Date(detectedAt).toISOString(),
          primaryCategory,
          severity,
          priority,
          actionType: "CORRECTIVE_AND_PREVENTIVE",
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

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <div className="font-medium">{config.sourceLabel}</div>
        <div className="text-xs mt-1">{config.intro}</div>
      </div>

      <Section title={`1 — ${config.sourceLabel} Details`}>
        <Grid>
          {config.fields.map((f) => (
            <div key={f.key} className={f.type === "textarea" ? "md:col-span-2" : ""}>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {f.label} {f.required && <span className="text-rose-600">*</span>}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  className={TEXTAREA}
                  rows={3}
                  value={sourceMeta[f.key] ?? ""}
                  onChange={(e) => setMetaField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              ) : f.type === "select" ? (
                <select
                  className={INPUT}
                  value={sourceMeta[f.key] ?? ""}
                  onChange={(e) => setMetaField(f.key, e.target.value)}
                >
                  <option value="">— Select —</option>
                  {f.options?.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type}
                  className={INPUT}
                  value={sourceMeta[f.key] ?? ""}
                  onChange={(e) => setMetaField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              )}
              {f.hint && <div className="text-[10px] text-slate-500 mt-0.5">{f.hint}</div>}
            </div>
          ))}
        </Grid>
      </Section>

      <Section title="2 — Scope">
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

      <Section title="3 — Problem">
        <Field label="Title" required>
          <input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Problem description (min 50 chars)" required>
          <textarea
            className={TEXTAREA}
            rows={4}
            value={problemDescription}
            onChange={(e) => setProblemDescription(e.target.value)}
          />
          <div className="text-[10px] text-slate-500 mt-0.5">{problemDescription.length} / 50</div>
        </Field>
        <Field label="Impact if not addressed">
          <textarea
            className={TEXTAREA}
            rows={2}
            value={problemImpact}
            onChange={(e) => setProblemImpact(e.target.value)}
          />
        </Field>
      </Section>

      <Section title="4 — Classification & Ownership">
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
          <Field label="Primary owner" required>
            <select
              className={INPUT}
              value={primaryOwnerUserId}
              onChange={(e) => setPrimaryOwnerUserId(e.target.value)}
            >
              <option value="">— Select —</option>
              {plantUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
        </Grid>
      </Section>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : `Create ${config.sourceLabel} CAPA`}
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
