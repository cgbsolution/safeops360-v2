"use client";

// PATCH form for the Agent row. All field edits go through one PATCH
// to /api/agents/{code} — the backend handles per-field validation
// and authority-level clamping.
//
// Read-only mode: when canEdit is false, controls render as plain text.
// The page-level permission gate is the source of truth; this
// component just avoids confusing users with disabled fields.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { Save, AlertCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

type AgentForForm = {
  code: string;
  currentAuthorityLevel: string;
  maxAuthorityLevel: string;
  authorityRationale: string | null;
  rateLimit: number;
  isActive: boolean;
  isInPilot: boolean;
  primaryModelId: string;
  escalationModelId: string | null;
  availableTools: string[];
  module: string;
};

const LEVELS = ["L0", "L1", "L2"] as const;

export function AgentConfigForm({
  agent,
  canEdit
}: {
  agent: AgentForForm;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState({
    currentAuthorityLevel: agent.currentAuthorityLevel,
    authorityRationale: agent.authorityRationale ?? "",
    rateLimit: agent.rateLimit,
    isActive: agent.isActive,
    isInPilot: agent.isInPilot,
    primaryModelId: agent.primaryModelId,
    escalationModelId: agent.escalationModelId ?? ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxLevelIdx = LEVELS.indexOf(agent.maxAuthorityLevel as (typeof LEVELS)[number]);
  const allowedLevels = LEVELS.slice(0, Math.max(maxLevelIdx + 1, 1));

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const body = {
        currentAuthorityLevel: form.currentAuthorityLevel,
        authorityRationale: form.authorityRationale || null,
        rateLimit: form.rateLimit,
        isActive: form.isActive,
        isInPilot: form.isInPilot,
        primaryModelId: form.primaryModelId,
        escalationModelId: form.escalationModelId || null
      };
      const res = await fetch(`/api/agents/${agent.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail ?? err?.error ?? `PATCH failed (${res.status})`);
      }
      toast({
        variant: "success",
        title: "Agent updated",
        description: `${agent.code} configuration saved.`
      });
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border border-slate-200 rounded-md bg-white p-4 space-y-4 shadow-none">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>
            Authority level{" "}
            <span className="text-[10px] text-slate-500 font-normal">
              ceiling: {agent.maxAuthorityLevel}
            </span>
          </Label>
          {canEdit ? (
            <SelectField
              value={form.currentAuthorityLevel}
              onChange={(value) => setForm((f) => ({ ...f, currentAuthorityLevel: value }))
              }
              options={allowedLevels.map((l) => ({ value: String(l), label: `${l}` }))}
            />
          ) : (
            <ReadOnlyValue value={form.currentAuthorityLevel} />
          )}
          <p className="text-[10px] text-slate-500 mt-1">
            L0 = suggest only · L1 = pre-fill drafts · L2 = limited auto-action
          </p>
        </div>

        <div>
          <Label>Rate limit (invocations/hour/plant)</Label>
          {canEdit ? (
            <Input
              type="number"
              min={1}
              max={10000}
              value={form.rateLimit}
              onChange={(e) =>
                setForm((f) => ({ ...f, rateLimit: parseInt(e.target.value || "0", 10) }))
              }
            />
          ) : (
            <ReadOnlyValue value={form.rateLimit.toString()} />
          )}
        </div>

        <div>
          <Label>Primary model</Label>
          {canEdit ? (
            <Input
              value={form.primaryModelId}
              onChange={(e) =>
                setForm((f) => ({ ...f, primaryModelId: e.target.value }))
              }
              placeholder="claude-haiku-4-5-20251001"
              className="font-mono text-xs"
            />
          ) : (
            <ReadOnlyValue value={form.primaryModelId} mono />
          )}
        </div>

        <div>
          <Label>
            Escalation model{" "}
            <span className="text-[10px] text-slate-500 font-normal">
              optional
            </span>
          </Label>
          {canEdit ? (
            <Input
              value={form.escalationModelId}
              onChange={(e) =>
                setForm((f) => ({ ...f, escalationModelId: e.target.value }))
              }
              placeholder="claude-opus-4-7"
              className="font-mono text-xs"
            />
          ) : (
            <ReadOnlyValue value={form.escalationModelId || "—"} mono />
          )}
        </div>
      </div>

      <div>
        <Label>Authority rationale</Label>
        {canEdit ? (
          <Textarea
            rows={2}
            value={form.authorityRationale}
            onChange={(e) =>
              setForm((f) => ({ ...f, authorityRationale: e.target.value }))
            }
            placeholder="Why is the agent at this authority level? Document promotion criteria."
            className="text-xs"
          />
        ) : (
          <ReadOnlyValue
            value={form.authorityRationale || "(none)"}
            multiline
          />
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <BooleanToggle
          label="Active"
          value={form.isActive}
          canEdit={canEdit}
          hint="When disabled, the agent's invoke API returns 403."
          onChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
        />
        <BooleanToggle
          label="Pilot mode"
          value={form.isInPilot}
          canEdit={canEdit}
          hint="Elevated logging; rate limit + invoke permission still apply."
          onChange={(v) => setForm((f) => ({ ...f, isInPilot: v }))}
        />
      </div>

      <div>
        <Label>Available tools</Label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {agent.availableTools.map((t) => (
            <Badge
              key={t}
              className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] font-mono"
            >
              {t}
            </Badge>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-1">
          Read-only here — tools are code-defined in the Python backend
          (<code className="font-mono">app/services/agents/tools/</code>).
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-md border border-rose-200 bg-rose-50 p-2 text-rose-900 text-xs flex items-start gap-2">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
          {error}
        </Alert>
      )}

      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving}>
            <Save size={12} />
            {saving ? "Saving…" : "Save Configuration"}
          </Button>
        </div>
      )}
    </Card>
  );
}

function ReadOnlyValue({
  value,
  mono,
  multiline
}: {
  value: string;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div
      className={
        "mt-1 px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700 " +
        (mono ? "font-mono text-xs " : "") +
        (multiline ? "whitespace-pre-wrap min-h-[3rem]" : "")
      }
    >
      {value}
    </div>
  );
}

function BooleanToggle({
  label,
  value,
  canEdit,
  hint,
  onChange
}: {
  label: string;
  value: boolean;
  canEdit: boolean;
  hint?: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex items-center gap-2">
        {canEdit ? (
          <Label className="flex items-center gap-2 cursor-pointer text-sm">
            <Checkbox
             
              checked={value}
              onChange={(e) => onChange(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300" />
            {value ? "Enabled" : "Disabled"}
          </Label>
        ) : (
          <span className="text-sm">{value ? "Enabled" : "Disabled"}</span>
        )}
      </div>
      {hint && <p className="text-[10px] text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}
