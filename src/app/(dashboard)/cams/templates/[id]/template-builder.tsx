"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, GripVertical, Save, Send, CheckCircle2, Copy, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { QUESTION_TYPES, TEMPLATE_STATUS_CHIP, labelize, type TemplateDetail, type ClauseRef } from "../../lib-cams";

type Qn = {
  id?: string; orderIndex: number; text: string; questionType: string; isMandatory: boolean;
  standardClauseRef?: string | null; guidance?: string | null; weight?: number | null;
  ncTriggersFinding: boolean; evidenceRequiredOnNc: boolean; options?: string[] | null;
};
type Sec = { id?: string; orderIndex: number; title: string; weightPct?: number | null; questions: Qn[] };

function newQuestion(i: number): Qn {
  return { orderIndex: i, text: "", questionType: "CONFORM_NC_NA", isMandatory: true, ncTriggersFinding: true, evidenceRequiredOnNc: false };
}

export function TemplateBuilder({ template, clauses, perms }: { template: TemplateDetail; clauses: ClauseRef[]; perms: { author: boolean; approve: boolean } }) {
  const router = useRouter();
  const [sections, setSections] = useState<Sec[]>(
    template.sections.map((s) => ({
      id: s.id, orderIndex: s.orderIndex, title: s.title, weightPct: s.weightPct,
      questions: s.questions.map((q) => ({ ...q })),
    }))
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const editable = perms.author && (template.status === "DRAFT" || template.status === "IN_REVIEW");

  function update<T>(setter: (v: T) => void, v: T) { setMsg(null); setErr(null); setter(v); }

  function addSection() {
    update(setSections, [...sections, { orderIndex: sections.length, title: `Section ${sections.length + 1}`, questions: [newQuestion(0)] }]);
  }
  function patchSection(si: number, patch: Partial<Sec>) {
    update(setSections, sections.map((s, i) => (i === si ? { ...s, ...patch } : s)));
  }
  function removeSection(si: number) { update(setSections, sections.filter((_, i) => i !== si)); }
  function addQuestion(si: number) {
    patchSection(si, { questions: [...sections[si].questions, newQuestion(sections[si].questions.length)] });
  }
  function patchQuestion(si: number, qi: number, patch: Partial<Qn>) {
    patchSection(si, { questions: sections[si].questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)) });
  }
  function removeQuestion(si: number, qi: number) {
    patchSection(si, { questions: sections[si].questions.filter((_, i) => i !== qi) });
  }

  async function save() {
    setBusy("save"); setErr(null); setMsg(null);
    const body = {
      sections: sections.map((s, si) => ({
        id: s.id, orderIndex: si, title: s.title, weightPct: s.weightPct,
        questions: s.questions.map((q, qi) => ({ ...q, orderIndex: qi })),
      })),
    };
    const res = await fetch(`/api/cams/templates/${template.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.detail || j.error || `Failed (${res.status})`); return; }
    setMsg("Saved.");
    router.refresh();
  }

  async function action(path: string, label: string) {
    setBusy(label); setErr(null); setMsg(null);
    const res = await fetch(`/api/cams/templates/${template.id}/${path}`, { method: "POST" });
    setBusy(null);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.detail || j.error || `Failed (${res.status})`); return; }
    if (path === "clone") { const c = await res.json(); router.push(`/cams/templates/${c.id}`); return; }
    router.refresh();
  }

  const totalQ = sections.reduce((n, s) => n + s.questions.length, 0);
  const clausedQ = sections.reduce((n, s) => n + s.questions.filter((q) => q.standardClauseRef).length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <span className={"rounded border px-2 py-0.5 text-xs " + (TEMPLATE_STATUS_CHIP[template.status] ?? "")}>{labelize(template.status)} · v{template.version}</span>
        <span className="text-xs text-slate-500">{sections.length} sections · {totalQ} questions · {clausedQ} clause-mapped</span>
        {msg && <span className="text-xs text-emerald-600">{msg}</span>}
        {err && <span className="text-xs text-rose-600">{err}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          {editable && (
            <>
              <Button disabled={!!busy} onClick={save} variant="outline" className="inline-flex items-center gap-1.5"><Save size={14} /> Save</Button>
              {template.status === "DRAFT" && <Button disabled={!!busy} onClick={() => action("submit", "submit")} variant="outline" className="inline-flex items-center gap-1.5 border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"><Send size={14} /> Submit for review</Button>}
            </>
          )}
          {perms.approve && (template.status === "DRAFT" || template.status === "IN_REVIEW") && (
            <Button disabled={!!busy} onClick={() => action("approve", "approve")} variant="success" className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} /> Approve</Button>
          )}
          {perms.author && template.status === "APPROVED" && (
            <Button disabled={!!busy} onClick={() => action("clone", "clone")} variant="outline" className="inline-flex items-center gap-1.5"><Copy size={14} /> Clone to new version</Button>
          )}
          {perms.approve && template.status === "APPROVED" && (
            <Button disabled={!!busy} onClick={() => action("retire", "retire")} variant="outline" className="inline-flex items-center gap-1.5 text-slate-600"><Archive size={14} /> Retire</Button>
          )}
        </div>
      </div>

      {!editable && template.status === "APPROVED" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">This version is approved and immutable. Clone it to make edits — a new draft version preserves this snapshot.</div>
      )}

      {sections.map((s, si) => (
        <div key={si} className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
            <GripVertical size={14} className="text-slate-300" />
            <input disabled={!editable} value={s.title} onChange={(e) => patchSection(si, { title: e.target.value })} className="flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-slate-800 focus:border-slate-300 focus:bg-white" placeholder="Section title" />
            <label className="flex items-center gap-1 text-[11px] text-slate-400">weight%
              <input disabled={!editable} type="number" value={s.weightPct ?? ""} onChange={(e) => patchSection(si, { weightPct: e.target.value === "" ? null : Number(e.target.value) })} className="w-16 rounded border border-slate-200 px-1 py-0.5 text-xs" />
            </label>
            {editable && <Button type="button" variant="ghost" size="icon" onClick={() => removeSection(si)} className="h-auto w-auto text-slate-300 hover:text-rose-600"><Trash2 size={15} /></Button>}
          </div>
          <div className="divide-y divide-slate-100">
            {s.questions.map((q, qi) => (
              <div key={qi} className="px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <span className="mt-2 text-[11px] tabular-nums text-slate-300">{qi + 1}</span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <textarea disabled={!editable} value={q.text} onChange={(e) => patchQuestion(si, qi, { text: e.target.value })} rows={1} className="w-full rounded border border-slate-200 px-2 py-1 text-sm" placeholder="Question / check text" />
                    <div className="flex flex-wrap items-center gap-2">
                      <select disabled={!editable} value={q.questionType} onChange={(e) => patchQuestion(si, qi, { questionType: e.target.value })} className="rounded border border-slate-200 px-1.5 py-1 text-xs">
                        {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <select disabled={!editable} value={q.standardClauseRef ?? ""} onChange={(e) => patchQuestion(si, qi, { standardClauseRef: e.target.value || null })} className="rounded border border-indigo-200 bg-indigo-50/50 px-1.5 py-1 text-xs text-indigo-700">
                        <option value="">— clause —</option>
                        {clauses.map((c) => <option key={c.clause} value={c.clause}>{c.clause} · {c.title}</option>)}
                      </select>
                      <label className="flex items-center gap-1 text-[11px] text-slate-500"><Checkbox disabled={!editable} checked={q.isMandatory} onChange={(e) => patchQuestion(si, qi, { isMandatory: e.target.checked })} /> Mandatory</label>
                      <label className="flex items-center gap-1 text-[11px] text-slate-500"><Checkbox disabled={!editable} checked={q.ncTriggersFinding} onChange={(e) => patchQuestion(si, qi, { ncTriggersFinding: e.target.checked })} /> NC → finding</label>
                      <label className="flex items-center gap-1 text-[11px] text-slate-500"><Checkbox disabled={!editable} checked={q.evidenceRequiredOnNc} onChange={(e) => patchQuestion(si, qi, { evidenceRequiredOnNc: e.target.checked })} /> Evidence on NC</label>
                    </div>
                    {q.guidance != null && (
                      <input disabled={!editable} value={q.guidance ?? ""} onChange={(e) => patchQuestion(si, qi, { guidance: e.target.value })} className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-500" placeholder="Guidance — what good looks like" />
                    )}
                  </div>
                  {editable && <Button type="button" variant="ghost" size="icon" onClick={() => removeQuestion(si, qi)} className="mt-1 h-auto w-auto text-slate-300 hover:text-rose-600"><Trash2 size={14} /></Button>}
                </div>
              </div>
            ))}
          </div>
          {editable && (
            <Button type="button" variant="ghost" onClick={() => addQuestion(si)} className="flex w-full items-center justify-center gap-1.5 border-t border-slate-100 py-2 text-xs font-medium text-primary-700 hover:bg-primary-50/40"><Plus size={14} /> Add question</Button>
          )}
        </div>
      ))}

      {editable && (
        <Button type="button" variant="ghost" onClick={addSection} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 hover:border-primary-300 hover:text-primary-700"><Plus size={16} /> Add section</Button>
      )}
    </div>
  );
}
