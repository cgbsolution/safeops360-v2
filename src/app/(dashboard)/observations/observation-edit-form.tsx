"use client";

// Compact "edit while open" form for a Safety Observation. Edits the core
// descriptive fields only (the reporter + original date stay locked for audit
// integrity). PATCHes /api/observations/{id}; the backend enforces
// OBSERVATION.UPDATE and refuses once the observation is CLOSED.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { readApiError } from "@/lib/client-errors";
import { DEPARTMENTS } from "@/lib/observation-masters";
import {
  StopTaxonomyFields,
  isAtRisk,
  type StopTaxonomyValue
} from "@/components/observations/stop-taxonomy-fields";
import {
  SeveritySuggestionField,
  useSeveritySuggestion,
  severityLabel
} from "@/components/observations/severity-suggestion";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// At-risk types only, matching the create form. The two SAFE types are still
// listed for a record that ALREADY is one — dropping them from the options of a
// select whose value is "SAFE_ACT" would render a blank type and silently
// reclassify the record on the next save. See `typeOptions` below.
const TYPES = [
  { value: "UNSAFE_ACT", label: "Unsafe Act" },
  { value: "UNSAFE_CONDITION", label: "Unsafe Condition" }
];
const LEGACY_SAFE_TYPES = [
  { value: "SAFE_ACT", label: "Safe Act (legacy)" },
  { value: "SAFE_CONDITION", label: "Safe Condition (legacy)" }
];
// Legacy hazard categories — the classification for SAFE observations only.
const CATEGORIES = [
  "PPE", "HOUSEKEEPING", "WORK_AT_HEIGHT", "HOT_WORK", "MOBILE_EQUIPMENT",
  "ELECTRICAL", "MATERIAL_HANDLING", "CONFINED_SPACE", "CHEMICAL_HANDLING",
  "EMERGENCY_PREP", "OTHERS"
];
// Severity options are no longer listed here — the ladder comes from the
// suggestion endpoint so the browser holds no copy of it to drift.

type Area = { id: string; name: string };

