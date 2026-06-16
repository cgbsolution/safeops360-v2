"use client";

import { useMemo, useState } from "react";
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AlertTriangle } from "lucide-react";
import type { DependencyMap } from "@/app/(dashboard)/erm/lib-p3";

const CRIT_HEX: Record<string, string> = {
  VITAL: "#C0392B",
  ESSENTIAL: "#E67E22",
  IMPORTANT: "#E6A817",
  DEFERRABLE: "#94a3b8",
};
const DEP_LABEL: Record<string, string> = {
  UPSTREAM_PROCESS: "Upstream Process",
  IT_SYSTEM: "IT System",
  EQUIPMENT: "Equipment",
  VENDOR: "Vendor",
  PEOPLE_SKILL: "People / Skill",
  UTILITY: "Utility",
  FACILITY: "Facility",
};

type ProcData = { label: string; criticality: string | null; fanCount: number };
type DepData = { label: string; depType: string; isSpof: boolean; fanIn: number };
type ProcNode = Node<ProcData, "proc">;
type DepNode = Node<DepData, "dep">;

function ProcessNode({ data }: NodeProps<ProcNode>) {
  const hex = CRIT_HEX[data.criticality ?? ""] ?? "#475569";
  return (
    <div className="rounded-lg border-2 bg-white px-3 py-2 shadow-sm" style={{ borderColor: hex }}>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <div className="max-w-[200px] text-[11px] font-semibold leading-tight text-slate-800">{data.label}</div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span className="rounded px-1 py-0.5 text-[9px] font-bold uppercase text-white" style={{ backgroundColor: hex }}>{data.criticality ?? "—"}</span>
        {data.fanCount > 0 && <span className="text-[9px] text-slate-400">{data.fanCount} deps</span>}
      </div>
    </div>
  );
}

function DepNodeView({ data }: NodeProps<DepNode>) {
  const spof = data.isSpof;
  return (
    <div
      className="rounded-lg border-2 px-3 py-2 shadow-sm"
      style={{ borderColor: spof ? "#C0392B" : "#cbd5e1", backgroundColor: spof ? "#fef2f2" : "#f8fafc" }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="flex items-center gap-1 text-[11px] font-semibold leading-tight text-slate-800">
        {spof && <AlertTriangle size={11} className="text-rose-600" />}
        <span className="max-w-[180px]">{data.label}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span className="rounded bg-slate-200 px-1 py-0.5 text-[9px] font-medium text-slate-600">{DEP_LABEL[data.depType] ?? data.depType}</span>
        {data.fanIn > 1 && <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold text-amber-700">shared ×{data.fanIn}</span>}
        {spof && <span className="text-[9px] font-semibold uppercase text-rose-600">SPOF</span>}
      </div>
    </div>
  );
}

const nodeTypes = { proc: ProcessNode, dep: DepNodeView };

function Inner({ map }: { map: DependencyMap }) {
  const [spofOnly, setSpofOnly] = useState(false);

  // fan-in count per dependency node (how many processes point at it)
  const fanIn = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of map.edges) m.set(e.target, (m.get(e.target) ?? 0) + 1);
    return m;
  }, [map.edges]);
  const fanOut = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of map.edges) m.set(e.source, (m.get(e.source) ?? 0) + 1);
    return m;
  }, [map.edges]);

  const { initialNodes, initialEdges } = useMemo(() => {
    const procNodes = map.nodes.filter((n) => n.nodeType === "PROCESS");
    const depNodes = map.nodes.filter((n) => n.nodeType !== "PROCESS");

    // SPOF-only filter keeps SPOF deps + the processes that reach them.
    let visDeps = depNodes;
    let visProcIds = new Set(procNodes.map((p) => p.id));
    let visEdges = map.edges;
    if (spofOnly) {
      visDeps = depNodes.filter((d) => d.isSpof);
      const spofIds = new Set(visDeps.map((d) => d.id));
      visEdges = map.edges.filter((e) => spofIds.has(e.target));
      visProcIds = new Set(visEdges.map((e) => e.source));
    }

    const nodes: (ProcNode | DepNode)[] = [];
    const visibleProcs = procNodes.filter((p) => visProcIds.has(p.id));
    visibleProcs.forEach((p, i) => {
      nodes.push({
        id: p.id,
        type: "proc",
        position: { x: 0, y: i * 96 },
        data: { label: p.label, criticality: p.criticality, fanCount: fanOut.get(p.id) ?? 0 },
      });
    });
    visDeps.forEach((d, i) => {
      nodes.push({
        id: d.id,
        type: "dep",
        position: { x: 520, y: i * 84 },
        data: { label: d.label, depType: d.nodeType, isSpof: d.isSpof, fanIn: fanIn.get(d.id) ?? 0 },
      });
    });

    const edges: Edge[] = visEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "default" as const,
      markerEnd: { type: MarkerType.ArrowClosed, color: e.isSpof ? "#C0392B" : "#94a3b8" },
      style: { stroke: e.isSpof ? "#C0392B" : "#cbd5e1", strokeWidth: e.isSpof ? 1.8 : 1.2 },
    }));
    return { initialNodes: nodes, initialEdges: edges };
  }, [map, spofOnly, fanIn, fanOut]);

  const [nodes, , onNodesChange] = useNodesState<ProcNode | DepNode>(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState<Edge>(initialEdges);

  const spofCount = map.nodes.filter((n) => n.nodeType !== "PROCESS" && n.isSpof).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs">
        <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2" style={{ borderColor: CRIT_HEX.VITAL }} /> Vital</div>
        <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2" style={{ borderColor: CRIT_HEX.ESSENTIAL }} /> Essential</div>
        <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 bg-rose-50" style={{ borderColor: "#C0392B" }} /> Unmitigated SPOF</div>
        <div className="flex items-center gap-1.5"><span className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700">shared ×n</span> Shared dependency</div>
        <button
          type="button"
          onClick={() => setSpofOnly((v) => !v)}
          className={"ml-auto inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-medium transition-colors " + (spofOnly ? "border-rose-600 bg-rose-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")}
        >
          <AlertTriangle size={13} /> {spofOnly ? "Showing SPOFs only" : `Show SPOFs only (${spofCount})`}
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50" style={{ height: "72vh" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodesConnectable={false}
          fitView
          minZoom={0.15}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#cbd5e1" gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

export function DepMapView({ map }: { map: DependencyMap }) {
  return (
    <ReactFlowProvider>
      <Inner map={map} />
    </ReactFlowProvider>
  );
}
