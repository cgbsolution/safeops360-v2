"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronRight, AlertTriangle, ShieldCheck, ShieldAlert, ShieldOff, X, ChevronDown, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type RcaMethod,
  type FiveWhyData,
  type FishboneData,
  type FtaData,
  type FtaNode,
  type FtaNodeType,
  type BowtieData,
  type BowtieBarrier,
  type BarrierStatus,
  type TapRootData,
  type CauseMapData,
  type ImpactCategory,
  FISHBONE_KEYS,
  FISHBONE_LABELS,
  emptyDataFor,
  isEmptyRcaData,
  newFtaNode
} from "@/lib/rca/types";

// ─── Dispatcher ────────────────────────────────────────────────────────
export function RcaEditor({
  method,
  value,
  onChange,
  readOnly
}: {
  method: RcaMethod | null;
  value: unknown;
  // Optional so a Server Component (e.g. the read-only incident detail view)
  // can render the editor without passing an event handler across the
  // server/client boundary. Defaults to a no-op when omitted.
  onChange?: (next: unknown) => void;
  readOnly?: boolean;
}) {
  const emit = onChange ?? (() => {});
  if (!method) {
    return (
      <Card className="border-dashed border-2 border-slate-300 bg-slate-50">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="mx-auto text-slate-400 mb-2" size={20} />
          <p className="text-sm text-slate-600">
            Pick a Root-Cause Method above to start the analysis.
          </p>
        </CardContent>
      </Card>
    );
  }
  switch (method) {
    case "FIVE_WHY":
      return <FiveWhyEditor value={(value as FiveWhyData) ?? null} onChange={emit} readOnly={readOnly} />;
    case "FISHBONE":
      return <FishboneEditor value={(value as FishboneData) ?? null} onChange={emit} readOnly={readOnly} />;
    case "FTA":
      return <FaultTreeEditor value={(value as FtaData) ?? null} onChange={emit} readOnly={readOnly} />;
    case "BOWTIE":
      return <BowtieEditor value={(value as BowtieData) ?? null} onChange={emit} readOnly={readOnly} />;
    case "TAPROOT":
      return <TapRootEditor value={(value as TapRootData) ?? null} onChange={emit} readOnly={readOnly} />;
    case "CAUSE_MAP":
      return <CauseMapEditor value={(value as CauseMapData) ?? null} onChange={emit} readOnly={readOnly} />;
  }
}

// ─── Method-switch confirmation hook ───────────────────────────────────
// Returns a function the form calls when the dropdown changes. Shows a
// confirm() if the previous method has content.
export function useRcaMethodSwitcher(opts: {
  current: RcaMethod | null;
  data: unknown;
  onConfirmedSwitch: (newMethod: RcaMethod, freshEmptyData: unknown, archived: { method: RcaMethod; data: unknown } | null) => void;
}) {
  return (next: RcaMethod) => {
    const { current, data } = opts;
    if (!current || isEmptyRcaData(current, data)) {
      opts.onConfirmedSwitch(next, emptyDataFor(next), null);
      return;
    }
    const ok = window.confirm(
      "Switching root-cause method will clear the current analysis. The previous data will be archived in this incident's history. Continue?"
    );
    if (!ok) return;
    opts.onConfirmedSwitch(next, emptyDataFor(next), { method: current, data });
  };
}

