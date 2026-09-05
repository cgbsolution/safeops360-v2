"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { cn } from "@/lib/utils";
import { ENGAGEMENT_TYPES, STANDARDS, SCORING_MODES, labelize } from "../lib-cams";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function NewTemplateButton({ ownerId }: { ownerId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5">
        <Plus size={16} /> New Template
      </Button>
      {open && <NewTemplateModal ownerId={ownerId} onClose={() => setOpen(false)} />}
    </>
  );
}

function NewTemplateModal({ ownerId, onClose }: { ownerId: string; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [standards, setStandards] = useState<string[]>([]);
  const [mode, setMode] = useState("PERCENT_CONFORMANCE");
  const [passThreshold, setPassThreshold] = useState("80");

  function toggle(list: string[], v: string, set: (l: string[]) => void) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  async function submit() {
    if (!name.trim()) { setErr("Name is required."); return; }
    setBusy(true); setErr(null);
    const body = {
      name: name.trim(), description: description.trim(),
      applicableEngagementTypes: types, standardRefs: standards,
      scoringConfig: { mode, passThresholdPercent: Number(passThreshold) || 80 },
      ownerId, isGlobal: true,
    };
    const res = await fetch("/api/cams/templates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.detail || j.error || `Failed (${res.status})`); return; }
    const created = await res.json();
    router.push(`/cams/templates/${created.id}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">New Template</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="h-auto w-auto text-slate-400 hover:text-slate-700"><X size={18} /></Button>
        </div>
        {err && <Alert variant="destructive" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</Alert>}
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Name (required)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Internal HSE System Audit — ISO 45001" />
          </div>
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Applicable engagement types</Label>
            <div className="flex flex-wrap gap-2">
              {ENGAGEMENT_TYPES.map((t) => (
                <Button key={t.value} type="button" variant="ghost" onClick={() => toggle(types, t.value, setTypes)}
                  className={cn("h-auto rounded-full border px-2.5 py-1 text-xs", types.includes(t.value) ? "border-primary-700 bg-primary-50 text-primary-700" : "border-slate-200 bg-white text-slate-600")}>
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Standards assessed</Label>
            <div className="flex flex-wrap gap-2">
              {STANDARDS.map((s) => (
                <Button key={s} type="button" variant="ghost" onClick={() => toggle(standards, s, setStandards)}
                  className={cn("h-auto rounded-full border px-2.5 py-1 text-xs", standards.includes(s) ? "border-primary-700 bg-primary-50 text-primary-700" : "border-slate-200 bg-white text-slate-600")}>
                  {s.replace("_", " ")}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">Scoring mode</Label>
              <SelectField value={mode} onChange={setMode}
                options={SCORING_MODES.map((m) => ({ value: m, label: labelize(m) }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">Pass threshold %</Label>
              <Input type="number" min={0} max={100} value={passThreshold} onChange={(e) => setPassThreshold(e.target.value)} />
            </div>
          </div>
          <Button disabled={busy || !name.trim()} onClick={submit} className="w-full">
            {busy ? "Creating…" : "Create draft & open builder"}
          </Button>
        </div>
      </div>
    </div>
  );
}
