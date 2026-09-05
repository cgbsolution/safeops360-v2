"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2 } from "lucide-react";
import { UserPicker } from "@/components/ui/user-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { Checkbox } from "@/components/ui/checkbox";
import { PLAN_TYPES } from "@/app/(dashboard)/erm/lib-p3";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

type PlantOption = { id: string; name: string };
type ProcOption = { id: string; processCode: string; name: string };
type Section = { heading: string; contentRichText: string };
type RTask = { title: string; responsibleRoleName: string; targetHoursFromActivation: string; detail: string };

const PLAN_TYPE_LABEL: Record<string, string> = {
  BUSINESS_CONTINUITY: "Business Continuity",
  DISASTER_RECOVERY_IT: "Disaster Recovery (IT)",
  CRISIS_MANAGEMENT: "Crisis Management",
  EMERGENCY_RESPONSE_LINK: "Emergency Response Link",
};

export function NewPlanButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} /> New Plan
      </Button>
      {open && <NewPlanModal onClose={() => setOpen(false)} onCreated={(id) => router.push(`/erm/bcm/plans/${id}`)} />}
    </>
  );
}

function NewPlanModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [planType, setPlanType] = useState<string>("BUSINESS_CONTINUITY");
  const [siteId, setSiteId] = useState<string>("");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [coveredProcessIds, setCoveredProcessIds] = useState<string[]>([]);
  const [scopeStatement, setScopeStatement] = useState("");
  const [criteriaText, setCriteriaText] = useState("");
  const [strategySummary, setStrategySummary] = useState("");
  const [fserPlanRef, setFserPlanRef] = useState("");
  const [sections, setSections] = useState<Section[]>([{ heading: "", contentRichText: "" }]);
  const [tasks, setTasks] = useState<RTask[]>([{ title: "", responsibleRoleName: "", targetHoursFromActivation: "", detail: "" }]);

  const [plants, setPlants] = useState<PlantOption[]>([]);
  const [procs, setProcs] = useState<ProcOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/plants").then((r) => (r.ok ? r.json() : [])).then((d) => { if (!cancelled) setPlants((d?.items ?? d ?? []).map((p: any) => ({ id: p.id, name: p.name }))); }).catch(() => {});
    fetch("/api/erm/bcm/processes").then((r) => (r.ok ? r.json() : { items: [] })).then((d) => {
      if (cancelled) return;
      setProcs((d?.items ?? d ?? []).map((p: any) => ({ id: p.id, processCode: p.processCode, name: p.name })));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function toggleProc(id: string) {
    setCoveredProcessIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const activationCriteria = criteriaText.split("\n").map((s) => s.trim()).filter(Boolean);
    const cleanSections = sections.filter((s) => s.heading.trim()).map((s, i) => ({ orderIndex: i, heading: s.heading.trim(), contentRichText: s.contentRichText, attachments: [] }));
    const cleanTasks = tasks.filter((t) => t.title.trim() && t.responsibleRoleName.trim()).map((t, i) => ({
      orderIndex: i, title: t.title.trim(), detail: t.detail.trim() || null,
      responsibleRoleName: t.responsibleRoleName.trim(), targetHoursFromActivation: Number(t.targetHoursFromActivation) || 0,
    }));
    try {
      const res = await fetch("/api/erm/bcm/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(), planType, siteId: siteId || null, ownerId,
          coveredProcessIds, scopeStatement: scopeStatement.trim(), activationCriteria,
          sections: cleanSections, strategySummary: strategySummary.trim(),
          fserPlanRef: fserPlanRef.trim() || null, recoveryTasks: cleanTasks,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.detail || j.error || `Failed to create plan (${res.status}).`); setBusy(false); return; }
      onCreated(j.id);
    } catch (e: any) { setError(e?.message ?? "Network error creating plan."); setBusy(false); }
  }

  const valid = title.trim().length >= 3 && ownerId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <Card className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">New continuity plan</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Plan title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. North Works Production Continuity Plan" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">Type</Label>
              <SelectField value={planType} onChange={setPlanType}
                options={PLAN_TYPES.map((t) => ({ value: t, label: PLAN_TYPE_LABEL[t] ?? t }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">Site</Label>
              <SelectField value={siteId} onChange={setSiteId}
                placeholder="Corporate"
                options={plants.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">Owner</Label>
              <UserPicker value={ownerId} onChange={(id) => setOwnerId(id)} placeholder="Owner" />
            </div>
          </div>

          {planType === "EMERGENCY_RESPONSE_LINK" && (
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">FSER plan reference (site code / provider key)</Label>
              <Input value={fserPlanRef} onChange={(e) => setFserPlanRef(e.target.value)} placeholder="e.g. NW" />
            </div>
          )}

          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Covered processes</Label>
            {procs.length === 0 ? (
              <p className="text-xs text-slate-400">No processes available.</p>
            ) : (
              <Card className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2 shadow-none">
                {procs.map((p) => (
                  <Label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-slate-50">
                    <Checkbox checked={coveredProcessIds.includes(p.id)} onChange={() => toggleProc(p.id)} />
                    <span className="font-medium text-primary-700">{p.processCode}</span>
                    <span className="truncate text-slate-600">{p.name}</span>
                  </Label>
                ))}
              </Card>
            )}
            {coveredProcessIds.length > 0 && <p className="mt-1 text-[11px] text-slate-400">{coveredProcessIds.length} process(es) selected</p>}
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Scope statement</Label>
            <Textarea value={scopeStatement} onChange={(e) => setScopeStatement(e.target.value)} rows={2} />
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Activation criteria (one per line)</Label>
            <Textarea value={criteriaText} onChange={(e) => setCriteriaText(e.target.value)} rows={3}
              placeholder={"Loss of a critical line > 8 hours\nSite evacuation order"} />
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Strategy summary</Label>
            <Textarea value={strategySummary} onChange={(e) => setStrategySummary(e.target.value)} rows={2} />
          </div>

          {/* Sections */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-600">Plan sections</Label>
              <Button type="button" variant="ghost" onClick={() => setSections((s) => [...s, { heading: "", contentRichText: "" }])} className="h-auto p-0 text-xs font-medium text-primary-700 hover:underline">+ Section</Button>
            </div>
            <div className="space-y-2">
              {sections.map((s, i) => (
                <Card key={i} className="rounded-md border border-slate-200 p-2 shadow-none">
                  <div className="flex items-center gap-2">
                    <Input value={s.heading} onChange={(e) => setSections((arr) => arr.map((x, j) => (j === i ? { ...x, heading: e.target.value } : x)))}
                      placeholder="Section heading" className="flex-1" />
                    {sections.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setSections((arr) => arr.filter((_, j) => j !== i))} className="text-slate-300 hover:text-rose-600"><Trash2 size={14} /></Button>}
                  </div>
                  <Textarea value={s.contentRichText} onChange={(e) => setSections((arr) => arr.map((x, j) => (j === i ? { ...x, contentRichText: e.target.value } : x)))}
                    rows={2} placeholder="Section content" className="mt-1" />
                </Card>
              ))}
            </div>
          </div>

          {/* Recovery tasks */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-600">Recovery tasks</Label>
              <Button type="button" variant="ghost" onClick={() => setTasks((t) => [...t, { title: "", responsibleRoleName: "", targetHoursFromActivation: "", detail: "" }])} className="h-auto p-0 text-xs font-medium text-primary-700 hover:underline">+ Task</Button>
            </div>
            <div className="space-y-2">
              {tasks.map((t, i) => (
                <Card key={i} className="flex items-center gap-2 rounded-md border border-slate-200 p-2 shadow-none">
                  <Input value={t.title} onChange={(e) => setTasks((arr) => arr.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                    placeholder="Task" className="flex-[2]" />
                  <Input value={t.responsibleRoleName} onChange={(e) => setTasks((arr) => arr.map((x, j) => (j === i ? { ...x, responsibleRoleName: e.target.value } : x)))}
                    placeholder="Responsible role" className="flex-[2]" />
                  <Input type="number" min={0} value={t.targetHoursFromActivation} onChange={(e) => setTasks((arr) => arr.map((x, j) => (j === i ? { ...x, targetHoursFromActivation: e.target.value } : x)))}
                    placeholder="h" className="w-16" />
                  {tasks.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setTasks((arr) => arr.filter((_, j) => j !== i))} className="text-slate-300 hover:text-rose-600"><Trash2 size={14} /></Button>}
                </Card>
              ))}
            </div>
          </div>

          {error && <Alert variant="destructive" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</Alert>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={busy || !valid}>
            {busy ? "Creating…" : "Create plan (draft)"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
