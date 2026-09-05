"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, Save, AlertCircle, Camera, MessageSquare, Star, ChevronUp, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";

const ITEM_TYPES = [
  { value: "PASS_FAIL", label: "Pass / Fail" },
  { value: "NUMERIC", label: "Numeric (with thresholds)" },
  { value: "MEASUREMENT", label: "Measurement (with units & thresholds)" },
  { value: "SELECT", label: "Select (single choice)" },
  { value: "TEXT", label: "Free text" },
  { value: "PHOTO", label: "Photo capture" },
  { value: "SIGNATURE", label: "Signature" },
  { value: "CHECKBOX", label: "Checkbox (Y/N)" },
  { value: "SECTION_HEADER", label: "Section header (no input)" }
] as const;

type Item = {
  id?: string;
  sequence: number;
  sectionTitle?: string;
  itemText: string;
  itemType: string;
  options?: string; // JSON for SELECT
  units?: string;
  minValue?: string;
  maxValue?: string;
  expectedValue?: string;
  isCritical: boolean;
  requiresPhoto: boolean;
  requiresComment: boolean;
  guidanceText?: string;
};

type Props = {
  initial?: any;
  inspectionTypes: { id: string; code: string; name: string; isStatutory: boolean }[];
  preselectedTypeId?: string;
};

