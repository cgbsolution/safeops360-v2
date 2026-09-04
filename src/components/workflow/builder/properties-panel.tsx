"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { UserPicker } from "@/components/ui/user-picker";
import { X, Trash2, Info, Plus } from "lucide-react";
import type { AssignmentMode, EditorCondition, EditorStep, StepType } from "./types";
import {
  STEP_TYPE_LIST,
  ROLE_OPTIONS,
  FIELD_OPTIONS,
  CONDITION_OPERATORS,
  detectAssignmentMode,
  parseConditionExpr,
  serializeConditionExpr
} from "./types";
import { cn } from "@/lib/utils";

const SLA_PRESETS = [
  { label: "2 hours", value: 2 },
  { label: "4 hours", value: 4 },
  { label: "1 day", value: 24 },
  { label: "2 days", value: 48 },
  { label: "1 week", value: 168 },
  { label: "2 weeks", value: 336 },
  { label: "1 month", value: 720 }
];

const ASSIGNMENT_MODES: { v: AssignmentMode; l: string; help: string }[] = [
  { v: "ROLE", l: "By Role", help: "Engine picks any user with the chosen role at the same plant." },
  { v: "FIELD", l: "From Record", help: "Resolved from a field on the record itself (e.g. action owner)." },
  { v: "USER", l: "Specific User", help: "Always assigns this exact person." },
  { v: "GROUP", l: "Group Queue", help: "Anyone in the union of these roles can claim the task." },
  { v: "NONE", l: "Manual", help: "Step is parked until an admin reassigns." }
];

