"use client";

// Entry creation form — sections 1 through 3 of the spec §4.3 editor.
//   1. Activity description + location + routine + frequency + persons exposed
//   2. Hazard identification (picker against library)
//   3. Initial risk assessment (visual matrix)
//
// Sections 4–9 (existing controls, residual risk, recommended controls,
// cross-module links, regulatory refs) are added to this form / the
// detail edit view in Phase 3 follow-on.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Search } from "lucide-react";
import { RiskMatrixGrid } from "@/components/hira/risk-matrix-grid";

type Likelihood = { id: string; score: number; label: string; description: string; frequencyGuidance?: string | null };
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

type Hazard = {
  id: string;
  code: string;
  category: string;
  subcategory: string | null;
  name: string;
  description: string;
  typicalHarmPotential: string[];
  typicalAffectedPersons: string[];
  energyForm: string | null;
};

type EntryHazardInput = {
  hazardId: string;
  contextualDescription: string;
  consequence: string;
};

const INPUT_CLASS =
  "flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600";
const TEXTAREA_CLASS =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600";

const ROUTINE = [
  { code: "ROUTINE", label: "Routine" },
  { code: "NON_ROUTINE", label: "Non-routine" },
  { code: "EMERGENCY", label: "Emergency" }
];

const FREQUENCY = [
  { code: "CONTINUOUS", label: "Continuous" },
  { code: "DAILY", label: "Daily" },
  { code: "WEEKLY", label: "Weekly" },
  { code: "MONTHLY", label: "Monthly" },
  { code: "OCCASIONAL", label: "Occasional" },
  { code: "RARE", label: "Rare" }
];

