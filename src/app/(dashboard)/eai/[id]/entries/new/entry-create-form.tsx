"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

type MatrixLevel = { id: string; score: number; label: string; description: string };
type Matrix = {
  id: string;
  name: string;
  likelihoods: MatrixLevel[];
  magnitudes: MatrixLevel[];
};
type Aspect = {
  id: string;
  code: string;
  categoryId: string;
  name: string;
  typicallySignificant: boolean;
};
type Category = { id: string; code: string; name: string; sortOrder: number };
type Receptor = { id: string; code: string; name: string };

type AspectRow = { aspectId: string; contextualDescription: string };
type ImpactRow = {
  description: string;
  affectedReceptor: string;
  impactType: string;
  reversibility: string;
  geographicExtent: string;
  temporalExtent: string;
};
type ControlRow = { hierarchy: string; description: string; effectiveness: string };

// Operating conditions + descriptors — canonical values used by the EAI
// seed data (prisma/seed-eai-demo.ts) so new rows match existing ones.
const OCCURRENCE = ["NORMAL", "ABNORMAL", "EMERGENCY"];
const FREQUENCY = ["CONTINUOUS", "DAILY", "WEEKLY", "MONTHLY", "OCCASIONAL", "RARE"];
const IMPACT_TYPE = ["DIRECT", "INDIRECT", "CUMULATIVE"];
const REVERSIBILITY = ["REVERSIBLE", "PARTIALLY_REVERSIBLE", "IRREVERSIBLE"];
const GEOGRAPHIC = ["SITE", "LOCAL", "REGIONAL", "GLOBAL"];
const TEMPORAL = ["SHORT_TERM", "MEDIUM_TERM", "LONG_TERM", "PERMANENT"];
const HIERARCHY = ["ELIMINATION", "SUBSTITUTION", "ENGINEERING", "ADMINISTRATIVE", "PPE", "MONITORING"];
const EFFECTIVENESS = ["EFFECTIVE", "PARTIALLY_EFFECTIVE", "NOT_EFFECTIVE", "NOT_VERIFIED"];

// Mirrors the backend create_entry → _resolve_impact_level bands so the
// preview shown here matches exactly what the server will compute & store.
function band(score: number): { level: string; cls: string; significant: boolean } {
  if (score <= 4) return { level: "LOW", cls: "bg-emerald-100 text-emerald-800 border-emerald-200", significant: false };
  if (score <= 9) return { level: "MODERATE", cls: "bg-amber-100 text-amber-800 border-amber-200", significant: false };
  if (score <= 16) return { level: "SIGNIFICANT", cls: "bg-orange-100 text-orange-800 border-orange-200", significant: true };
  return { level: "MAJOR", cls: "bg-rose-100 text-rose-800 border-rose-200", significant: true };
}

function commaList(s: string): string[] | null {
  const arr = s.split(",").map((x) => x.trim()).filter(Boolean);
  return arr.length ? arr : null;
}

