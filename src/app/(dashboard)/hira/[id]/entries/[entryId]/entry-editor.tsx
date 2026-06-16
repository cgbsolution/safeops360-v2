"use client";

// Full entry editor — covers spec §4.3 sections 1 through 9.
//
// Sections 1–3 (activity, hazards, initial risk) are rendered read-only
// here; they were set at creation and changes go through a major-revision
// review. Sections 4–9 (existing controls, residual risk, recommended
// controls, cross-module links, regulation refs, review metadata) are
// editable inline.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Save } from "lucide-react";
import { RiskMatrixGrid } from "@/components/hira/risk-matrix-grid";

type Likelihood = { id: string; score: number; label: string; description: string };
type Severity = { id: string; score: number; label: string; description: string };
type Cell = {
  likelihoodScore: number;
  severityScore: number;
  riskScore: number;
  riskLevel: string;
  colorHex: string;
  actionRequired: string;
  responseTimeDays: number;
};

type ExistingControl = {
  id: string;
  controlId: string | null;
  hierarchy: string;
  description: string;
  effectiveness: string | null;
  verificationMethod: string | null;
  verificationFreq: string | null;
  responsibleRole: string | null;
  evidenceAttached: boolean;
  documentReference: string | null;
  sortOrder: number;
};

type RecommendedControl = {
  id: string;
  hierarchy: string;
  description: string;
  rationale: string | null;
  estimatedCostBand: string | null;
  proposedImplementationDate: Date | null;
  responsibleId: string | null;
  status: string;
  capaId: string | null;
};

type RegulationRef = {
  id: string;
  regulation: string;
  section: string | null;
  requirementSummary: string | null;
};

type Capa = {
  id: string;
  number: string;
  description: string;
  status: string;
};

type EntryShape = {
  id: string;
  studyId: string;
  sequenceNumber: number;
  groupLabel: string | null;
  activityDescription: string;
  routine: string;
  frequency: string;
  typicalDurationMin: number | null;
  subLocation: string | null;
  area: { id: string; name: string } | null;
  personsEmployees: number;
  personsContractors: number;
  personsVisitors: number;
  personsPublic: number;
  affectedPersonGroups: string | null;
  equipmentUsed: string[];
  materialsUsed: string[];
  energySourcesPresent: string[];
  initialLikelihoodScore: number;
  initialLikelihoodRationale: string | null;
  initialSeverityScore: number;
  initialSeverityRationale: string | null;
  initialRiskScore: number;
  initialRiskLevel: string;
  initialRiskColor: string | null;
  initialLikelihood: Likelihood | null;
  initialSeverity: Severity | null;
  residualLikelihoodId: string | null;
  residualSeverityId: string | null;
  residualLikelihoodScore: number | null;
  residualSeverityScore: number | null;
  residualLikelihoodRationale: string | null;
  residualSeverityRationale: string | null;
  residualRiskScore: number | null;
  residualRiskLevel: string | null;
  residualRiskColor: string | null;
  residualAcceptable: boolean | null;
  residualAcceptanceRationale: string | null;
  status: string;
  versionNumber: number;
  triggersTrainingProgramIds: string[];
  triggersInspectionTypeIds: string[];
  influencesPtwRiskLevel: boolean;
  influencesPtwPermitTypes: string[];
  linkedEmergencyProcIds: string[];
  linkedEnvironmentalAspects: string[];
  lastReviewedAt: Date | null;
  nextReviewDue: Date | null;
  reviewCount: number;
  lastReviewType: string | null;
  hazards: {
    id: string;
    hazardId: string;
    contextualDescription: string | null;
    consequence: string | null;
    hazard: { id: string; code: string; category: string; name: string };
  }[];
  existingControls: ExistingControl[];
  recommendedControls: RecommendedControl[];
  regulationRefs: RegulationRef[];
  capas: Capa[];
  study: { riskMatrixId: string };
};

const INPUT =
  "flex h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600";
const TEXTAREA =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600";