export function PropertiesPanel({
  step,
  roles,
  isFirst,
  onChange,
  onDelete,
  onClose
}: {
  step: EditorStep;
  /** The active role catalogue, loaded from the database by the page. Falls
   *  back to ROLE_OPTIONS only so the dropdown is never empty. */
  roles?: { code: string; name: string }[];
  isFirst: boolean;
  onChange: (next: EditorStep) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const roleChoices = useMemo(
    () =>
      roles && roles.length > 0
        ? roles.map((r) => ({ value: r.code, label: r.name }))
        : ROLE_OPTIONS,
    [roles]
  );
  const [condition, setCondition] = useState<EditorCondition>(() => parseConditionExpr(step.conditionExpr));

  // Reset condition rows when switching to a different step
  useEffect(() => {
    setCondition(parseConditionExpr(step.conditionExpr));
  }, [step.clientId, step.conditionExpr]);

  function patch(p: Partial<EditorStep>) {
    onChange({ ...step, ...p });
  }

  function setMode(mode: AssignmentMode) {
    // Re-clicking the mode the step is already in must not wipe its settings —
    // that is how a pinned "By Role" step silently lost its person.
    if (mode === detectAssignmentMode(step)) return;
    const cleared = { approverRole: null, approverField: null, approverUserId: null, approverUserName: null, approverGroupRoles: null };
    if (mode === "ROLE") onChange({ ...step, ...cleared, approverRole: step.approverRole ?? "HSE_MANAGER" });
    else if (mode === "FIELD") onChange({ ...step, ...cleared, approverField: step.approverField ?? "ACTION_OWNER" });
    else if (mode === "USER") onChange({ ...step, ...cleared });
    else if (mode === "GROUP") onChange({ ...step, ...cleared, approverGroupRoles: step.approverGroupRoles ?? ["HSE_MANAGER"] });
    else onChange({ ...step, ...cleared });
  }

  function commitConditions(next: EditorCondition) {
    setCondition(next);
    onChange({ ...step, conditionExpr: serializeConditionExpr(next) });
  }

  const mode = detectAssignmentMode(step);
  const slaUnit: "HOURS" | "DAYS" = step.slaUnit ?? (step.slaHours && step.slaHours >= 24 && step.slaHours % 24 === 0 ? "DAYS" : "HOURS");

  // The UI shows the raw number in the chosen unit; persist as hours regardless.
  const slaDisplay = useMemo(() => {
    if (step.slaHours == null) return "";
    return slaUnit === "DAYS" ? String(Math.round((step.slaHours / 24) * 10) / 10) : String(step.slaHours);
  }, [step.slaHours, slaUnit]);

  function setSla(rawValue: string, unit: "HOURS" | "DAYS") {
    if (rawValue === "") {
      patch({ slaHours: null, slaUnit: unit });
      return;
    }
    const n = Math.max(0, Number(rawValue));
    const hours = unit === "DAYS" ? Math.round(n * 24) : Math.round(n);
    patch({ slaHours: hours, slaUnit: unit });
  }

  return (
    <aside className="w-96 border-l bg-white flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Step Properties</div>
          <div className="text-sm font-semibold text-slate-900 truncate">{step.name || "Untitled step"}</div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* Step type */}
        <div>
          <Label>Step type</Label>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {STEP_TYPE_LIST.map((opt) => {
              const selected = step.stepType === opt.value;
              const disabled = isFirst && opt.value !== "MAKER";
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={disabled}
                  title={disabled ? "First step must be Maker" : opt.description}
                  onClick={() => patch({ stepType: opt.value as StepType })}
                  className={cn(
                    "px-2.5 py-2 text-xs rounded-md border text-left transition",
                    selected ? "border-primary-500 bg-primary-50 text-primary-900 ring-1 ring-primary-200" : "border-slate-200 hover:border-slate-300 text-slate-700",
                    disabled && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <div className="font-semibold">{opt.label}</div>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            {STEP_TYPE_LIST.find((o) => o.value === step.stepType)?.description}
          </p>
        </div>

        {/* Display name */}
        <div className="space-y-1.5">
          <Label htmlFor="step-name">Display name</Label>
          <Input
            id="step-name"
            value={step.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="e.g. Section Head Review"
          />
          <p className="text-[11px] text-slate-500">Shown to approvers in their inbox and task lists.</p>
        </div>

        {/* Assignment */}
        {step.stepType !== "MAKER" && (
          <div>
            <Label>Who handles this step?</Label>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {ASSIGNMENT_MODES.map((m) => (
                <button
                  key={m.v}
                  type="button"
                  onClick={() => setMode(m.v)}
                  title={m.help}
                  className={cn(
                    "px-2.5 py-1.5 text-xs rounded-md border text-left transition",
                    mode === m.v ? "border-primary-500 bg-primary-50 text-primary-900" : "border-slate-200 text-slate-700 hover:border-slate-300"
                  )}
                >
                  {m.l}
                </button>
              ))}
            </div>

            {mode === "ROLE" && (
              <div className="mt-2 space-y-2">
                <Select
                  value={step.approverRole ?? ""}
                  onChange={(e) => patch({ approverRole: e.target.value || null })}
                >
                  <option value="">— Pick a role —</option>
                  {roleChoices.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </Select>

                {/* Which holder of that role. Two genuinely different routings,
                    so they are a choice rather than a hidden default:

                      Per plant — the engine resolves a holder at the record's
                        own plant, so a Plant Head step reaches THAT plant's
                        head. This is what makes one definition serve every site.

                      One person — a single named holder takes the step for
                        every plant. Stored as approverUserId alongside the role;
                        the engine checks the pinned user first, and the role is
                        kept so the step still says who it is for. */}
                <div className="rounded-md border border-slate-200 p-2 space-y-1.5">
                  <p className="text-[11px] font-medium text-slate-700">Which holder of this role?</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => patch({ approverUserId: null, approverUserName: null })}
                      className={cn(
                        "px-2.5 py-1.5 text-xs rounded-md border text-left transition",
                        !step.approverUserId
                          ? "border-primary-500 bg-primary-50 text-primary-900"
                          : "border-slate-200 text-slate-700 hover:border-slate-300"
                      )}
                    >
                      Per plant
                    </button>
                    <button
                      type="button"
                      onClick={() => patch({ approverUserId: step.approverUserId ?? null })}
                      className={cn(
                        "px-2.5 py-1.5 text-xs rounded-md border text-left transition",
                        step.approverUserId
                          ? "border-primary-500 bg-primary-50 text-primary-900"
                          : "border-slate-200 text-slate-700 hover:border-slate-300"
                      )}
                    >
                      One person
                    </button>
                  </div>
                  {/* Scoped to people who actually hold the selected role.
                      workflow_engine._rbac_gate requires the assignee to hold
                      step.approverRole before it will let them approve, execute
                      or verify — so pinning someone outside the role would
                      create a task that lands in their inbox and then refuses
                      every action they take on it. */}
                  <UserPicker
                    value={step.approverUserId}
                    onChange={(id, user) =>
                      patch({ approverUserId: id, approverUserName: user?.name ?? null })
                    }
                    filter={step.approverRole ? { role: step.approverRole } : undefined}
                    disabled={!step.approverRole}
                    placeholder={
                      step.approverRole ? "Search people holding this role" : "Pick a role first"
                    }
                    emptyText="Nobody holds this role yet."
                  />
                  <p className="text-[11px] text-slate-500">
                    {step.approverUserId
                      ? "Every record routes to this one person, whichever plant it belongs to."
                      : "The engine picks a holder of this role at the record's own plant, falling back to a globally scoped holder."}
                  </p>
                </div>
              </div>
            )}

            {mode === "FIELD" && (
              <div className="mt-2 space-y-1">
                <Select
                  value={step.approverField ?? ""}
                  onChange={(e) => patch({ approverField: e.target.value || null })}
                >
                  <option value="">— Pick a field —</option>
                  {FIELD_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </Select>
                <p className="text-[11px] text-slate-500">{ASSIGNMENT_MODES[1].help}</p>
              </div>
            )}

            {mode === "USER" && (
              <div className="mt-2 space-y-1">
                <UserPicker
                  value={step.approverUserId}
                  onChange={(id, user) => patch({ approverUserId: id, approverUserName: user?.name ?? null })}
                  placeholder="Search and select user"
                  required
                />
                <p className="text-[11px] text-slate-500">{ASSIGNMENT_MODES[2].help}</p>
              </div>
            )}

            {mode === "GROUP" && (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {ROLE_OPTIONS.map((r) => {
                    const selected = (step.approverGroupRoles ?? []).includes(r.value);
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => {
                          const cur = step.approverGroupRoles ?? [];
                          const next = selected ? cur.filter((x) => x !== r.value) : [...cur, r.value];
                          patch({ approverGroupRoles: next.length ? next : null });
                        }}
                        className={cn(
                          "px-2.5 py-1 text-xs rounded-full border transition",
                          selected ? "border-primary-500 bg-primary-50 text-primary-800" : "border-slate-200 text-slate-700 hover:border-slate-300"
                        )}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500">{ASSIGNMENT_MODES[3].help}</p>
              </div>
            )}

            {mode === "NONE" && (
              <p className="text-[11px] text-slate-500 mt-2 flex items-start gap-1.5">
                <Info size={11} className="mt-0.5 flex-shrink-0" />
                {ASSIGNMENT_MODES[4].help}
              </p>
            )}
          </div>
        )}

        {/* SLA */}
        {step.stepType !== "MAKER" && (
          <div>
            <Label>Service-level agreement</Label>
            <div className="mt-2 flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step={slaUnit === "DAYS" ? 0.5 : 1}
                value={slaDisplay}
                onChange={(e) => setSla(e.target.value, slaUnit)}
                placeholder={slaUnit === "DAYS" ? "days" : "hours"}
                className="w-28"
              />
              <Select
                value={slaUnit}
                onChange={(e) => setSla(slaDisplay, e.target.value as "HOURS" | "DAYS")}
                className="w-24"
              >
                <option value="HOURS">Hours</option>
                <option value="DAYS">Days</option>
              </Select>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {SLA_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => patch({ slaHours: p.value, slaUnit: p.value % 24 === 0 ? "DAYS" : "HOURS" })}
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-full border transition",
                    step.slaHours === p.value
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {step.slaHours != null && step.slaHours > 0 && (
              <div className="mt-3 space-y-1.5">
                <Label className="text-xs">Escalate to (when overdue)</Label>
                <Select
                  value={step.escalationRole ?? ""}
                  onChange={(e) => patch({ escalationRole: e.target.value || null })}
                >
                  <option value="">— None —</option>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </Select>
              </div>
            )}
          </div>
        )}

        {/* Optional flag */}
        {step.stepType !== "MAKER" && (
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={step.isOptional}
              onChange={(e) => patch({ isOptional: e.target.checked })}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-medium text-slate-800">Optional step</div>
              <div className="text-[11px] text-slate-500">Currently informational — combine with conditions to skip.</div>
            </div>
          </label>
        )}

        {/* Conditions */}
        {step.stepType !== "MAKER" && (
          <div>
            <Label>Run only when…</Label>
            <p className="text-[11px] text-slate-500 mb-2">
              Build one or more rules. Use comma-separated values for &quot;is in&quot; / &quot;is not in&quot;.
            </p>

            {condition.rules.length === 0 ? (
              <button
                type="button"
                onClick={() =>
                  commitConditions({
                    combinator: "AND",
                    rules: [{ field: "severity", operator: "in", value: "HIGH,CRITICAL" }]
                  })
                }
                className="text-xs text-primary-700 hover:text-primary-900 font-medium flex items-center gap-1"
              >
                <Plus size={12} /> Add a condition
              </button>
            ) : (
              <div className="space-y-2">
                {condition.rules.length > 1 && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span>Combine with:</span>
                    <div className="inline-flex border border-slate-200 rounded overflow-hidden">
                      {(["AND", "OR"] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => commitConditions({ ...condition, combinator: c })}
                          className={cn(
                            "px-2 py-0.5 text-xs",
                            condition.combinator === c ? "bg-primary-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {condition.rules.map((row, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input
                      placeholder="field"
                      value={row.field}
                      onChange={(e) => {
                        const next = { ...condition, rules: [...condition.rules] };
                        next.rules[i] = { ...row, field: e.target.value };
                        commitConditions(next);
                      }}
                      className="h-8 text-xs flex-1"
                    />
                    <Select
                      value={row.operator}
                      onChange={(e) => {
                        const next = { ...condition, rules: [...condition.rules] };
                        next.rules[i] = { ...row, operator: e.target.value as any };
                        commitConditions(next);
                      }}
                      className="h-8 text-xs w-28"
                    >
                      {CONDITION_OPERATORS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                    <Input
                      placeholder={row.operator === "in" || row.operator === "not_in" ? "A,B,C" : "value"}
                      value={row.value}
                      onChange={(e) => {
                        const next = { ...condition, rules: [...condition.rules] };
                        next.rules[i] = { ...row, value: e.target.value };
                        commitConditions(next);
                      }}
                      className="h-8 text-xs flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...condition, rules: condition.rules.filter((_, j) => j !== i) };
                        commitConditions(next);
                      }}
                      className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-600"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    commitConditions({
                      ...condition,
                      rules: [...condition.rules, { field: "", operator: "=", value: "" }]
                    })
                  }
                  className="text-xs text-primary-700 hover:text-primary-900 font-medium flex items-center gap-1"
                >
                  <Plus size={12} /> Add another condition
                </button>
              </div>
            )}

            {condition.rules.length > 0 && (
              <Badge className="mt-3 bg-amber-50 text-amber-800 border-amber-200">
                Conditional step — will be skipped if not matched
              </Badge>
            )}
          </div>
        )}

        {/* Approver notes */}
        {step.stepType !== "MAKER" && (
          <div className="space-y-1.5">
            <Label htmlFor="step-notes">Notes for approver</Label>
            <Textarea
              id="step-notes"
              rows={3}
              value={step.notes ?? ""}
              onChange={(e) => patch({ notes: e.target.value || null })}
              placeholder="Context, instructions, what to verify…"
            />
            <p className="text-[11px] text-slate-500">Shown to the approver/assignee when they open the task.</p>
          </div>
        )}
      </div>

      <div className="border-t px-5 py-3 flex items-center justify-between">
        {step.stepType === "MAKER" ? (
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Info size={11} /> The Maker step is required and cannot be deleted.
          </span>
        ) : (
          <Button variant="outline" size="sm" onClick={onDelete} className="text-rose-600 border-rose-200 hover:bg-rose-50">
            <Trash2 size={13} /> Delete step
          </Button>
        )}
      </div>
    </aside>
  );
}