export function EaiEntryCreateForm({
  studyId,
  matrix,
  aspects,
  categories,
  receptors
}: {
  studyId: string;
  matrix: Matrix;
  aspects: Aspect[];
  categories: Category[];
  receptors: Receptor[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const likelihoods = [...matrix.likelihoods].sort((a, b) => a.score - b.score);
  const magnitudes = [...matrix.magnitudes].sort((a, b) => a.score - b.score);
  const receptorOpts = receptors.length
    ? receptors
    : // Fallback if the receptor master is empty.
      ["AIR", "SURFACE_WATER", "GROUND_WATER", "SOIL", "COMMUNITY", "CLIMATE"].map(
        (c) => ({ id: c, code: c, name: c })
      );

  // Aspect library grouped by category for an optgroup-based picker.
  const aspectsByCategory = useMemo(() => {
    const cats = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const groups = cats.map((c) => ({
      label: c.name,
      items: aspects.filter((a) => a.categoryId === c.id)
    }));
    const known = new Set(cats.map((c) => c.id));
    const orphan = aspects.filter((a) => !known.has(a.categoryId));
    if (orphan.length) groups.push({ label: "Other", items: orphan });
    return groups.filter((g) => g.items.length > 0);
  }, [aspects, categories]);

  // ── Activity ──────────────────────────────────────────────────────
  const [activityDescription, setActivityDescription] = useState("");
  const [subLocation, setSubLocation] = useState("");
  const [occurrence, setOccurrence] = useState("NORMAL");
  const [frequency, setFrequency] = useState("CONTINUOUS");
  const [typicalDurationMin, setTypicalDurationMin] = useState<string>("");
  const [equipmentUsed, setEquipmentUsed] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState("");

  // ── Initial assessment ────────────────────────────────────────────
  const [initialLikelihoodId, setInitialLikelihoodId] = useState("");
  const [initialMagnitudeId, setInitialMagnitudeId] = useState("");
  const [initialLikelihoodRationale, setInitialLikelihoodRationale] = useState("");
  const [initialMagnitudeRationale, setInitialMagnitudeRationale] = useState("");

  // ── Child collections ─────────────────────────────────────────────
  const [aspectRows, setAspectRows] = useState<AspectRow[]>([
    { aspectId: "", contextualDescription: "" }
  ]);
  const [impactRows, setImpactRows] = useState<ImpactRow[]>([]);
  const [controlRows, setControlRows] = useState<ControlRow[]>([]);

  const likScore = likelihoods.find((l) => l.id === initialLikelihoodId)?.score;
  const magScore = magnitudes.find((m) => m.id === initialMagnitudeId)?.score;
  const preview =
    likScore && magScore
      ? { score: likScore * magScore, ...band(likScore * magScore) }
      : null;

  function addAspect() {
    setAspectRows((r) => [...r, { aspectId: "", contextualDescription: "" }]);
  }
  function addImpact() {
    setImpactRows((r) => [
      ...r,
      {
        description: "",
        affectedReceptor: receptorOpts[0]?.code ?? "",
        impactType: "DIRECT",
        reversibility: "REVERSIBLE",
        geographicExtent: "LOCAL",
        temporalExtent: "MEDIUM_TERM"
      }
    ]);
  }
  function addControl() {
    setControlRows((r) => [
      ...r,
      { hierarchy: "ENGINEERING", description: "", effectiveness: "EFFECTIVE" }
    ]);
  }

  function submit() {
    setError(null);
    if (!activityDescription.trim()) return setError("Activity description is required.");
    if (!initialLikelihoodId) return setError("Initial likelihood is required.");
    if (!initialMagnitudeId) return setError("Initial magnitude is required.");

    const cleanAspects = aspectRows.filter((a) => a.aspectId);
    if (cleanAspects.length === 0)
      return setError("Add at least one environmental aspect.");

    const cleanImpacts = impactRows.filter((i) => i.description.trim());
    const cleanControls = controlRows.filter((c) => c.description.trim());

    const body = {
      activityDescription: activityDescription.trim(),
      subLocation: subLocation.trim() || null,
      occurrence,
      frequency,
      typicalDurationMin: typicalDurationMin ? Number(typicalDurationMin) : null,
      equipmentUsed: commaList(equipmentUsed),
      materialsUsed: commaList(materialsUsed),
      initialLikelihoodId,
      initialMagnitudeId,
      initialLikelihoodRationale: initialLikelihoodRationale.trim() || null,
      initialMagnitudeRationale: initialMagnitudeRationale.trim() || null,
      aspects: cleanAspects.map((a, i) => ({
        aspectId: a.aspectId,
        contextualDescription: a.contextualDescription.trim() || null,
        sortOrder: i
      })),
      impacts: cleanImpacts.map((i, idx) => ({ ...i, sortOrder: idx })),
      existingControls: cleanControls.map((c, i) => ({ ...c, sortOrder: i }))
    };

    startTransition(async () => {
      const res = await fetch(`/api/eai/studies/${studyId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          (data as { error?: string; detail?: string }).error ??
            (data as { detail?: string }).detail ??
            `Failed (${res.status})`
        );
        return;
      }
      router.push(`/eai/${studyId}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Activity */}
      <Section title="Activity">
        <Field label="Activity description" required>
          <textarea
            value={activityDescription}
            onChange={(e) => setActivityDescription(e.target.value)}
            rows={2}
            placeholder="e.g., Clinker production in the rotary kiln — continuous stack emission of particulate matter."
            className="form-input"
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Occurrence" required>
            <select value={occurrence} onChange={(e) => setOccurrence(e.target.value)} className="form-input">
              {OCCURRENCE.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>
          <Field label="Frequency" required>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="form-input">
              {FREQUENCY.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </Field>
          <Field label="Typical duration (min)">
            <input
              type="number"
              min={0}
              value={typicalDurationMin}
              onChange={(e) => setTypicalDurationMin(e.target.value)}
              className="form-input"
            />
          </Field>
        </div>
        <Field label="Sub-location">
          <input
            type="text"
            value={subLocation}
            onChange={(e) => setSubLocation(e.target.value)}
            placeholder="e.g., Kiln line 2 stack"
            className="form-input"
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Equipment used (comma-separated)">
            <input
              type="text"
              value={equipmentUsed}
              onChange={(e) => setEquipmentUsed(e.target.value)}
              placeholder="Rotary kiln, Bag filter"
              className="form-input"
            />
          </Field>
          <Field label="Materials used (comma-separated)">
            <input
              type="text"
              value={materialsUsed}
              onChange={(e) => setMaterialsUsed(e.target.value)}
              placeholder="Coal, Limestone"
              className="form-input"
            />
          </Field>
        </div>
      </Section>

      {/* Aspects */}
      <Section title="Environmental aspects" onAdd={addAspect} addLabel="Add aspect">
        {aspectRows.length === 0 ? (
          <Empty msg="Add at least one environmental aspect from the library." />
        ) : (
          <ul className="space-y-3">
            {aspectRows.map((row, i) => (
              <li key={i} className="rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="flex gap-2 items-start">
                  <select
                    value={row.aspectId}
                    onChange={(e) =>
                      setAspectRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, aspectId: e.target.value } : r))
                      )
                    }
                    className="form-input flex-1"
                  >
                    <option value="">Select aspect…</option>
                    {aspectsByCategory.map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.items.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                            {a.typicallySignificant ? " ⚠" : ""}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <RemoveBtn
                    onClick={() => setAspectRows((rows) => rows.filter((_, idx) => idx !== i))}
                    label="Remove aspect"
                  />
                </div>
                <input
                  type="text"
                  value={row.contextualDescription}
                  onChange={(e) =>
                    setAspectRows((rows) =>
                      rows.map((r, idx) =>
                        idx === i ? { ...r, contextualDescription: e.target.value } : r
                      )
                    )
                  }
                  placeholder="Context for this activity (optional)"
                  className="form-input text-sm"
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Initial assessment */}
      <Section title="Initial assessment">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Likelihood" required>
            <select
              value={initialLikelihoodId}
              onChange={(e) => setInitialLikelihoodId(e.target.value)}
              className="form-input"
            >
              <option value="">Select likelihood…</option>
              {likelihoods.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.score} — {l.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Magnitude" required>
            <select
              value={initialMagnitudeId}
              onChange={(e) => setInitialMagnitudeId(e.target.value)}
              className="form-input"
            >
              <option value="">Select magnitude…</option>
              {magnitudes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.score} — {m.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="rounded-lg border bg-slate-50 p-3 flex items-center gap-3 text-sm">
          <span className="text-slate-600">Initial impact:</span>
          {preview ? (
            <>
              <span className={`inline-block px-2 py-0.5 text-xs rounded border ${preview.cls}`}>
                {preview.level} · {preview.score}
              </span>
              {preview.significant && (
                <span className="text-xs font-medium text-rose-700">Significant aspect</span>
              )}
              <span className="text-xs text-slate-400">
                ({likScore} × {magScore})
              </span>
            </>
          ) : (
            <span className="text-xs text-slate-400">Select likelihood and magnitude to preview.</span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Likelihood rationale">
            <textarea
              value={initialLikelihoodRationale}
              onChange={(e) => setInitialLikelihoodRationale(e.target.value)}
              rows={2}
              className="form-input"
            />
          </Field>
          <Field label="Magnitude rationale">
            <textarea
              value={initialMagnitudeRationale}
              onChange={(e) => setInitialMagnitudeRationale(e.target.value)}
              rows={2}
              className="form-input"
            />
          </Field>
        </div>
        <p className="text-xs text-slate-400">
          Residual scoring (after controls) is recorded later from the entry, once controls are evaluated.
        </p>
      </Section>

      {/* Impacts */}
      <Section title="Environmental impacts" onAdd={addImpact} addLabel="Add impact">
        {impactRows.length === 0 ? (
          <Empty msg="Optional — describe the impacts these aspects cause." />
        ) : (
          <ul className="space-y-3">
            {impactRows.map((row, i) => (
              <li key={i} className="rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="flex gap-2 items-start">
                  <input
                    type="text"
                    value={row.description}
                    onChange={(e) =>
                      setImpactRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, description: e.target.value } : r))
                      )
                    }
                    placeholder="Impact description"
                    className="form-input flex-1"
                  />
                  <RemoveBtn
                    onClick={() => setImpactRows((rows) => rows.filter((_, idx) => idx !== i))}
                    label="Remove impact"
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <MiniSelect
                    value={row.affectedReceptor}
                    onChange={(v) =>
                      setImpactRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, affectedReceptor: v } : r)))
                    }
                    options={receptorOpts.map((r) => ({ value: r.code, label: r.name }))}
                  />
                  <MiniSelect
                    value={row.impactType}
                    onChange={(v) =>
                      setImpactRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, impactType: v } : r)))
                    }
                    options={IMPACT_TYPE.map((x) => ({ value: x, label: x }))}
                  />
                  <MiniSelect
                    value={row.reversibility}
                    onChange={(v) =>
                      setImpactRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, reversibility: v } : r)))
                    }
                    options={REVERSIBILITY.map((x) => ({ value: x, label: x.replace(/_/g, " ") }))}
                  />
                  <MiniSelect
                    value={row.geographicExtent}
                    onChange={(v) =>
                      setImpactRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, geographicExtent: v } : r)))
                    }
                    options={GEOGRAPHIC.map((x) => ({ value: x, label: x }))}
                  />
                  <MiniSelect
                    value={row.temporalExtent}
                    onChange={(v) =>
                      setImpactRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, temporalExtent: v } : r)))
                    }
                    options={TEMPORAL.map((x) => ({ value: x, label: x.replace(/_/g, " ") }))}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Existing controls */}
      <Section title="Existing controls" onAdd={addControl} addLabel="Add control">
        {controlRows.length === 0 ? (
          <Empty msg="Optional — record controls already in place." />
        ) : (
          <ul className="space-y-3">
            {controlRows.map((row, i) => (
              <li key={i} className="rounded-lg border border-slate-200 p-3 flex gap-2 items-start">
                <select
                  value={row.hierarchy}
                  onChange={(e) =>
                    setControlRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, hierarchy: e.target.value } : r)))
                  }
                  className="form-input w-44"
                >
                  {HIERARCHY.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={row.description}
                  onChange={(e) =>
                    setControlRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, description: e.target.value } : r)))
                  }
                  placeholder="Control description"
                  className="form-input flex-1"
                />
                <select
                  value={row.effectiveness}
                  onChange={(e) =>
                    setControlRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, effectiveness: e.target.value } : r)))
                  }
                  className="form-input w-44"
                >
                  {EFFECTIVENESS.map((x) => (
                    <option key={x} value={x}>{x.replace(/_/g, " ")}</option>
                  ))}
                </select>
                <RemoveBtn
                  onClick={() => setControlRows((rows) => rows.filter((_, idx) => idx !== i))}
                  label="Remove control"
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {error && (
        <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="ghost" onClick={() => router.push(`/eai/${studyId}`)} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Add Entry"}
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  onAdd,
  addLabel
}: {
  title: string;
  children: React.ReactNode;
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {onAdd && (
          <Button type="button" variant="ghost" size="sm" onClick={onAdd}>
            <Plus size={14} /> {addLabel ?? "Add"}
          </Button>
        )}
      </div>
      <div className="space-y-5 px-6 py-5">{children}</div>
    </section>
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
      <label className="form-label">
        {label} {required && <span className="text-rose-600">*</span>}
      </label>
      {children}
    </div>
  );
}

function MiniSelect({
  value,
  onChange,
  options
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="form-input text-xs">
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function RemoveBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-2 text-slate-400 hover:text-rose-600 shrink-0"
      aria-label={label}
    >
      <Trash2 size={14} />
    </button>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-xs text-slate-400 py-1">{msg}</div>;
}
