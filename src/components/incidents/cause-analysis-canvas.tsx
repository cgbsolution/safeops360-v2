"use client";

// Feature 1 — Visual RCA canvas. Two switchable views (Fishbone 6M + 5-Why)
// that read/write ONE shared `causes[]` array, so switching method never loses
// data (fishbone nodes have whyLevel=null; 5-Why nodes carry whyLevel 1-5). The
// root-cause node is queryable (server derives incident.rootCauses from it).
// The 5-Why root step has an inline "Add CAPA" that links the CAPA to the cause.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { UserPicker } from "@/components/ui/user-picker";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { GitBranch, ListOrdered, Plus, X, Star, Sparkles, Check, Loader2, Save } from "lucide-react";

type Method = "fishbone" | "five_why";
type CauseNode = {
  id: string;
  category: string | null;
  whyLevel: number | null;
  text: string;
  isRootCause: boolean;
  source: "manual" | "ai_suggested";
  confidence?: number | null;
  linkedCapaId?: string | null;
};

const FISHBONE = [
  { key: "manpower", label: "Manpower", tone: "border-rose-200 bg-rose-50/40" },
  { key: "machine", label: "Machine", tone: "border-blue-200 bg-blue-50/40" },
  { key: "method", label: "Method", tone: "border-violet-200 bg-violet-50/40" },
  { key: "material", label: "Material", tone: "border-amber-200 bg-amber-50/40" },
  { key: "measurement", label: "Measurement", tone: "border-emerald-200 bg-emerald-50/40" },
  { key: "environment", label: "Environment", tone: "border-teal-200 bg-teal-50/40" },
];

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export function CauseAnalysisCanvas({
  incidentId,
  plantId,
  initial,
  canManage,
}: {
  incidentId: string;
  plantId: string;
  initial: { method?: Method; causes?: CauseNode[] } | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [method, setMethod] = useState<Method>(initial?.method ?? "fishbone");
  const [causes, setCauses] = useState<CauseNode[]>(initial?.causes ?? []);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  function mutate(next: CauseNode[]) {
    setCauses(next);
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const r = await fetch(`/api/incidents/${incidentId}/cause-analysis`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootCauseMethod: method === "fishbone" ? "Fishbone" : "5-Why",
          causeAnalysis: { method, causes },
        }),
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.detail ?? `Save failed (${r.status})`); }
      setDirty(false);
      toast({ variant: "success", title: "Cause analysis saved" });
      router.refresh();
    } catch (e: any) {
      toast({ variant: "error", title: "Could not save", description: e.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Cause Analysis Canvas</CardTitle>
            <CardDescription>Both views write the same causes — switching never loses data.</CardDescription>
          </div>
          {/* Segmented control */}
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-sm">
            <button type="button" onClick={() => setMethod("fishbone")}
              className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5", method === "fishbone" ? "bg-primary-100 text-primary-900 font-medium" : "text-slate-600")}>
              <GitBranch size={14} /> Fishbone
            </button>
            <button type="button" onClick={() => setMethod("five_why")}
              className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5", method === "five_why" ? "bg-primary-100 text-primary-900 font-medium" : "text-slate-600")}>
              <ListOrdered size={14} /> 5-Why
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {method === "fishbone" ? (
          <FishboneView causes={causes} onChange={mutate} readOnly={!canManage} />
        ) : (
          <FiveWhyView causes={causes} onChange={mutate} readOnly={!canManage} incidentId={incidentId} plantId={plantId} />
        )}

        {canManage && (
          <div className="flex items-center justify-end gap-2 pt-1">
            {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
            <Button size="sm" onClick={save} disabled={saving || !dirty}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Fishbone (6M spine) ────────────────────────────────────────────────────
function FishboneView({ causes, onChange, readOnly }: { causes: CauseNode[]; onChange: (n: CauseNode[]) => void; readOnly: boolean }) {
  const bones = causes.filter((c) => c.whyLevel == null);

  function add(category: string) {
    onChange([...causes, { id: genId(), category, whyLevel: null, text: "", isRootCause: false, source: "manual" }]);
  }
  function setText(id: string, text: string) {
    onChange(causes.map((c) => (c.id === id ? { ...c, text } : c)));
  }
  function toggleRoot(id: string) {
    onChange(causes.map((c) => (c.id === id ? { ...c, isRootCause: !c.isRootCause } : c)));
  }
  function remove(id: string) {
    onChange(causes.filter((c) => c.id !== id));
  }

  return (
    <div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {FISHBONE.map((b) => {
          const items = bones.filter((c) => c.category === b.key);
          return (
            <div key={b.key} className={cn("rounded-lg border p-3", b.tone)}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-700">{b.label}</span>
                {!readOnly && <button type="button" onClick={() => add(b.key)} className="text-primary-700 hover:text-primary-900"><Plus size={14} /></button>}
              </div>
              {items.length === 0 && <div className="text-[11px] text-slate-400 italic">No causes.</div>}
              <div className="space-y-1.5">
                {items.map((c) => (
                  <div key={c.id} className={cn("flex items-start gap-1 rounded border px-1.5 py-1", c.isRootCause ? "border-primary-400 bg-primary-50" : "border-transparent")}>
                    {!readOnly && (
                      <button type="button" onClick={() => toggleRoot(c.id)} title="Mark root cause" className={cn("mt-1.5", c.isRootCause ? "text-primary-600" : "text-slate-300 hover:text-primary-500")}>
                        <Star size={12} fill={c.isRootCause ? "currentColor" : "none"} />
                      </button>
                    )}
                    <Input value={c.text} onChange={(e) => setText(c.id, e.target.value)} placeholder="Contributing cause…" className="h-7 text-xs" disabled={readOnly} />
                    {c.source === "ai_suggested" && <Sparkles size={11} className="text-violet-500 mt-2" />}
                    {!readOnly && <button type="button" onClick={() => remove(c.id)} className="text-slate-400 hover:text-rose-600 mt-1.5"><X size={11} /></button>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-400 mt-2">★ marks a bone as a root cause (accent). Root causes feed the incident's queryable root-cause list.</p>
    </div>
  );
}

// ─── 5-Why (numbered chain) ─────────────────────────────────────────────────
function FiveWhyView({ causes, onChange, readOnly, incidentId, plantId }: {
  causes: CauseNode[]; onChange: (n: CauseNode[]) => void; readOnly: boolean; incidentId: string; plantId: string;
}) {
  // The 5-Why chain = nodes with whyLevel 1..5, ordered.
  const chain = [1, 2, 3, 4, 5].map((lvl) => causes.find((c) => c.whyLevel === lvl) ?? null);
  const lastFilled = [...chain].reverse().find((c) => c && c.text.trim());

  function setLevel(lvl: number, text: string) {
    const existing = causes.find((c) => c.whyLevel === lvl);
    if (existing) {
      onChange(causes.map((c) => (c.whyLevel === lvl ? { ...c, text } : c)));
    } else {
      onChange([...causes, { id: genId(), category: null, whyLevel: lvl, text, isRootCause: false, source: "manual" }]);
    }
  }
  function toggleRoot(lvl: number) {
    onChange(causes.map((c) => (c.whyLevel != null ? { ...c, isRootCause: c.whyLevel === lvl ? !c.isRootCause : false } : c)));
  }

  return (
    <div className="space-y-0">
      {[1, 2, 3, 4, 5].map((lvl, i) => {
        const node = chain[i];
        const isRoot = !!node?.isRootCause || (node === lastFilled && !causes.some((c) => c.whyLevel != null && c.isRootCause));
        return (
          <div key={lvl} className="relative pl-10 pb-4 last:pb-0">
            {/* connector line */}
            {i < 4 && <div className="absolute left-[15px] top-7 bottom-0 w-px bg-slate-200" />}
            <div className={cn("absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
              isRoot ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600 border border-slate-300")}>
              {lvl}
            </div>
            <div className={cn("rounded-lg border p-2.5", isRoot ? "border-primary-400 bg-primary-50" : "border-slate-200")}>
              <div className="flex items-center gap-2">
                <Input value={node?.text ?? ""} onChange={(e) => setLevel(lvl, e.target.value)}
                  placeholder={lvl === 1 ? "Why did this happen?" : "Why?"} className="h-8 text-sm" disabled={readOnly} />
                {node?.source === "ai_suggested" && <Sparkles size={13} className="text-violet-500 flex-shrink-0" />}
                {!readOnly && node?.text && (
                  <button type="button" onClick={() => toggleRoot(lvl)} title="Mark as root cause"
                    className={cn("flex-shrink-0", isRoot ? "text-primary-600" : "text-slate-300 hover:text-primary-500")}>
                    <Star size={15} fill={isRoot ? "currentColor" : "none"} />
                  </button>
                )}
              </div>
              {isRoot && node?.text && (
                <div className="mt-2 flex items-center gap-2">
                  <Badge className="bg-primary-100 text-primary-800 border-primary-200 text-[10px]">Root cause</Badge>
                  {!readOnly && <InlineAddCapa incidentId={incidentId} plantId={plantId} cause={node.text} causeId={node.id} />}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InlineAddCapa({ incidentId, plantId, cause, causeId }: { incidentId: string; plantId: string; cause: string; causeId: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState("CORRECTIVE");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState("");

  async function submit() {
    if (!ownerId || !targetDate) { toast({ variant: "error", title: "Owner + target date required" }); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/incidents/${incidentId}/capas`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: `Address root cause: ${cause}`, type, rootCauseAddressed: cause,
          linkedCauseId: causeId, ownerId, targetDate: new Date(targetDate).toISOString(),
        }),
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.detail ?? `Failed (${r.status})`); }
      toast({ variant: "success", title: "CAPA raised", description: "Linked to this root cause." });
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast({ variant: "error", title: "Could not raise CAPA", description: e.message });
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus size={13} /> Add CAPA</Button>;
  return (
    <div className="w-full rounded-md border border-slate-200 bg-white p-2.5 space-y-2">
      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Type</Label>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="CORRECTIVE">Corrective</option>
            <option value="PREVENTIVE">Preventive</option>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Target Date</Label>
          <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Owner</Label>
        <UserPicker value={ownerId} onChange={setOwnerId} filter={{ plantId }} placeholder="Assign CAPA owner…" />
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={busy}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Raise CAPA</Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