const HIERARCHY = [
  { code: "ELIMINATION", label: "Elimination" },
  { code: "SUBSTITUTION", label: "Substitution" },
  { code: "ENGINEERING", label: "Engineering" },
  { code: "ADMINISTRATIVE", label: "Administrative" },
  { code: "PPE", label: "PPE" }
];
const HIERARCHY_RANK: Record<string, number> = {
  ELIMINATION: 1,
  SUBSTITUTION: 2,
  ENGINEERING: 3,
  ADMINISTRATIVE: 4,
  PPE: 5
};

const EFFECTIVENESS = [
  { code: "EFFECTIVE", label: "Effective", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { code: "PARTIALLY_EFFECTIVE", label: "Partially effective", color: "bg-amber-100 text-amber-800 border-amber-300" },
  { code: "INEFFECTIVE", label: "Ineffective", color: "bg-rose-100 text-rose-800 border-rose-300" },
  { code: "NOT_VERIFIED", label: "Not verified", color: "bg-slate-100 text-slate-800 border-slate-300" }
];

const COST_BANDS = [
  { code: "LOW", label: "Low" },
  { code: "MEDIUM", label: "Medium" },
  { code: "HIGH", label: "High" },
  { code: "VERY_HIGH", label: "Very high" }
];

const PERMIT_TYPES = [
  "HOT_WORK",
  "CONFINED_SPACE",
  "WORK_AT_HEIGHT",
  "EXCAVATION",
  "ELECTRICAL_LOTO",
  "GENERAL_COLD"
];

export function EntryEditor({
  entry,
  matrix,
  controlLibrary,
  requireChangeReason
}: {
  entry: EntryShape;
  matrix: {
    likelihoods: Likelihood[];
    severities: Severity[];
    cells: Cell[];
    acceptableResidual: Record<string, string>;
  };
  controlLibrary: { id: string; code: string; hierarchy: string; description: string }[];
  requireChangeReason: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);

  // Section 4 — existing controls (local working copy)
  const [isDirty, setIsDirty] = useState(false);
  const [existingControls, setExistingControls] = useState<ExistingControl[]>(entry.existingControls);

  // Section 5 — residual risk
  const [residualL, setResidualL] = useState<number | undefined>(
    entry.residualLikelihoodScore ?? undefined
  );
  const [residualS, setResidualS] = useState<number | undefined>(
    entry.residualSeverityScore ?? undefined
  );
  const [residualLRationale, setResidualLRationale] = useState(entry.residualLikelihoodRationale ?? "");
  const [residualSRationale, setResidualSRationale] = useState(entry.residualSeverityRationale ?? "");
  const [acceptanceRationale, setAcceptanceRationale] = useState(entry.residualAcceptanceRationale ?? "");

  // Section 6 — recommended controls
  const [recommendedControls, setRecommendedControls] = useState<RecommendedControl[]>(
    entry.recommendedControls
  );

  // Section 7 — cross-module links
  const [triggersTraining, setTriggersTraining] = useState<string[]>(entry.triggersTrainingProgramIds);
  const [triggersInspection, setTriggersInspection] = useState<string[]>(entry.triggersInspectionTypeIds);
  const [influencesPtw, setInfluencesPtw] = useState<boolean>(entry.influencesPtwRiskLevel);
  const [ptwPermitTypes, setPtwPermitTypes] = useState<string[]>(entry.influencesPtwPermitTypes);

  // Section 8 — regulation refs
  const [regulationRefs, setRegulationRefs] = useState<RegulationRef[]>(entry.regulationRefs);

  // Change reason
  const [changeReason, setChangeReason] = useState("");

  // Computed: residual risk cell
  const residualCell = useMemo(() => {
    if (!residualL || !residualS) return null;
    return matrix.cells.find((c) => c.likelihoodScore === residualL && c.severityScore === residualS) ?? null;
  }, [residualL, residualS, matrix.cells]);

  // Computed: residual acceptable?
  const acceptableThreshold = matrix.acceptableResidual[entry.routine.toLowerCase()] as string | undefined;
  const residualLevel = residualCell?.riskLevel;
  const order = ["LOW", "MODERATE", "HIGH", "CRITICAL"];
  const residualAcceptable =
    residualLevel && acceptableThreshold
      ? order.indexOf(residualLevel) <= order.indexOf(acceptableThreshold)
      : null;

  function save() {
    setError(null);
    setSuccess(false);
    if (requireChangeReason && !changeReason.trim()) {
      setError("This study is approved/active. A change reason is required.");
      return;
    }

    startTransition(async () => {
      // 1. PATCH the entry main row
      const entryPatch: any = {
        residualLikelihoodId:
          residualL && residualS
            ? matrix.likelihoods.find((l) => l.score === residualL)?.id
            : null,
        residualSeverityId:
          residualL && residualS ? matrix.severities.find((s) => s.score === residualS)?.id : null,
        residualLikelihoodRationale: residualLRationale || null,
        residualSeverityRationale: residualSRationale || null,
        residualAcceptanceRationale: acceptanceRationale || null,
        triggersTrainingProgramIds: triggersTraining,
        triggersInspectionTypeIds: triggersInspection,
        influencesPtwRiskLevel: influencesPtw,
        influencesPtwPermitTypes: ptwPermitTypes,
        affectedPersonGroups: entry.affectedPersonGroups,
        changeReason: requireChangeReason ? changeReason : undefined,
        changeTrigger: requireChangeReason ? "CORRECTION" : undefined
      };

      const res = await fetch(`/api/hira/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entryPatch)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      const patchData = await res.json().catch(() => ({} as any));

      // 2. Sync existing controls (separate endpoint — implemented next)
      // For now we POST the whole array as a replace; granular CRUD comes next.
      const ecRes = await fetch(`/api/hira/entries/${entry.id}/existing-controls`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controls: existingControls })
      });
      if (!ecRes.ok) {
        const data = await ecRes.json().catch(() => ({}));
        setError(`Existing controls save failed: ${data.error ?? ecRes.status}`);
        return;
      }

      // 3. Sync recommended controls
      const rcRes = await fetch(`/api/hira/entries/${entry.id}/recommended-controls`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controls: recommendedControls })
      });
      if (!rcRes.ok) {
        const data = await rcRes.json().catch(() => ({}));
        setError(`Recommended controls save failed: ${data.error ?? rcRes.status}`);
        return;
      }

      // 4. Sync regulation refs
      const rrRes = await fetch(`/api/hira/entries/${entry.id}/regulation-refs`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refs: regulationRefs })
      });
      if (!rrRes.ok) {
        const data = await rrRes.json().catch(() => ({}));
        setError(`Regulation refs save failed: ${data.error ?? rrRes.status}`);
        return;
      }

      setSavedVersion(patchData?.versionNumber ?? null);
      setSuccess(true);
      setIsDirty(false);
      setChangeReason("");
      router.refresh();
    });
  }

  // Helper handlers for existing controls
  function addExistingControl() {
    setExistingControls((arr) => [
      ...arr,
      {
        id: `new-${Date.now()}-${arr.length}`,
        controlId: null,
        hierarchy: "ENGINEERING",
        description: "",
        effectiveness: null,
        verificationMethod: null,
        verificationFreq: null,
        responsibleRole: null,
        evidenceAttached: false,
        documentReference: null,
        sortOrder: arr.length
      }
    ]);
    setIsDirty(true);
  }
  function updateExistingControl(id: string, patch: Partial<ExistingControl>) {
    setExistingControls((arr) => arr.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setIsDirty(true);
  }
  function removeExistingControl(id: string) {
    setExistingControls((arr) => arr.filter((c) => c.id !== id));
    setIsDirty(true);
  }

  function addRecommendedControl() {
    setRecommendedControls((arr) => [
      ...arr,
      {
        id: `new-${Date.now()}-${arr.length}`,
        hierarchy: "ENGINEERING",
        description: "",
        rationale: null,
        estimatedCostBand: null,
        proposedImplementationDate: null,
        responsibleId: null,
        status: "PROPOSED",
        capaId: null
      }
    ]);
    setIsDirty(true);
  }
  function updateRecommendedControl(id: string, patch: Partial<RecommendedControl>) {
    setRecommendedControls((arr) => arr.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setIsDirty(true);
  }
  function removeRecommendedControl(id: string) {
    setRecommendedControls((arr) => arr.filter((c) => c.id !== id));
    setIsDirty(true);
  }

  function addRegRef() {
    setRegulationRefs((arr) => [...arr, { id: `new-${Date.now()}-${arr.length}`, regulation: "", section: null, requirementSummary: null }]);
    setIsDirty(true);
  }
  function updateRegRef(id: string, patch: Partial<RegulationRef>) {
    setRegulationRefs((arr) => arr.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setIsDirty(true);
  }
  function removeRegRef(id: string) {
    setRegulationRefs((arr) => arr.filter((r) => r.id !== id));
    setIsDirty(true);
  }

  // Sort existing controls by hierarchy rank for display
  const sortedExisting = [...existingControls].sort(
    (a, b) => (HIERARCHY_RANK[a.hierarchy] ?? 99) - (HIERARCHY_RANK[b.hierarchy] ?? 99) || a.sortOrder - b.sortOrder
  );

  // Recommended visible only if there are some OR residual is unacceptable
  const showRecommended = recommendedControls.length > 0 || residualAcceptable === false;

  return (
    <div className="space-y-6">
      {/* Section 1 — Activity (read-only) */}
      <Section title="1 — Activity (read-only)">
        <div className="text-sm text-slate-800 whitespace-pre-wrap">{entry.activityDescription}</div>
        <Grid>
          <ReadField label="Routine">{entry.routine}</ReadField>
          <ReadField label="Frequency">{entry.frequency}</ReadField>
          <ReadField label="Area">{entry.area?.name ?? "—"}</ReadField>
          <ReadField label="Sub-location">{entry.subLocation ?? "—"}</ReadField>
          <ReadField label="Duration (min)">{entry.typicalDurationMin ?? "—"}</ReadField>
          <ReadField label="Persons exposed">
            E:{entry.personsEmployees} · C:{entry.personsContractors} · V:{entry.personsVisitors} · P:{entry.personsPublic}
          </ReadField>
        </Grid>
        {entry.affectedPersonGroups && (
          <ReadField label="Affected person groups">{entry.affectedPersonGroups}</ReadField>
        )}
      </Section>

      {/* Section 2 — Hazards (read-only) */}
      <Section title={`2 — Hazards (${entry.hazards.length})`}>
        {entry.hazards.length === 0 ? (
          <div className="text-sm text-slate-500">No hazards identified.</div>
        ) : (
          <ul className="space-y-2">
            {entry.hazards.map((h) => (
              <li key={h.id} className="rounded border bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm">{h.hazard.name}</div>
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                    {h.hazard.category.replace(/_/g, " ")}
                  </span>
                </div>
                {h.contextualDescription && (
                  <div className="text-xs text-slate-600 mt-1">{h.contextualDescription}</div>
                )}
                {h.consequence && (
                  <div className="text-xs text-slate-500 mt-1">
                    <span className="font-medium text-slate-600">Consequence:</span> {h.consequence}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Section 3 — Initial risk (read-only) */}
      <Section title="3 — Initial Risk (read-only)">
        <div className="flex items-center gap-4">
          <RiskChip level={entry.initialRiskLevel} score={entry.initialRiskScore} large />
          <div className="text-sm text-slate-700">
            <div>
              <span className="text-slate-500">Likelihood:</span> {entry.initialLikelihood?.label} (
              {entry.initialLikelihoodScore})
            </div>
            <div>
              <span className="text-slate-500">Severity:</span> {entry.initialSeverity?.label} (
              {entry.initialSeverityScore})
            </div>
          </div>
        </div>
        {(entry.initialLikelihoodRationale || entry.initialSeverityRationale) && (
          <Grid>
            <ReadField label="Likelihood rationale">{entry.initialLikelihoodRationale ?? "—"}</ReadField>
            <ReadField label="Severity rationale">{entry.initialSeverityRationale ?? "—"}</ReadField>
          </Grid>
        )}
      </Section>

      {/* Section 4 — Existing controls */}
      <Section
        title={`4 — Existing Controls (${existingControls.length})`}
        cta={
          <button
            type="button"
            onClick={addExistingControl}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-slate-300 hover:border-primary-500 hover:text-primary-700"
          >
            <Plus size={12} /> Add control
          </button>
        }
      >
        {sortedExisting.length === 0 ? (
          <div className="rounded border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
            No controls recorded. Document what's in place today.
          </div>
        ) : (
          <div className="space-y-2">
            {sortedExisting.map((c) => (
              <div key={c.id} className="rounded border bg-white p-3">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-3">
                    <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Hierarchy</label>
                    <select
                      className={INPUT}
                      value={c.hierarchy}
                      onChange={(e) => updateExistingControl(c.id, { hierarchy: e.target.value, controlId: null })}
                    >
                      {HIERARCHY.map((h) => (
                        <option key={h.code} value={h.code}>
                          {h.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] uppercase text-slate-500 mb-0.5">From library</label>
                    <select
                      className={INPUT}
                      value={c.controlId ?? ""}
                      onChange={(e) => {
                        const lib = controlLibrary.find((x) => x.id === e.target.value);
                        updateExistingControl(c.id, {
                          controlId: e.target.value || null,
                          ...(lib
                            ? { hierarchy: lib.hierarchy, description: lib.description }
                            : {})
                        });
                      }}
                    >
                      <option value="">— Custom —</option>
                      {controlLibrary
                        .filter((l) => l.hierarchy === c.hierarchy)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.description.slice(0, 60)}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Effectiveness</label>
                    <select
                      className={INPUT}
                      value={c.effectiveness ?? ""}
                      onChange={(e) =>
                        updateExistingControl(c.id, { effectiveness: e.target.value || null })
                      }
                    >
                      <option value="">— Select —</option>
                      {EFFECTIVENESS.map((e) => (
                        <option key={e.code} value={e.code}>
                          {e.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Responsible role</label>
                    <input
                      className={INPUT}
                      value={c.responsibleRole ?? ""}
                      placeholder="e.g. Supervisor"
                      onChange={(e) =>
                        updateExistingControl(c.id, { responsibleRole: e.target.value || null })
                      }
                    />
                  </div>
                  <div className="col-span-1 flex items-end justify-end">
                    <button
                      type="button"
                      onClick={() => removeExistingControl(c.id)}
                      className="text-rose-600 hover:bg-rose-50 rounded p-1.5 mb-0.5"
                      aria-label="Remove control"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <textarea
                  className={`${TEXTAREA} mt-2`}
                  rows={2}
                  placeholder="Control description"
                  value={c.description}
                  onChange={(e) => updateExistingControl(c.id, { description: e.target.value })}
                />
                <div className="grid grid-cols-12 gap-2 mt-2 items-end">
                  <div className="col-span-5">
                    <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Verification method</label>
                    <input
                      className={INPUT}
                      value={c.verificationMethod ?? ""}
                      onChange={(e) =>
                        updateExistingControl(c.id, { verificationMethod: e.target.value || null })
                      }
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Frequency</label>
                    <input
                      className={INPUT}
                      value={c.verificationFreq ?? ""}
                      placeholder="e.g. Quarterly"
                      onChange={(e) =>
                        updateExistingControl(c.id, { verificationFreq: e.target.value || null })
                      }
                    />
                  </div>
                  <div className="col-span-4 flex flex-col gap-1">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={c.evidenceAttached}
                        onChange={(e) =>
                          updateExistingControl(c.id, {
                            evidenceAttached: e.target.checked,
                            documentReference: e.target.checked ? c.documentReference : null
                          })
                        }
                      />
                      Evidence on file
                    </label>
                    {c.evidenceAttached && (
                      <input
                        className={INPUT}
                        placeholder="Document / record reference"
                        value={c.documentReference ?? ""}
                        onChange={(e) =>
                          updateExistingControl(c.id, { documentReference: e.target.value || null })
                        }
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Section 5 — Residual risk */}
      <Section title="5 — Residual Risk (after controls)">
        <p className="text-sm text-slate-600 mb-3">
          With the controls above in place, click the matrix cell that reflects how the activity actually plays out
          today. Be honest about control effectiveness.
        </p>
        <RiskMatrixGrid
          likelihoods={matrix.likelihoods}
          severities={matrix.severities}
          cells={matrix.cells}
          mode="selection"
          selectedLikelihood={residualL}
          selectedSeverity={residualS}
          onSelect={(l, s) => {
            setResidualL(l);
            setResidualS(s);
            setIsDirty(true);
          }}
          caption="Residual Risk — after stated controls"
        />

        {residualCell && (
          <div
            className="mt-3 rounded-md border p-3"
            style={{ backgroundColor: residualCell.colorHex + "22" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium" style={{ color: residualCell.colorHex }}>
                  {residualCell.riskLevel} residual risk — score {residualCell.riskScore}
                </div>
                <div className="text-xs text-slate-700 mt-1">{residualCell.actionRequired}</div>
              </div>
              {residualAcceptable !== null && (
                <span
                  className={`text-xs px-2 py-0.5 rounded border ${
                    residualAcceptable
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : "bg-rose-100 text-rose-800 border-rose-300"
                  }`}
                >
                  {residualAcceptable
                    ? "✓ Acceptable"
                    : `✗ Exceeds threshold (${acceptableThreshold ?? "—"})`}
                </span>
              )}
            </div>
          </div>
        )}

        <Grid>
          <Field label="Likelihood rationale">
            <textarea
              className={TEXTAREA}
              rows={2}
              value={residualLRationale}
              onChange={(e) => { setResidualLRationale(e.target.value); setIsDirty(true); }}
            />
          </Field>
          <Field label="Severity rationale">
            <textarea
              className={TEXTAREA}
              rows={2}
              value={residualSRationale}
              onChange={(e) => { setResidualSRationale(e.target.value); setIsDirty(true); }}
            />
          </Field>
        </Grid>

        {residualAcceptable === false && (
          <div className="mt-3">
            <Field label="Acceptance rationale (required if proceeding without additional controls)">
              <textarea
                className={TEXTAREA}
                rows={2}
                value={acceptanceRationale}
                onChange={(e) => { setAcceptanceRationale(e.target.value); setIsDirty(true); }}
                placeholder="Why is this residual being accepted despite exceeding the threshold? (e.g. compensating controls outside this entry, time-bounded acceptance, ALARP documented elsewhere)"
              />
            </Field>
          </div>
        )}
      </Section>

      {/* Section 6 — Recommended controls */}
      {showRecommended && (
        <Section
          title={`6 — Recommended Additional Controls (${recommendedControls.length})`}
          cta={
            <button
              type="button"
              onClick={addRecommendedControl}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-slate-300 hover:border-primary-500 hover:text-primary-700"
            >
              <Plus size={12} /> Add proposal
            </button>
          }
        >
          {recommendedControls.length === 0 ? (
            <div className="rounded border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
              Residual risk exceeds the acceptability threshold. Propose additional controls.
            </div>
          ) : (
            <div className="space-y-2">
              {recommendedControls.map((rc) => (
                <div key={rc.id} className="rounded border bg-white p-3">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-3">
                      <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Hierarchy</label>
                      <select
                        className={INPUT}
                        value={rc.hierarchy}
                        onChange={(e) => updateRecommendedControl(rc.id, { hierarchy: e.target.value })}
                      >
                        {HIERARCHY.map((h) => (
                          <option key={h.code} value={h.code}>
                            {h.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Cost band</label>
                      <select
                        className={INPUT}
                        value={rc.estimatedCostBand ?? ""}
                        onChange={(e) =>
                          updateRecommendedControl(rc.id, { estimatedCostBand: e.target.value || null })
                        }
                      >
                        <option value="">— —</option>
                        {COST_BANDS.map((cb) => (
                          <option key={cb.code} value={cb.code}>
                            {cb.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Proposed date</label>
                      <input
                        type="date"
                        className={INPUT}
                        value={rc.proposedImplementationDate ? new Date(rc.proposedImplementationDate).toISOString().slice(0, 10) : ""}
                        onChange={(e) =>
                          updateRecommendedControl(rc.id, {
                            proposedImplementationDate: e.target.value ? new Date(e.target.value) : null
                          })
                        }
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Status</label>
                      <select
                        className={INPUT}
                        value={rc.status}
                        onChange={(e) => updateRecommendedControl(rc.id, { status: e.target.value })}
                      >
                        {["PROPOSED", "APPROVED", "IN_PROGRESS", "IMPLEMENTED", "DEFERRED", "REJECTED"].map((s) => (
                          <option key={s} value={s}>
                            {s.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1 flex items-end justify-end">
                      <button
                        type="button"
                        onClick={() => removeRecommendedControl(rc.id)}
                        className="text-rose-600 hover:bg-rose-50 rounded p-1.5 mb-0.5"
                        aria-label="Remove proposal"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <textarea
                    className={`${TEXTAREA} mt-2`}
                    rows={2}
                    placeholder="Proposed control"
                    value={rc.description}
                    onChange={(e) => updateRecommendedControl(rc.id, { description: e.target.value })}
                  />
                  <textarea
                    className={`${TEXTAREA} mt-2`}
                    rows={2}
                    placeholder="Rationale — why this would close the gap"
                    value={rc.rationale ?? ""}
                    onChange={(e) => updateRecommendedControl(rc.id, { rationale: e.target.value || null })}
                  />
                  <div className="mt-2">
                    <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Responsible person (user ID)</label>
                    <input
                      className={INPUT}
                      placeholder="Paste user ID"
                      value={rc.responsibleId ?? ""}
                      onChange={(e) => updateRecommendedControl(rc.id, { responsibleId: e.target.value || null })}
                    />
                  </div>
                  {rc.capaId && (
                    <div className="mt-2 text-xs text-slate-500">
                      Linked CAPA: <code className="px-1 rounded bg-slate-100">{rc.capaId.slice(0, 8)}…</code>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Section 7 — Cross-module links */}
      <Section title="7 — Cross-Module Linkages">
        <ChipList
          label="Triggers training (program IDs)"
          values={triggersTraining}
          onChange={(v) => { setTriggersTraining(v); setIsDirty(true); }}
          placeholder="Paste training program ID and press Enter"
        />
        <ChipList
          label="Triggers inspection (template IDs)"
          values={triggersInspection}
          onChange={(v) => { setTriggersInspection(v); setIsDirty(true); }}
          placeholder="Paste inspection template ID and press Enter"
        />
        <div className="mt-3 flex flex-col gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={influencesPtw}
              onChange={(e) => { setInfluencesPtw(e.target.checked); setIsDirty(true); }}
            />
            This entry influences PTW risk level for permits in this area
          </label>
          {influencesPtw && (
            <div className="ml-6 flex flex-wrap gap-2">
              {PERMIT_TYPES.map((p) => (
                <label
                  key={p}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border cursor-pointer ${
                    ptwPermitTypes.includes(p)
                      ? "bg-primary-100 text-primary-800 border-primary-300"
                      : "bg-white text-slate-700 border-slate-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={ptwPermitTypes.includes(p)}
                    onChange={(e) => {
                      setPtwPermitTypes((arr) =>
                        e.target.checked ? [...arr, p] : arr.filter((x) => x !== p)
                      );
                      setIsDirty(true);
                    }}
                  />
                  {p.replace(/_/g, " ")}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3 text-xs text-slate-500">
          EAI environmental aspect cross-reference: <em>module not yet shipped</em>.
        </div>
      </Section>

      {/* Section 8 — Regulatory references */}
      <Section
        title={`8 — Regulatory References (${regulationRefs.length})`}
        cta={
          <button
            type="button"
            onClick={addRegRef}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-slate-300 hover:border-primary-500 hover:text-primary-700"
          >
            <Plus size={12} /> Add reference
          </button>
        }
      >
        {regulationRefs.length === 0 ? (
          <div className="text-sm text-slate-500">No regulatory references attached.</div>
        ) : (
          <div className="space-y-2">
            {regulationRefs.map((r) => (
              <div key={r.id} className="rounded border bg-white p-3 grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Regulation</label>
                  <input
                    className={INPUT}
                    value={r.regulation}
                    onChange={(e) => updateRegRef(r.id, { regulation: e.target.value })}
                    placeholder="e.g. Factories Act 1948"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Section</label>
                  <input
                    className={INPUT}
                    value={r.section ?? ""}
                    onChange={(e) => updateRegRef(r.id, { section: e.target.value || null })}
                    placeholder="e.g. §41B"
                  />
                </div>
                <div className="col-span-4">
                  <label className="block text-[10px] uppercase text-slate-500 mb-0.5">Requirement summary</label>
                  <input
                    className={INPUT}
                    value={r.requirementSummary ?? ""}
                    onChange={(e) => updateRegRef(r.id, { requirementSummary: e.target.value || null })}
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeRegRef(r.id)}
                    className="text-rose-600 hover:bg-rose-50 rounded p-1.5"
                    aria-label="Remove reference"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Section 9 — Review metadata (read-only) */}
      <Section title="9 — Review Metadata">
        <Grid>
          <ReadField label="Last reviewed">
            {entry.lastReviewedAt ? new Date(entry.lastReviewedAt).toLocaleDateString() : "Not yet reviewed"}
          </ReadField>
          <ReadField label="Next review due">
            {entry.nextReviewDue ? new Date(entry.nextReviewDue).toLocaleDateString() : "—"}
          </ReadField>
          <ReadField label="Review count">{entry.reviewCount}</ReadField>
          <ReadField label="Last review type">{entry.lastReviewType ?? "—"}</ReadField>
        </Grid>
        {entry.capas.length > 0 && (
          <div className="mt-3">
            <div className="text-xs font-medium text-slate-600 mb-1">Linked CAPAs</div>
            <ul className="text-sm space-y-1">
              {entry.capas.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1">
                  <span className="font-mono text-xs">{c.number}</span>
                  <span className="text-xs">{c.description.slice(0, 80)}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200">{c.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-white border-t border-slate-200">
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-2 rounded border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm text-rose-900"
          >
            {error}
          </div>
        )}
        {success && (
          <div
            role="status"
            aria-live="polite"
            className="mb-2 rounded border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-900"
          >
            Saved. {savedVersion ? `Version ${savedVersion} created.` : ""}
          </div>
        )}
        {requireChangeReason && (
          <div className="mb-2">
            <input
              className={INPUT}
              placeholder="Change reason (required — captured on the new version)"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
            />
          </div>
        )}
        <div className="flex gap-2 items-center">
          <Button onClick={save} disabled={pending || !isDirty}>
            <Save size={14} className="mr-1" /> {pending ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setExistingControls(entry.existingControls.map(c => ({...c})));
              setRecommendedControls(entry.recommendedControls.map(c => ({...c})));
              setRegulationRefs(entry.regulationRefs.map(r => ({...r})));
              setResidualL(entry.residualLikelihoodScore ?? undefined);
              setResidualS(entry.residualSeverityScore ?? undefined);
              setResidualLRationale(entry.residualLikelihoodRationale ?? "");
              setResidualSRationale(entry.residualSeverityRationale ?? "");
              setAcceptanceRationale(entry.residualAcceptanceRationale ?? "");
              setTriggersTraining(entry.triggersTrainingProgramIds);
              setTriggersInspection(entry.triggersInspectionTypeIds);
              setInfluencesPtw(entry.influencesPtwRiskLevel);
              setPtwPermitTypes(entry.influencesPtwPermitTypes);
              setChangeReason("");
              setIsDirty(false);
              router.refresh();
            }}
            disabled={pending}
          >
            Discard changes
          </Button>
          <div className="ml-auto text-xs text-slate-500">
            Version {entry.versionNumber} · status {entry.status}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  cta,
  children
}: {
  title: string;
  cta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600">{title}</h2>
        {cta}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ReadField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm text-slate-800 mt-0.5">{children}</div>
    </div>
  );
}

function RiskChip({ level, score, large }: { level: string; score: number; large?: boolean }) {
  const colors: Record<string, string> = {
    LOW: "bg-emerald-100 text-emerald-800 border-emerald-300",
    MODERATE: "bg-amber-100 text-amber-800 border-amber-300",
    HIGH: "bg-orange-100 text-orange-900 border-orange-300",
    CRITICAL: "bg-rose-200 text-rose-900 border-rose-400 font-semibold"
  };
  return (
    <span
      className={`inline-block ${
        large ? "px-3 py-1 text-base" : "px-2 py-0.5 text-xs"
      } rounded border ${colors[level] ?? "bg-slate-100 text-slate-800 border-slate-200"}`}
    >
      {level} · {score}
    </span>
  );
}

function ChipList({
  label,
  values,
  onChange,
  placeholder
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-700 border"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-slate-400 hover:text-rose-600"
              aria-label="Remove"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        className={INPUT}
        value={input}
        placeholder={placeholder}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && input.trim()) {
            e.preventDefault();
            if (!values.includes(input.trim())) onChange([...values, input.trim()]);
            setInput("");
          }
        }}
      />
    </div>
  );
}
