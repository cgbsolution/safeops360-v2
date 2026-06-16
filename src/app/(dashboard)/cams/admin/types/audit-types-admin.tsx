"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Pencil } from "lucide-react";
import { ENGAGEMENT_TYPES, STANDARDS, ENGAGEMENT_TYPE_CHIP, engagementTypeLabel, labelize, type AuditType, type Template } from "../../lib-cams";

export function AuditTypesAdmin({ initial, templates, canConfig }: { initial: AuditType[]; templates: Template[]; canConfig: boolean }) {
  const [editing, setEditing] = useState<AuditType | "new" | null>(null);

  return (
    <div>
      {canConfig && (
        <div className="mb-3 flex justify-end">
          <button onClick={() => setEditing("new")} className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800">
            <Plus size={16} /> New Audit Type
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50/95">
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2.5">Code</th>
              <th className="px-3 py-2.5">Name</th>
              <th className="px-3 py-2.5">Engagement type</th>
              <th className="px-3 py-2.5">Default template</th>
              <th className="px-3 py-2.5">Standards</th>
              <th className="px-3 py-2.5 text-center">Asset?</th>
              <th className="px-3 py-2.5 text-center">Engagements</th>
              <th className="px-3 py-2.5">Active</th>
              {canConfig && <th className="px-3 py-2.5"></th>}
            </tr>
          </thead>
          <tbody>
            {initial.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-sm text-slate-400">No audit types defined yet.</td></tr>
            ) : (
              initial.map((t) => (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <td className="px-3 py-2.5 font-medium text-slate-700">{t.typeCode}</td>
                  <td className="px-3 py-2.5 text-slate-700">{t.name}</td>
                  <td className="px-3 py-2.5"><span className={"rounded border px-2 py-0.5 text-[11px] " + (ENGAGEMENT_TYPE_CHIP[t.engagementType] ?? "")}>{engagementTypeLabel(t.engagementType)}</span></td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">{t.defaultTemplateName ?? "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">{t.standardRefs.map((s) => s.replace("_", " ")).join(", ") || "—"}</td>
                  <td className="px-3 py-2.5 text-center text-xs">{t.requiresAssetRef ? "Yes" : "—"}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-slate-600">{t.engagementCount}</td>
                  <td className="px-3 py-2.5">{t.isActive ? <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">Active</span> : <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">Retired</span>}</td>
                  {canConfig && <td className="px-3 py-2.5"><button onClick={() => setEditing(t)} className="text-slate-400 hover:text-primary-700"><Pencil size={14} /></button></td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {editing && <AuditTypeModal record={editing === "new" ? null : editing} templates={templates} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AuditTypeModal({ record, templates, onClose }: { record: AuditType | null; templates: Template[]; onClose: () => void }) {
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

  async function submit() {
    if (!name.trim()) { setErr("Name is required."); return; }
    setBusy(true); setErr(null);
    const body = {
      name: name.trim(), engagementType, defaultTemplateId: defaultTemplateId || null,
      defaultRecurrence: defaultRecurrence || null, requiresAssetRef, requiresAuditorCompetency: [],
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        {err && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Name (required)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm" placeholder="e.g. Fire Equipment Inspection" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Engagement type</label>
              <select value={engagementType} onChange={(e) => setEngagementType(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm">
                {ENGAGEMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Default recurrence</label>
              <select value={defaultRecurrence} onChange={(e) => setDefaultRecurrence(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm">
                <option value="">—</option>
                {["WEEKLY", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL"].map((f) => <option key={f} value={f}>{labelize(f)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Default template</label>
            <select value={defaultTemplateId} onChange={(e) => setDefaultTemplateId(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm">
              <option value="">—</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.templateCode} · {t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Standards</label>
            <div className="flex flex-wrap gap-2">
              {STANDARDS.map((s) => (
                <button key={s} type="button" onClick={() => setStandardRefs((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s])}
                  className={"rounded-full border px-2.5 py-1 text-xs " + (standardRefs.includes(s) ? "border-primary-700 bg-primary-50 text-primary-700" : "border-slate-200 bg-white text-slate-600")}>
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" checked={requiresAssetRef} onChange={(e) => setRequiresAssetRef(e.target.checked)} /> Requires asset / equipment ref</label>
            <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active</label>
          </div>
          <button disabled={busy || !name.trim()} onClick={submit} className="w-full rounded-lg bg-primary-700 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50">
            {busy ? "Saving…" : record ? "Save changes" : "Create audit type"}
          </button>
        </div>
      </div>
    </div>
  );
}