// ─── 5-Why ─────────────────────────────────────────────────────────────
function FiveWhyEditor({
  value,
  onChange,
  readOnly
}: {
  value: FiveWhyData | null;
  onChange: (next: FiveWhyData) => void;
  readOnly?: boolean;
}) {
  const data: FiveWhyData = value ?? (emptyDataFor("FIVE_WHY") as FiveWhyData);

  function update(patch: Partial<FiveWhyData>) {
    onChange({ ...data, ...patch });
  }
  function setWhy(idx: number, patch: Partial<{ question: string; answer: string }>) {
    const next = [...data.whys];
    next[idx] = { ...next[idx], ...patch };
    update({ whys: next });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>5-Why Analysis</CardTitle>
        <CardDescription>
          Drill from problem to root cause through five iterative "why" questions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Problem Statement</Label>
          <Textarea
            rows={2}
            value={data.problemStatement}
            onChange={(e) => update({ problemStatement: e.target.value })}
            placeholder="One-sentence description of what happened..."
            disabled={readOnly}
          />
        </div>

        <div className="space-y-3">
          {data.whys.map((w, i) => (
            <div key={i} className="grid sm:grid-cols-12 gap-3 items-start">
              <div className="sm:col-span-1 pt-2 text-xs font-bold uppercase tracking-wider text-primary-700">
                Why {i + 1}
              </div>
              <div className="sm:col-span-5">
                <Input
                  value={w.question}
                  onChange={(e) => setWhy(i, { question: e.target.value })}
                  placeholder={i === 0 ? "Why did this happen?" : "Why?"}
                  disabled={readOnly}
                />
              </div>
              <div className="sm:col-span-6">
                <Input
                  value={w.answer}
                  onChange={(e) => setWhy(i, { answer: e.target.value })}
                  placeholder="Answer..."
                  disabled={readOnly}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 pt-2 border-t">
          <Label>Root Cause</Label>
          <Textarea
            rows={2}
            value={data.rootCause}
            onChange={(e) => update({ rootCause: e.target.value })}
            placeholder="Final identified root cause."
            disabled={readOnly}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Fishbone ──────────────────────────────────────────────────────────
const FISHBONE_TONE: Record<string, string> = {
  manpower: "border-rose-200 bg-rose-50/30",
  machine: "border-blue-200 bg-blue-50/30",
  method: "border-violet-200 bg-violet-50/30",
  material: "border-amber-200 bg-amber-50/30",
  measurement: "border-emerald-200 bg-emerald-50/30",
  environment: "border-teal-200 bg-teal-50/30"
};

function FishboneEditor({
  value,
  onChange,
  readOnly
}: {
  value: FishboneData | null;
  onChange: (next: FishboneData) => void;
  readOnly?: boolean;
}) {
  const data: FishboneData = value ?? (emptyDataFor("FISHBONE") as FishboneData);

  function update(patch: Partial<FishboneData>) {
    onChange({ ...data, ...patch });
  }
  function addCause(key: typeof FISHBONE_KEYS[number]) {
    const cur = data.categories[key] ?? [];
    update({ categories: { ...data.categories, [key]: [...cur, ""] } });
  }
  function setCause(key: typeof FISHBONE_KEYS[number], idx: number, val: string) {
    const cur = [...(data.categories[key] ?? [])];
    cur[idx] = val;
    update({ categories: { ...data.categories, [key]: cur } });
  }
  function removeCause(key: typeof FISHBONE_KEYS[number], idx: number) {
    const cur = (data.categories[key] ?? []).filter((_, i) => i !== idx);
    update({ categories: { ...data.categories, [key]: cur } });
  }
  function addRootCause() {
    update({ rootCauses: [...(data.rootCauses ?? []), ""] });
  }
  function setRootCause(idx: number, val: string) {
    const cur = [...(data.rootCauses ?? [])];
    cur[idx] = val;
    update({ rootCauses: cur });
  }
  function removeRootCause(idx: number) {
    update({ rootCauses: (data.rootCauses ?? []).filter((_, i) => i !== idx) });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fishbone (Ishikawa) — 6M Categories</CardTitle>
        <CardDescription>
          Identify contributing causes across the six M categories, then mark the dominant ones as root causes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Problem Statement</Label>
          <Textarea
            rows={2}
            value={data.problemStatement}
            onChange={(e) => update({ problemStatement: e.target.value })}
            placeholder="Describe the problem under analysis..."
            disabled={readOnly}
          />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FISHBONE_KEYS.map((k) => {
            const causes = data.categories[k] ?? [];
            return (
              <div key={k} className={cn("rounded-lg border p-3", FISHBONE_TONE[k])}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-wider font-bold text-slate-700">{FISHBONE_LABELS[k]}</span>
                  {!readOnly && (
                    <button type="button" onClick={() => addCause(k)} className="text-primary-700 hover:text-primary-900">
                      <Plus size={14} />
                    </button>
                  )}
                </div>
                {causes.length === 0 && (
                  <div className="text-[11px] text-slate-400 italic">No causes captured.</div>
                )}
                <div className="space-y-1.5">
                  {causes.map((c, i) => (
                    <div key={i} className="flex items-start gap-1">
                      <Input
                        value={c}
                        onChange={(e) => setCause(k, i, e.target.value)}
                        placeholder="Contributing cause..."
                        className="h-7 text-xs"
                        disabled={readOnly}
                      />
                      {!readOnly && (
                        <button type="button" onClick={() => removeCause(k, i)} className="text-slate-400 hover:text-rose-600 mt-1">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between">
            <Label>Root Causes Identified</Label>
            {!readOnly && (
              <Button type="button" size="sm" variant="outline" onClick={addRootCause}>
                <Plus size={12} /> Add
              </Button>
            )}
          </div>
          {data.rootCauses.length === 0 && (
            <div className="text-xs text-slate-400 italic">Mark 1-3 dominant causes as root causes.</div>
          )}
          <div className="space-y-1.5">
            {data.rootCauses.map((rc, i) => (
              <div key={i} className="flex items-start gap-1">
                <Input
                  value={rc}
                  onChange={(e) => setRootCause(i, e.target.value)}
                  placeholder="Root cause..."
                  disabled={readOnly}
                />
                {!readOnly && (
                  <button type="button" onClick={() => removeRootCause(i)} className="text-slate-400 hover:text-rose-600 mt-2">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── FTA ───────────────────────────────────────────────────────────────
const FTA_NODE_LABEL: Record<FtaNodeType, string> = {
  EVENT: "Event",
  AND_GATE: "AND",
  OR_GATE: "OR",
  BASIC_EVENT: "Basic"
};

function FaultTreeEditor({
  value,
  onChange,
  readOnly
}: {
  value: FtaData | null;
  onChange: (next: FtaData) => void;
  readOnly?: boolean;
}) {
  const data: FtaData = value ?? (emptyDataFor("FTA") as FtaData);

  function patchTopEvent(v: string) {
    onChange({ ...data, topEvent: v });
  }
  function updateNode(rootId: string, updater: (n: FtaNode) => FtaNode) {
    function walk(n: FtaNode): FtaNode {
      if (n.id === rootId) return updater(n);
      if (!n.children?.length) return n;
      return { ...n, children: n.children.map(walk) };
    }
    onChange({ ...data, rootNode: walk(data.rootNode) });
  }
  function addChild(parentId: string, type: FtaNodeType = "BASIC_EVENT") {
    updateNode(parentId, (n) => ({ ...n, children: [...(n.children ?? []), newFtaNode(type)] }));
  }
  function removeNode(targetId: string) {
    function walk(n: FtaNode): FtaNode {
      return { ...n, children: (n.children ?? []).filter((c) => c.id !== targetId).map(walk) };
    }
    onChange({ ...data, rootNode: walk(data.rootNode) });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fault Tree Analysis (FTA)</CardTitle>
        <CardDescription>
          Top event at the root, AND / OR gates branching down to basic events. Click + to add children.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Top Event</Label>
          <Input
            value={data.topEvent}
            onChange={(e) => patchTopEvent(e.target.value)}
            placeholder="e.g., Falling object struck worker on walkway"
            disabled={readOnly}
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <FtaNodeEditor
            node={data.rootNode}
            depth={0}
            onUpdateNode={updateNode}
            onAddChild={addChild}
            onRemove={removeNode}
            isRoot
            readOnly={readOnly}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function FtaNodeEditor({
  node,
  depth,
  onUpdateNode,
  onAddChild,
  onRemove,
  isRoot,
  readOnly
}: {
  node: FtaNode;
  depth: number;
  onUpdateNode: (id: string, updater: (n: FtaNode) => FtaNode) => void;
  onAddChild: (parentId: string, type?: FtaNodeType) => void;
  onRemove: (id: string) => void;
  isRoot?: boolean;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-2" style={{ marginLeft: depth * 16 }}>
      <div className="flex flex-wrap items-start gap-2">
        <Select
          value={node.nodeType}
          onChange={(e) => onUpdateNode(node.id, (n) => ({ ...n, nodeType: e.target.value as FtaNodeType }))}
          className="w-32 h-8 text-xs"
          disabled={readOnly}
        >
          <option value="EVENT">Event</option>
          <option value="AND_GATE">AND Gate</option>
          <option value="OR_GATE">OR Gate</option>
          <option value="BASIC_EVENT">Basic Event</option>
        </Select>
        <Badge
          className={cn(
            "text-[10px]",
            node.nodeType === "AND_GATE" && "bg-rose-100 text-rose-800 border-rose-200",
            node.nodeType === "OR_GATE" && "bg-amber-100 text-amber-800 border-amber-200",
            node.nodeType === "BASIC_EVENT" && "bg-slate-100 text-slate-700 border-slate-200",
            node.nodeType === "EVENT" && "bg-primary-100 text-primary-800 border-primary-200"
          )}
        >
          {FTA_NODE_LABEL[node.nodeType]}
        </Badge>
        <Input
          value={node.description}
          onChange={(e) => onUpdateNode(node.id, (n) => ({ ...n, description: e.target.value }))}
          placeholder="Describe this event/gate..."
          className="flex-1 h-8 text-xs"
          disabled={readOnly}
        />
        {!readOnly && (
          <>
            <button type="button" onClick={() => onAddChild(node.id)} className="text-primary-700 hover:text-primary-900 h-8 px-2" title="Add child">
              <Plus size={14} />
            </button>
            {!isRoot && (
              <button type="button" onClick={() => onRemove(node.id)} className="text-slate-400 hover:text-rose-600 h-8 px-1" title="Remove">
                <Trash2 size={13} />
              </button>
            )}
          </>
        )}
      </div>
      {node.nodeType === "BASIC_EVENT" && (
        <div className="ml-4 grid sm:grid-cols-3 gap-2">
          <Select
            value={node.probability ?? ""}
            onChange={(e) => onUpdateNode(node.id, (n) => ({ ...n, probability: (e.target.value || undefined) as any }))}
            className="h-7 text-xs"
            disabled={readOnly}
          >
            <option value="">Probability —</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </Select>
          <Input
            value={node.existingControls ?? ""}
            onChange={(e) => onUpdateNode(node.id, (n) => ({ ...n, existingControls: e.target.value }))}
            placeholder="Existing control"
            className="h-7 text-xs sm:col-span-2"
            disabled={readOnly}
          />
          <label className="flex items-center gap-1.5 text-[11px] text-slate-700 sm:col-span-3">
            <input
              type="checkbox"
              checked={!!node.controlActiveAtIncident}
              onChange={(e) => onUpdateNode(node.id, (n) => ({ ...n, controlActiveAtIncident: e.target.checked }))}
              disabled={readOnly}
              className="rounded border-slate-300"
            />
            Control was active at incident
          </label>
        </div>
      )}
      {(node.children?.length ?? 0) > 0 && (
        <div className="border-l-2 border-slate-200 pl-2 space-y-2">
          {node.children!.map((c) => (
            <FtaNodeEditor
              key={c.id}
              node={c}
              depth={0}
              onUpdateNode={onUpdateNode}
              onAddChild={onAddChild}
              onRemove={onRemove}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Bowtie ────────────────────────────────────────────────────────────
function BowtieEditor({
  value,
  onChange,
  readOnly
}: {
  value: BowtieData | null;
  onChange: (next: BowtieData) => void;
  readOnly?: boolean;
}) {
  const data: BowtieData = value ?? (emptyDataFor("BOWTIE") as BowtieData);

  function update(patch: Partial<BowtieData>) {
    onChange({ ...data, ...patch });
  }
  function addThreat() {
    update({ threats: [...data.threats, { description: "", preventiveBarriers: [] }] });
  }
  function setThreat(idx: number, patch: Partial<{ description: string; preventiveBarriers: BowtieBarrier[] }>) {
    const next = [...data.threats];
    next[idx] = { ...next[idx], ...patch };
    update({ threats: next });
  }
  function removeThreat(idx: number) {
    update({ threats: data.threats.filter((_, i) => i !== idx) });
  }
  function addConsequence() {
    update({ consequences: [...data.consequences, { description: "", mitigativeBarriers: [] }] });
  }
  function setConsequence(idx: number, patch: Partial<{ description: string; mitigativeBarriers: BowtieBarrier[] }>) {
    const next = [...data.consequences];
    next[idx] = { ...next[idx], ...patch };
    update({ consequences: next });
  }
  function removeConsequence(idx: number) {
    update({ consequences: data.consequences.filter((_, i) => i !== idx) });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bowtie Analysis</CardTitle>
        <CardDescription>
          Threats and preventive barriers on the left, the top event in the centre, consequences and mitigative barriers on the right.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Top Event</Label>
          <Input
            value={data.topEvent}
            onChange={(e) => update({ topEvent: e.target.value })}
            placeholder="e.g., Loss of containment of hot clinker from cooler grate"
            disabled={readOnly}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-3">
          {/* THREATS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider font-bold text-amber-800">Threats</Label>
              {!readOnly && (
                <Button type="button" size="sm" variant="outline" onClick={addThreat}>
                  <Plus size={12} /> Threat
                </Button>
              )}
            </div>
            {data.threats.length === 0 && (
              <div className="text-xs text-slate-400 italic">No threats captured.</div>
            )}
            {data.threats.map((t, i) => (
              <div key={i} className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-2">
                <div className="flex items-start gap-1">
                  <Input
                    value={t.description}
                    onChange={(e) => setThreat(i, { description: e.target.value })}
                    placeholder="Threat description..."
                    className="h-8 text-sm"
                    disabled={readOnly}
                  />
                  {!readOnly && (
                    <button type="button" onClick={() => removeThreat(i)} className="text-slate-400 hover:text-rose-600 mt-1">
                      <X size={13} />
                    </button>
                  )}
                </div>
                <BarrierList
                  barriers={t.preventiveBarriers}
                  label="Preventive Barriers"
                  onChange={(barriers) => setThreat(i, { preventiveBarriers: barriers })}
                  readOnly={readOnly}
                />
              </div>
            ))}
          </div>

          {/* TOP EVENT */}
          <div className="flex items-center justify-center">
            <div className="w-full rounded-lg border-2 border-rose-300 bg-rose-100 text-rose-900 p-4 text-center">
              <div className="text-[10px] uppercase tracking-wider font-bold text-rose-700">Top Event</div>
              <div className="text-sm font-semibold mt-1 leading-snug">{data.topEvent || "—"}</div>
            </div>
          </div>

          {/* CONSEQUENCES */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider font-bold text-blue-800">Consequences</Label>
              {!readOnly && (
                <Button type="button" size="sm" variant="outline" onClick={addConsequence}>
                  <Plus size={12} /> Consequence
                </Button>
              )}
            </div>
            {data.consequences.length === 0 && (
              <div className="text-xs text-slate-400 italic">No consequences captured.</div>
            )}
            {data.consequences.map((c, i) => (
              <div key={i} className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-2">
                <div className="flex items-start gap-1">
                  <Input
                    value={c.description}
                    onChange={(e) => setConsequence(i, { description: e.target.value })}
                    placeholder="Consequence description..."
                    className="h-8 text-sm"
                    disabled={readOnly}
                  />
                  {!readOnly && (
                    <button type="button" onClick={() => removeConsequence(i)} className="text-slate-400 hover:text-rose-600 mt-1">
                      <X size={13} />
                    </button>
                  )}
                </div>
                <BarrierList
                  barriers={c.mitigativeBarriers}
                  label="Mitigative Barriers"
                  onChange={(barriers) => setConsequence(i, { mitigativeBarriers: barriers })}
                  readOnly={readOnly}
                />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BarrierList({
  barriers,
  label,
  onChange,
  readOnly
}: {
  barriers: BowtieBarrier[];
  label: string;
  onChange: (next: BowtieBarrier[]) => void;
  readOnly?: boolean;
}) {
  function add() {
    onChange([...barriers, { description: "", status: "WORKED" }]);
  }
  function set(i: number, patch: Partial<BowtieBarrier>) {
    const next = [...barriers];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  function remove(i: number) {
    onChange(barriers.filter((_, idx) => idx !== i));
  }

  const statusStyle: Record<BarrierStatus, string> = {
    WORKED: "border-emerald-300 bg-emerald-50 text-emerald-800",
    FAILED: "border-rose-300 bg-rose-50 text-rose-800",
    ABSENT: "border-slate-300 bg-slate-50 text-slate-700"
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider font-medium text-slate-600">{label}</span>
        {!readOnly && (
          <button type="button" onClick={add} className="text-primary-700 hover:text-primary-900 text-[11px]">
            <Plus size={12} className="inline" /> Add
          </button>
        )}
      </div>
      {barriers.map((b, i) => {
        const Icon = b.status === "WORKED" ? ShieldCheck : b.status === "FAILED" ? ShieldAlert : ShieldOff;
        return (
          <div key={i} className={cn("flex items-start gap-1 rounded border px-2 py-1", statusStyle[b.status])}>
            <Icon size={12} className="mt-1.5 flex-shrink-0" />
            <Input
              value={b.description}
              onChange={(e) => set(i, { description: e.target.value })}
              placeholder="Barrier..."
              className="h-7 text-xs flex-1 bg-transparent"
              disabled={readOnly}
            />
            <Select
              value={b.status}
              onChange={(e) => set(i, { status: e.target.value as BarrierStatus })}
              className="h-7 text-[10px] w-24 bg-transparent"
              disabled={readOnly}
            >
              <option value="WORKED">Worked</option>
              <option value="FAILED">Failed</option>
              <option value="ABSENT">Absent</option>
            </Select>
            {!readOnly && (
              <button type="button" onClick={() => remove(i)} className="text-slate-400 hover:text-rose-600 mt-1">
                <X size={11} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── TapRoot ───────────────────────────────────────────────────────────
const TAPROOT_CATEGORIES = [
  "Procedure",
  "Training",
  "Quality Control",
  "Communications",
  "Management System",
  "Human Engineering",
  "Work Direction",
  "Equipment Reliability",
  "SPAC"
];

function TapRootEditor({
  value,
  onChange,
  readOnly
}: {
  value: TapRootData | null;
  onChange: (next: TapRootData) => void;
  readOnly?: boolean;
}) {
  const data: TapRootData = value ?? (emptyDataFor("TAPROOT") as TapRootData);

  function update(patch: Partial<TapRootData>) {
    onChange({ ...data, ...patch });
  }
  function addSnap() {
    update({ snapChart: [...data.snapChart, { timestamp: "", condition: "", action: "", isIncident: false }] });
  }
  function setSnap(i: number, patch: Partial<typeof data.snapChart[number]>) {
    const next = [...data.snapChart]; next[i] = { ...next[i], ...patch }; update({ snapChart: next });
  }
  function removeSnap(i: number) {
    update({ snapChart: data.snapChart.filter((_, idx) => idx !== i) });
  }
  function addCf() {
    update({
      causalFactors: [
        ...data.causalFactors,
        { description: "", rootCauseTree: [{ category: "", subcategory: "", nearRootCause: "", rootCause: "" }] }
      ]
    });
  }
  function setCf(i: number, patch: Partial<typeof data.causalFactors[number]>) {
    const next = [...data.causalFactors]; next[i] = { ...next[i], ...patch }; update({ causalFactors: next });
  }
  function removeCf(i: number) {
    update({ causalFactors: data.causalFactors.filter((_, idx) => idx !== i) });
  }
  function addRcEntry(cfIdx: number) {
    const cf = data.causalFactors[cfIdx];
    setCf(cfIdx, { rootCauseTree: [...cf.rootCauseTree, { category: "", subcategory: "", nearRootCause: "", rootCause: "" }] });
  }
  function setRcEntry(cfIdx: number, rcIdx: number, patch: Partial<typeof data.causalFactors[number]["rootCauseTree"][number]>) {
    const cf = data.causalFactors[cfIdx];
    const tree = [...cf.rootCauseTree]; tree[rcIdx] = { ...tree[rcIdx], ...patch };
    setCf(cfIdx, { rootCauseTree: tree });
  }
  function removeRcEntry(cfIdx: number, rcIdx: number) {
    const cf = data.causalFactors[cfIdx];
    setCf(cfIdx, { rootCauseTree: cf.rootCauseTree.filter((_, idx) => idx !== rcIdx) });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>TapRoot Analysis</CardTitle>
        <CardDescription>
          SnapCharT (sequence map) → Causal Factors → Root Cause Tree per factor.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Event Description</Label>
          <Textarea
            rows={2}
            value={data.eventDescription}
            onChange={(e) => update({ eventDescription: e.target.value })}
            placeholder="One-sentence event summary..."
            disabled={readOnly}
          />
        </div>

        {/* SnapCharT */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>SnapCharT — Sequence of Events</Label>
            {!readOnly && (
              <Button type="button" size="sm" variant="outline" onClick={addSnap}>
                <Plus size={12} /> Step
              </Button>
            )}
          </div>
          <div className="rounded-lg border bg-white p-3 space-y-2">
            {data.snapChart.length === 0 && <div className="text-xs text-slate-400 italic">No sequence steps captured.</div>}
            {data.snapChart.map((s, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start">
                <Input
                  value={s.timestamp}
                  onChange={(e) => setSnap(i, { timestamp: e.target.value })}
                  placeholder="Time"
                  className="h-8 text-xs col-span-2"
                  disabled={readOnly}
                />
                <Input
                  value={s.action}
                  onChange={(e) => setSnap(i, { action: e.target.value })}
                  placeholder="Action..."
                  className="h-8 text-xs col-span-4"
                  disabled={readOnly}
                />
                <Input
                  value={s.condition}
                  onChange={(e) => setSnap(i, { condition: e.target.value })}
                  placeholder="Condition..."
                  className="h-8 text-xs col-span-4"
                  disabled={readOnly}
                />
                <label className="col-span-2 flex items-center gap-1 text-[11px] text-slate-600">
                  <input
                    type="checkbox"
                    checked={s.isIncident}
                    onChange={(e) => setSnap(i, { isIncident: e.target.checked })}
                    disabled={readOnly}
                    className="rounded border-slate-300"
                  />
                  Incident
                  {!readOnly && (
                    <button type="button" onClick={() => removeSnap(i)} className="text-slate-400 hover:text-rose-600 ml-auto">
                      <X size={11} />
                    </button>
                  )}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Causal Factors */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Causal Factors → Root Cause Tree</Label>
            {!readOnly && (
              <Button type="button" size="sm" variant="outline" onClick={addCf}>
                <Plus size={12} /> Causal Factor
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {data.causalFactors.length === 0 && <div className="text-xs text-slate-400 italic">No causal factors captured.</div>}
            {data.causalFactors.map((cf, ci) => (
              <div key={ci} className="rounded-lg border bg-slate-50/60 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Badge className="bg-violet-100 text-violet-800 border-violet-200">CF{ci + 1}</Badge>
                  <Input
                    value={cf.description}
                    onChange={(e) => setCf(ci, { description: e.target.value })}
                    placeholder="Causal factor description..."
                    className="h-8 text-sm flex-1"
                    disabled={readOnly}
                  />
                  {!readOnly && (
                    <button type="button" onClick={() => removeCf(ci)} className="text-slate-400 hover:text-rose-600 mt-1">
                      <X size={13} />
                    </button>
                  )}
                </div>
                <div className="ml-3 space-y-1.5">
                  {cf.rootCauseTree.map((rc, ri) => (
                    <div key={ri} className="grid grid-cols-12 gap-1.5 items-start">
                      <Select
                        value={rc.category}
                        onChange={(e) => setRcEntry(ci, ri, { category: e.target.value })}
                        className="h-7 text-[11px] col-span-3"
                        disabled={readOnly}
                      >
                        <option value="">Category —</option>
                        {TAPROOT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </Select>
                      <Input
                        value={rc.subcategory}
                        onChange={(e) => setRcEntry(ci, ri, { subcategory: e.target.value })}
                        placeholder="Subcategory"
                        className="h-7 text-[11px] col-span-2"
                        disabled={readOnly}
                      />
                      <Input
                        value={rc.nearRootCause}
                        onChange={(e) => setRcEntry(ci, ri, { nearRootCause: e.target.value })}
                        placeholder="Near root cause"
                        className="h-7 text-[11px] col-span-3"
                        disabled={readOnly}
                      />
                      <Input
                        value={rc.rootCause}
                        onChange={(e) => setRcEntry(ci, ri, { rootCause: e.target.value })}
                        placeholder="Root cause detail"
                        className="h-7 text-[11px] col-span-3"
                        disabled={readOnly}
                      />
                      {!readOnly && (
                        <button type="button" onClick={() => removeRcEntry(ci, ri)} className="text-slate-400 hover:text-rose-600 mt-1 col-span-1">
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                  {!readOnly && (
                    <button type="button" onClick={() => addRcEntry(ci)} className="text-[11px] text-primary-700 hover:text-primary-900">
                      <Plus size={11} className="inline" /> Add tree entry
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Generic Causes */}
        <SimpleStringList
          label="Generic Causes"
          values={data.genericCauses}
          onChange={(next) => update({ genericCauses: next })}
          readOnly={readOnly}
        />

        {/* Corrective Actions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Corrective Actions</Label>
            {!readOnly && (
              <Button type="button" size="sm" variant="outline" onClick={() => update({ correctiveActions: [...data.correctiveActions, { description: "", traceableTo: [] }] })}>
                <Plus size={12} /> Action
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            {data.correctiveActions.length === 0 && <div className="text-xs text-slate-400 italic">No corrective actions captured.</div>}
            {data.correctiveActions.map((ca, i) => (
              <div key={i} className="flex items-start gap-1">
                <Input
                  value={ca.description}
                  onChange={(e) => {
                    const next = [...data.correctiveActions]; next[i] = { ...ca, description: e.target.value };
                    update({ correctiveActions: next });
                  }}
                  placeholder="Action..."
                  disabled={readOnly}
                />
                {!readOnly && (
                  <button type="button" onClick={() => update({ correctiveActions: data.correctiveActions.filter((_, idx) => idx !== i) })} className="text-slate-400 hover:text-rose-600 mt-2">
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SimpleStringList({
  label,
  values,
  onChange,
  readOnly,
  placeholder
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  readOnly?: boolean;
  placeholder?: string;
}) {
  function add() { onChange([...values, ""]); }
  function set(i: number, val: string) { const next = [...values]; next[i] = val; onChange(next); }
  function remove(i: number) { onChange(values.filter((_, idx) => idx !== i)); }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label>{label}</Label>
        {!readOnly && (
          <Button type="button" size="sm" variant="outline" onClick={add}>
            <Plus size={12} /> Add
          </Button>
        )}
      </div>
      <div className="space-y-1.5">
        {values.length === 0 && <div className="text-xs text-slate-400 italic">None captured.</div>}
        {values.map((v, i) => (
          <div key={i} className="flex items-start gap-1">
            <Input value={v} onChange={(e) => set(i, e.target.value)} placeholder={placeholder ?? "Item..."} disabled={readOnly} />
            {!readOnly && (
              <button type="button" onClick={() => remove(i)} className="text-slate-400 hover:text-rose-600 mt-2">
                <X size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Cause Map ─────────────────────────────────────────────────────────
const IMPACT_OPTIONS: { code: ImpactCategory; label: string; tone: string }[] = [
  { code: "SAFETY", label: "Safety", tone: "bg-rose-100 text-rose-800 border-rose-200" },
  { code: "ENVIRONMENTAL", label: "Environmental", tone: "bg-teal-100 text-teal-800 border-teal-200" },
  { code: "PRODUCTION", label: "Production", tone: "bg-blue-100 text-blue-800 border-blue-200" },
  { code: "COMPLIANCE", label: "Compliance", tone: "bg-amber-100 text-amber-800 border-amber-200" },
  { code: "COST", label: "Cost", tone: "bg-violet-100 text-violet-800 border-violet-200" }
];

function CauseMapEditor({
  value,
  onChange,
  readOnly
}: {
  value: CauseMapData | null;
  onChange: (next: CauseMapData) => void;
  readOnly?: boolean;
}) {
  const data: CauseMapData = value ?? (emptyDataFor("CAUSE_MAP") as CauseMapData);

  function update(patch: Partial<CauseMapData>) {
    onChange({ ...data, ...patch });
  }
  function toggleImpact(code: ImpactCategory) {
    const set = new Set(data.impacts);
    if (set.has(code)) set.delete(code); else set.add(code);
    update({ impacts: [...set] });
  }
  function addNode(parentId: string | null) {
    const id = Math.random().toString(36).slice(2, 10);
    update({ causeNodes: [...data.causeNodes, { id, description: "", parentId }] });
  }
  function setNode(id: string, patch: Partial<{ description: string; parentId: string | null }>) {
    update({ causeNodes: data.causeNodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
  }
  function removeNode(id: string) {
    // also remove descendants
    const toRemove = new Set<string>([id]);
    let added = true;
    while (added) {
      added = false;
      for (const n of data.causeNodes) {
        if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
          toRemove.add(n.id);
          added = true;
        }
      }
    }
    update({ causeNodes: data.causeNodes.filter((n) => !toRemove.has(n.id)) });
  }

  // Build a tree for rendering
  const rootNodes = data.causeNodes.filter((n) => n.parentId === null);
  function childrenOf(id: string) { return data.causeNodes.filter((n) => n.parentId === id); }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cause Map</CardTitle>
        <CardDescription>
          Impact-led cause-and-effect chain. Pick the impact categories, then build a "caused-by" tree from the root event back to underlying causes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Impacts Assessed</Label>
          <div className="flex flex-wrap gap-1.5">
            {IMPACT_OPTIONS.map((opt) => {
              const selected = data.impacts.includes(opt.code);
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => toggleImpact(opt.code)}
                  disabled={readOnly}
                  className={cn(
                    "px-2.5 py-1 rounded-full border text-xs transition",
                    selected ? opt.tone : "border-slate-200 text-slate-600 hover:border-slate-300"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Root Event</Label>
          <Input
            value={data.rootEvent}
            onChange={(e) => update({ rootEvent: e.target.value })}
            placeholder="The event whose causes are being mapped..."
            disabled={readOnly}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Cause Chain</Label>
            {!readOnly && (
              <Button type="button" size="sm" variant="outline" onClick={() => addNode(null)}>
                <Plus size={12} /> Top-level cause
              </Button>
            )}
          </div>
          {rootNodes.length === 0 ? (
            <div className="text-xs text-slate-400 italic">No causes captured.</div>
          ) : (
            <div className="space-y-2">
              {rootNodes.map((n) => (
                <CauseNodeRow
                  key={n.id}
                  node={n}
                  childrenOf={childrenOf}
                  setNode={setNode}
                  addNode={addNode}
                  removeNode={removeNode}
                  depth={0}
                  readOnly={readOnly}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CauseNodeRow({
  node,
  childrenOf,
  setNode,
  addNode,
  removeNode,
  depth,
  readOnly
}: {
  node: { id: string; description: string; parentId: string | null };
  childrenOf: (id: string) => { id: string; description: string; parentId: string | null }[];
  setNode: (id: string, patch: any) => void;
  addNode: (parentId: string | null) => void;
  removeNode: (id: string) => void;
  depth: number;
  readOnly?: boolean;
}) {
  const kids = childrenOf(node.id);
  return (
    <div className="space-y-1.5" style={{ marginLeft: depth * 16 }}>
      <div className="flex items-start gap-1">
        <ChevronRight size={14} className="text-slate-400 mt-2 flex-shrink-0" />
        <Input
          value={node.description}
          onChange={(e) => setNode(node.id, { description: e.target.value })}
          placeholder="Caused by..."
          className="flex-1 h-8 text-sm"
          disabled={readOnly}
        />
        {!readOnly && (
          <>
            <button type="button" onClick={() => addNode(node.id)} className="text-primary-700 hover:text-primary-900 mt-1">
              <Plus size={13} />
            </button>
            <button type="button" onClick={() => removeNode(node.id)} className="text-slate-400 hover:text-rose-600 mt-1">
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>
      {kids.length > 0 && (
        <div className="border-l-2 border-slate-200 pl-2 space-y-1.5">
          {kids.map((c) => (
            <CauseNodeRow
              key={c.id}
              node={c}
              childrenOf={childrenOf}
              setNode={setNode}
              addNode={addNode}
              removeNode={removeNode}
              depth={0}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}
