"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

const TRIGGER_COLOR: Record<string, string> = {
  SCHEDULE: "bg-blue-100 text-blue-800 border-blue-200",
  REGULATORY_CHANGE: "bg-purple-100 text-purple-800 border-purple-200",
  INCIDENT: "bg-rose-100 text-rose-800 border-rose-200",
  MOC: "bg-indigo-100 text-indigo-800 border-indigo-200",
  AUDIT_FINDING: "bg-amber-100 text-amber-800 border-amber-200",
  MANUAL: "bg-slate-100 text-slate-700 border-slate-200",
};

type Cycle = {
  id: string;
  entryId: string;
  scheduledFor: string;
  triggeredBy: string;
  status: string;
  assignedToId: string;
  outcome: string | null;
  entryTitle: string | null;
  entrySequenceNumber: number | null;
  studyNumber: string | null;
  studyTitle: string | null;
};

export function BulkReviewPanel({ cycles }: { cycles: Cycle[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkError, setBulkError] = useState<string | null>(null);

  const now = new Date();

  const actionable = cycles.filter((c) => ["SCHEDULED", "IN_PROGRESS"].includes(c.status));

  const hasActionable = actionable.length > 0;

  function toggleAll() {
    if (selected.size === actionable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(actionable.map((c) => c.id)));
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submitBulkNoChange() {
    if (selected.size === 0) return;
    setBulkError(null);
    startTransition(async () => {
      const res = await fetch("/api/eai/review-cycles/bulk-no-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleIds: Array.from(selected) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setBulkError(data.error ?? data.detail ?? `Failed (${res.status})`);
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div>
      {selected.size > 0 && (
        <Alert variant="success" className="mb-3 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm">
          <span className="font-medium text-emerald-800">{selected.size} selected</span>
          <button
            onClick={submitBulkNoChange}
            disabled={pending}
            className="ml-auto px-3 py-1 text-xs rounded border border-emerald-400 bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {pending ? "Submitting…" : "Submit No Change for selected"}
          </button>
        </Alert>
      )}
      {bulkError && (
        <Alert variant="destructive" className="mb-3 rounded border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {bulkError}
        </Alert>
      )}

      <Card className="overflow-x-auto rounded-xl border bg-white shadow-none">
        <Table className="w-full text-sm">
          <TableHeader className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider">
            <TableRow>
              <TableHead className="px-4 py-3 w-8">
                <Checkbox
                 
                  checked={selected.size === actionable.length && actionable.length > 0}
                  onChange={toggleAll}
                  disabled={pending}
                  title="Select all actionable" />
              </TableHead>
              <TableHead className="text-left px-4 py-3">Entry / Study</TableHead>
              <TableHead className="text-left px-4 py-3">Trigger</TableHead>
              <TableHead className="text-left px-4 py-3">Status</TableHead>
              <TableHead className="text-left px-4 py-3">Scheduled</TableHead>
              <TableHead className="text-left px-4 py-3">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {cycles.map((c) => {
              const overdue = c.status === "SCHEDULED" && new Date(c.scheduledFor) < now;
              const awaitingReapproval = c.outcome === "MAJOR_REVISION";
              const isActionable = ["SCHEDULED", "IN_PROGRESS"].includes(c.status);
              return (
                <TableRow key={c.id} className={overdue ? "bg-rose-50/40" : "hover:bg-slate-50"}>
                  <TableCell className="px-4 py-3">
                    {isActionable && (
                      <Checkbox
                       
                        checked={selected.has(c.id)}
                        onChange={() => toggle(c.id)}
                        disabled={pending} />
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Link
                      href={`/eai/reviews/${c.id}`}
                      className="font-medium text-emerald-700 hover:underline text-sm"
                    >
                      {c.entryTitle
                        ? c.entryTitle.length > 50
                          ? c.entryTitle.slice(0, 50) + "…"
                          : c.entryTitle
                        : `Entry ${c.entryId.slice(0, 8)}…`}
                    </Link>
                    {c.entrySequenceNumber !== null && (
                      <span className="ml-1.5 text-xs text-slate-500">#{c.entrySequenceNumber}</span>
                    )}
                    {(c.studyNumber || c.studyTitle) && (
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {c.studyNumber && <span className="font-mono">{c.studyNumber}</span>}
                        {c.studyTitle && (
                          <span>
                            {c.studyNumber && " · "}
                            {c.studyTitle.length > 40
                              ? c.studyTitle.slice(0, 40) + "…"
                              : c.studyTitle}
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded border ${
                        TRIGGER_COLOR[c.triggeredBy] ?? "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {c.triggeredBy.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span>{c.status.replace(/_/g, " ")}</span>
                      {overdue && (
                        <span className="text-rose-700 font-semibold">OVERDUE</span>
                      )}
                      {awaitingReapproval && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 border border-amber-300">
                          Awaiting re-approval
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs text-slate-700">
                    {new Date(c.scheduledFor).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {isActionable && (
                      <Link
                        href={`/eai/reviews/${c.id}`}
                        className="text-xs px-2 py-1 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      >
                        Open review
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {!hasActionable && cycles.length > 0 && (
        <Card className="mt-2 rounded border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500 shadow-none">
          All cycles in this view are completed or skipped. No actions available.
        </Card>
      )}
    </div>
  );
}
