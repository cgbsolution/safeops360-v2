"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { UserPicker } from "@/components/ui/user-picker";
import { ENGAGEMENT_TYPES, STANDARDS, type AuditType, type Template } from "../lib-cams";

type Props = {
  auditTypes: AuditType[];
  templates: Template[];
  plants: { id: string; name: string; code: string }[];
};

export function ScheduleEngagementButton({ auditTypes, templates, plants }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800">
        <Plus size={16} /> Schedule Audit
      </button>
      {open && <ScheduleModal auditTypes={auditTypes} templates={templates} plants={plants} onClose={() => setOpen(false)} />}
    </>
  );
}

function ScheduleModal({ auditTypes, templates, plants, onClose }: Props & { onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [engagementType, setEngagementType] = useState("INTERNAL_AUDIT");
  const [auditTypeId, setAuditTypeId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [leadAuditorId, setLeadAuditorId] = useState<string | null>(null);
  const [auditeeOwnerId, setAuditeeOwnerId] = useState<string | null>(null);
  const [plannedDate, setPlannedDate] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [standardRefs, setStandardRefs] = useState<string[]>([]);
  const [scopeStatement, setScopeStatement] = useState("");

  // Templates applicable to the chosen engagement type.
  const applicableTemplates = useMemo(
    () => templates.filter((t) => t.applicableEngagementTypes.length === 0 || t.applicableEngagementTypes.includes(engagementType)),
    [templates, engagementType]
  );

  function onPickAuditType(id: string) {
    setAuditTypeId(id);
    const at = auditTypes.find((a) => a.id === id);
    if (at) {
      setEngagementType(at.engagementType);
      if (at.standardRefs?.length) setStandardRefs(at.standardRefs);
      if (at.defaultTemplateId) setTemplateId(at.defaultTemplateId);
    }
  }

  async function submit() {
    if (!title.trim() || !leadAuditorId || !plannedDate) {
      setErr("Title, lead auditor and planned date are required.");
      return;
    }
    setBusy(true);
    setErr(null);
    const body = {
      title: title.trim(),
      engagementType,
      auditTypeId: auditTypeId || null,
      standardRefs,
      siteId: siteId || null,
      scopeStatement: scopeStatement.trim(),
      leadAuditorId,
      auditeeOwnerId: auditeeOwnerId || null,
      plannedDate: new Date(plannedDate).toISOString(),
      scheduledStart: new Date(plannedDate).toISOString(),
      templateId: templateId || null,
    };
    const res = await fetch("/api/cams/engagements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.detail || j.error || `Failed (${res.status})`);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Schedule Audit / Inspection</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        {err && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}

        <div className="space-y-3">
          <Field label="Title (required)">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm" placeholder="e.g. Internal HSE System Audit — North Works" />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Audit type">
              <select value={auditTypeId} onChange={(e) => onPickAuditType(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm">
                <option value="">— none / ad-hoc —</option>
                {auditTypes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <Field label="Engagement type">
              <select value={engagementType} onChange={(e) => setEngagementType(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm">
                {ENGAGEMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Site">
              <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm">
                <option value="">— corporate / unspecified —</option>
                {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Planned date (required)">
              <input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
            </Field>
          </div>

          <Field label="Template (approved)">
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm">
              <option value="">— select at execution —</option>
              {applicableTemplates.map((t) => <option key={t.id} value={t.id}>{t.templateCode} · {t.name} (v{t.version})</option>)}
            </select>
          </Field>

          <Field label="Standards">
            <div className="flex flex-wrap gap-2">
              {STANDARDS.map((s) => {
                const on = standardRefs.includes(s);
                return (
                  <button key={s} type="button" onClick={() => setStandardRefs((prev) => on ? prev.filter((x) => x !== s) : [...prev, s])}
                    className={"rounded-full border px-3 py-1 text-xs " + (on ? "border-primary-700 bg-primary-50 text-primary-700" : "border-slate-200 bg-white text-slate-600")}>
                    {s.replace("_", " ")}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Lead auditor (required)">
              <UserPicker value={leadAuditorId} onChange={setLeadAuditorId} placeholder="Search lead auditor" required />
            </Field>
            <Field label="Auditee / area owner">
              <UserPicker value={auditeeOwnerId} onChange={setAuditeeOwnerId} placeholder="Search auditee owner" />
            </Field>
          </div>

          <Field label="Scope statement">
            <textarea value={scopeStatement} onChange={(e) => setScopeStatement(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 p-2 text-sm" placeholder="What this engagement covers…" />
          </Field>

          <button disabled={busy || !title.trim() || !leadAuditorId || !plannedDate} onClick={submit}
            className="w-full rounded-lg bg-primary-700 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50">
            {busy ? "Scheduling…" : "Schedule engagement"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}
