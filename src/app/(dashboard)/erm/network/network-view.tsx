"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ExternalLink, Plus, Trash2, Filter, Crosshair, X } from "lucide-react";
import { BAND_HEX, BAND_CHIP, LINKAGE_LABEL, type NetworkGraph } from "../lib";

type GraphNode = NetworkGraph["nodes"][number];
type GraphEdge = NetworkGraph["edges"][number];

type RiskNodeData = {
  riskCode: string;
  title: string;
  categoryColor: string | null;
  residualBand: string | null;
  residualScore: number | null;
  dim: boolean;
  selected: boolean;
  pickStage: 0 | 1 | 2; // 0 = not in add mode, 1 = pick source, 2 = pick target
};

type RiskFlowNode = Node<RiskNodeData, "risk">;

const LINKAGE_TYPES = ["TRIGGERS", "AMPLIFIES", "CORRELATED"] as const;
type LinkageType = (typeof LINKAGE_TYPES)[number];

// Edge stroke style per linkage type (TRIGGERS solid, AMPLIFIES dashed, CORRELATED dotted).
function edgeDash(type: string): string | undefined {
  if (type === "AMPLIFIES") return "6 4";
  if (type === "CORRELATED") return "2 4";
  return undefined; // TRIGGERS = solid
}

function edgeColor(type: string): string {
  if (type === "AMPLIFIES") return "#E67E22";
  if (type === "CORRELATED") return "#6366f1";
  return "#C0392B"; // TRIGGERS
}

