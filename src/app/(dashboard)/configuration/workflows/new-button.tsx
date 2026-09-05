"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Plus, X, Loader2 } from "lucide-react";

const MODULES = [
  { value: "OBSERVATION", label: "Safety Observation" },
  { value: "NEAR_MISS", label: "Near Miss" },
  { value: "PTW", label: "Permit to Work" },
  { value: "INCIDENT", label: "Incident Investigation" },
  { value: "TRAINING", label: "Training" },
  { value: "INSPECTION", label: "Inspection" },
  { value: "MANHOURS", label: "Manhours & KPIs" }
];

export function NewWorkflowButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [module, setModule] = useState("OBSERVATION");
  const [recordType, setRecordType] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  async function create() {
    setError("");
    if (!name.trim()) { setError("Name is required"); return; }
    setBusy(true);
    const r = await fetch("/api/workflow/definitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module,
        recordType: recordType.trim() || null,
        name: name.trim(),
        description: description.trim() || null
      })
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? "Failed to create");
      return;
    }
    const j = await r.json();
    router.push(`/configuration/workflows/${j.definition.id}`);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} /> New workflow
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !busy && setOpen(false)}>
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <div className="text-base font-semibold">New workflow</div>
                <div className="text-xs text-slate-500">A starter workflow with Maker → Checker → Closure will be created. Edit it on the canvas.</div>
              </div>
              <Button variant="ghost" size="icon" aria-label="Close" title="Close" className="h-auto w-auto p-0 text-slate-400 hover:bg-transparent hover:text-slate-600" onClick={() => !busy && setOpen(false)}>
                <X size={18} />
              </Button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="wf-name">Name</Label>
                <Input id="wf-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Safety Observation — Strict approval" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wf-module">Module</Label>
                <SelectField id="wf-module" value={module} onChange={(value) => setModule(value)}
                  options={MODULES.map((m) => ({ value: String(m.value), label: m.label }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wf-rt">Record sub-type <span className="text-slate-400 font-normal">(optional)</span></Label>
                <Input id="wf-rt" value={recordType} onChange={(e) => setRecordType(e.target.value)} placeholder="e.g. HOT_WORK, CONFINED_SPACE" />
                <div className="text-[11px] text-slate-500">Leave blank to apply to all sub-types of this module.</div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wf-desc">Description</Label>
                <Input id="wf-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this workflow does" />
              </div>
              {error && <div className="text-xs text-rose-600">{error}</div>}
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
              <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={create} disabled={busy}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Create & open
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