export function EntryCreateForm({
  studyId,
  areas,
  matrix,
  hazards
}: {
  studyId: string;
  areas: { id: string; name: string }[];
  matrix: { likelihoods: Likelihood[]; severities: Severity[]; cells: Cell[] };
  hazards: Hazard[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Section 1
  const [activityDescription, setActivityDescription] = useState("");
  const [areaId, setAreaId] = useState("");
  const [subLocation, setSubLocation] = useState("");
  const [routine, setRoutine] = useState("ROUTINE");
  const [frequency, setFrequency] = useState("DAILY");
  const [typicalDurationMin, setTypicalDurationMin] = useState<number | "">("");
  const [personsEmployees, setPersonsEmployees] = useState<number>(0);
  const [personsContractors, setPersonsContractors] = useState<number>(0);
  const [personsVisitors, setPersonsVisitors] = useState<number>(0);
  const [personsPublic, setPersonsPublic] = useState<number>(0);
  const [affectedPersonGroups, setAffectedPersonGroups] = useState("");

  // Section 2 — hazard picker
  const [hazardSearch, setHazardSearch] = useState("");
  const [hazardCategory, setHazardCategory] = useState("");
  const [pickedHazards, setPickedHazards] = useState<EntryHazardInput[]>([]);

  // Section 3 — initial risk
  const [selectedLikelihood, setSelectedLikelihood] = useState<number | undefined>();
  const [selectedSeverity, setSelectedSeverity] = useState<number | undefined>();
  const [likelihoodRationale, setLikelihoodRationale] = useState("");
  const [severityRationale, setSeverityRationale] = useState("");

  const selectedCell = useMemo(
    () =>
      selectedLikelihood && selectedSeverity
        ? matrix.cells.find(
            (c) => c.likelihoodScore === selectedLikelihood && c.severityScore === selectedSeverity
          )
        : undefined,
    [selectedLikelihood, selectedSeverity, matrix.cells]
  );

  const hazardCategories = Array.from(new Set(hazards.map((h) => h.category))).sort();
  const filteredHazards = hazards.filter((h) => {
    if (hazardCategory && h.category !== hazardCategory) return false;
    if (hazardSearch) {
      const q = hazardSearch.toLowerCase();
      return (
        h.name.toLowerCase().includes(q) ||
        h.description.toLowerCase().includes(q) ||
        h.code.toLowerCase().includes(q)
      );
    }
    return true;
  });

  function addHazard(h: Hazard) {
    if (pickedHazards.some((p) => p.hazardId === h.id)) return;
    setPickedHazards((arr) => [...arr, { hazardId: h.id, contextualDescription: "", consequence: "" }]);
  }

  function removeHazard(hazardId: string) {
    setPickedHazards((arr) => arr.filter((p) => p.hazardId !== hazardId));
  }

  function updateContext(hazardId: string, value: string) {
    setPickedHazards((arr) =>
      arr.map((p) => (p.hazardId === hazardId ? { ...p, contextualDescription: value } : p))
    );
  }

  function updateConsequence(hazardId: string, value: string) {
    setPickedHazards((arr) =>
      arr.map((p) => (p.hazardId === hazardId ? { ...p, consequence: value } : p))
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!activityDescription.trim()) return setError("Activity description is required");
    if (pickedHazards.length === 0) return setError("Pick at least one hazard");
    if (!selectedLikelihood || !selectedSeverity) return setError("Assess the initial risk by clicking a matrix cell");
    const totalPersons = (personsEmployees || 0) + (personsContractors || 0) + (personsVisitors || 0) + (personsPublic || 0);
    if (totalPersons === 0) {
      setError("At least one person group count must be greater than zero");
      return;
    }

    const likelihoodObj = matrix.likelihoods.find((l) => l.score === selectedLikelihood)!;
    const severityObj = matrix.severities.find((s) => s.score === selectedSeverity)!;

    startTransition(async () => {
      const res = await fetch(`/api/hira/studies/${studyId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityDescription: activityDescription.trim(),
          areaId: areaId || undefined,
          subLocation: subLocation || undefined,
          routine,
          frequency,
          typicalDurationMin: typicalDurationMin || undefined,
          personsEmployees,
          personsContractors,
          personsVisitors,
          personsPublic,
          affectedPersonGroups: affectedPersonGroups || undefined,
          initialLikelihoodId: likelihoodObj.id,
          initialSeverityId: severityObj.id,
          initialLikelihoodRationale: likelihoodRationale || undefined,
          initialSeverityRationale: severityRationale || undefined,
          hazards: pickedHazards.map((p) => ({
            hazardId: p.hazardId,
            contextualDescription: p.contextualDescription || undefined,
            consequence: p.consequence || undefined
          }))
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Create failed (${res.status})`);
        return;
      }
      router.push(`/hira/${studyId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm text-rose-900">{error}</div>
      )}

      {/* Section 1 */}
      <Section title="1 — Activity">
        <Field label="Activity description" required>
          <textarea
            className={TEXTAREA_CLASS}
            rows={3}
            value={activityDescription}
            onChange={(e) => setActivityDescription(e.target.value)}
            placeholder="e.g. Loading cement bags onto trailer using forklift"
          />
        </Field>
        <Grid>
          <Field label="Area">
            <select className={INPUT_CLASS} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">— Select —</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sub-location / specifics">
            <input className={INPUT_CLASS} value={subLocation} onChange={(e) => setSubLocation(e.target.value)} />
          </Field>
          <Field label="Routine type" required>
            <select className={INPUT_CLASS} value={routine} onChange={(e) => setRoutine(e.target.value)}>
              {ROUTINE.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Frequency" required>
            <select className={INPUT_CLASS} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              {FREQUENCY.map((f) => (
                <option key={f.code} value={f.code}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Typical duration (min)">
            <input
              type="number"
              min={1}
              className={INPUT_CLASS}
              value={typicalDurationMin}
              onChange={(e) =>
                setTypicalDurationMin(e.target.value === "" ? "" : parseInt(e.target.value, 10))
              }
            />
          </Field>
        </Grid>
        <div className="mt-3">
          <div className="text-xs font-medium text-slate-600 mb-1">Persons exposed during the activity</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <NumberInput label="Employees" value={personsEmployees} onChange={setPersonsEmployees} />
            <NumberInput label="Contractors" value={personsContractors} onChange={setPersonsContractors} />
            <NumberInput label="Visitors" value={personsVisitors} onChange={setPersonsVisitors} />
            <NumberInput label="Public" value={personsPublic} onChange={setPersonsPublic} />
          </div>
        </div>
        <Field label="Affected person groups (optional)">
          <textarea
            className={TEXTAREA_CLASS}
            rows={2}
            value={affectedPersonGroups}
            onChange={(e) => setAffectedPersonGroups(e.target.value)}
            placeholder="e.g. Maintenance crew, nearby operators, visitors in aisle 3"
          />
        </Field>
      </Section>

      {/* Section 2 — hazard picker */}
      <Section title={`2 — Hazards (${pickedHazards.length})`}>
        {pickedHazards.length > 0 ? (
          <div className="space-y-2 mb-3">
            {pickedHazards.map((p) => {
              const h = hazards.find((x) => x.id === p.hazardId);
              if (!h) return null;
              return (
                <div key={p.hazardId} className="rounded-md border bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm">{h.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {h.category.replace(/_/g, " ")} · {h.code}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeHazard(p.hazardId)}
                      className="text-rose-600 hover:bg-rose-50 rounded p-1"
                      aria-label="Remove hazard"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <textarea
                    className={`${TEXTAREA_CLASS} mt-2`}
                    rows={2}
                    placeholder="How this hazard manifests in THIS activity (optional)"
                    value={p.contextualDescription}
                    onChange={(e) => updateContext(p.hazardId, e.target.value)}
                  />
                  <textarea
                    className={`${TEXTAREA_CLASS} mt-1`}
                    rows={2}
                    placeholder="Consequence if hazard is realised — worst credible outcome (optional)"
                    value={p.consequence}
                    onChange={(e) => updateConsequence(p.hazardId, e.target.value)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 mb-3">
            No hazards picked yet. Search the library below.
          </div>
        )}

        <div className="border rounded-md bg-white">
          <div className="p-2 border-b flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 text-slate-400" size={16} />
              <input
                className={`${INPUT_CLASS} pl-8`}
                placeholder="Search hazards by name, description, or code"
                value={hazardSearch}
                onChange={(e) => setHazardSearch(e.target.value)}
              />
            </div>
            <select
              className={`${INPUT_CLASS} w-48`}
              value={hazardCategory}
              onChange={(e) => setHazardCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {hazardCategories.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y">
            {filteredHazards.slice(0, 60).map((h) => {
              const already = pickedHazards.some((p) => p.hazardId === h.id);
              return (
                <button
                  key={h.id}
                  type="button"
                  disabled={already}
                  onClick={() => addHazard(h)}
                  className={`w-full text-left px-3 py-2 hover:bg-slate-50 ${
                    already ? "opacity-40 cursor-not-allowed" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm">{h.name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {h.category.replace(/_/g, " ")}
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5 line-clamp-1">{h.description}</div>
                </button>
              );
            })}
            {filteredHazards.length === 0 && (
              <div className="px-3 py-6 text-sm text-slate-500 text-center">No hazards match the filter.</div>
            )}
          </div>
          {filteredHazards.length > 60 && (
            <p className="text-xs text-amber-700 mt-1 px-3 pb-2">
              Showing first 60 of {filteredHazards.length}. Refine your search to see more.
            </p>
          )}
        </div>
      </Section>

      {/* Section 3 — initial risk */}
      <Section title="3 — Initial Risk (before controls)">
        <p className="text-sm text-slate-600 mb-3">
          Click a cell to set the inherent risk of the activity before any controls are considered.
        </p>
        <RiskMatrixGrid
          likelihoods={matrix.likelihoods}
          severities={matrix.severities}
          cells={matrix.cells}
          mode="selection"
          selectedLikelihood={selectedLikelihood}
          selectedSeverity={selectedSeverity}
          onSelect={(l, s) => {
            setSelectedLikelihood(l);
            setSelectedSeverity(s);
          }}
          caption="Initial Risk Matrix — select a cell"
        />

        {selectedCell && (
          <div
            className="mt-3 rounded-md border p-3"
            style={{ backgroundColor: selectedCell.colorHex + "22" }}
          >
            <div className="text-sm font-medium" style={{ color: selectedCell.colorHex }}>
              {selectedCell.riskLevel} risk — score {selectedCell.riskScore}
            </div>
            <div className="text-xs text-slate-700 mt-1">{selectedCell.actionRequired}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              Response time: within {selectedCell.responseTimeDays} days
            </div>
          </div>
        )}

        <Grid>
          <Field label="Likelihood rationale">
            <textarea
              className={TEXTAREA_CLASS}
              rows={2}
              value={likelihoodRationale}
              onChange={(e) => setLikelihoodRationale(e.target.value)}
              placeholder="Why this likelihood score? Past incidents, near misses, exposure."
            />
          </Field>
          <Field label="Severity rationale">
            <textarea
              className={TEXTAREA_CLASS}
              rows={2}
              value={severityRationale}
              onChange={(e) => setSeverityRationale(e.target.value)}
              placeholder="Why this severity? Worst credible outcome if the hazard is realised."
            />
          </Field>
        </Grid>
      </Section>

      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        <strong>Sections 4–9 (existing controls, residual risk, recommended controls, cross-module links, regulatory refs)</strong>{" "}
        are added by editing the entry after creation. They will land in Phase 3 follow-on.
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create Entry"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push(`/hira/${studyId}`)} disabled={pending}>
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label} {required && <span className="text-rose-600">*</span>}
      </label>
      {children}
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] text-slate-500 mb-0.5">{label}</label>
      <input
        type="number"
        min={0}
        className={INPUT_CLASS}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
      />
    </div>
  );
}