// ── Custom node ──────────────────────────────────────────────────────────────
function RiskNode({ data }: NodeProps<RiskFlowNode>) {
  const bg = data.categoryColor ?? "#475569";
  const chip = BAND_CHIP[(data.residualBand ?? "").toUpperCase()] ?? "bg-white/20 text-white border-white/30";
  return (
    <div
      className="rounded-lg border-2 px-3 py-2 text-white shadow-md transition-opacity"
      style={{
        backgroundColor: bg,
        borderColor: data.selected ? "#0f172a" : "rgba(255,255,255,0.5)",
        opacity: data.dim ? 0.18 : 1,
        boxShadow: data.selected ? "0 0 0 3px rgba(15,23,42,0.35)" : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-bold tabular-nums">{data.riskCode}</span>
        {data.residualScore != null && (
          <span className="rounded bg-black/25 px-1 text-[10px] font-semibold tabular-nums">{data.residualScore}</span>
        )}
      </div>
      <div className="mt-0.5 max-w-[140px] truncate text-[11px] leading-tight opacity-95">{data.title}</div>
      {data.residualBand && (
        <span className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-[9px] font-semibold ${chip}`}>
          {data.residualBand}
        </span>
      )}
      {data.pickStage > 0 && (
        <span className="mt-1 block text-[9px] font-semibold uppercase tracking-wide text-white/90">
          {data.pickStage === 1 ? "click = source" : "click = target"}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { risk: RiskNode };

// Radial layout keyed by index — bigger radius for more nodes.
function layoutPosition(index: number, total: number): { x: number; y: number } {
  if (total <= 1) return { x: 400, y: 320 };
  const radius = Math.max(260, total * 34);
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    x: 480 + radius * Math.cos(angle),
    y: 360 + radius * Math.sin(angle),
  };
}

function nodeScale(score: number | null | undefined): number {
  if (score == null) return 1;
  // residual score 1..25 → scale ~0.9 .. 1.45
  return 0.9 + Math.min(score, 25) / 45;
}

function InnerNetwork({ graph }: { graph: NetworkGraph }) {
  const router = useRouter();

  // ── UI state ───────────────────────────────────────────────────────────────
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [isolate, setIsolate] = useState(false);

  // add-linkage mode
  const [addMode, setAddMode] = useState(false);
  const [sourcePick, setSourcePick] = useState<string | null>(null);
  const [targetPick, setTargetPick] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<LinkageType>("TRIGGERS");
  const [linkNotes, setLinkNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);

  // distinct categories present, for the filter chips
  const categories = useMemo(() => {
    const m = new Map<string, string>(); // code -> color
    for (const n of graph.nodes) {
      if (n.categoryCode) m.set(n.categoryCode, n.categoryColor ?? "#475569");
    }
    return [...m.entries()].map(([code, color]) => ({ code, color }));
  }, [graph.nodes]);

  // 1-hop neighbour set of the selected node (for isolate mode)
  const neighbourIds = useMemo(() => {
    if (!selectedNodeId) return null;
    const set = new Set<string>([selectedNodeId]);
    for (const e of graph.edges) {
      if (e.source === selectedNodeId) set.add(e.target);
      if (e.target === selectedNodeId) set.add(e.source);
    }
    return set;
  }, [selectedNodeId, graph.edges]);

  // a node passes the category filter
  const passesCategory = useCallback(
    (n: GraphNode) => activeCategories.size === 0 || (n.categoryCode != null && activeCategories.has(n.categoryCode)),
    [activeCategories],
  );

  // Which nodes are "dimmed" (out of category, or out of isolate neighbourhood)
  const isDimmed = useCallback(
    (n: GraphNode) => {
      if (!passesCategory(n)) return true;
      if (isolate && neighbourIds && !neighbourIds.has(n.id)) return true;
      return false;
    },
    [passesCategory, isolate, neighbourIds],
  );

  // ── Build React Flow nodes/edges ─────────────────────────────────────────────
  const initialNodes: RiskFlowNode[] = useMemo(() => {
    const total = graph.nodes.length;
    return graph.nodes.map((n, idx) => {
      const scale = nodeScale(n.residualScore);
      const pickStage: 0 | 1 | 2 = !addMode ? 0 : sourcePick == null ? 1 : 2;
      return {
        id: n.id,
        type: "risk" as const,
        position: layoutPosition(idx, total),
        data: {
          riskCode: n.riskCode,
          title: n.title,
          categoryColor: n.categoryColor,
          residualBand: n.residualBand,
          residualScore: n.residualScore,
          dim: isDimmed(n),
          selected: n.id === selectedNodeId || n.id === sourcePick || n.id === targetPick,
          pickStage,
        },
        style: { transform: `scale(${scale})` },
      } satisfies RiskFlowNode;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.nodes]);

  const initialEdges: Edge[] = useMemo(() => {
    return graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: LINKAGE_LABEL[e.linkageType] ?? e.linkageType,
      labelStyle: { fontSize: 10, fill: "#475569", fontWeight: 600 },
      labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.9 },
      labelBgPadding: [3, 1] as [number, number],
      type: "default" as const,
      markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor(e.linkageType) },
      style: {
        stroke: edgeColor(e.linkageType),
        strokeWidth: 1.6,
        strokeDasharray: edgeDash(e.linkageType),
      },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState<RiskFlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

  // Re-sync node visual data (dim / selected / pick) when interaction state changes,
  // without disturbing positions the user may have dragged.
  const syncedNodes = useMemo(() => {
    const pickStage: 0 | 1 | 2 = !addMode ? 0 : sourcePick == null ? 1 : 2;
    return nodes.map((rfn) => {
      const n = nodeById.get(rfn.id);
      if (!n) return rfn;
      return {
        ...rfn,
        data: {
          ...rfn.data,
          dim: isDimmed(n),
          selected: rfn.id === selectedNodeId || rfn.id === sourcePick || rfn.id === targetPick,
          pickStage,
        },
      };
    });
  }, [nodes, nodeById, isDimmed, selectedNodeId, sourcePick, targetPick, addMode]);

  const syncedEdges = useMemo(() => {
    if (!isolate || !neighbourIds) return edges;
    return edges.map((e) => ({
      ...e,
      hidden: !(neighbourIds.has(e.source) && neighbourIds.has(e.target)),
    }));
  }, [edges, isolate, neighbourIds]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const onNodeClick: NodeMouseHandler = useCallback(
    (_evt, node) => {
      setSelectedEdge(null);
      if (addMode) {
        if (sourcePick == null) {
          setSourcePick(node.id);
        } else if (node.id !== sourcePick) {
          setTargetPick(node.id);
        }
        return;
      }
      setSelectedNodeId(node.id);
    },
    [addMode, sourcePick],
  );

  const onEdgeClick: EdgeMouseHandler = useCallback(
    (_evt, edge) => {
      const ge = graph.edges.find((e) => e.id === edge.id) ?? null;
      setSelectedEdge(ge);
      setSelectedNodeId(null);
    },
    [graph.edges],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdge(null);
  }, []);

  function toggleCategory(code: string) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function resetAddMode() {
    setSourcePick(null);
    setTargetPick(null);
    setLinkNotes("");
    setActionError(null);
  }

  function toggleAddMode() {
    setAddMode((v) => !v);
    setSelectedNodeId(null);
    setSelectedEdge(null);
    resetAddMode();
  }

  async function saveLinkage() {
    if (!sourcePick || !targetPick) return;
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch("/api/erm/linkages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceRiskId: sourcePick,
          targetRiskId: targetPick,
          linkageType: linkType,
          notes: linkNotes,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.detail ?? `Failed to add linkage (${res.status})`);
      }
      setAddMode(false);
      resetAddMode();
      router.refresh();
    } catch (e: any) {
      setActionError(e?.message ?? "Failed to add linkage");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLinkage(id: string) {
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/erm/linkages/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.detail ?? `Failed to delete linkage (${res.status})`);
      }
      setSelectedEdge(null);
      router.refresh();
    } catch (e: any) {
      setActionError(e?.message ?? "Failed to delete linkage");
    } finally {
      setSaving(false);
    }
  }

  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) : null;
  const sourceNode = sourcePick ? nodeById.get(sourcePick) : null;
  const targetNode = targetPick ? nodeById.get(targetPick) : null;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <Filter size={13} /> Category
        </span>
        {categories.length === 0 && <span className="text-xs text-slate-400">No categories</span>}
        {categories.map((c) => {
          const active = activeCategories.has(c.code);
          return (
            <button
              key={c.code}
              type="button"
              onClick={() => toggleCategory(c.code)}
              className={
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors " +
                (active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")
              }
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
              {c.code}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsolate((v) => !v)}
            disabled={!selectedNodeId}
            title="Show only the selected risk and its direct neighbours"
            className={
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
              (isolate ? "border-primary-700 bg-primary-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")
            }
          >
            <Crosshair size={14} /> Isolate
          </button>
          <button
            type="button"
            onClick={toggleAddMode}
            className={
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors " +
              (addMode ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")
            }
          >
            <Plus size={14} /> {addMode ? "Adding linkage…" : "Add linkage"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
        {/* Graph */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50" style={{ height: "70vh" }}>
          <ReactFlow
            nodes={syncedNodes}
            edges={syncedEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            nodesConnectable={false}
            fitView
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#cbd5e1" gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        {/* Side panel */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          {actionError && (
            <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">{actionError}</div>
          )}

          {addMode ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Add linkage</h3>
                <button onClick={toggleAddMode} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>
              <ol className="space-y-1.5 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <span className={"flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold " + (sourceNode ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500")}>1</span>
                  {sourceNode ? <span className="font-medium text-slate-800">{sourceNode.riskCode} (source)</span> : "Click the source risk node"}
                </li>
                <li className="flex items-center gap-2">
                  <span className={"flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold " + (targetNode ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500")}>2</span>
                  {targetNode ? <span className="font-medium text-slate-800">{targetNode.riskCode} (target)</span> : "Click the target risk node"}
                </li>
              </ol>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Linkage type</label>
                <select
                  value={linkType}
                  onChange={(e) => setLinkType(e.target.value as LinkageType)}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                >
                  {LINKAGE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {LINKAGE_LABEL[t] ?? t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Notes</label>
                <textarea
                  value={linkNotes}
                  onChange={(e) => setLinkNotes(e.target.value)}
                  rows={3}
                  placeholder="Why are these connected?"
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveLinkage}
                  disabled={!sourcePick || !targetPick || saving}
                  className="flex-1 rounded-lg bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Create linkage"}
                </button>
                {(sourcePick || targetPick) && (
                  <button type="button" onClick={resetAddMode} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:border-slate-400">
                    Reset
                  </button>
                )}
              </div>
            </div>
          ) : selectedNode ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold tabular-nums text-slate-500">{selectedNode.riskCode}</span>
                  <h3 className="text-sm font-semibold leading-snug text-slate-900">{selectedNode.title}</h3>
                </div>
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: selectedNode.categoryColor ?? "#475569" }} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedNode.residualBand && (
                  <span className={"inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold " + (BAND_CHIP[selectedNode.residualBand.toUpperCase()] ?? "")}>
                    {selectedNode.residualScore != null && <span className="tabular-nums">{selectedNode.residualScore}</span>}
                    {selectedNode.residualBand}
                  </span>
                )}
                {selectedNode.categoryCode && (
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: selectedNode.categoryColor ?? "#475569" }}>
                    {selectedNode.categoryCode}
                  </span>
                )}
                <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                  {selectedNode.lifecycleState.replace(/_/g, " ")}
                </span>
              </div>
              <Link
                href={`/erm/register/${selectedNode.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-primary-700 hover:border-primary-700"
              >
                <ExternalLink size={14} /> Open Risk
              </Link>
              <button
                type="button"
                onClick={() => setIsolate((v) => !v)}
                className="block w-full rounded-lg border border-slate-200 px-3 py-1.5 text-center text-xs font-medium text-slate-600 hover:border-slate-400"
              >
                {isolate ? "Show full network" : "Isolate neighbours"}
              </button>
            </div>
          ) : selectedEdge ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Linkage</h3>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                  style={{ backgroundColor: edgeColor(selectedEdge.linkageType) }}
                >
                  {LINKAGE_LABEL[selectedEdge.linkageType] ?? selectedEdge.linkageType}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-700">{nodeById.get(selectedEdge.source)?.riskCode ?? "?"}</span>
                <span className="text-slate-400">→</span>
                <span className="font-semibold text-slate-700">{nodeById.get(selectedEdge.target)?.riskCode ?? "?"}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Notes</span>
                <p className="mt-1 text-xs text-slate-600">{selectedEdge.notes || "—"}</p>
              </div>
              <button
                type="button"
                onClick={() => deleteLinkage(selectedEdge.id)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40"
              >
                <Trash2 size={14} /> Delete linkage
              </button>
            </div>
          ) : (
            <div className="space-y-3 text-xs text-slate-500">
              <p className="text-sm font-semibold text-slate-700">Network legend</p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <svg width="36" height="8">
                    <line x1="0" y1="4" x2="36" y2="4" stroke={edgeColor("TRIGGERS")} strokeWidth="2" />
                  </svg>
                  <span>Triggers (solid)</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg width="36" height="8">
                    <line x1="0" y1="4" x2="36" y2="4" stroke={edgeColor("AMPLIFIES")} strokeWidth="2" strokeDasharray="6 4" />
                  </svg>
                  <span>Amplifies (dashed)</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg width="36" height="8">
                    <line x1="0" y1="4" x2="36" y2="4" stroke={edgeColor("CORRELATED")} strokeWidth="2" strokeDasharray="2 4" />
                  </svg>
                  <span>Correlated (dotted)</span>
                </li>
              </ul>
              <p className="pt-1">Node size scales with residual score; colour shows the risk category.</p>
              <p>Click a node or edge to inspect it. Select a node then toggle <span className="font-medium text-slate-700">Isolate</span> to focus on its direct connections.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function NetworkView({ graph }: { graph: NetworkGraph }) {
  return (
    <ReactFlowProvider>
      <InnerNetwork graph={graph} />
    </ReactFlowProvider>
  );
}
