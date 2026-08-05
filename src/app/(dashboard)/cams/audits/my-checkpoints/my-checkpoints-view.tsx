"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, ArrowRight, Inbox, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MyCheckpointsResponse, MyAuditGroup, MyCheckpointItem,
  STATUS_CHIP, STATUS_LABEL, CRITICALITY_CHIP, CRITICALITY_FALLBACK, VALUE_META, Chip,
} from "../lib";

export function MyCheckpointsView({ data }: { data: MyCheckpointsResponse }) {
  const [needsOnly, setNeedsOnly] = useState(false);

  const audits = useMemo(() => {
    if (!needsOnly) return data.audits;
    return data.audits
      .map((a) => ({ ...a, items: a.items.filter((i) => i.needsResponse) }))
      .filter((a) => a.items.length > 0);
  }, [data.audits, needsOnly]);

  if (data.totals.total === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
        <Inbox size={28} className="text-slate-300" />
        <div className="text-sm font-medium text-slate-600">No checkpoints assigned to you</div>
        <div className="text-xs text-slate-400">When a Plant Head allocates audit checkpoints to you, they appear here.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Totals + filter */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <Stat label="Assigned checkpoints" value={data.totals.total} />
        <Stat label="Across audits" value={data.totals.audits} />
        <Stat label="Needs my response" value={data.totals.needsResponse} accent={data.totals.needsResponse > 0} />
        <button
          type="button"
          onClick={() => setNeedsOnly((v) => !v)}
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
            needsOnly ? "border-amber-500 bg-amber-500 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
          )}
        >
          Needs my response
          {data.totals.needsResponse > 0 && (
            <span className={cn("rounded-full px-1.5 text-[10px] font-bold", needsOnly ? "bg-white/25" : "bg-amber-100 text-amber-700")}>{data.totals.needsResponse}</span>
          )}
        </button>
      </div>

      {audits.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <CheckCircle2 size={26} className="text-emerald-400" />
          <div className="text-sm font-medium text-slate-600">Nothing needs your response right now.</div>
        </div>
      )}

      {audits.map((a) => <AuditCard key={a.auditId} a={a} />)}
    </div>
  );
}

function AuditCard({ a }: { a: MyAuditGroup }) {
  // Group items by discipline.
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: MyCheckpointItem[] }>();
    for (const i of [...a.items].sort((x, y) => x.sequence - y.sequence)) {
      let g = map.get(i.categoryId);
      if (!g) { g = { name: i.categoryName, items: [] }; map.set(i.categoryId, g); }
      g.items.push(i);
    }
    return [...map.values()];
  }, [a.items]);

  const sc = a.scorecard;

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <ClipboardList size={16} className="text-primary-700" />
        <Link href={`/cams/audits/${a.auditId}`} className="text-sm font-semibold text-slate-800 hover:text-primary-700">{a.title}</Link>
        <span className="font-mono text-[11px] text-slate-400">{a.auditNumber}</span>
        <Chip map={STATUS_CHIP} value={a.status} label={STATUS_LABEL[a.status] ?? a.status} className="text-[10px]" />
        <div className="ml-auto flex items-center gap-1.5 text-[11px]">
          <ScorePill label="✓" v={sc.pass} cls="bg-emerald-100 text-emerald-800" />
          <ScorePill label="~" v={sc.partial} cls="bg-amber-100 text-amber-800" />
          <ScorePill label="✗" v={sc.fail} cls="bg-rose-100 text-rose-700" />
          <ScorePill label="N/A" v={sc.na} cls="bg-slate-100 text-slate-500" />
          <ScorePill label="—" v={sc.not_assessed} cls="bg-slate-100 text-slate-400" />
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.name}>
          <div className="bg-slate-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{g.name}</div>
          <div className="divide-y divide-slate-100">
            {g.items.map((i) => <Row key={i.id} auditId={a.auditId} i={i} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function Row({ auditId, i }: { auditId: string; i: MyCheckpointItem }) {
  const raw = i.auditorResponse?.value ?? null;
  const val = raw === "yes" ? "pass" : raw === "no" ? "fail" : raw; // normalize like the scorecard
  const meta = (val && VALUE_META[val]) || { label: "Not assessed", chip: "bg-slate-100 text-slate-500", dot: "bg-slate-300" };
  const actionable = i.needsResponse; // fail/partial awaiting my response

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <span className={cn("size-2 shrink-0 rounded-full", meta.dot)} />
      <span className="font-mono text-[11px] text-slate-500">{i.checkpointCode}</span>
      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase", CRITICALITY_CHIP[i.criticality] ?? CRITICALITY_FALLBACK)}>{i.criticality}</span>
      {i.isAdHoc && <span className="rounded bg-violet-100 px-1 text-[9px] font-semibold uppercase text-violet-700">custom</span>}
      <span className="min-w-0 flex-1 truncate text-[13px] text-slate-700">{i.checkpointQuestion}</span>
      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.chip)}>{meta.label}</span>
      {actionable ? (
        <Link href={`/cams/audits/${auditId}`} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-600">
          Respond <ArrowRight size={11} />
        </Link>
      ) : (
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-300">read-only</span>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="text-sm">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={cn("text-xl font-extrabold tabular-nums", accent ? "text-amber-600" : "text-slate-800")}>{value}</div>
    </div>
  );
}

function ScorePill({ label, v, cls }: { label: string; v: number; cls: string }) {
  if (v === 0) return null;
  return <span className={cn("rounded-full px-1.5 py-0.5 font-semibold tabular-nums", cls)}>{label} {v}</span>;
}
