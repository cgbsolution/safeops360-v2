"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

type Plant = {
  id: string;
  code: string;
  name: string;
  departments: { id: string; name: string }[];
  areas: { id: string; name: string }[];
};

type ImpactMatrix = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  likelihoodLevels: number;
  magnitudeLevels: number;
  isDefault: boolean;
};

type UserOption = {
  id: string;
  name: string;
  email: string;
  plantId: string | null;
};

type Regulation = {
  id: string;
  code: string;
  name: string;
};

type TeamMemberInput = {
  userId: string;
  teamRole: string;
  department: string;
};

const TEAM_ROLES = [
  { code: "FACILITATOR", label: "Facilitator" },
  { code: "ENVIRONMENT_MANAGER", label: "Environment Manager" },
  { code: "PROCESS_EXPERT", label: "Process Expert" },
  { code: "OPERATIONS", label: "Operations Representative" },
  { code: "SUSTAINABILITY", label: "Sustainability Lead" },
  { code: "EXTERNAL_CONSULTANT", label: "External Consultant" }
];

const SCOPE_TYPES = [
  { code: "PLANT", label: "Entire Plant" },
  { code: "DEPARTMENT", label: "Department" },
  { code: "AREA", label: "Area" },
  { code: "PROCESS", label: "Process" },
  { code: "ACTIVITY", label: "Activity Set" }
];

const REVIEW_FREQUENCIES = [
  { code: "ANNUAL", label: "Annual" },
  { code: "BIENNIAL", label: "Every 2 years" },
  { code: "QUARTERLY", label: "Quarterly (high-significance ops)" },
  { code: "TRIGGERED_ONLY", label: "Triggered only" },
  { code: "CUSTOM", label: "Custom interval" }
];

