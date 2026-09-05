"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ENGAGEMENT_TYPES, STANDARDS, ENGAGEMENT_TYPE_CHIP, engagementTypeLabel, labelize, type AuditType, type Template } from "../../lib-cams";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

// WP-49: the audit type is the configuration home. Everything below was either a
// hard-coded module constant or an empty array before this screen could set it.
type Competency = { id: string; code: string; name: string; category?: string };
type Regime = { code: string; name: string; scoringStyle: string };

export function AuditTypesAdmin({
  initial, templates, canConfig, competencies = [], regimes = [],
}: {
  initial: AuditType[]; templates: Template[]; canConfig: boolean;
  competencies?: Competency[]; regimes?: Regime[];
}) {
  const [editing, setEditing] = useState<AuditType | "new" | null>(null);

  return (
    <div>
      {canConfig && (
        <div className="mb-3 flex justify-end">
          <Button onClick={() => setEditing("new")} className="inline-flex items-center gap-1.5">
            <Plus size={16} /> New Audit Type
          </Button>
        </div>
      )}
      <Card className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-none">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Engagement type</TableHead>
              <TableHead>Default template</TableHead>
              <TableHead>Standards</TableHead>
              <TableHead className="text-center">Asset?</TableHead>
              <TableHead className="text-center">Engagements</TableHead>
              <TableHead>Active</TableHead>
              {canConfig && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {initial.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="py-10 text-center text-slate-400">No audit types defined yet.</TableCell></TableRow>
            ) : (
              initial.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.typeCode}</TableCell>
                  <TableCell>{t.name}</TableCell>
                  <TableCell><span className={"rounded border px-2 py-0.5 text-[11px] " + (ENGAGEMENT_TYPE_CHIP[t.engagementType] ?? "")}>{engagementTypeLabel(t.engagementType)}</span></TableCell>
                  <TableCell className="text-xs text-slate-600">{t.defaultTemplateName ?? "—"}</TableCell>
                  <TableCell className="text-xs text-slate-600">{t.standardRefs.map((s) => s.replace("_", " ")).join(", ") || "—"}</TableCell>
                  <TableCell className="text-center text-xs">{t.requiresAssetRef ? "Yes" : "—"}</TableCell>
                  <TableCell className="text-center tabular-nums text-slate-600">{t.engagementCount}</TableCell>
                  <TableCell>{t.isActive ? <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">Active</span> : <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">Retired</span>}</TableCell>
                  {canConfig && <TableCell><Button type="button" variant="ghost" size="icon" onClick={() => setEditing(t)} className="h-auto w-auto text-slate-400 hover:text-primary-700"><Pencil size={14} /></Button></TableCell>}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
      {editing && <AuditTypeModal record={editing === "new" ? null : editing} templates={templates} competencies={competencies} regimes={regimes} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AuditTypeModal({
  record, templates, competencies, regimes, onClose,
}: {
  record: AuditType | null; templates: Template[];
  competencies: Competency[]; regimes: Regime[]; onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState(record?.name ?? "");
  const [engagementType, setEngagementType] = useState(record?.engagementType ?? "INTERNAL_AUDIT");
  const [defaultTemplateId, setDefaultTemplateId] = useState(record?.defaultTemplateId ?? "");
  const [defaultRecurrence, setDefaultRecurrence] = useState(record?.defaultRecurrence ?? "");
  const [requiresAssetRef, setRequiresAssetRef] = useState(record?.requiresAssetRef ?? false);
  const [standardRefs, setStandardRefs] = useState<string[]>(record?.standardRefs ?? []);
  const [isActive, setIsActive] = useState(record?.isActive ?? true);
  // WP-36 shipped BUILT AND INERT because this array was hard-coded to [] below.
  const [requiredCompetencies, setRequiredCompetencies] = useState<string[]>(
    record?.requiresAuditorCompetency ?? [],
  );
  const [competenceEnforcement, setCompetenceEnforcement] = useState(
    record?.competenceEnforcement ?? "WARN",
  );
  const [regimeCode, setRegimeCode] = useState(record?.regimeCode ?? "");
  // F-22: MINIMUM_PASS_SCORE was a module constant applied to every audit type.
  const [minimumPassScore, setMinimumPassScore] = useState(
    String(record?.scoringRules?.minimumPassScore ?? 80),
  );
  const [criticalGate, setCriticalGate] = useState(
    String(record?.scoringRules?.criticalGateThreshold ?? 0),
  );

  async function submit() {
    if (!name.trim()) { setErr("Name is required."); return; }
    setBusy(true); setErr(null);
    const body = {
      name: name.trim(), engagementType, defaultTemplateId: defaultTemplateId || null,
      defaultRecurrence: defaultRecurrence || null, requiresAssetRef,
      requiresAuditorCompetency: requiredCompetencies,
      competenceEnforcement,
      regimeCode: regimeCode || null,
      scoringRules: {
        minimumPassScore: Number(minimumPassScore) || 80,
        criticalGateThreshold: Number(criticalGate) || 0,
      },
      standardRefs, isActive,
    };
    const url = record ? `/api/cams/audit-types/${record.id}` : "/api/cams/audit-types";
    const res = await fetch(url, { method: record ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.detail || j.error || `Failed (${res.status})`); return; }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{record ? "Edit Audit Type" : "New Audit Type"}</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="h-auto w-auto text-slate-400 hover:text-slate-700"><X size={18} /></Button>
        </div>
        {err && <Alert variant="destructive" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</Alert>}
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Name (required)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fire Equipment Inspection" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">Engagement type</Label>
              <SelectField value={engagementType} onChange={setEngagementType}
                options={ENGAGEMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">Default recurrence</Label>
              <SelectField value={defaultRecurrence} onChange={setDefaultRecurrence}
                placeholder="—"
                options={["WEEKLY", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL"].map((f) => ({ value: f, label: labelize(f) }))}
              />
            </div>
          </div>
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Default template</Label>
            <SelectField value={defaultTemplateId} onChange={setDefaultTemplateId}
              placeholder="—"
              options={templates.map((t) => ({ value: t.id, label: `${t.templateCode} · ${t.name}` }))}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Standards</Label>
            <div className="flex flex-wrap gap-2">
              {STANDARDS.map((s) => (
                <Button key={s} type="button" variant="ghost" onClick={() => setStandardRefs((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s])}
                  className={cn("h-auto rounded-full border px-2.5 py-1 text-xs", standardRefs.includes(s) ? "border-primary-700 bg-primary-50 text-primary-700" : "border-slate-200 bg-white text-slate-600")}>
                  {s.replace("_", " ")}
                </Button>
              ))}
            </div>
          </div>
          {/* WP-36: required auditor competencies. Until this control existed the
              competence check ran against an empty list and cleared everyone. */}
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">
              Required auditor competencies
            </Label>
            {competencies.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                No competencies are defined in the Skill Matrix yet, so assignments cannot be
                checked against competence until at least one exists.
              </p>
            ) : (
              <Card className="max-h-32 overflow-y-auto rounded-md border border-slate-200 shadow-none">
                {competencies.map((c) => {
                  const on = requiredCompetencies.includes(c.id);
                  return (
                    <Button key={c.id} type="button" variant="ghost" aria-pressed={on}
                      onClick={() => setRequiredCompetencies((prev) => on ? prev.filter((x) => x !== c.id) : [...prev, c.id])}
                      className={cn("h-auto w-full justify-start gap-2 rounded-none border-b border-slate-100 px-2.5 py-1.5 text-left text-xs last:border-0", on && "bg-primary-50/60")}>
                      <span className={cn("flex size-3.5 items-center justify-center rounded border text-[9px]",
                        on ? "border-primary-600 bg-primary-600 text-white" : "border-slate-300")} aria-hidden>
                        {on ? "\u2713" : ""}
                      </span>
                      <span className="text-slate-700">{c.name}</span>
                      <span className="ml-auto font-mono text-[10px] text-slate-400">{c.code}</span>
                    </Button>
                  );
                })}
              </Card>
            )}
            {requiredCompetencies.length > 0 && (
              <div className="mt-1.5">
                <Label className="mb-1 block text-xs font-medium text-slate-600">
                  When an auditor lacks one
                </Label>
                <SelectField value={competenceEnforcement} onChange={setCompetenceEnforcement}
                  options={[
                  { value: "WARN", label: "Warn - show the gap, allow the assignment" },
                  { value: "BLOCK", label: "Block - refuse the assignment" }
                ]}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Warn is the safe default while the Skill Matrix is still being populated.
                </p>
              </div>
            )}
          </div>

          {/* F-22: the pass mark and critical gate were hard-coded platform-wide. */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">Pass mark (%)</Label>
              <Input type="number" min={0} max={100} value={minimumPassScore}
                onChange={(e) => setMinimumPassScore(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">
                Critical failures allowed
              </Label>
              <Input type="number" min={0} value={criticalGate}
                onChange={(e) => setCriticalGate(e.target.value)} />
            </div>
            <p className="col-span-2 -mt-1 text-[11px] text-slate-400">
              A critical failure fails the audit regardless of the percentage. The rule is printed
              on the result, so a 99.5% FAIL explains itself.
            </p>
          </div>

          {/* WP-47: buyer-regime vocabulary. */}
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">
              Buyer-regime vocabulary
            </Label>
            <SelectField value={regimeCode} onChange={setRegimeCode}
              placeholder="Native (critical / major / minor / observation)"
              options={regimes.map((r) => ({ value: r.code, label: `${r.name} - ${r.scoringStyle.toLowerCase()}` }))}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Changes the severity and result labels auditors see. Regime structures are
              SafeOps-authored shapes, not the regime owner&rsquo;s licensed criteria.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Label className="flex items-center gap-1.5 text-sm text-slate-600"><Checkbox checked={requiresAssetRef} onChange={(e) => setRequiresAssetRef(e.target.checked)} /> Requires asset / equipment ref</Label>
            <Label className="flex items-center gap-1.5 text-sm text-slate-600"><Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active</Label>
          </div>
          <Button disabled={busy || !name.trim()} onClick={submit} className="w-full">
            {busy ? "Saving…" : record ? "Save changes" : "Create audit type"}
          </Button>
        </div>
      </div>
    </div>
  );
}
