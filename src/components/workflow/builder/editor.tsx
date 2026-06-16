"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Save, Play, Pause, Sparkles, Loader2, Trash2, AlertTriangle, CheckCircle2, Info,
  History, Undo2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, humanize } from "@/lib/utils";

import { StepNode, InserterNode, TriggerNode } from "./step-node";
import { PropertiesPanel } from "./properties-panel";
import { VersionHistoryDrawer } from "./version-history";
import { TestRunPanel } from "./test-run-panel";
import {
  type DefinitionDTO,
  type EditorStep,
  type StepType,
  dtoStepToEditor
} from "./types";

const NODE_WIDTH = 288;
const NODE_GAP = 70;
const X_CENTER = 0;

const nodeTypes: NodeTypes = {
  step: StepNode as any,
  inserter: InserterNode as any,
  trigger: TriggerNode as any
};

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function toEditorSteps(initial: DefinitionDTO): EditorStep[] {
  return initial.steps
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((s) => dtoStepToEditor(s, uid()));
}

export function WorkflowEditor({ initial }: { initial: DefinitionDTO }) {
  return (
    <ReactFlowProvider>
      <EditorInner initial={initial} />
    </ReactFlowProvider>
  );
}

function EditorInner({ initial }: { initial: DefinitionDTO }) {
  const router = useRouter();
  const initialSteps = useMemo(() => toEditorSteps(initial), [initial]);
  const [steps, setSteps] = useState<EditorStep[]>(initialSteps);
  // The "saved baseline" used to compute dirty state and to revert on discard.
  // Updated after every successful save. Stored as a JSON string for cheap equality checks.
  const [baseline, setBaseline] = useState<string>(() => JSON.stringify(initialSteps));
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [isActive, setIsActive] = useState(initial.isActive);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>("Loaded");
  const [highlightedSeq, setHighlightedSeq] = useState<number | null>(null);
  const [editingHeader, setEditingHeader] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);

  // Compute dirty = current state differs from baseline
  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        name,
        description,
        isActive,
        steps
      }),
    [name, description, isActive, steps]
  );
  const baselineSnapshot = useMemo(
    () =>
      JSON.stringify({
        name: initial.name,
        description: initial.description ?? "",
        isActive: initial.isActive,
        steps: initialSteps
      }),
    [initial, initialSteps]
  );
  const dirty = currentSnapshot !== baseline && currentSnapshot !== baselineSnapshot ? true : currentSnapshot !== baseline;

  // ─── Step mutations ────────────────────────────────────────────────────
  function updateStep(clientId: string, next: EditorStep) {
    setSteps((prev) => prev.map((s) => (s.clientId === clientId ? { ...next, clientId } : s)));
  }

  function deleteStep(clientId: string) {
    setSteps((prev) => prev.filter((s) => s.clientId !== clientId));
    if (selectedClientId === clientId) setSelectedClientId(null);
  }

  function duplicateStep(clientId: string) {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.clientId === clientId);
      if (idx < 0) return prev;
      const orig = prev[idx];
      // Maker can't be duplicated. Closure can't be duplicated either (only one allowed).
      if (orig.stepType === "MAKER" || orig.stepType === "CLOSURE") return prev;
      const copy: EditorStep = {
        ...orig,
        clientId: uid(),
        serverId: undefined,
        name: orig.name + " (copy)"
      };
      const next = prev.slice();
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }

  function moveStep(clientId: string, dir: -1 | 1) {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.clientId === clientId);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      // Maker stays first; Closure stays last.
      if (prev[idx].stepType === "MAKER" || prev[target].stepType === "MAKER") return prev;
      if (prev[idx].stepType === "CLOSURE" || prev[target].stepType === "CLOSURE") return prev;
      const next = prev.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function insertStepAt(index: number) {
    const newStep: EditorStep = {
      clientId: uid(),
      sequence: 0,
      stepType: "CHECKER",
      name: "New step",
      approverRole: "HSE_MANAGER",
      approverField: null,
      approverUserId: null,
      approverGroupRoles: null,
      slaHours: 24,
      slaUnit: "HOURS",
      escalationRole: null,
      isOptional: false,
      conditionExpr: null,
      notes: null
    };
    setSteps((prev) => {
      const next = prev.slice();
      // Don't allow inserting after the closure step.
      const closureIdx = prev.findIndex((s) => s.stepType === "CLOSURE");
      const safeIndex = closureIdx >= 0 && index > closureIdx ? closureIdx : index;
      next.splice(safeIndex, 0, newStep);
      return next;
    });
    setSelectedClientId(newStep.clientId);
  }

  // ─── Build nodes & edges from steps ────────────────────────────────────
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    let y = 0;
    nodes.push({
      id: "trigger",
      type: "trigger",
      position: { x: X_CENTER, y },
      data: { module: initial.module, recordType: initial.recordType },
      draggable: false,
      selectable: false
    });
    y += 110 + NODE_GAP;

    steps.forEach((step, i) => {
      if (i > 0) {
        const inserterId = `inserter-${step.clientId}`;
        nodes.push({
          id: inserterId,
          type: "inserter",
          position: { x: X_CENTER + NODE_WIDTH / 2 - 14, y: y - NODE_GAP / 2 - 14 },
          data: { onClick: () => insertStepAt(i) },
          draggable: false,
          selectable: false
        });
      }
      const isHighlighted = highlightedSeq === i + 1;

      nodes.push({
        id: step.clientId,
        type: "step",
        position: { x: X_CENTER, y },
        draggable: false,
        // selectable MUST be true here — ReactFlow's NodeWrapper consumes pointer events
        // (drag/pan detection) before child onClicks can fire when selectable is false +
        // panOnDrag is on. Selecting + onNodeClick is how clicks reach React.
        selectable: true,
        data: {
          step: { ...step, sequence: i + 1 },
          selected: selectedClientId === step.clientId,
          isFirst: i === 0,
          isLast: i === steps.length - 1,
          highlight: isHighlighted ? "running" : "idle",
          onSelect: () => setSelectedClientId(step.clientId),
          onDelete: () => deleteStep(step.clientId),
          onDuplicate: () => duplicateStep(step.clientId),
          onMoveUp: () => moveStep(step.clientId, -1),
          onMoveDown: () => moveStep(step.clientId, 1)
        }
      });

      y += 150 + NODE_GAP;
    });

    if (steps.length > 0) {
      const lastIdx = steps.length;
      nodes.push({
        id: "inserter-end",
        type: "inserter",
        position: { x: X_CENTER + NODE_WIDTH / 2 - 14, y: y - NODE_GAP / 2 - 14 },
        data: { onClick: () => insertStepAt(lastIdx) },
        draggable: false,
        selectable: false
      });
    }

    if (steps.length > 0) {
      edges.push({
        id: "edge-trigger-first",
        source: "trigger",
        target: steps[0].clientId,
        type: "smoothstep",
        animated: false,
        style: { stroke: "#cbd5e1", strokeWidth: 2, strokeDasharray: "4 4" }
      });

      for (let i = 0; i < steps.length - 1; i++) {
        const a = steps[i], b = steps[i + 1];
        const isConditional = !!b.conditionExpr;
        edges.push({
          id: `edge-${a.clientId}-${b.clientId}`,
          source: a.clientId,
          target: b.clientId,
          type: "smoothstep",
          animated: false,
          // Conditional edges are amber + dashed to flag the fork visually.
          style: {
            stroke: isConditional ? "#f59e0b" : "#cbd5e1",
            strokeWidth: 2,
            strokeDasharray: isConditional ? "6 3" : "4 4"
          },
          label: isConditional ? "if" : undefined,
          labelBgStyle: isConditional ? { fill: "#fef3c7" } : undefined,
          labelStyle: isConditional ? { fill: "#92400e", fontSize: 10, fontWeight: 600 } : undefined
        });
      }
    }

    return { nodes, edges };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, selectedClientId, initial.module, initial.recordType, highlightedSeq]);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => { setRfNodes(nodes); }, [nodes, setRfNodes]);
  useEffect(() => { setRfEdges(edges); }, [edges, setRfEdges]);

  const selectedStep = steps.find((s) => s.clientId === selectedClientId) ?? null;
  const selectedIndex = selectedStep ? steps.findIndex((s) => s.clientId === selectedClientId) : -1;

  useEffect(() => {
    if (selectedClientId && !steps.some((s) => s.clientId === selectedClientId)) {
      setSelectedClientId(null);
    }
  }, [steps, selectedClientId]);

  // ─── Validation (mirrors server-side rules) ───────────────────────────
  const issues = useMemo(() => {
    const out: string[] = [];
    if (steps.length === 0) out.push("Workflow must have at least one step.");
    const makerCount = steps.filter((s) => s.stepType === "MAKER").length;
    if (makerCount !== 1) out.push("Workflow must have exactly one Maker step.");
    if (steps[0]?.stepType !== "MAKER") out.push("First step must be the Maker.");
    const closureCount = steps.filter((s) => s.stepType === "CLOSURE").length;
    if (closureCount !== 1) out.push("Workflow must have exactly one Closure step.");
    if (steps.length > 0 && steps[steps.length - 1].stepType !== "CLOSURE") out.push("Last step must be the Closure.");
    if (!steps.some((s) => s.stepType === "CHECKER" || s.stepType === "ASSIGNEE_TASK")) {
      out.push("Add at least one Checker or Assignee step between Maker and Closure.");
    }
    steps.forEach((s, i) => {
      if (!s.name.trim()) out.push(`Step ${i + 1} is missing a name.`);
      if (
        i > 0 &&
        s.stepType !== "CLOSURE" &&
        !s.approverRole &&
        !s.approverField &&
        !s.approverUserId &&
        !(s.approverGroupRoles && s.approverGroupRoles.length > 0)
      ) {
        out.push(`Step ${i + 1} ("${s.name || "untitled"}") has no assignee.`);
      }
    });
    return out;
  }, [steps]);

  // ─── Save ─────────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (issues.length > 0) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/workflow/definitions/${initial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          module: initial.module,
          recordType: initial.recordType,
          isActive,
          steps: steps.map((s, i) => ({
            sequence: i + 1,
            stepType: s.stepType,
            name: s.name,
            approverRole: s.approverRole,
            approverField: s.approverField,
            approverUserId: s.approverUserId,
            approverGroupRoles:
              s.approverGroupRoles && s.approverGroupRoles.length > 0
                ? JSON.stringify(s.approverGroupRoles)
                : null,
            slaHours: s.slaHours,
            slaUnit: s.slaUnit,
            escalationRole: s.escalationRole,
            isOptional: s.isOptional,
            conditionExpr: s.conditionExpr,
            notes: s.notes
          }))
        })
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setSaved(`Save failed: ${j.error ?? r.status}`);
        return;
      }
      // Update baseline so dirty state clears.
      setBaseline(JSON.stringify({ name: name.trim(), description: description.trim() ?? "", isActive, steps }));
      setSaved("Saved · " + new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }, [initial.id, initial.module, initial.recordType, name, description, isActive, steps, issues, router]);

  // Cmd/Ctrl+S to save
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && !busy && issues.length === 0) save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, busy, issues.length, save]);

  // ─── Discard ───────────────────────────────────────────────────────────
  function discard() {
    if (!dirty) return;
    if (!confirm("Discard all unsaved changes?")) return;
    // Restore from initial server-rendered DTO, not the live baseline (which may include
    // saved-but-not-yet-refreshed state). The live baseline is rebuilt on the next save.
    setSteps(toEditorSteps(initial));
    setName(initial.name);
    setDescription(initial.description ?? "");
    setIsActive(initial.isActive);
    setSelectedClientId(null);
    setSaved("Discarded");
  }

  async function toggleActive() {
    const next = !isActive;
    setIsActive(next);
    await fetch(`/api/workflow/definitions/${initial.id}/toggle`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next })
    });
    setSaved(next ? "Activated" : "Deactivated");
  }

  async function deleteDefinition() {
    if (!confirm(`Delete the workflow "${name}"? This cannot be undone.`)) return;
    setBusy(true);
    const r = await fetch(`/api/workflow/definitions/${initial.id}`, { method: "DELETE" });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(j.error ?? "Failed to delete");
      return;
    }
    router.push("/configuration/workflows");
    router.refresh();
  }

  return (
    <div className="-m-4 lg:-m-8 h-[calc(100vh-9rem)] flex flex-col bg-slate-100">
      <div className="flex items-center justify-between gap-3 bg-white border-b px-5 py-3 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link href="/configuration/workflows" className="text-slate-500 hover:text-slate-900 flex-shrink-0">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            {editingHeader ? (
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setEditingHeader(false)}
                onKeyDown={(e) => { if (e.key === "Enter") setEditingHeader(false); }}
                className="h-8 text-base font-semibold"
              />
            ) : (
              <button className="text-left max-w-full" onClick={() => setEditingHeader(true)} title="Click to rename">
                <div className="text-base font-semibold text-slate-900 truncate hover:text-primary-700">
                  {name || "Untitled workflow"}
                </div>
              </button>
            )}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{humanize(initial.module)}</span>
              {initial.recordType && <><span>·</span><span>{humanize(initial.recordType)}</span></>}
              <span>·</span>
              <span>{steps.length} step{steps.length === 1 ? "" : "s"}</span>
              {initial.instanceCount > 0 && (
                <>
                  <span>·</span>
                  <span>{initial.instanceCount} run{initial.instanceCount === 1 ? "" : "s"}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {dirty ? (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Unsaved
            </span>
          ) : (
            saved && (
              <span className="text-xs text-emerald-700 flex items-center gap-1">
                <CheckCircle2 size={12} /> {saved}
              </span>
            )
          )}

          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)} title="Version history">
            <History size={13} /> History
          </Button>

          <Button
            variant={isActive ? "outline" : "secondary"}
            size="sm"
            onClick={toggleActive}
            title={isActive ? "Deactivate this workflow" : "Activate this workflow"}
          >
            {isActive ? <><Pause size={13} /> Turn off</> : <><Play size={13} /> Turn on</>}
          </Button>

          <Button variant="outline" size="sm" onClick={() => setTestOpen(true)} disabled={steps.length === 0}>
            <Sparkles size={13} /> Test run
          </Button>

          {dirty && (
            <Button variant="outline" size="sm" onClick={discard} disabled={busy}>
              <Undo2 size={13} /> Discard
            </Button>
          )}

          <Button
            size="sm"
            onClick={save}
            disabled={busy || !dirty || issues.length > 0}
            title={issues[0] ?? "Save changes"}
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
          </Button>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-2 text-xs text-amber-800 flex items-start gap-2 flex-shrink-0">
          <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-semibold">Fix before saving:</span>{" "}
            {issues.slice(0, 2).join(" · ")}
            {issues.length > 2 && <span className="text-amber-700"> +{issues.length - 2} more</span>}
          </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 relative">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
            minZoom={0.4}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
            onPaneClick={() => setSelectedClientId(null)}
            // ReactFlow-level click handler. Inner div onClicks no longer fire reliably
            // for nodes once panOnDrag is enabled — onNodeClick is the supported path.
            onNodeClick={(_e, node) => {
              if (node.type === "step") setSelectedClientId(node.id);
            }}
            nodesDraggable={false}
            nodesConnectable={false}
            edgesFocusable={false}
            elementsSelectable={true}
            panOnDrag
            zoomOnDoubleClick={false}
          >
            <Background gap={20} size={1} color="#cbd5e1" />
            <Controls position="bottom-left" showInteractive={false} className="!shadow-md !border !border-slate-200 !rounded-lg overflow-hidden" />
          </ReactFlow>

          {!selectedStep && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur border border-slate-200 rounded-full px-3 py-1.5 text-[11px] text-slate-600 flex items-center gap-1.5 pointer-events-none">
              <Info size={11} /> Click a step to edit · click a + to insert · drag to pan
            </div>
          )}

          {initial.instanceCount === 0 && (
            <button
              onClick={deleteDefinition}
              disabled={busy}
              className="absolute bottom-4 right-4 text-[11px] text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 bg-white border border-rose-200 rounded-md px-2 py-1 shadow-sm"
            >
              <Trash2 size={11} /> Delete workflow
            </button>
          )}
        </div>

        {selectedStep && (
          <PropertiesPanel
            step={{ ...selectedStep, sequence: selectedIndex + 1 }}
            isFirst={selectedIndex === 0}
            onChange={(next) => updateStep(selectedStep.clientId, next)}
            onDelete={() => deleteStep(selectedStep.clientId)}
            onClose={() => setSelectedClientId(null)}
          />
        )}
      </div>

      <VersionHistoryDrawer
        definitionId={initial.id}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRestored={() => {
          setHistoryOpen(false);
          // Force a server reload so the editor picks up the restored state cleanly.
          router.refresh();
          // The router.refresh above re-renders this server component; the resulting
          // initialSteps re-flows into state via useMemo on `initial`. To make sure the
          // baseline matches, replace the URL with itself which guarantees a fresh DTO.
          router.replace(`/configuration/workflows/${initial.id}`);
        }}
      />

      <TestRunPanel
        definitionId={initial.id}
        open={testOpen}
        draftSteps={steps}
        onClose={() => setTestOpen(false)}
        onStepHover={(seq) => setHighlightedSeq(seq)}
      />
    </div>
  );
}
