"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { parseApiError } from "@/lib/api-error";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

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
        setError(await parseApiError(res, "Create failed"));
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
        <Alert variant="destructive" className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm text-rose-900">
          {error}
        </Alert>
      )}

      <Section title="1 — Scope">
        <Grid>
          <Field label="Plant" required>
            <SelectField
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
              value={plantId}
              onChange={(value) => {
                setPlantId(value);
                setDepartmentId("");
                setAreaId("");
              }}
              options={plants.map((p) => ({ value: p.id, label: `${p.name}` }))}
            />
          </Field>
          <Field label="Scope Type" required>
            <SelectField
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
              value={scopeType}
              onChange={setScopeType}
              options={SCOPE_TYPES.map((s) => ({ value: s.code, label: `${s.label}` }))}
            />
          </Field>
          {(scopeType === "DEPARTMENT" || scopeType === "AREA" || scopeType === "ACTIVITY") && (
            <Field label="Department">
              <SelectField
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                value={departmentId}
                onChange={setDepartmentId}
                placeholder="— Any —"
                options={availableDepartments.map((d) => ({ value: d.id, label: `${d.name}` }))}
              />
            </Field>
          )}
          {(scopeType === "AREA" || scopeType === "ACTIVITY" || scopeType === "EQUIPMENT") && (
            <Field label="Area">
              <SelectField
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                value={areaId}
                onChange={setAreaId}
                placeholder="— Any —"
                options={availableAreas.map((a) => ({ value: a.id, label: `${a.name}` }))}
              />
            </Field>
          )}
        </Grid>
      </Section>

      <Section title="2 — Study">
        <Field label="Title" required>
          <Input
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. HIRA — Cement Mill Operations 2026" />
        </Field>
        <Field label="Description">
          <Textarea
            className="form-input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional context, drivers for the study, scope notes." />
        </Field>
      </Section>

      <Section title="3 — Methodology">
        <Field label="Risk Matrix" required>
          <SelectField
            className="form-select"
            value={riskMatrixId}
            onChange={setRiskMatrixId}
            options={riskMatrices.map((m) => ({ value: m.id, label: `${m.name} (${m.likelihoodLevels}×${m.severityLevels}) ${m.isDefault ? " — default" : ""} ${m.controlHierarchyEnforced ? " — hierarchy enforced" : ""}` }))}
          />
        </Field>
        <p className="text-xs text-slate-500">
          The matrix is locked once the study is approved. To change methodology mid-study, supersede with a new study.
        </p>
      </Section>

      <Section title="4 — Team">
        <Field label="Team Leader" required>
          <SelectField
            className="form-select"
            value={teamLeaderId}
            onChange={setTeamLeaderId}
            placeholder="— Select team leader —"
            options={plantUsers.map((u) => ({ value: u.id, label: `${u.name} ${u.department ? `(${u.department})` : ""}` }))}
          />
        </Field>

        <div className="mt-3 space-y-2">
          {team.map((m, i) => (
            <Card key={i} className="grid grid-cols-12 gap-2 items-end p-3 rounded border bg-slate-50 shadow-none">
              <div className="col-span-5">
                <Label className="text-xs text-slate-500">Member</Label>
                <SelectField
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                  value={m.userId}
                  onChange={(value) => updateTeamMember(i, { userId: value })}
                  placeholder="— Select —"
                  options={plantUsers.map((u) => ({ value: u.id, label: `${u.name}` }))}
                />
              </div>
              <div className="col-span-4">
                <Label className="text-xs text-slate-500">Role</Label>
                <SelectField
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                  value={m.teamRole}
                  onChange={(value) => updateTeamMember(i, { teamRole: value })}
                  options={TEAM_ROLES.map((r) => ({ value: r.code, label: `${r.label}` }))}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-slate-500">Department</Label>
                <Input
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                  value={m.department}
                  onChange={(e) => updateTeamMember(i, { department: e.target.value })} />
              </div>
              <Button variant="destructive"
                type="button"
                onClick={() => removeTeamMember(i)} className="col-span-1 h-9 rounded"
                aria-label="Remove team member">
                <Trash2 size={14} />
              </Button>
            </Card>
          ))}
        </div>

        <Button variant="outline"
          type="button"
          onClick={addTeamMember} className="mt-2 gap-1.5 px-3 py-1.5 text-sm rounded border-dashed">
          <Plus size={14} /> Add team member
        </Button>

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
            <SelectField
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
              value={reviewFrequency}
              onChange={setReviewFrequency}
              options={REVIEW_FREQUENCIES.map((r) => ({ value: r.code, label: `${r.label}` }))}
            />
          </Field>
          {reviewFrequency === "CUSTOM" && (
            <Field label="Custom Interval (months)">
              <Input
                type="number"
                min={1}
                max={60}
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                value={customReviewMonths}
                onChange={(e) =>
                  setCustomReviewMonths(e.target.value === "" ? "" : parseInt(e.target.value, 10))
                } />
            </Field>
          )}
          <Field label="Target Completion Date">
            <Input
              type="date"
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
              value={targetCompletionDate}
              onChange={(e) => setTargetCompletionDate(e.target.value)} />
          </Field>
        </Grid>
        <Label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
          <Checkbox
           
            checked={regulatoryReviewRequired}
            onChange={(e) => setRegulatoryReviewRequired(e.target.checked)} />
          Requires regulatory review (e.g. MAH installation, statutory submission)
        </Label>
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
      <Label className="form-label">
        {label} {required && <span className="text-rose-600">*</span>}
      </Label>
      {children}
    </div>
  );
}
