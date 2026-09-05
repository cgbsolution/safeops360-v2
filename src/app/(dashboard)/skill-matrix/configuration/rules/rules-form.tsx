"use client";

// Client editor for the competency-engine rule thresholds. Bound to the
// `effective` config for the selected plant; PUT writes a plant-scoped
// override (or the global default when no plant is resolved). Gated by
// SKILL_MATRIX.COMPETENCY_CONFIGURE — the API enforces independently.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { Can } from "@/components/auth/can";
import { SEVERITY_THRESHOLDS, type RuleConfigEffective } from "@/lib/training-engine";
import { Card } from "@/components/ui/card";

type NumField = {
  key:
    | "thresholdCount"
    | "thresholdWindowDays"
    | "recertWindowDays"
    | "assignmentDueDays"
    | "correlationWindowDays";
  label: string;
  help: string;
};

const NUM_FIELDS: NumField[] = [
  {
    key: "thresholdCount",
    label: "Threshold count",
    help: "Repeat events of the same class needed to trigger an assignment."
  },
  {
    key: "thresholdWindowDays",
    label: "Threshold window (days)",
    help: "Look-back window over which repeats are counted."
  },
  {
    key: "recertWindowDays",
    label: "Recert window (days)",
    help: "How far ahead of expiry a recert assignment is raised."
  },
  {
    key: "assignmentDueDays",
    label: "Assignment due (days)",
    help: "Default due date offset for a new assignment."
  },
  {
    key: "correlationWindowDays",
    label: "Correlation window (days)",
    help: "Before/after window used by the training-impact report."
  }
];

export function RulesForm({
  effective,
  plantId
}: {
  effective: RuleConfigEffective;
  plantId: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const [nums, setNums] = useState<Record<NumField["key"], string>>({
    thresholdCount: String(effective.thresholdCount),
    thresholdWindowDays: String(effective.thresholdWindowDays),
    recertWindowDays: String(effective.recertWindowDays),
    assignmentDueDays: String(effective.assignmentDueDays),
    correlationWindowDays: String(effective.correlationWindowDays)
  });
  const [sifImmediate, setSifImmediate] = useState(effective.severitySifImmediate);
  const [severityThreshold, setSeverityThreshold] = useState(effective.severityThreshold);

  const setNum = (k: NumField["key"], v: string) => setNums((n) => ({ ...n, [k]: v }));

  async function save() {
    setBusy(true);
    try {
      const payload = {
        plantId: plantId ?? undefined,
        thresholdCount: Number(nums.thresholdCount) || 0,
        thresholdWindowDays: Number(nums.thresholdWindowDays) || 0,
        recertWindowDays: Number(nums.recertWindowDays) || 0,
        assignmentDueDays: Number(nums.assignmentDueDays) || 0,
        correlationWindowDays: Number(nums.correlationWindowDays) || 0,
        severitySifImmediate: sifImmediate,
        severityThreshold
      };
      const res = await fetch("/api/training-engine/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast({
          variant: "error",
          title: "Couldn't save configuration",
          description: j.detail || j.error || "Please try again."
        });
        return;
      }
      toast({ variant: "success", title: "Configuration saved" });
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <Card className="rounded-xl border border-primary-200 bg-primary-50/50 px-4 py-3 text-sm text-primary-900 shadow-none">
        {plantId
          ? "Editing the plant-specific override. These values take precedence over the global default for this plant."
          : "No plant scope resolved — editing the global default used wherever a plant has no override."}
      </Card>

      <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {NUM_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              <Input
                type="number"
                value={nums[f.key]}
                onChange={(e) => setNum(f.key, e.target.value)}
              />
              <p className="text-[11px] text-slate-500">{f.help}</p>
            </div>
          ))}

          <div className="space-y-1">
            <Label className="text-xs">Severity threshold</Label>
            <SelectField
              value={severityThreshold}
              onChange={(value) => setSeverityThreshold(value)}
              options={SEVERITY_THRESHOLDS.map((s) => ({ value: String(s), label: `${s}` }))}
            />
            <p className="text-[11px] text-slate-500">
              Minimum severity that triggers a severity-rule assignment.
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">SIF handling</Label>
            <Label className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm">
              <Checkbox
                checked={sifImmediate}
                onChange={(e) => setSifImmediate(e.target.checked)}
              />
              <span className="text-slate-700">Assign immediately on SIF-potential events</span>
            </Label>
            <p className="text-[11px] text-slate-500">
              Bypass the threshold count for serious-injury-or-fatality potential.
            </p>
          </div>
        </div>
      </Card>

      <Can
        permission="SKILL_MATRIX.COMPETENCY_CONFIGURE"
        fallback={
          <p className="text-xs text-slate-400">
            You have read-only access to this configuration.
          </p>
        }
      >
        <Button onClick={save} disabled={busy}>
          <Save size={16} /> {busy ? "Saving…" : "Save configuration"}
        </Button>
      </Can>
    </div>
  );
}