export function ChecklistBuilder({ initial, inspectionTypes, preselectedTypeId }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [inspectionTypeId, setInspectionTypeId] = useState(initial?.inspectionTypeId ?? preselectedTypeId ?? inspectionTypes[0]?.id ?? "");
  const [version, setVersion] = useState(initial?.version ?? 1);
  const [applicableEquipmentCategories, setApplicableEquipmentCategories] = useState<string[]>(initial?.applicableEquipmentCategories ?? []);

  const [items, setItems] = useState<Item[]>(
    initial?.items?.map((i: any, idx: number) => ({
      id: i.id,
      sequence: i.sequence ?? idx + 1,
      sectionTitle: i.sectionTitle ?? "",
      itemText: i.itemText,
      itemType: i.itemType,
      options: i.options ? JSON.stringify(i.options) : "",
      units: i.units ?? "",
      minValue: i.minValue?.toString() ?? "",
      maxValue: i.maxValue?.toString() ?? "",
      expectedValue: i.expectedValue ?? "",
      isCritical: !!i.isCritical,
      requiresPhoto: !!i.requiresPhoto,
      requiresComment: !!i.requiresComment,
      guidanceText: i.guidanceText ?? ""
    })) ?? []
  );

  const criticalCount = useMemo(() => items.filter((i) => i.isCritical).length, [items]);

  function addItem() {
    setItems([...items, {
      sequence: items.length + 1,
      itemText: "",
      itemType: "PASS_FAIL",
      isCritical: false,
      requiresPhoto: false,
      requiresComment: false
    }]);
  }

  function addSection() {
    setItems([...items, {
      sequence: items.length + 1,
      itemText: "Section Title",
      itemType: "SECTION_HEADER",
      isCritical: false,
      requiresPhoto: false,
      requiresComment: false
    }]);
  }

  function updateItem(idx: number, patch: Partial<Item>) {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    setItems(next);
  }

  function removeItem(idx: number) {
    const next = items.filter((_, i) => i !== idx);
    setItems(next.map((it, i) => ({ ...it, sequence: i + 1 })));
  }

  function moveItem(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    setItems(next.map((it, i) => ({ ...it, sequence: i + 1 })));
  }

  async function onSubmit(saveAs: "DRAFT" | "UNDER_REVIEW") {
    setError("");
    if (!code.trim() || !name.trim() || !inspectionTypeId) {
      setError("Code, name, and inspection type are required.");
      return;
    }
    if (items.length === 0) {
      setError("At least one checklist item is required.");
      return;
    }
    for (const it of items) {
      if (!it.itemText.trim()) {
        setError(`Item #${it.sequence} has no text.`);
        return;
      }
      if (it.itemType === "SELECT" && !it.options?.trim()) {
        setError(`Item #${it.sequence} (SELECT) has no options.`);
        return;
      }
    }
    setSubmitting(true);
    const payload = {
      code: code.trim(),
      name: name.trim(),
      description: description.trim() || null,
      inspectionTypeId,
      version: Number(version) || 1,
      applicableEquipmentCategories,
      approvalStatus: saveAs,
      items: items.map((it) => ({
        sequence: it.sequence,
        sectionTitle: it.sectionTitle?.trim() || null,
        itemText: it.itemText.trim(),
        itemType: it.itemType,
        options: it.options ? safeJson(it.options) : null,
        units: it.units?.trim() || null,
        minValue: it.minValue ? Number(it.minValue) : null,
        maxValue: it.maxValue ? Number(it.maxValue) : null,
        expectedValue: it.expectedValue?.trim() || null,
        isCritical: it.isCritical,
        requiresPhoto: it.requiresPhoto,
        requiresComment: it.requiresComment,
        guidanceText: it.guidanceText?.trim() || null
      }))
    };
    const url = initial?.id ? `/api/checklist-templates/${initial.id}` : "/api/checklist-templates";
    const method = initial?.id ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? `Save failed (${res.status}).`);
      return;
    }
    const j = await res.json();
    router.push(`/inspections/checklists/${j.id ?? initial?.id}`);
    router.refresh();
  }

  function safeJson(s: string) {
    try {
      const v = JSON.parse(s);
      return v;
    } catch {
      // Treat as comma-separated list
      return s.split(",").map((x) => ({ value: x.trim(), label: x.trim() }));
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Template Header</CardTitle>
          <CardDescription>Code is stable across versions; bump version when content changes.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Code *</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, "_"))} placeholder="CL_KILN_MONTHLY" />
          </div>
          <div>
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Inspection Type *</Label>
            <SelectField value={inspectionTypeId} onChange={setInspectionTypeId}
              placeholder="— Create an inspection type first —"
              options={inspectionTypes.map((t) => ({ value: String(t.id), label: `${t.isStatutory ? "★ " : ""}${t.name} (${t.code})` }))}
            />
          </div>
          <div>
            <Label>Version</Label>
            <Input type="number" min={1} value={version} onChange={(e) => setVersion(Number(e.target.value))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Checklist Items ({items.length})</span>
            <div className="flex gap-2 text-xs">
              {criticalCount > 0 && (
                <Badge className="bg-rose-50 text-rose-700 border-rose-200">
                  <AlertCircle size={10} /> {criticalCount} critical
                </Badge>
              )}
            </div>
          </CardTitle>
          <CardDescription>
            Critical items, when failed, raise a critical Finding that cascades to PTW gating, observation creation, and Plant Head notification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 && (
            <div className="text-center py-8 text-sm text-slate-500">No items yet.</div>
          )}
          {items.map((it, idx) => (
            <ItemEditor
              key={idx}
              item={it}
              idx={idx}
              total={items.length}
              onChange={(p) => updateItem(idx, p)}
              onRemove={() => removeItem(idx)}
              onMove={(d) => moveItem(idx, d)}
            />
          ))}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={addItem}>
              <Plus size={14} /> Add item
            </Button>
            <Button type="button" variant="ghost" onClick={addSection}>
              <Plus size={14} /> Add section header
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="rounded border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">{error}</Alert>
      )}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button type="button" variant="ghost" onClick={() => onSubmit("DRAFT")} disabled={submitting}>
          <Save size={16} /> Save draft
        </Button>
        <Button type="button" onClick={() => onSubmit("UNDER_REVIEW")} disabled={submitting}>
          Submit for approval
        </Button>
      </div>
    </div>
  );
}

