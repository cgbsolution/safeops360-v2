"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, Handle, Position, MarkerType,
  useNodesState, useEdgesState, type Node, type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Select } from "@/components/ui/select";
import { DOMAIN_COLOR, DOMAIN_LABEL, type CauseRiskGraph } from "../lib";

function CauseNode({ data }: { data: any }) {
  return (
    <div className="rounded-lg border-2 border-slate-900 bg-slate-900 px-3 py-2 text-white shadow-md">
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">Root cause</div>
      <div className="max-w-[170px] text-[12px] font-semibold leading-tight">{data.label}</div>
      {data.sublabel && <div className="text-[10px] opacity-60">{data.sublabel}</div>}
    </div>
  );
}

function RiskNode({ data }: { data: any }) {
  const bg = data.colorHex ?? "#475569";
  return (
    <div className="rounded-lg border-2 px-3 py-2 text-white shadow-md" style={{ backgroundColor: bg, borderColor: "rgba(255,255,255,0.5)" }}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-bold">{data.label}</span>
        {data.band && <span className="rounded bg-white/25 px-1 text-[9px] font-semibold">{data.band}</span>}
      </div>
      {data.sublabel && <div className="mt-0.5 max-w-[150px] truncate text-[11px] opacity-90">{data.sublabel}</div>}
      {data.domain && <div className="text-[9px] uppercase tracking-wide opacity-70">{DOMAIN_LABEL[data.domain] ?? data.domain}</div>}
    </div>
  );
}

const nodeTypes = { cause: CauseNode, risk: RiskNode };

function layout(graph: CauseRiskGraph): { nodes: Node[]; edges: Edge[] } {
  const causes = graph.nodes.filter((n) => n.type === "cause");
  const risks = graph.nodes.filter((n) => n.type === "risk");
  const nodes: Node[] = [];
  causes.forEach((c, i) => {
    nodes.push({ id: c.id, type: "cause", position: { x: 40, y: 60 + i * 150 }, data: c as any });
  });
  const cols = 3;
  risks.forEach((r, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    nodes.push({ id: r.id, type: "risk", position: { x: 380 + col * 220, y: 40 + row * 110 }, data: r as any });
  });
  const edges: Edge[] = graph.edges.map((e) => {
    const isChain = e.source.startsWith("risk:");
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      animated: !isChain,
      style: {
        stroke: isChain ? "#94a3b8" : "#6366f1",
        strokeWidth: Math.max(1, (e.weight ?? 0.5) * 3),
        strokeDasharray: isChain ? "4 4" : undefined,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: isChain ? "#94a3b8" : "#6366f1" },
      label: e.contributionType ?? undefined,
      labelStyle: { fontSize: 9, fill: "#64748b" },
    };
  });
  return { nodes, edges };
}

export function CauseToRiskMap({ graph, focusOptions, focusValue }: {
  graph: CauseRiskGraph;
  focusOptions: { id: string; label: string }[];
  focusValue: string;
}) {
  const router = useRouter();
  const initial = useMemo(() => layout(graph), [graph]);
  const [nodes, , onNodesChange] = useNodesState(initial.nodes);
  const [edges, , onEdgesChange] = useEdgesState(initial.edges);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Focus root cause</span>
        <Select
          value={focusValue}
          onChange={(e) => {
            const v = e.target.value;
            router.push(v ? `/erm/rca/map?subCauseId=${v}` : "/erm/rca/map");
          }}
        >
          <option value="">Top recurring drivers</option>
          {focusOptions.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </Select>
        <span className="ml-auto flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-5 bg-indigo-500" /> cause → risk</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-slate-400" /> risk → risk chain</span>
        </span>
      </div>

      {graph.nodes.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
          No approved RCAs with risk links yet.
        </div>
      ) : (
        <div className="h-[640px] overflow-hidden rounded-xl border border-slate-200 bg-white">
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      )}
    </div>
  );
}
