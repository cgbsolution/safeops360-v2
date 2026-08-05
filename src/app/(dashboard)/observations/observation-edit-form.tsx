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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { readApiError } from "@/lib/client-errors";
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

const TYPES = [
  { value: "SAFE_ACT", label: "Safe Act" },
  { value: "UNSAFE_ACT", label: "Unsafe Act" },
  { value: "SAFE_CONDITION", label: "Safe Condition" },
  { value: "UNSAFE_CONDITION", label: "Unsafe Condition" }
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
    areaId: string | null;
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
  const [targetDate, setTargetDate] = useState(observation.targetDate ? observation.targetDate.slice(0, 10) : "");
  const [severityReason, setSeverityReason] = useState("");

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
    if (description.trim().length < 10) {
      setError("Description must be at least 10 characters.");
      return;
    }
    const atRisk = isAtRisk(type);
    if (atRisk && (!taxonomy.categoryCode || !taxonomy.subCategoryCode)) {
      setError("Select both a category and a sub-category for this observation type.");
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
            <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Type</Label>
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </div>
            <StopTaxonomyFields
              type={type}
              value={taxonomy}
              onChange={setTaxonomy}
              safeCategorySlot={
                <div>
                  <Label>Category</Label>
                  <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                  </Select>
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
              <Label>Area</Label>
              <Select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                <option value="">— None —</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>Target Date</Label>
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
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
