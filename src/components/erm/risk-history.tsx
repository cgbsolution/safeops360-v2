"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

// ── Risk audit-trail timeline ────────────────────────────────────────────────
// GET /api/erm/risks/{riskId}/history → { entries: [...], total }
// Vertical timeline, newest first. Each entry: colored action badge, entityLabel,
// actor, timestamp, changed-field chips, and an expandable before→after diff.

type HistoryEntry = {
  id: string;
  entityType: string;
  entityLabel: string;
  action: string;
  actorId: string | null;
  actorName: string | null;
  actorType: string | null;
  timestamp: string;
  changedFields: string[] | null;
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  reason: string | null;
};

const ACTION_BADGE: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  UPDATE: "bg-sky-100 text-sky-800 ring-sky-200",
  STATE_TRANSITION: "bg-violet-100 text-violet-800 ring-violet-200",
  SOFT_DELETE: "bg-rose-100 text-rose-800 ring-rose-200",
};
const ACTION_DOT: Record<string, string> = {
  CREATE: "bg-emerald-500",
  UPDATE: "bg-sky-500",
  STATE_TRANSITION: "bg-violet-500",
  SOFT_DELETE: "bg-rose-500",
};

function badgeClass(action: string): string {
  return ACTION_BADGE[action] ?? "bg-slate-100 text-slate-700 ring-slate-200";
}
function dotClass(action: string): string {
  return ACTION_DOT[action] ?? "bg-slate-400";
}

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtValue(v: any): string {
  if (v == null) return "—";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

// Turn raw DB column names into plain-English audit labels. Known fields get a
// curated label; anything else falls back to camelCase → "Camel case".
const FIELD_LABEL: Record<string, string> = {
  lifecycleState: "Lifecycle state",
  state: "Workflow state",
  status: "Status",
  title: "Title",
  description: "Description",
  categoryId: "Category",
  subCategoryId: "Sub-category",
  businessUnit: "Business unit",
  plantId: "Plant / site",
  velocity: "Velocity",
  priority: "Priority",
  riskOwnerId: "Risk owner",
  riskChampionId: "Risk champion",
  appetiteThreshold: "Target / appetite",
  nextReviewDate: "Next review date",
  identifiedDate: "Identified date",
  inherentLikelihood: "Inherent likelihood",
  inherentImpact: "Inherent impact",
  inherentScore: "Inherent score",
  inherentBand: "Inherent rating",
  residualLikelihood: "Residual likelihood",
  residualImpact: "Residual impact",
  residualScore: "Residual score",
  residualBand: "Residual rating",
  residualOverrideVariance: "Residual override variance",
  residualExpectedLossInr: "Residual expected loss (₹)",
  controlEffectivenessPct: "Control effectiveness %",
  causes: "Causes",
  consequences: "Consequences",
  existingControls: "Existing controls",
  sourceMetadata: "Treatment details",
  completionPercent: "Completion %",
  expectedResidualReduction: "Expected residual reduction",
  closureTargetDate: "Due date",
  primaryOwnerUserId: "Action owner",
};
function humanizeField(f: string): string {
  if (FIELD_LABEL[f]) return FIELD_LABEL[f];
  return f
    .replace(/Id$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export function RiskHistory({ riskId, riskCode }: { riskId: string; riskCode?: string }) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setError(null);
    fetch(`/api/erm/risks/${riskId}/history`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        if (cancelled) return;
        const rows: HistoryEntry[] = Array.isArray(j?.entries) ? j.entries : [];
        setEntries(rows);
        setTotal(typeof j?.total === "number" ? j.total : rows.length);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [riskId]);

  if (error) {
    return <Alert variant="destructive" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Failed to load history: {error}</Alert>;
  }
  if (entries === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" /> Loading history…
      </div>
    );
  }
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">No audit history yet.</p>;
  }

  return (
    <div>
      <p className="mb-4 text-xs text-slate-500">
        Tamper-evident audit trail for {riskCode ? <b>{riskCode}</b> : "this risk"} · {total} event{total === 1 ? "" : "s"} (newest first).
      </p>
      <ol className="relative space-y-0 border-l border-slate-200 pl-6">
        {entries.map((e) => {
          const changed = e.changedFields ?? [];
          const canExpand = (e.before != null || e.after != null) && changed.length > 0;
          const open = !!expanded[e.id];
          return (
            <li key={e.id} className="relative pb-5">
              <span className={"absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white " + dotClass(e.action)} />
              <Card className="rounded-lg border border-slate-200 bg-white p-3 shadow-none">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={"rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 " + badgeClass(e.action)}>
                    {e.action.replace(/_/g, " ")}
                  </span>
                  <span className="text-sm font-medium text-slate-800">{e.entityLabel}</span>
                  <span className="ml-auto text-[11px] text-slate-400">{fmtWhen(e.timestamp)}</span>
                </div>

                <div className="mt-1 text-[11px] text-slate-500">
                  {e.actorName ?? "System"}
                  {e.actorType && <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{e.actorType.replace(/_/g, " ")}</span>}
                </div>

                {changed.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {changed.map((f) => (
                      <span key={f} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        {humanizeField(f)}
                      </span>
                    ))}
                  </div>
                )}

                {e.reason && <p className="mt-2 text-[11px] italic text-slate-500">{e.reason}</p>}

                {canExpand && (
                  <>
                    <button
                      type="button"
                      onClick={() => setExpanded((p) => ({ ...p, [e.id]: !p[e.id] }))}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary-700 hover:underline"
                    >
                      {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {open ? "Hide changes" : "View changes"}
                    </button>
                    {open && (
                      <Card className="mt-2 overflow-x-auto rounded-md border border-slate-100 bg-slate-50/60 shadow-none">
                        <Table className="w-full text-xs">
                          <TableHeader>
                            <TableRow className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wider text-slate-400">
                              <TableHead className="px-2 py-1.5">Field</TableHead>
                              <TableHead className="px-2 py-1.5">Before</TableHead>
                              <TableHead className="px-2 py-1.5">After</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {changed.map((f) => (
                              <TableRow key={f} className="border-b border-slate-100 last:border-0 align-top">
                                <TableCell className="px-2 py-1.5 font-medium text-slate-600">{humanizeField(f)}</TableCell>
                                <TableCell className="px-2 py-1.5 text-rose-700">{fmtValue(e.before ? e.before[f] : null)}</TableCell>
                                <TableCell className="px-2 py-1.5 text-emerald-700">{fmtValue(e.after ? e.after[f] : null)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Card>
                    )}
                  </>
                )}
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