export function ObservationEditForm({
  observation,
  areas
}: {
  observation: {
    id: string;
    number: string;
    // Needed to resolve the area hazard tier for the severity suggestion.
    plantId: string;
    type: string;
    category: string;
    // Null on safe observations and on legacy at-risk rows the taxonomy
    // migration left for review — editing one is how a reviewer resolves it.
    categoryCode?: string | null;
    subCategoryCode?: string | null;
    severity: string;
    description: string;
    // Legacy structured area. Still shown when a record carries one so it can
    // be cleared, but never set on a new record — see `location`.
    areaId: string | null;
    location?: string | null;
    department?: string | null;
    targetDate: string | null;
  };
  areas: Area[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const back = `/observations/${observation.id}`;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState(observation.type);
  const [category, setCategory] = useState(observation.category);
  const [taxonomy, setTaxonomy] = useState<StopTaxonomyValue>({
    categoryCode: observation.categoryCode ?? "",
    subCategoryCode: observation.subCategoryCode ?? ""
  });
  const [severity, setSeverity] = useState(observation.severity);
  const [description, setDescription] = useState(observation.description);
  const [areaId, setAreaId] = useState(observation.areaId ?? "");
  const [location, setLocation] = useState(observation.location ?? "");
  const [department, setDepartment] = useState(observation.department ?? "");
  const [targetDate, setTargetDate] = useState(observation.targetDate ? observation.targetDate.slice(0, 10) : "");
  const [severityReason, setSeverityReason] = useState("");

  // Keep a safe type selectable only while the record still carries one, so
  // this form can render it and a reviewer can reclassify it to an at-risk
  // type — after which the option disappears and cannot be chosen again.
  const typeOptions = LEGACY_SAFE_TYPES.some((t) => t.value === observation.type)
    ? [...TYPES, ...LEGACY_SAFE_TYPES]
    : TYPES;

  // Same engine as the create form. `suppressInitialPrefill` is what keeps
  // opening this page from silently rewriting a severity somebody already
  // decided on — a reclassification here still re-prefills.
  const { suggestion: severitySuggestion, loading: severityLoading } = useSeveritySuggestion({
    observationType: type,
    categoryCode: taxonomy.categoryCode,
    subCategoryCode: taxonomy.subCategoryCode,
    plantId: observation.plantId,
    areaId,
    enabled: isAtRisk(type)
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!description.trim()) {
      setError("Describe what was observed.");
      return;
    }
    const atRisk = isAtRisk(type);
    // Category only. The sub-category is optional here for the same reason it
    // is on create — it refines the classification rather than completing it —
    // and clearing it on an existing record is a legitimate edit.
    if (atRisk && !taxonomy.categoryCode) {
      setError("Select a category for this observation type.");
      return;
    }
    // The server only demands a reason for a divergence it has not already
    // recorded against this record, so a reason typed here may turn out to be
    // unnecessary — it is sent regardless and simply ignored in that case.
    const suggested = severitySuggestion?.suggested;
    const minSeverityReason = severitySuggestion?.minOverrideReasonChars ?? 10;
    if (
      suggested &&
      severity !== suggested &&
      severity !== observation.severity &&
      severityReason.trim().length < minSeverityReason
    ) {
      setError(
        `Severity was changed from the suggested ${severityLabel(suggested)} — give a reason ` +
          `of at least ${minSeverityReason} characters explaining why this observation differs.`
      );
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/observations/${observation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          // An at-risk record's legacy `category` is derived server-side from
          // the STOP code; sending it too would just be ignored.
          ...(atRisk
            ? { categoryCode: taxonomy.categoryCode, subCategoryCode: taxonomy.subCategoryCode }
            : { category }),
          severity,
          ...(severityReason.trim() ? { severityOverrideReason: severityReason.trim() } : {}),
          description,
          areaId: areaId || null,
          location: location.trim() || null,
          department: department || null,
          targetDate: targetDate ? new Date(targetDate).toISOString() : null
        })
      });
      if (res.ok) {
        toast({ variant: "success", title: "Saved", description: `${observation.number} updated.` });
        router.push(back);
        router.refresh();
        return;
      }
      setError(await readApiError(res));
    } catch (err: any) {
      setError(err?.message ?? "Could not reach the server. Check your connection and retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <Card>
        <CardContent className="space-y-4 pt-6">
          {error && (
            <Alert variant="destructive" size="lg">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Type</Label>
              <SelectField
                value={type}
                onChange={setType}
                ariaLabel="Observation type"
                options={typeOptions.map((t) => ({ value: t.value, label: t.label }))}
              />
            </div>
            <StopTaxonomyFields
              type={type}
              value={taxonomy}
              onChange={setTaxonomy}
              safeCategorySlot={
                <div>
                  <Label>Category</Label>
                  <SelectField
                    value={category}
                    onChange={setCategory}
                    ariaLabel="Category"
                    options={CATEGORIES.map((c) => ({ value: c, label: c.replace(/_/g, " ") }))}
                  />
                </div>
              }
            />
            <div>
              <Label>Severity</Label>
              <SeveritySuggestionField
                value={severity}
                onChange={setSeverity}
                suggestion={severitySuggestion}
                loading={severityLoading}
                reason={severityReason}
                onReasonChange={setSeverityReason}
                suppressInitialPrefill
              />
            </div>
            <div>
              <Label>Location</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Where on site — line, machine, room or landmark"
              />
            </div>
            {/* Only for a record that predates the free-text Location field.
                Offered so a reviewer can clear a stale area, never so a new one
                can be attached — the dropdown is gone from the create form. */}
            {observation.areaId && (
              <div>
                <Label>Area (legacy)</Label>
                <SelectField
                  value={areaId}
                  onChange={setAreaId}
                  ariaLabel="Area"
                  placeholder="— None —"
                  options={areas.map((a) => ({ value: a.id, label: a.name }))}
                />
              </div>
            )}
            <div>
              <Label>Department</Label>
              <SelectField
                value={department}
                onChange={setDepartment}
                ariaLabel="Department"
                placeholder="— None —"
                options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
              />
            </div>
            <div>
              <Label>Target Date</Label>
              <DatePicker value={targetDate} onChange={setTargetDate} ariaLabel="Target date" />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.push(back)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {busy ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
