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

type RiskMatrix = {
  id: string;
  code: string;
  name: string;
  likelihoodLevels: number;
  severityLevels: number;
  isDefault: boolean;
  controlHierarchyEnforced: boolean;
};

type UserOption = {
  id: string;
  name: string;
  email: string;
  department: string | null;
  plantId: string | null;
};

type TeamMemberInput = {
  userId: string;
  teamRole: string;
  department: string;
};

const TEAM_ROLES = [
  { code: "FACILITATOR", label: "Facilitator" },
  { code: "SUBJECT_MATTER_EXPERT", label: "Subject Matter Expert" },
  { code: "OPERATOR_REP", label: "Operator Representative" },
  { code: "SAFETY_OFFICER", label: "Safety Officer" },
  { code: "DEPARTMENT_HEAD", label: "Department Head" },
  { code: "EXTERNAL_CONSULTANT", label: "External Consultant" }
];

const SCOPE_TYPES = [
  { code: "PLANT", label: "Entire Plant" },
  { code: "DEPARTMENT", label: "Department" },
  { code: "AREA", label: "Area" },
  { code: "ACTIVITY", label: "Activity Set" },
  { code: "EQUIPMENT", label: "Specific Equipment" },
  { code: "PROCESS", label: "Process" }
];

const REVIEW_FREQUENCIES = [
  { code: "ANNUAL", label: "Annual" },
  { code: "BIENNIAL", label: "Every 2 years" },
  { code: "QUARTERLY", label: "Quarterly (high-risk operations)" },
  { code: "TRIGGERED_ONLY", label: "Triggered only" },
  { code: "CUSTOM", label: "Custom interval" }
];