function ItemEditor({
  item, idx, total, onChange, onRemove, onMove
}: {
  item: Item;
  idx: number;
  total: number;
  onChange: (p: Partial<Item>) => void;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
}) {
  const isSection = item.itemType === "SECTION_HEADER";
  const showThresholds = item.itemType === "NUMERIC" || item.itemType === "MEASUREMENT";
  const showOptions = item.itemType === "SELECT";

  return (
    <div className={["border rounded-md p-3", isSection ? "bg-slate-50 border-slate-300" : "border-slate-200"].join(" ")}>
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1 mt-1">
          <Button type="button" variant="ghost" size="icon" onClick={() => onMove(-1)} disabled={idx === 0}
            aria-label="Move item up" title="Move item up"
            className="h-auto w-auto p-0 text-slate-400 hover:bg-transparent hover:text-slate-700">
            <ChevronUp size={14} />
          </Button>
          <span className="text-xs font-mono text-slate-400 text-center">{item.sequence}</span>
          <Button type="button" variant="ghost" size="icon" onClick={() => onMove(1)} disabled={idx === total - 1}
            aria-label="Move item down" title="Move item down"
            className="h-auto w-auto p-0 text-slate-400 hover:bg-transparent hover:text-slate-700">
            <ChevronDown size={14} />
          </Button>
        </div>
        <div className="flex-1 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className={isSection ? "md:col-span-3" : "md:col-span-2"}>
              <Input
                value={item.itemText}
                onChange={(e) => onChange({ itemText: e.target.value })}
                placeholder={isSection ? "Section title" : "Check item description"}
                className={isSection ? "font-semibold text-base" : ""}
              />
            </div>
            {!isSection && (
              <div>
                <SelectField value={item.itemType} onChange={(value) => onChange({ itemType: value })}
                  options={ITEM_TYPES.map((t) => ({ value: String(t.value), label: t.label }))}
                />
              </div>
            )}
          </div>

          {showThresholds && (
            <div className="grid grid-cols-3 gap-2 pl-4 border-l-2 border-blue-200">
              <div>
                <Label className="text-xs">Min</Label>
                <Input type="number" step="any" value={item.minValue ?? ""} onChange={(e) => onChange({ minValue: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Max</Label>
                <Input type="number" step="any" value={item.maxValue ?? ""} onChange={(e) => onChange({ maxValue: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Units</Label>
                <Input value={item.units ?? ""} onChange={(e) => onChange({ units: e.target.value })} placeholder="bar, °C, mm…" />
              </div>
            </div>
          )}

          {showOptions && (
            <div className="pl-4 border-l-2 border-violet-200">
              <Label className="text-xs">Options (comma-separated or JSON)</Label>
              <Input
                value={item.options ?? ""}
                onChange={(e) => onChange({ options: e.target.value })}
                placeholder="Excellent, Good, Marginal, Poor"
              />
            </div>
          )}

          {!isSection && (
            <>
              <div>
                <Input value={item.expectedValue ?? ""} onChange={(e) => onChange({ expectedValue: e.target.value })} placeholder="Expected value (display hint, optional)" />
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                <Label className="flex items-center gap-1 cursor-pointer">
                  <Checkbox checked={item.isCritical} onChange={(e) => onChange({ isCritical: e.target.checked })} />
                  <Star size={10} className={item.isCritical ? "text-rose-600 fill-rose-600" : "text-slate-300"} />
                  Critical
                </Label>
                <Label className="flex items-center gap-1 cursor-pointer">
                  <Checkbox checked={item.requiresPhoto} onChange={(e) => onChange({ requiresPhoto: e.target.checked })} />
                  <Camera size={10} /> Photo required
                </Label>
                <Label className="flex items-center gap-1 cursor-pointer">
                  <Checkbox checked={item.requiresComment} onChange={(e) => onChange({ requiresComment: e.target.checked })} />
                  <MessageSquare size={10} /> Comment required
                </Label>
              </div>
              <details className="text-xs">
                <summary className="text-slate-500 cursor-pointer">Add guidance text</summary>
                <Textarea
                  value={item.guidanceText ?? ""}
                  onChange={(e) => onChange({ guidanceText: e.target.value })}
                  rows={2}
                  className="mt-1"
                  placeholder="What the inspector should check, common pitfalls, photos to capture…"
                />
              </details>
            </>
          )}
        </div>
        <Button variant="ghost" type="button" onClick={onRemove} className="mt-1" title="Remove">
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}