export function EaiStudyCreateForm({
  defaultPlantId,
  plants,
  impactMatrices,
  users,
  regulations
}: {
  defaultPlantId: string | null;
  plants: Plant[];
  impactMatrices: ImpactMatrix[];
  users: UserOption[];
  regulations: Regulation[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Defensive defaults — if the upstream fetches fail or return a
  // different shape, fall back to empty arrays so .find / .filter / .map
  // can't throw "plants.find is not a function" at render time.
  const safePlants = Array.isArray(plants) ? plants : [];
  const safeUsers = Array.isArray(users) ? users : [];
  const safeMatrices = Array.isArray(impactMatrices) ? impactMatrices : [];
  const safeRegulations = Array.isArray(regulations) ? regulations : [];

  const defaultMatrix =
    safeMatrices.find((m) => m.isDefault) ?? safeMatrices[0];

  const [plantId, setPlantId] = useState<string>(defaultPlantId ?? safePlants[0]?.id ?? "");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [areaId, setAreaId] = useState<string>("");
  const [scopeType, setScopeType] = useState<string>("PLANT");
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [impactMatrixId, setImpactMatrixId] = useState<string>(defaultMatrix?.id ?? "");
  const [teamLeaderId, setTeamLeaderId] = useState<string>("");
  const [team, setTeam] = useState<TeamMemberInput[]>([]);
  const [reviewFrequency, setReviewFrequency] = useState<string>("ANNUAL");
  const [customReviewMonths, setCustomReviewMonths] = useState<number | null>(null);
  const [targetCompletionDate, setTargetCompletionDate] = useState<string>("");
  const [applicableRegulations, setApplicableRegulations] = useState<string[]>([]);
  const [regulatoryReviewRequired, setRegulatoryReviewRequired] = useState<boolean>(false);

  const selectedPlant = useMemo(
    () => safePlants.find((p) => p.id === plantId),
    [safePlants, plantId]
  );

  const plantUsers = useMemo(
    () => safeUsers.filter((u) => !u.plantId || u.plantId === plantId),
    [safeUsers, plantId]
  );

  function addTeamMember() {
    setTeam([...team, { userId: "", teamRole: "PROCESS_EXPERT", department: "" }]);
  }

  function removeTeamMember(idx: number) {
    setTeam(team.filter((_, i) => i !== idx));
  }

  function updateTeamMember(idx: number, patch: Partial<TeamMemberInput>) {
    setTeam(team.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  }

  function toggleRegulation(code: string) {
    setApplicableRegulations((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function submit() {
    setError(null);
    if (!plantId) {
      setError("Plant is required");
      return;
    }
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!impactMatrixId) {
      setError("Impact matrix is required");
      return;
    }
    if (!teamLeaderId) {
      setError("Team leader is required");
      return;
    }
    if (scopeType === "DEPARTMENT" && !departmentId) {
      setError("Department is required for DEPARTMENT scope");
      return;
    }
    if (scopeType === "AREA" && !areaId) {
      setError("Area is required for AREA scope");
      return;
    }

    startTransition(async () => {
      const body = {
        plantId,
        departmentId: departmentId || null,
        areaId: areaId || null,
        scopeType,
        title: title.trim(),
        description: description.trim() || null,
        impactMatrixId,
        teamLeaderId,
        team: team.filter((m) => m.userId),
        targetCompletionDate: targetCompletionDate
          ? new Date(targetCompletionDate).toISOString()
          : null,
        reviewFrequency,
        customReviewMonths: reviewFrequency === "CUSTOM" ? customReviewMonths : null,
        applicableRegulations,
        regulatoryReviewRequired
      };

      const res = await fetch("/api/eai/studies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string; detail?: string }).error ?? (data as { detail?: string }).detail ?? `Failed (${res.status})`);
        return;
      }

      const result = (await res.json()) as { id: string };
      router.push(`/eai/${result.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Section title="Scope">
        <Field label="Plant" required>
          <select
            value={plantId}
            onChange={(e) => {
              setPlantId(e.target.value);
              setDepartmentId("");
              setAreaId("");
            }}
            className="form-input"
          >
            <option value="">Select plant...</option>
            {safePlants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Scope type" required>
          <select
            value={scopeType}
            onChange={(e) => setScopeType(e.target.value)}
            className="form-input"
          >
            {SCOPE_TYPES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        {scopeType === "DEPARTMENT" && (
          <Field label="Department" required>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="form-input"
            >
              <option value="">Select department...</option>
              {selectedPlant?.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {scopeType === "AREA" && (
          <Field label="Area" required>
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className="form-input"
            >
              <option value="">Select area...</option>
              {selectedPlant?.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Title" required>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Cement Mill 2 — environmental aspects 2026 review"
            className="form-input"
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="form-input"
          />
        </Field>
      </Section>

      <Section title="Methodology">
        <Field label="Impact matrix" required>
          <select
            value={impactMatrixId}
            onChange={(e) => setImpactMatrixId(e.target.value)}
            className="form-input"
          >
            <option value="">Select impact matrix...</option>
            {safeMatrices.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.likelihoodLevels}×{m.magnitudeLevels})
                {m.isDefault ? " — default" : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Review frequency">
          <div className="flex gap-2">
            <select
              value={reviewFrequency}
              onChange={(e) => setReviewFrequency(e.target.value)}
              className="form-input flex-1"
            >
              {REVIEW_FREQUENCIES.map((f) => (
                <option key={f.code} value={f.code}>
                  {f.label}
                </option>
              ))}
            </select>
            {reviewFrequency === "CUSTOM" && (
              <input
                type="number"
                min={1}
                max={60}
                placeholder="months"
                value={customReviewMonths ?? ""}
                onChange={(e) =>
                  setCustomReviewMonths(e.target.value ? Number(e.target.value) : null)
                }
                className="form-input w-28"
              />
            )}
          </div>
        </Field>

        <Field label="Target completion date">
          <input
            type="date"
            value={targetCompletionDate}
            onChange={(e) => setTargetCompletionDate(e.target.value)}
            className="form-input"
          />
        </Field>
      </Section>

      <Section title="Team">
        <Field label="Team leader" required>
          <select
            value={teamLeaderId}
            onChange={(e) => setTeamLeaderId(e.target.value)}
            className="form-input"
          >
            <option value="">Select team leader...</option>
            {plantUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </Field>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wider text-slate-600 font-medium">
              Team members ({team.length})
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={addTeamMember}>
              <Plus size={14} /> Add
            </Button>
          </div>
          {team.length === 0 ? (
            <div className="text-xs text-slate-400 py-3">
              No team members added yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {team.map((m, i) => (
                <li key={i} className="flex gap-2 items-start">
                  <select
                    value={m.userId}
                    onChange={(e) => updateTeamMember(i, { userId: e.target.value })}
                    className="form-input flex-1"
                  >
                    <option value="">Select user...</option>
                    {plantUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={m.teamRole}
                    onChange={(e) => updateTeamMember(i, { teamRole: e.target.value })}
                    className="form-input w-48"
                  >
                    {TEAM_ROLES.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeTeamMember(i)}
                    className="p-2 text-slate-400 hover:text-rose-600"
                    aria-label="Remove team member"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <Section title="Applicable regulations">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-64 overflow-auto border rounded p-2">
          {safeRegulations.map((r) => (
            <label
              key={r.id}
              className="flex items-start gap-2 text-xs cursor-pointer hover:bg-slate-50 px-1 py-0.5 rounded"
            >
              <input
                type="checkbox"
                checked={applicableRegulations.includes(r.code)}
                onChange={() => toggleRegulation(r.code)}
                className="mt-0.5"
              />
              <span>
                <span className="font-mono text-[10px] text-slate-500">{r.code}</span>
                <br />
                {r.name}
              </span>
            </label>
          ))}
        </div>
        <label className="flex items-center gap-2 mt-2 text-xs">
          <input
            type="checkbox"
            checked={regulatoryReviewRequired}
            onChange={(e) => setRegulatoryReviewRequired(e.target.checked)}
          />
          <span>Regulatory review required before approval</span>
        </label>
      </Section>

      {error && (
        <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? "Creating..." : "Create Study"}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
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