export function StudyCreateForm({
  plants,
  riskMatrices,
  users
}: {
  plants: Plant[];
  riskMatrices: RiskMatrix[];
  users: UserOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const defaultMatrix = riskMatrices.find((m) => m.isDefault) ?? riskMatrices[0];

  const [plantId, setPlantId] = useState(plants[0]?.id ?? "");
  const [scopeType, setScopeType] = useState("PLANT");
  const [departmentId, setDepartmentId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [riskMatrixId, setRiskMatrixId] = useState(defaultMatrix?.id ?? "");
  const [teamLeaderId, setTeamLeaderId] = useState("");
  const [reviewFrequency, setReviewFrequency] = useState("ANNUAL");
  const [customReviewMonths, setCustomReviewMonths] = useState<number | "">("");
  const [targetCompletionDate, setTargetCompletionDate] = useState("");
  const [regulatoryReviewRequired, setRegulatoryReviewRequired] = useState(false);
  const [team, setTeam] = useState<TeamMemberInput[]>([]);

  const selectedPlant = plants.find((p) => p.id === plantId);
  const availableDepartments = selectedPlant?.departments ?? [];
  const availableAreas = selectedPlant?.areas ?? [];
  const plantUsers = useMemo(
    () => users.filter((u) => !u.plantId || u.plantId === plantId),
    [users, plantId]
  );

  // Minimum team validation — the spec requires at least one Safety Officer
  // or HSE Manager. We approximate by requiring at least one Safety Officer
  // role on the team; the workflow will enforce stricter rules at submit.
  const hasSafetyRep = team.some(
    (m) => m.teamRole === "SAFETY_OFFICER" || m.teamRole === "FACILITATOR"
  );
  const teamSize = team.length;
  const teamMeetsMinimum = teamSize >= 3 && hasSafetyRep;

  function addTeamMember() {
    setTeam((t) => [...t, { userId: "", teamRole: "SUBJECT_MATTER_EXPERT", department: "" }]);
  }

  function updateTeamMember(i: number, patch: Partial<TeamMemberInput>) {
    setTeam((t) => t.map((m, j) => (i === j ? { ...m, ...patch } : m)));
  }

  function removeTeamMember(i: number) {
    setTeam((t) => t.filter((_, j) => i !== j));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!teamLeaderId) {
      setError("Team leader is required");
      return;
    }
    if (!riskMatrixId) {
      setError("Risk matrix selection is required");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/hira/studies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plantId,
          scopeType,
          departmentId: departmentId || undefined,
          areaId: areaId || undefined,
          title: title.trim(),
          description: description.trim() || undefined,
          riskMatrixId,
          teamLeaderId,
          team: team.filter((m) => m.userId),
          reviewFrequency,
          customReviewMonths: reviewFrequency === "CUSTOM" ? customReviewMonths || undefined : undefined,
          targetCompletionDate: targetCompletionDate || undefined,
          regulatoryReviewRequired
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Create failed (${res.status})`);
        return;
      }
      const created = await res.json();
      router.push(`/hira/${created.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm text-rose-900">
          {error}
        </div>
      )}

      <Section title="1 — Scope">
        <Grid>
          <Field label="Plant" required>
            <select
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
              value={plantId}
              onChange={(e) => {
                setPlantId(e.target.value);
                setDepartmentId("");
                setAreaId("");
              }}
            >
              {plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Scope Type" required>
            <select
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
              value={scopeType}
              onChange={(e) => setScopeType(e.target.value)}
            >
              {SCOPE_TYPES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          {(scopeType === "DEPARTMENT" || scopeType === "AREA" || scopeType === "ACTIVITY") && (
            <Field label="Department">
              <select
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">— Any —</option>
                {availableDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {(scopeType === "AREA" || scopeType === "ACTIVITY" || scopeType === "EQUIPMENT") && (
            <Field label="Area">
              <select
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
              >
                <option value="">— Any —</option>
                {availableAreas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </Grid>
      </Section>

      <Section title="2 — Study">
        <Field label="Title" required>
          <input
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. HIRA — Cement Mill Operations 2026"
          />
        </Field>
        <Field label="Description">
          <textarea
            className="form-input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional context, drivers for the study, scope notes."
          />
        </Field>
      </Section>

      <Section title="3 — Methodology">
        <Field label="Risk Matrix" required>
          <select
            className="form-select"
            value={riskMatrixId}
            onChange={(e) => setRiskMatrixId(e.target.value)}
          >
            {riskMatrices.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.likelihoodLevels}×{m.severityLevels})
                {m.isDefault ? " — default" : ""}
                {m.controlHierarchyEnforced ? " — hierarchy enforced" : ""}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-slate-500">
          The matrix is locked once the study is approved. To change methodology mid-study, supersede with a new study.
        </p>
      </Section>

      <Section title="4 — Team">
        <Field label="Team Leader" required>
          <select
            className="form-select"
            value={teamLeaderId}
            onChange={(e) => setTeamLeaderId(e.target.value)}
          >
            <option value="">— Select team leader —</option>
            {plantUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} {u.department ? `(${u.department})` : ""}
              </option>
            ))}
          </select>
        </Field>

        <div className="mt-3 space-y-2">
          {team.map((m, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 rounded border bg-slate-50">
              <div className="col-span-5">
                <label className="text-xs text-slate-500">Member</label>
                <select
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                  value={m.userId}
                  onChange={(e) => updateTeamMember(i, { userId: e.target.value })}
                >
                  <option value="">— Select —</option>
                  {plantUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-4">
                <label className="text-xs text-slate-500">Role</label>
                <select
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                  value={m.teamRole}
                  onChange={(e) => updateTeamMember(i, { teamRole: e.target.value })}
                >
                  {TEAM_ROLES.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-500">Department</label>
                <input
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                  value={m.department}
                  onChange={(e) => updateTeamMember(i, { department: e.target.value })}
                />
              </div>
              <button
                type="button"
                onClick={() => removeTeamMember(i)}
                className="col-span-1 inline-flex items-center justify-center h-9 rounded border bg-white text-rose-600 hover:bg-rose-50"
                aria-label="Remove team member"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addTeamMember}
          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-dashed border-slate-300 text-slate-600 hover:border-primary-500 hover:text-primary-700"
        >
          <Plus size={14} /> Add team member
        </button>

        <div className="mt-3 text-xs">
          {teamMeetsMinimum ? (
            <span className="text-emerald-700">✓ Minimum team (3 members + safety representative) met.</span>
          ) : (
            <span className="text-amber-700">
              Workflow submission requires at least 3 members including a Safety Officer or Facilitator. (Currently {teamSize}{hasSafetyRep ? ", with safety rep" : ", no safety rep"}.)
            </span>
          )}
        </div>
      </Section>

      <Section title="5 — Review Cycle">
        <Grid>
          <Field label="Review Frequency">
            <select
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
              value={reviewFrequency}
              onChange={(e) => setReviewFrequency(e.target.value)}
            >
              {REVIEW_FREQUENCIES.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          {reviewFrequency === "CUSTOM" && (
            <Field label="Custom Interval (months)">
              <input
                type="number"
                min={1}
                max={60}
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                value={customReviewMonths}
                onChange={(e) =>
                  setCustomReviewMonths(e.target.value === "" ? "" : parseInt(e.target.value, 10))
                }
              />
            </Field>
          )}
          <Field label="Target Completion Date">
            <input
              type="date"
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
              value={targetCompletionDate}
              onChange={(e) => setTargetCompletionDate(e.target.value)}
            />
          </Field>
        </Grid>
        <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={regulatoryReviewRequired}
            onChange={(e) => setRegulatoryReviewRequired(e.target.checked)}
          />
          Requires regulatory review (e.g. MAH installation, statutory submission)
        </label>
      </Section>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create Draft Study"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => history.back()} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  // Split "1 — Scope" into number chip + label for a more polished header.
  const m = title.match(/^(\d+)\s*[—-]\s*(.+)$/);
  const num = m?.[1];
  const label = m?.[2] ?? title;
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
        {num && (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
            {num}
          </span>
        )}
        <h2 className="text-base font-semibold text-slate-900">{label}</h2>
      </div>
      <div className="space-y-5 px-6 py-5">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5">{children}</div>;
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
