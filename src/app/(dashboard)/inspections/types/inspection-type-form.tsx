"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, GraduationCap, Save, Send } from "lucide-react";

const CATEGORIES = ["ROUTINE", "STATUTORY", "PRE_OPERATIONAL", "POST_INCIDENT", "CONDITION_BASED", "THIRD_PARTY", "FOCUSED"] as const;
const FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL"] as const;
const STATUTORY_FORM_TYPES = [
  "FORM_11_PRESSURE_VESSEL",
  "FORM_13_LIFTING_EQUIPMENT",
  "FORM_4_FACTORY_LICENSE",
  "PESO_CYLINDER_INSPECTION",
  "ELECTRICAL_INSPECTORATE",
  "POLLUTION_CONTROL_BOARD",
  "OTHER"
] as const;

const COMMON_EQUIPMENT_CATEGORIES = [
  "Process Critical",
  "Mobile Equipment",
  "Lifting Equipment",
  "Fire Safety",
  "Emergency",
  "Statutory",
  "Electrical",
  "Hand Tools"
];

type Props = {
  initial?: any;
  trainingPrograms: { code: string; name: string; isStatutory: boolean }[];
};

export function InspectionTypeForm({ initial, trainingPrograms }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "ROUTINE");
  const [defaultFrequency, setDefaultFrequency] = useState(initial?.defaultFrequency ?? "MONTHLY");
  const [applicableEquipmentCategories, setApplicableEquipmentCategories] = useState<string[]>(
    initial?.applicableEquipmentCategories ?? []
  );
  const [isStatutory, setIsStatutory] = useState(initial?.isStatutory ?? false);
  const [statutoryReference, setStatutoryReference] = useState(initial?.statutoryReference ?? "");
  const [regulatoryAuthority, setRegulatoryAuthority] = useState(initial?.regulatoryAuthority ?? "");
  const [statutoryFormType, setStatutoryFormType] = useState(initial?.statutoryFormType ?? "");
  const [retentionYears, setRetentionYears] = useState(initial?.retentionYears ?? 7);
  const [requiresCertifiedInspector, setRequiresCertifiedInspector] = useState(
    initial?.requiresCertifiedInspector ?? false
  );
  const [requiredCertificationCodes, setRequiredCertificationCodes] = useState<string[]>(
    initial?.requiredCertificationCodes ?? []
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  function toggleArr(v: string, setter: any, current: string[]) {
    if (current.includes(v)) setter(current.filter((x) => x !== v));
    else setter([...current, v]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!code.trim() || !name.trim()) {
      setError("Code and name are required.");
      return;
    }
    setSubmitting(true);
    const payload = {
      code: code.trim(),
      name: name.trim(),
      description: description.trim() || null,
      category,
      defaultFrequency,
      applicableEquipmentCategories,
      isStatutory,
      statutoryReference: isStatutory ? statutoryReference.trim() || null : null,
      regulatoryAuthority: isStatutory ? regulatoryAuthority.trim() || null : null,
      statutoryFormType: isStatutory ? statutoryFormType || null : null,
      retentionYears: Number(retentionYears) || 7,
      requiresCertifiedInspector,
      requiredCertificationCodes: requiresCertifiedInspector ? requiredCertificationCodes : [],
      isActive
    };
    const url = initial?.id
      ? `/api/inspection-types/${initial.id}`
      : "/api/inspection-types";
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
    router.push(`/inspections/types/${j.id ?? initial?.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identification</CardTitle>
          <CardDescription>Code is used as the stable key in equipment links and reports.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Code *</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, "_"))} placeholder="INSP_KILN_MONTHLY" />
          </div>
          <div>
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kiln — Monthly Mechanical Inspection" />
          </div>
          <div className="md:col-span-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
            </Select>
          </div>
          <div>
            <Label>Default Frequency</Label>
            <Select value={defaultFrequency} onChange={(e) => setDefaultFrequency(e.target.value)}>
              {FREQUENCIES.map((f) => <option key={f} value={f}>{f.replace(/_/g, " ")}</option>)}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Applicable Equipment Categories</CardTitle>
          <CardDescription>This type can be applied to equipment in these categories. Equipment with no overlap will not see this type as an option.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {COMMON_EQUIPMENT_CATEGORIES.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => toggleArr(c, setApplicableEquipmentCategories, applicableEquipmentCategories)}
                className={[
                  "px-3 py-1 rounded-full text-xs border",
                  applicableEquipmentCategories.includes(c)
                    ? "bg-primary-600 text-white border-primary-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                ].join(" ")}
              >
                {c}
              </button>
            ))}
          </div>
          {applicableEquipmentCategories.length === 0 && (
            <p className="text-xs text-amber-700 mt-2">No categories selected — this type will not be applicable to any equipment until you select at least one.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-rose-600" /> Statutory awareness
          </CardTitle>
          <CardDescription>Mark types that satisfy a regulatory requirement so that retention rules, regulatory form numbering, and inspector authentication are enforced.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isStatutory} onChange={(e) => setIsStatutory(e.target.checked)} />
            This is a statutory inspection
          </label>
          {isStatutory && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 border-rose-200">
              <div>
                <Label>Statutory reference</Label>
                <Input value={statutoryReference} onChange={(e) => setStatutoryReference(e.target.value)} placeholder="Factories Act 1948 / Form 11" />
              </div>
              <div>
                <Label>Regulatory authority</Label>
                <Input value={regulatoryAuthority} onChange={(e) => setRegulatoryAuthority(e.target.value)} placeholder="Chief Inspector of Factories" />
              </div>
              <div>
                <Label>Statutory form type</Label>
                <Select value={statutoryFormType} onChange={(e) => setStatutoryFormType(e.target.value)}>
                  <option value="">— Select —</option>
                  {STATUTORY_FORM_TYPES.map((f) => <option key={f} value={f}>{f.replace(/_/g, " ")}</option>)}
                </Select>
              </div>
              <div>
                <Label>Record retention (years)</Label>
                <Input type="number" min={1} max={30} value={retentionYears} onChange={(e) => setRetentionYears(Number(e.target.value))} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap size={18} className="text-amber-600" /> Inspector competency gate
          </CardTitle>
          <CardDescription>Restrict who can execute this inspection based on training program certification.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={requiresCertifiedInspector} onChange={(e) => setRequiresCertifiedInspector(e.target.checked)} />
            Inspector must hold required training certification(s)
          </label>
          {requiresCertifiedInspector && (
            <div className="pl-6 border-l-2 border-amber-200">
              <Label>Required certifications (program codes)</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {trainingPrograms.length === 0 && (
                  <p className="text-xs text-slate-500">No training programs found. Create one in Training → Programs first.</p>
                )}
                {trainingPrograms.map((p) => (
                  <button
                    type="button"
                    key={p.code}
                    onClick={() => toggleArr(p.code, setRequiredCertificationCodes, requiredCertificationCodes)}
                    className={[
                      "px-3 py-1 rounded-full text-xs border flex items-center gap-1",
                      requiredCertificationCodes.includes(p.code)
                        ? "bg-amber-600 text-white border-amber-600"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    ].join(" ")}
                  >
                    {p.isStatutory && <ShieldAlert size={10} />}
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active — available for new equipment links and schedule generation
          </label>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">{error}</div>
      )}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={submitting}>
          <Save size={16} /> {submitting ? "Saving…" : initial?.id ? "Save changes" : "Create type"}
        </Button>
      </div>
    </form>
  );
}
