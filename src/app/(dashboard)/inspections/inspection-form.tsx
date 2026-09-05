"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { UserPicker } from "@/components/ui/user-picker";
import { parseApiError } from "@/lib/api-error";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectField } from "@/components/ui/select-field";
import { Alert } from "@/components/ui/alert";

type Equipment = {
  id: string;
  code: string;
  name: string;
  plantId: string;
  plant: { id: string; name: string };
  checklistTemplate: string | null;
  frequency: string;
};

function safeParseList(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    return [];
  } catch {
    return [];
  }
}

export function InspectionForm({ equipment }: { equipment: Equipment[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [equipmentId, setEquipmentId] = useState(equipment[0]?.id ?? "");
  const [inspectorId, setInspectorId] = useState<string | null>(null);
  const [recordCompleted, setRecordCompleted] = useState(false);
  const [error, setError] = useState("");

  const selectedEq = useMemo(() => equipment.find((e) => e.id === equipmentId), [equipment, equipmentId]);
  // B3: defensive parse of checklist template (was a hard JSON.parse before)
  const checklist = useMemo(() => safeParseList(selectedEq?.checklistTemplate), [selectedEq]);
  const today = new Date().toISOString().slice(0, 10);

  const [results, setResults] = useState<Record<string, string>>({});

  // Takes the value, not a change event: the equipment picker is a Radix
  // listbox now, and there is no DOM event behind the selection.
  function onEquipmentChange(value: string) {
    setEquipmentId(value);
    setInspectorId(null); // re-pick inspector when plant changes via equipment
    setResults({});
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    // B4 client-side hint: if recording completion, ensure at least one item is set
    if (recordCompleted && checklist.length > 0 && Object.keys(results).length === 0) {
      setError("Mark at least one checklist item before saving.");
      return;
    }

    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, any> = {
      ...Object.fromEntries(fd.entries()),
      inspectorId,
      checklistResult: recordCompleted && Object.keys(results).length > 0 ? JSON.stringify(results) : undefined
    };
    const res = await fetch("/api/inspections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setSubmitting(false);
    if (res.ok) {
      const j = await res.json();
      router.push(`/inspections/${j.id}`);
      router.refresh();
    } else {
      setError(await parseApiError(res, "Failed to schedule inspection"));
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Equipment<span className="text-rose-600 ml-0.5">*</span></Label>
            <SelectField name="equipmentId" value={equipmentId} onChange={onEquipmentChange} required
              options={equipment.map((e) => ({ value: String(e.id), label: `${e.code} — ${e.name} (${e.plant.name})` }))}
            />
            {selectedEq && (
              <p className="text-xs text-slate-500">Frequency: {selectedEq.frequency.replace(/_/g, " ")}</p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Scheduled Date<span className="text-rose-600 ml-0.5">*</span></Label>
              <Input name="scheduledDate" type="date" defaultValue={today} required />
            </div>
            <div className="space-y-2">
              <Label>Inspector</Label>
              <UserPicker
                value={inspectorId}
                onChange={(id) => setInspectorId(id)}
                filter={{
                  plantId: selectedEq?.plantId,
                  // Only show users with INSPECTION.EXECUTE — otherwise the
                  // workflow rejects them with "Missing permission" at submit time.
                  permission: "INSPECTION.EXECUTE"
                }}
                placeholder="Search and select inspector"
              />
              <p className="text-xs text-slate-500">
                The inspector receives the execution task in their inbox once scheduled.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
             
              id="recordNow"
              checked={recordCompleted}
              onChange={(e) => setRecordCompleted(e.target.checked)}
              className="rounded border-slate-300 text-primary-700 focus:ring-primary-600" />
            <Label htmlFor="recordNow" className="cursor-pointer">Record completion now (in-field shortcut)</Label>
          </div>

          {recordCompleted && (
            <>
              <div className="space-y-2">
                <Label>Overall Result<span className="text-rose-600 ml-0.5">*</span></Label>
                <SelectField name="result" required defaultValue="Pass"
                  options={[
                  { value: "Pass", label: "Pass" },
                  { value: "Partial", label: "Partial / Minor" },
                  { value: "Fail", label: "Fail" }
                ]}
                />
                <p className="text-[11px] text-slate-500">
                  A Fail / Partial result auto-creates a Safety Observation for follow-up.
                </p>
              </div>

              {checklist.length > 0 ? (
                <div>
                  <Label>Checklist Items</Label>
                  <Card className="mt-2 space-y-2 border rounded-md p-3 bg-slate-50 shadow-none">
                    {checklist.map((item, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex-1 min-w-0">{item}</span>
                        <SelectField
                          className="w-32"
                          value={results[item] ?? "Pass"}
                          onChange={(value) => setResults({ ...results, [item]: value })}
                          options={[
                          { value: "Pass", label: "Pass" },
                          { value: "Marginal", label: "Marginal" },
                          { value: "Fail", label: "Fail" },
                          { value: "N/A", label: "N/A" }
                        ]}
                        />
                      </div>
                    ))}
                  </Card>
                </div>
              ) : (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  This equipment has no checklist template. Record an overall result and field observations below.
                </p>
              )}

              <div className="space-y-2">
                <Label>Field Observations</Label>
                <Textarea name="observations" rows={3} placeholder="Any concerns, anomalies, or remarks..." />
              </div>
            </>
          )}

          {error && <Alert variant="destructive" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-3">{error}</Alert>}

          <div className="flex gap-3">
            <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : recordCompleted ? "Save Inspection" : "Schedule Inspection"}</Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
