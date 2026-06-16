"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import type { EaiEntryOut, MatrixLevel, AspectItem, CategoryItem, ReceptorItem } from "./types";

type Props = {
  entry: EaiEntryOut;
  matrix: { likelihoods: MatrixLevel[]; magnitudes: MatrixLevel[] };
  aspects: AspectItem[];
  categories: CategoryItem[];
  receptors: ReceptorItem[];
  isEditable: boolean;
};

// ── Row types ─────────────────────────────────────────────────────────────────

type AspectRow = { aspectId: string; contextualDescription: string };
type ImpactRow = {
  description: string;
  affectedReceptor: string;
  impactType: string;
  reversibility: string;
  geographicExtent: string;
  temporalExtent: string;
};
type ControlRow = {
  hierarchy: string;
  description: string;
  effectiveness: string;
  monitoringPoint: string;
  monitoringParameter: string;
  monitoringFrequency: string;
};
type ObligationRow = {
  regulationCode: string;
  parameter: string;
  permittedLimit: string;
  monitoringFrequency: string;
  nextMonitoringDue: string;
};
type RecControlRow = {
  hierarchy: string;
  description: string;
  rationale: string;
  estimatedCostBand: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const OCCURRENCE = ["NORMAL", "ABNORMAL", "EMERGENCY"];
const FREQUENCY = ["CONTINUOUS", "DAILY", "WEEKLY", "MONTHLY", "OCCASIONAL", "RARE"];
const IMPACT_TYPE = ["DIRECT", "INDIRECT", "CUMULATIVE"];
const REVERSIBILITY = ["REVERSIBLE", "PARTIALLY_REVERSIBLE", "IRREVERSIBLE"];
const GEOGRAPHIC = ["SITE", "LOCAL", "REGIONAL", "GLOBAL"];
const TEMPORAL = ["SHORT_TERM", "MEDIUM_TERM", "LONG_TERM", "PERMANENT"];
const HIERARCHY = ["ELIMINATION", "SUBSTITUTION", "ENGINEERING", "ADMINISTRATIVE", "PPE", "MONITORING"];
const EFFECTIVENESS = ["EFFECTIVE", "PARTIALLY_EFFECTIVE", "NOT_EFFECTIVE", "NOT_VERIFIED"];
const COMPLIANCE_STATUS = ["COMPLIANT", "MARGINAL", "NON_COMPLIANT", "UNDER_REVIEW"];
const COST_BAND = ["<5K", "5K-25K", "25K-100K", ">100K"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function band(score: number): { level: string; cls: string; significant: boolean } {
  if (score <= 4)
    return { level: "LOW", cls: "bg-emerald-100 text-emerald-800 border-emerald-200", significant: false };
  if (score <= 9)
    return { level: "MODERATE", cls: "bg-amber-100 text-amber-800 border-amber-200", significant: false };
  if (score <= 16)
    return { level: "SIGNIFICANT", cls: "bg-orange-100 text-orange-800 border-orange-200", significant: true };
  return { level: "MAJOR", cls: "bg-rose-100 text-rose-800 border-rose-200", significant: true };
}

function commaList(s: string): string[] | null {
  const arr = s.split(",").map((x) => x.trim()).filter(Boolean);
  return arr.length ? arr : null;
}

// Find the matrix level id matching a score (for initializing residual dropdowns)
function findLevelId(levels: MatrixLevel[], score: number | null): string {
  if (score === null) return "";
  return levels.find((l) => l.score === score)?.id ?? "";
}

// Build initial state from entry prop
function initAspectRows(entry: EaiEntryOut): AspectRow[] {
  if (!entry.aspects || entry.aspects.length === 0) {
    return [{ aspectId: "", contextualDescription: "" }];
  }
  return [...entry.aspects]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((a) => ({
      aspectId: a.aspectId,
      contextualDescription: a.contextualDescription ?? ""
    }));
}

function initImpactRows(entry: EaiEntryOut): ImpactRow[] {
  return (entry.impacts ?? []).map((i) => ({
    description: i.description,
    affectedReceptor: i.affectedReceptor,
    impactType: i.impactType,
    reversibility: i.reversibility,
    geographicExtent: i.geographicExtent,
    temporalExtent: i.temporalExtent
  }));
}

function initControlRows(entry: EaiEntryOut): ControlRow[] {
  return (entry.existingControls ?? []).map((c) => ({
    hierarchy: c.hierarchy,
    description: c.description,
    effectiveness: c.effectiveness ?? "EFFECTIVE",
    monitoringPoint: c.monitoringPoint ?? "",
    monitoringParameter: c.monitoringParameter ?? "",
    monitoringFrequency: c.monitoringFrequency ?? ""
  }));
}

function initObligationRows(entry: EaiEntryOut): ObligationRow[] {
  return (entry.complianceObligations ?? []).map((o) => ({
    regulationCode: o.regulationCode,
    parameter: o.parameter,
    permittedLimit: o.permittedLimit,
    monitoringFrequency: o.monitoringFrequency,
    nextMonitoringDue: o.nextMonitoringDue
      ? o.nextMonitoringDue.slice(0, 10)
      : ""
  }));
}

function initRecControlRows(entry: EaiEntryOut): RecControlRow[] {
  return (entry.recommendedControls ?? []).map((r) => ({
    hierarchy: r.hierarchy,
    description: r.description,
    rationale: r.rationale ?? "",
    estimatedCostBand: r.estimatedCostBand ?? ""
  }));
}

// ── Main component ────────────────────────────────────────────────────────────

export function EntryEditor({
  entry,
  matrix,
  aspects,
  categories,
  receptors,
  isEditable
}: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Change-reason (required when study is locked)
  const [changeReason, setChangeReason] = useState("");
  const [changeTrigger, setChangeTrigger] = useState("MANUAL_EDIT");

  // ── Activity state ────────────────────────────────────────────────
  const [activityDescription, setActivityDescription] = useState(entry.activityDescription);
  const [occurrence, setOccurrence] = useState(entry.occurrence);
  const [frequency, setFrequency] = useState(entry.frequency);
  const [typicalDurationMin, setTypicalDurationMin] = useState(
    entry.typicalDurationMin !== null ? String(entry.typicalDurationMin) : ""
  );
  const [subLocation, setSubLocation] = useState(entry.subLocation ?? "");
  const [equipmentUsed, setEquipmentUsed] = useState(
    entry.equipmentUsed?.join(", ") ?? ""
  );
  const [materialsUsed, setMaterialsUsed] = useState(
    entry.materialsUsed?.join(", ") ?? ""
  );

  // ── Child collections ─────────────────────────────────────────────
  const [aspectRows, setAspectRows] = useState<AspectRow[]>(() => initAspectRows(entry));
  const [impactRows, setImpactRows] = useState<ImpactRow[]>(() => initImpactRows(entry));
  const [controlRows, setControlRows] = useState<ControlRow[]>(() => initControlRows(entry));
  const [obligationRows, setObligationRows] = useState<ObligationRow[]>(() => initObligationRows(entry));
  const [recControlRows, setRecControlRows] = useState<RecControlRow[]>(() => initRecControlRows(entry));

  // ── Residual assessment ───────────────────────────────────────────
  const likelihoods = useMemo(() => [...matrix.likelihoods].sort((a, b) => a.score - b.score), [matrix]);
  const magnitudes = useMemo(() => [...matrix.magnitudes].sort((a, b) => a.score - b.score), [matrix]);

  const [residualLikelihoodId, setResidualLikelihoodId] = useState(
    () => findLevelId(likelihoods, entry.residualLikelihoodScore)
  );
  const [residualMagnitudeId, setResidualMagnitudeId] = useState(
    () => findLevelId(magnitudes, entry.residualMagnitudeScore)
  );
  const [residualLikelihoodRationale, setResidualLikelihoodRationale] = useState(
    entry.residualLikelihoodRationale ?? ""
  );
  const [residualMagnitudeRationale, setResidualMagnitudeRationale] = useState(
    entry.residualMagnitudeRationale ?? ""
  );
  const [residualAcceptanceRationale, setResidualAcceptanceRationale] = useState(
    entry.residualAcceptanceRationale ?? ""
  );

  // ── Legal compliance ──────────────────────────────────────────────
  const [legalComplianceStatus, setLegalComplianceStatus] = useState(
    entry.legalComplianceStatus ?? ""
  );

  // ── Aspect grouping ───────────────────────────────────────────────
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

  // ── Receptor options ──────────────────────────────────────────────
  const receptorOpts = receptors.length
    ? receptors
    : ["AIR", "SURFACE_WATER", "GROUND_WATER", "SOIL", "COMMUNITY", "CLIMATE"].map(
        (c) => ({ id: c, code: c, name: c })
      );

  // ── Residual live preview ─────────────────────────────────────────
  const resLikScore = likelihoods.find((l) => l.id === residualLikelihoodId)?.score;
  const resMagScore = magnitudes.find((m) => m.id === residualMagnitudeId)?.score;
  const residualPreview =
    resLikScore != null && resMagScore != null
      ? { score: resLikScore * resMagScore, ...band(resLikScore * resMagScore) }
      : null;

  // ── Dirty helper ──────────────────────────────────────────────────
  function markDirty() {
    setIsDirty(true);
    setSuccess(null);
    setError(null);
  }

  // ── Row add helpers ───────────────────────────────────────────────
  function addAspect() {
    setAspectRows((r) => [...r, { aspectId: "", contextualDescription: "" }]);
    markDirty();
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
    markDirty();
  }
  function addControl() {
    setControlRows((r) => [
      ...r,
      {
        hierarchy: "ENGINEERING",
        description: "",
        effectiveness: "EFFECTIVE",
        monitoringPoint: "",
        monitoringParameter: "",
        monitoringFrequency: ""
      }
    ]);
    markDirty();
  }
  function addObligation() {
    setObligationRows((r) => [
      ...r,
      {
        regulationCode: "",
        parameter: "",
        permittedLimit: "",
        monitoringFrequency: "",
        nextMonitoringDue: ""
      }
    ]);
    markDirty();
  }
  function addRecControl() {
    setRecControlRows((r) => [
      ...r,
      {
        hierarchy: "ENGINEERING",
        description: "",
        rationale: "",
        estimatedCostBand: ""
      }
    ]);
    markDirty();
  }

  // ── Discard changes ───────────────────────────────────────────────
  function discard() {
    setActivityDescription(entry.activityDescription);
    setOccurrence(entry.occurrence);
    setFrequency(entry.frequency);
    setTypicalDurationMin(entry.typicalDurationMin !== null ? String(entry.typicalDurationMin) : "");
    setSubLocation(entry.subLocation ?? "");
    setEquipmentUsed(entry.equipmentUsed?.join(", ") ?? "");
    setMaterialsUsed(entry.materialsUsed?.join(", ") ?? "");
    setAspectRows(initAspectRows(entry));
    setImpactRows(initImpactRows(entry));
    setControlRows(initControlRows(entry));
    setObligationRows(initObligationRows(entry));
    setRecControlRows(initRecControlRows(entry));
    setResidualLikelihoodId(findLevelId(likelihoods, entry.residualLikelihoodScore));
    setResidualMagnitudeId(findLevelId(magnitudes, entry.residualMagnitudeScore));
    setResidualLikelihoodRationale(entry.residualLikelihoodRationale ?? "");
    setResidualMagnitudeRationale(entry.residualMagnitudeRationale ?? "");
    setResidualAcceptanceRationale(entry.residualAcceptanceRationale ?? "");
    setLegalComplianceStatus(entry.legalComplianceStatus ?? "");
    setChangeReason("");
    setChangeTrigger("MANUAL_EDIT");
    setIsDirty(false);
    setError(null);
    setSuccess(null);
  }

  // ── Save ──────────────────────────────────────────────────────────
  function save() {
    setError(null);
    setSuccess(null);
    if (!activityDescription.trim()) {
      setError("Activity description is required.");
      return;
    }

    setIsSaving(true);
    (async () => {
      const entryId = entry.id;

      // 1. PATCH main entry fields
      const patchBody: Record<string, unknown> = {
        activityDescription: activityDescription.trim(),
        occurrence,
        frequency,
        typicalDurationMin: typicalDurationMin ? Number(typicalDurationMin) : null,
        subLocation: subLocation.trim() || null,
        equipmentUsed: commaList(equipmentUsed),
        materialsUsed: commaList(materialsUsed),
        residualLikelihoodId: residualLikelihoodId || null,
        residualMagnitudeId: residualMagnitudeId || null,
        residualLikelihoodRationale: residualLikelihoodRationale.trim() || null,
        residualMagnitudeRationale: residualMagnitudeRationale.trim() || null,
        residualAcceptanceRationale: residualAcceptanceRationale.trim() || null,
        legalComplianceStatus: legalComplianceStatus || null
      };
      if (changeReason.trim()) {
        patchBody.changeReason = changeReason.trim();
        patchBody.changeTrigger = changeTrigger;
      }

      const r1 = await fetch(`/api/eai/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody)
      });
      if (!r1.ok) {
        const d = await r1.json().catch(() => ({})) as Record<string, unknown>;
        setError((d.error as string) ?? (d.detail as string) ?? `Save failed (${r1.status})`);
        return;
      }

      // 2. PUT aspects
      const r2 = await fetch(`/api/eai/entries/${entryId}/aspects`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          aspectRows
            .filter((a) => a.aspectId)
            .map((a, i) => ({
              aspectId: a.aspectId,
              contextualDescription: a.contextualDescription.trim() || null,
              sortOrder: i
            }))
        )
      });
      if (!r2.ok) {
        const d = await r2.json().catch(() => ({})) as Record<string, unknown>;
        setError((d.error as string) ?? `Aspects save failed (${r2.status})`);
        return;
      }

      // 3. PUT impacts
      const r3 = await fetch(`/api/eai/entries/${entryId}/impacts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          impactRows
            .filter((i) => i.description.trim())
            .map((r, i) => ({ ...r, sortOrder: i }))
        )
      });
      if (!r3.ok) {
        const d = await r3.json().catch(() => ({})) as Record<string, unknown>;
        setError((d.error as string) ?? `Impacts save failed (${r3.status})`);
        return;
      }

      // 4. PUT controls
      const r4 = await fetch(`/api/eai/entries/${entryId}/controls`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          controlRows
            .filter((c) => c.description.trim())
            .map((r, i) => ({ ...r, sortOrder: i }))
        )
      });
      if (!r4.ok) {
        const d = await r4.json().catch(() => ({})) as Record<string, unknown>;
        setError((d.error as string) ?? `Controls save failed (${r4.status})`);
        return;
      }

      // 5. PUT compliance-obligations
      const r5 = await fetch(`/api/eai/entries/${entryId}/compliance-obligations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          obligationRows.filter((o) => o.regulationCode && o.parameter)
        )
      });
      if (!r5.ok) {
        const d = await r5.json().catch(() => ({})) as Record<string, unknown>;
        setError((d.error as string) ?? `Compliance obligations save failed (${r5.status})`);
        return;
      }

      // 6. PUT recommended-controls
      const r6 = await fetch(`/api/eai/entries/${entryId}/recommended-controls`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          recControlRows
            .filter((r) => r.description.trim())
            .map((r, i) => ({ ...r, sortOrder: i }))
        )
      });
      if (!r6.ok) {
        const d = await r6.json().catch(() => ({})) as Record<string, unknown>;
        setError((d.error as string) ?? `Recommended controls save failed (${r6.status})`);
        return;
      }

      setIsDirty(false);
      setSuccess("Entry saved successfully.");
    })().finally(() => setIsSaving(false));
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Locked study banner */}
      {!isEditable && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Lock size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <span>
            <strong>Study is locked.</strong> Edits will create a new version and require a change reason.
          </span>
        </div>
      )}

      {/* ── Section 1: Activity ── */}
      <EditorSection title="Activity">
        <Field label="Activity description" required>
          <textarea
            value={activityDescription}
            onChange={(e) => { setActivityDescription(e.target.value); markDirty(); }}
            rows={3}
            placeholder="Describe the activity and associated environmental aspect…"
            className="form-input"
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Occurrence" required>
            <select
              value={occurrence}
              onChange={(e) => { setOccurrence(e.target.value); markDirty(); }}
              className="form-input"
            >
              {OCCURRENCE.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>
          <Field label="Frequency" required>
            <select
              value={frequency}
              onChange={(e) => { setFrequency(e.target.value); markDirty(); }}
              className="form-input"
            >
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
              onChange={(e) => { setTypicalDurationMin(e.target.value); markDirty(); }}
              className="form-input"
            />
          </Field>
        </div>
        <Field label="Sub-location">
          <input
            type="text"
            value={subLocation}
            onChange={(e) => { setSubLocation(e.target.value); markDirty(); }}
            placeholder="e.g., Kiln line 2 stack"
            className="form-input"
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Equipment used (comma-separated)">
            <input
              type="text"
              value={equipmentUsed}
              onChange={(e) => { setEquipmentUsed(e.target.value); markDirty(); }}
              placeholder="Rotary kiln, Bag filter"
              className="form-input"
            />
          </Field>
          <Field label="Materials used (comma-separated)">
            <input
              type="text"
              value={materialsUsed}
              onChange={(e) => { setMaterialsUsed(e.target.value); markDirty(); }}
              placeholder="Coal, Limestone"
              className="form-input"
            />
          </Field>
        </div>
      </EditorSection>

      {/* ── Section 2: Environmental Aspects ── */}
      <EditorSection title="Environmental Aspects" onAdd={addAspect} addLabel="Add aspect">
        {aspectRows.length === 0 ? (
          <EmptyHint msg="Add at least one environmental aspect from the library." />
        ) : (
          <ul className="space-y-3">
            {aspectRows.map((row, i) => (
              <li key={i} className="rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="flex gap-2 items-start">
                  <select
                    value={row.aspectId}
                    onChange={(e) => {
                      setAspectRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, aspectId: e.target.value } : r))
                      );
                      markDirty();
                    }}
                    className="form-input flex-1"
                  >
                    <option value="">Select aspect…</option>
                    {aspectsByCategory.map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.items.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}{a.typicallySignificant ? " ⚠" : ""}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <RemoveBtn
                    onClick={() => {
                      setAspectRows((rows) => rows.filter((_, idx) => idx !== i));
                      markDirty();
                    }}
                    label="Remove aspect"
                  />
                </div>
                <input
                  type="text"
                  value={row.contextualDescription}
                  onChange={(e) => {
                    setAspectRows((rows) =>
                      rows.map((r, idx) =>
                        idx === i ? { ...r, contextualDescription: e.target.value } : r
                      )
                    );
                    markDirty();
                  }}
                  placeholder="Context for this activity (optional)"
                  className="form-input text-sm"
                />
              </li>
            ))}
          </ul>
        )}
      </EditorSection>

      {/* ── Section 3: Environmental Impacts ── */}
      <EditorSection title="Environmental Impacts" onAdd={addImpact} addLabel="Add impact">
        {impactRows.length === 0 ? (
          <EmptyHint msg="Describe the impacts these aspects cause on the environment." />
        ) : (
          <ul className="space-y-3">
            {impactRows.map((row, i) => (
              <li key={i} className="rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="flex gap-2 items-start">
                  <input
                    type="text"
                    value={row.description}
                    onChange={(e) => {
                      setImpactRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, description: e.target.value } : r))
                      );
                      markDirty();
                    }}
                    placeholder="Impact description"
                    className="form-input flex-1"
                  />
                  <RemoveBtn
                    onClick={() => {
                      setImpactRows((rows) => rows.filter((_, idx) => idx !== i));
                      markDirty();
                    }}
                    label="Remove impact"
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <MiniSelect
                    value={row.affectedReceptor}
                    onChange={(v) => {
                      setImpactRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, affectedReceptor: v } : r))
                      );
                      markDirty();
                    }}
                    options={receptorOpts.map((r) => ({ value: r.code, label: r.name }))}
                    label="Receptor"
                  />
                  <MiniSelect
                    value={row.impactType}
                    onChange={(v) => {
                      setImpactRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, impactType: v } : r))
                      );
                      markDirty();
                    }}
                    options={IMPACT_TYPE.map((x) => ({ value: x, label: x }))}
                    label="Type"
                  />
                  <MiniSelect
                    value={row.reversibility}
                    onChange={(v) => {
                      setImpactRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, reversibility: v } : r))
                      );
                      markDirty();
                    }}
                    options={REVERSIBILITY.map((x) => ({ value: x, label: x.replace(/_/g, " ") }))}
                    label="Reversibility"
                  />
                  <MiniSelect
                    value={row.geographicExtent}
                    onChange={(v) => {
                      setImpactRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, geographicExtent: v } : r))
                      );
                      markDirty();
                    }}
                    options={GEOGRAPHIC.map((x) => ({ value: x, label: x }))}
                    label="Geographic"
                  />
                  <MiniSelect
                    value={row.temporalExtent}
                    onChange={(v) => {
                      setImpactRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, temporalExtent: v } : r))
                      );
                      markDirty();
                    }}
                    options={TEMPORAL.map((x) => ({ value: x, label: x.replace(/_/g, " ") }))}
                    label="Temporal"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </EditorSection>

      {/* ── Section 4: Existing Controls ── */}
      <EditorSection title="Existing Controls" onAdd={addControl} addLabel="Add control">
        {controlRows.length === 0 ? (
          <EmptyHint msg="Record controls already in place for this activity." />
        ) : (
          <ul className="space-y-3">
            {controlRows.map((row, i) => (
              <li key={i} className="rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="flex gap-2 items-start">
                  <select
                    value={row.hierarchy}
                    onChange={(e) => {
                      setControlRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, hierarchy: e.target.value } : r))
                      );
                      markDirty();
                    }}
                    className="form-input w-44"
                  >
                    {HIERARCHY.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={row.description}
                    onChange={(e) => {
                      setControlRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, description: e.target.value } : r))
                      );
                      markDirty();
                    }}
                    placeholder="Control description"
                    className="form-input flex-1"
                  />
                  <select
                    value={row.effectiveness}
                    onChange={(e) => {
                      setControlRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, effectiveness: e.target.value } : r))
                      );
                      markDirty();
                    }}
                    className="form-input w-44"
                  >
                    {EFFECTIVENESS.map((x) => (
                      <option key={x} value={x}>{x.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                  <RemoveBtn
                    onClick={() => {
                      setControlRows((rows) => rows.filter((_, idx) => idx !== i));
                      markDirty();
                    }}
                    label="Remove control"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={row.monitoringPoint}
                    onChange={(e) => {
                      setControlRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, monitoringPoint: e.target.value } : r))
                      );
                      markDirty();
                    }}
                    placeholder="Monitoring point"
                    className="form-input text-sm"
                  />
                  <input
                    type="text"
                    value={row.monitoringParameter}
                    onChange={(e) => {
                      setControlRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, monitoringParameter: e.target.value } : r))
                      );
                      markDirty();
                    }}
                    placeholder="Monitoring parameter"
                    className="form-input text-sm"
                  />
                  <input
                    type="text"
                    value={row.monitoringFrequency}
                    onChange={(e) => {
                      setControlRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, monitoringFrequency: e.target.value } : r))
                      );
                      markDirty();
                    }}
                    placeholder="Monitoring frequency"
                    className="form-input text-sm"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </EditorSection>

      {/* ── Section 5: Compliance Obligations ── */}
      <EditorSection title="Compliance Obligations" onAdd={addObligation} addLabel="Add obligation">
        {obligationRows.length === 0 ? (
          <EmptyHint msg="No statutory obligations recorded. Add regulation parameters and limits." />
        ) : (
          <ul className="space-y-3">
            {obligationRows.map((row, i) => (
              <li key={i} className="rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <input
                    type="text"
                    value={row.regulationCode}
                    onChange={(e) => {
                      setObligationRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, regulationCode: e.target.value } : r))
                      );
                      markDirty();
                    }}
                    placeholder="Regulation code *"
                    className="form-input text-sm font-mono"
                  />
                  <input
                    type="text"
                    value={row.parameter}
                    onChange={(e) => {
                      setObligationRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, parameter: e.target.value } : r))
                      );
                      markDirty();
                    }}
                    placeholder="Parameter *"
                    className="form-input text-sm"
                  />
                  <input
                    type="text"
                    value={row.permittedLimit}
                    onChange={(e) => {
                      setObligationRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, permittedLimit: e.target.value } : r))
                      );
                      markDirty();
                    }}
                    placeholder="Permitted limit"
                    className="form-input text-sm"
                  />
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={row.monitoringFrequency}
                      onChange={(e) => {
                        setObligationRows((rows) =>
                          rows.map((r, idx) => (idx === i ? { ...r, monitoringFrequency: e.target.value } : r))
                        );
                        markDirty();
                      }}
                      placeholder="Monitoring freq"
                      className="form-input text-sm flex-1"
                    />
                    <RemoveBtn
                      onClick={() => {
                        setObligationRows((rows) => rows.filter((_, idx) => idx !== i));
                        markDirty();
                      }}
                      label="Remove obligation"
                    />
                  </div>
                </div>
                <div>
                  <input
                    type="date"
                    value={row.nextMonitoringDue}
                    onChange={(e) => {
                      setObligationRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, nextMonitoringDue: e.target.value } : r))
                      );
                      markDirty();
                    }}
                    className="form-input text-sm w-48"
                  />
                  <span className="text-xs text-slate-400 ml-2">Next monitoring due (optional)</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </EditorSection>

      {/* ── Section 6: Recommended Controls ── */}
      <EditorSection title="Recommended Controls" onAdd={addRecControl} addLabel="Add recommendation">
        {recControlRows.length === 0 ? (
          <EmptyHint msg="Add recommended controls for improving environmental performance." />
        ) : (
          <ul className="space-y-3">
            {recControlRows.map((row, i) => (
              <li key={i} className="rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="flex gap-2 items-start">
                  <select
                    value={row.hierarchy}
                    onChange={(e) => {
                      setRecControlRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, hierarchy: e.target.value } : r))
                      );
                      markDirty();
                    }}
                    className="form-input w-44"
                  >
                    {HIERARCHY.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={row.description}
                    onChange={(e) => {
                      setRecControlRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, description: e.target.value } : r))
                      );
                      markDirty();
                    }}
                    placeholder="Recommended control description"
                    className="form-input flex-1"
                  />
                  <select
                    value={row.estimatedCostBand}
                    onChange={(e) => {
                      setRecControlRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, estimatedCostBand: e.target.value } : r))
                      );
                      markDirty();
                    }}
                    className="form-input w-36"
                  >
                    <option value="">Cost band…</option>
                    {COST_BAND.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  <RemoveBtn
                    onClick={() => {
                      setRecControlRows((rows) => rows.filter((_, idx) => idx !== i));
                      markDirty();
                    }}
                    label="Remove recommended control"
                  />
                </div>
                <textarea
                  value={row.rationale}
                  onChange={(e) => {
                    setRecControlRows((rows) =>
                      rows.map((r, idx) => (idx === i ? { ...r, rationale: e.target.value } : r))
                    );
                    markDirty();
                  }}
                  rows={2}
                  placeholder="Rationale for this recommendation (optional)"
                  className="form-input text-sm"
                />
              </li>
            ))}
          </ul>
        )}
      </EditorSection>

      {/* ── Section 7: Residual Assessment ── */}
      <EditorSection title="Residual Assessment">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Residual likelihood">
            <select
              value={residualLikelihoodId}
              onChange={(e) => { setResidualLikelihoodId(e.target.value); markDirty(); }}
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
          <Field label="Residual magnitude">
            <select
              value={residualMagnitudeId}
              onChange={(e) => { setResidualMagnitudeId(e.target.value); markDirty(); }}
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

        {/* Live residual preview */}
        <div className="rounded-lg border bg-slate-50 p-3 flex items-center gap-3 text-sm">
          <span className="text-slate-600">Residual impact:</span>
          {residualPreview ? (
            <>
              <span
                className={`inline-block px-2 py-0.5 text-xs rounded border ${residualPreview.cls}`}
              >
                {residualPreview.level} · {residualPreview.score}
              </span>
              {residualPreview.significant && (
                <span className="text-xs font-medium text-rose-700">Significant aspect</span>
              )}
              <span className="text-xs text-slate-400">
                ({resLikScore} × {resMagScore})
              </span>
            </>
          ) : (
            <span className="text-xs text-slate-400">
              Select likelihood and magnitude to preview residual score.
            </span>
          )}
        </div>

        {/* Also show initial assessment for comparison */}
        <div className="rounded-lg border bg-slate-50 p-3 flex items-center gap-3 text-sm">
          <span className="text-slate-600">Initial impact (read-only):</span>
          <span
            className={`inline-block px-2 py-0.5 text-xs rounded border ${
              band(entry.initialImpactScore).cls
            }`}
          >
            {entry.initialImpactLevel} · {entry.initialImpactScore}
          </span>
          <span className="text-xs text-slate-400">
            ({entry.initialLikelihoodScore} × {entry.initialMagnitudeScore})
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Likelihood rationale">
            <textarea
              value={residualLikelihoodRationale}
              onChange={(e) => { setResidualLikelihoodRationale(e.target.value); markDirty(); }}
              rows={2}
              className="form-input"
              placeholder="Basis for residual likelihood score"
            />
          </Field>
          <Field label="Magnitude rationale">
            <textarea
              value={residualMagnitudeRationale}
              onChange={(e) => { setResidualMagnitudeRationale(e.target.value); markDirty(); }}
              rows={2}
              className="form-input"
              placeholder="Basis for residual magnitude score"
            />
          </Field>
        </div>
        <Field label="Acceptance rationale">
          <textarea
            value={residualAcceptanceRationale}
            onChange={(e) => { setResidualAcceptanceRationale(e.target.value); markDirty(); }}
            rows={2}
            className="form-input"
            placeholder="Why is the residual risk level acceptable?"
          />
        </Field>
      </EditorSection>

      {/* ── Section 8: Legal Compliance ── */}
      <EditorSection title="Legal Compliance">
        <Field label="Overall compliance status">
          <select
            value={legalComplianceStatus}
            onChange={(e) => { setLegalComplianceStatus(e.target.value); markDirty(); }}
            className="form-input max-w-xs"
          >
            <option value="">Not assessed</option>
            {COMPLIANCE_STATUS.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </Field>
      </EditorSection>

      {/* ── Change reason (locked study) ── */}
      {!isEditable && (
        <EditorSection title="Change Reason">
          <p className="text-xs text-slate-500 mb-3">
            Because the study is in a locked state, your changes will create a new version.
            Please provide a reason for this edit.
          </p>
          <Field label="Change reason" required>
            <textarea
              value={changeReason}
              onChange={(e) => { setChangeReason(e.target.value); markDirty(); }}
              rows={2}
              placeholder="e.g., Corrected monitoring frequency after regulatory audit finding"
              className="form-input"
            />
          </Field>
          <Field label="Change trigger">
            <select
              value={changeTrigger}
              onChange={(e) => { setChangeTrigger(e.target.value); markDirty(); }}
              className="form-input max-w-xs"
            >
              <option value="MANUAL_EDIT">Manual edit</option>
              <option value="INCIDENT">Incident</option>
              <option value="AUDIT_FINDING">Audit finding</option>
              <option value="REGULATORY_UPDATE">Regulatory update</option>
              <option value="MANAGEMENT_REVIEW">Management review</option>
              <option value="OPERATIONAL_CHANGE">Operational change</option>
            </select>
          </Field>
        </EditorSection>
      )}

      {/* ── Feedback messages ── */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* ── Footer buttons ── */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
        <Button
          type="button"
          variant="outline"
          onClick={discard}
          disabled={!isDirty || isSaving}
        >
          Discard changes
        </Button>
        <Button
          type="button"
          onClick={save}
          disabled={!isDirty || isSaving || (!isEditable && !changeReason.trim())}
        >
          {isSaving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EditorSection({
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
            <Plus size={14} className="mr-1" /> {addLabel ?? "Add"}
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
  options,
  label
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label?: string;
}) {
  return (
    <div>
      {label && <div className="text-[10px] text-slate-500 mb-0.5">{label}</div>}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="form-input text-xs w-full">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
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

function EmptyHint({ msg }: { msg: string }) {
  return <div className="text-xs text-slate-400 py-1">{msg}</div>;
}
