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
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
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
      </div>
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
        {err && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Name (required)</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fire Equipment Inspection" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Engagement type</label>
              <Select value={engagementType} onChange={(e) => setEngagementType(e.target.value)}>
                {ENGAGEMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Default recurrence</label>
              <Select value={defaultRecurrence} onChange={(e) => setDefaultRecurrence(e.target.value)}>
                <option value="">—</option>
                {["WEEKLY", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL"].map((f) => <option key={f} value={f}>{labelize(f)}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Default template</label>
            <Select value={defaultTemplateId} onChange={(e) => setDefaultTemplateId(e.target.value)}>
              <option value="">—</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.templateCode} · {t.name}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Standards</label>
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
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Required auditor competencies
            </label>
            {competencies.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                No competencies are defined in the Skill Matrix yet, so assignments cannot be
                checked against competence until at least one exists.
              </p>
            ) : (
              <div className="max-h-32 overflow-y-auto rounded-md border border-slate-200">
                {competencies.map((c) => {
                  const on = requiredCompetencies.includes(c.id);
                  return (
                    <button key={c.id} type="button"
                      onClick={() => setRequiredCompetencies((prev) => on ? prev.filter((x) => x !== c.id) : [...prev, c.id])}
                      className={cn("flex w-full items-center gap-2 border-b border-slate-100 px-2.5 py-1.5 text-left text-xs last:border-0 hover:bg-slate-50", on && "bg-primary-50/60")}>
                      <span className={cn("flex size-3.5 items-center justify-center rounded border text-[9px]",
                        on ? "border-primary-600 bg-primary-600 text-white" : "border-slate-300")} aria-hidden>
                        {on ? "\u2713" : ""}
                      </span>
                      <span className="text-slate-700">{c.name}</span>
                      <span className="ml-auto font-mono text-[10px] text-slate-400">{c.code}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {requiredCompetencies.length > 0 && (
              <div className="mt-1.5">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  When an auditor lacks one
                </label>
                <Select value={competenceEnforcement} onChange={(e) => setCompetenceEnforcement(e.target.value)}>
                  <option value="WARN">Warn - show the gap, allow the assignment</option>
                  <option value="BLOCK">Block - refuse the assignment</option>
                </Select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Warn is the safe default while the Skill Matrix is still being populated.
                </p>
              </div>
            )}
          </div>

          {/* F-22: the pass mark and critical gate were hard-coded platform-wide. */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Pass mark (%)</label>
              <Input type="number" min={0} max={100} value={minimumPassScore}
                onChange={(e) => setMinimumPassScore(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Critical failures allowed
              </label>
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
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Buyer-regime vocabulary
            </label>
            <Select value={regimeCode} onChange={(e) => setRegimeCode(e.target.value)}>
              <option value="">Native (critical / major / minor / observation)</option>
              {regimes.map((r) => (
                <option key={r.code} value={r.code}>{r.name} - {r.scoringStyle.toLowerCase()}</option>
              ))}
            </Select>
            <p className="mt-1 text-[11px] text-slate-400">
              Changes the severity and result labels auditors see. Regime structures are
              SafeOps-authored shapes, not the regime owner&rsquo;s licensed criteria.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-sm text-slate-600"><Checkbox checked={requiresAssetRef} onChange={(e) => setRequiresAssetRef(e.target.checked)} /> Requires asset / equipment ref</label>
            <label className="flex items-center gap-1.5 text-sm text-slate-600"><Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active</label>
          </div>
          <Button disabled={busy || !name.trim()} onClick={submit} className="w-full">
            {busy ? "Saving…" : record ? "Save changes" : "Create audit type"}
          </Button>
        </div>
      </div>
    </div>
  );
}
