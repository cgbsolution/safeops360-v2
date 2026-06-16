"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Edit3,
  FlaskConical,
  PauseCircle,
  PlayCircle,
  Printer,
  ShieldCheck,
  TimerReset,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

type Approval = {
  id: string;
  step: string;
  decision: string;
  comments: string | null;
  conditions: string | null;
  decidedAt: string | Date;
  approver: { name: string; designation: string | null } | null;
};

type Suspension = {
  id: string;
  reason: string;
  reasonDetail: string | null;
  suspendedAt: string | Date;
  resumedAt: string | Date | null;
  resumptionConditions: string | null;
  reFlraRequired: boolean;
  suspendedBy: { name: string } | null;
  resumedBy: { name: string } | null;
};

type Extension = {
  id: string;
  newValidTo: string | Date;
  reason: string;
  status: string;
  approverComments: string | null;
  requestedAt: string | Date;
  approvedAt: string | Date | null;
  requestedBy: { name: string } | null;
  approvedBy: { name: string } | null;
};

type GasReading = {
  id: string;
  recordedAt: string | Date;
  isExceedance: boolean;
  isPreEntry: boolean;
  instrumentSerial: string | null;
  readings: any;
  recordedBy: { name: string } | null;
};

type WorkflowHistoryRow = {
  id: string;
  action: string;
  stepName: string;
  performedAt: string | Date;
  comments: string | null;
  performedBy: { name: string } | null;
};

type Event = {
  ts: number;
  kind: "WORKFLOW" | "APPROVAL" | "SUSPENSION" | "RESUME" | "EXTENSION" | "GAS_READING";
  payload: any;
};

export function AuditTrailPanel({
  approvals,
  suspensions,
  extensions,
  gasReadings,
  workflowHistory,
}: {
  approvals: Approval[];
  suspensions: Suspension[];
  extensions: Extension[];
  gasReadings: GasReading[];
  workflowHistory: WorkflowHistoryRow[];
}) {
  const events: Event[] = [];

  for (const w of workflowHistory) {
    events.push({
      ts: new Date(w.performedAt).getTime(),
      kind: "WORKFLOW",
      payload: w,
    });
  }
  for (const a of approvals) {
    events.push({
      ts: new Date(a.decidedAt).getTime(),
      kind: "APPROVAL",
      payload: a,
    });
  }
  for (const s of suspensions) {
    events.push({
      ts: new Date(s.suspendedAt).getTime(),
      kind: "SUSPENSION",
      payload: s,
    });
    if (s.resumedAt) {
      events.push({
        ts: new Date(s.resumedAt).getTime(),
        kind: "RESUME",
        payload: s,
      });
    }
  }
  for (const e of extensions) {
    events.push({
      ts: new Date(e.requestedAt).getTime(),
      kind: "EXTENSION",
      payload: e,
    });
  }
  for (const g of gasReadings) {
    events.push({
      ts: new Date(g.recordedAt).getTime(),
      kind: "GAS_READING",
      payload: g,
    });
  }

  events.sort((a, b) => a.ts - b.ts);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock size={16} /> Audit Trail
          </CardTitle>
          <CardDescription className="text-xs">
            Every approval, suspension, extension and gas reading on this permit.
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="print:hidden"
          onClick={() => window.print()}
        >
          <Printer size={14} /> Print
        </Button>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-xs text-slate-500">No events yet.</div>
        ) : (
          <ol className="relative border-l border-slate-200 ml-2 space-y-3">
            {events.map((e, i) => (
              <li key={`${e.kind}-${i}`} className="ml-4 relative">
                <span
                  className={[
                    "absolute -left-[26px] top-1 flex items-center justify-center w-5 h-5 rounded-full border bg-white",
                    iconColor(e.kind, e.payload),
                  ].join(" ")}
                >
                  <Icon kind={e.kind} payload={e.payload} />
                </span>
                <EventRow kind={e.kind} payload={e.payload} />
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function Icon({ kind, payload }: { kind: Event["kind"]; payload: any }) {
  switch (kind) {
    case "APPROVAL":
      return payload.decision === "APPROVED" ? (
        <CheckCircle2 size={11} className="text-emerald-600" />
      ) : (
        <XCircle size={11} className="text-rose-600" />
      );
    case "SUSPENSION":
      return <PauseCircle size={11} className="text-amber-600" />;
    case "RESUME":
      return <PlayCircle size={11} className="text-emerald-600" />;
    case "EXTENSION":
      return <TimerReset size={11} className="text-blue-600" />;
    case "GAS_READING":
      return (
        <FlaskConical
          size={11}
          className={payload.isExceedance ? "text-rose-600" : "text-emerald-600"}
        />
      );
    case "WORKFLOW":
    default:
      return <Edit3 size={11} className="text-slate-500" />;
  }
}

function iconColor(kind: Event["kind"], payload: any) {
  switch (kind) {
    case "APPROVAL":
      return payload.decision === "APPROVED" ? "border-emerald-300" : "border-rose-300";
    case "SUSPENSION":
      return "border-amber-300";
    case "RESUME":
      return "border-emerald-300";
    case "EXTENSION":
      return "border-blue-300";
    case "GAS_READING":
      return payload.isExceedance ? "border-rose-300" : "border-emerald-300";
    default:
      return "border-slate-200";
  }
}

function EventRow({ kind, payload }: { kind: Event["kind"]; payload: any }) {
  switch (kind) {
    case "WORKFLOW": {
      const w = payload as WorkflowHistoryRow;
      return (
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{w.stepName}</span>
            <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">
              {w.action}
            </Badge>
            <span className="text-[11px] text-slate-500">
              {w.performedBy?.name ?? "—"} · {formatDateTime(new Date(w.performedAt))}
            </span>
          </div>
          {w.comments && (
            <div className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap">
              {w.comments}
            </div>
          )}
        </div>
      );
    }
    case "APPROVAL": {
      const a = payload as Approval;
      return (
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{a.step.replace(/_/g, " ")}</span>
            <Badge
              className={
                a.decision === "APPROVED"
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]"
                  : "bg-rose-100 text-rose-700 border-rose-200 text-[10px]"
              }
            >
              {a.decision}
            </Badge>
            <span className="text-[11px] text-slate-500">
              {a.approver?.name ?? "—"} · {formatDateTime(new Date(a.decidedAt))}
            </span>
          </div>
          {a.comments && (
            <div className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap">
              {a.comments}
            </div>
          )}
          {a.conditions && (
            <div className="text-xs text-amber-700 mt-0.5">
              <span className="font-medium">Conditions: </span>
              {a.conditions}
            </div>
          )}
        </div>
      );
    }
    case "SUSPENSION": {
      const s = payload as Suspension;
      return (
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Suspended</span>
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
              {s.reason}
            </Badge>
            {s.reFlraRequired && (
              <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px]">
                Re-FLRA required
              </Badge>
            )}
            <span className="text-[11px] text-slate-500">
              {s.suspendedBy?.name ?? "—"} · {formatDateTime(new Date(s.suspendedAt))}
            </span>
          </div>
          {s.reasonDetail && (
            <div className="text-xs text-slate-600 mt-0.5">{s.reasonDetail}</div>
          )}
        </div>
      );
    }
    case "RESUME": {
      const s = payload as Suspension;
      return (
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Resumed</span>
            <span className="text-[11px] text-slate-500">
              {s.resumedBy?.name ?? "—"} · {s.resumedAt && formatDateTime(new Date(s.resumedAt))}
            </span>
          </div>
          {s.resumptionConditions && (
            <div className="text-xs text-emerald-700 mt-0.5">
              <span className="font-medium">Conditions: </span>
              {s.resumptionConditions}
            </div>
          )}
        </div>
      );
    }
    case "EXTENSION": {
      const e = payload as Extension;
      return (
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Extension request</span>
            <Badge
              className={
                e.status === "APPROVED"
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]"
                  : e.status === "REJECTED"
                  ? "bg-rose-100 text-rose-700 border-rose-200 text-[10px]"
                  : "bg-amber-100 text-amber-700 border-amber-200 text-[10px]"
              }
            >
              {e.status}
            </Badge>
            <span className="text-[11px] text-slate-500">
              {e.requestedBy?.name ?? "—"} · {formatDateTime(new Date(e.requestedAt))}
            </span>
          </div>
          <div className="text-xs text-slate-600 mt-0.5">
            New validity: {formatDateTime(new Date(e.newValidTo))}
          </div>
          <div className="text-xs text-slate-600 mt-0.5">{e.reason}</div>
          {e.approverComments && (
            <div className="text-xs text-slate-600 mt-0.5">
              <span className="font-medium">{e.approvedBy?.name}: </span>
              {e.approverComments}
            </div>
          )}
        </div>
      );
    }
    case "GAS_READING": {
      const g = payload as GasReading;
      const readings: any[] = Array.isArray(g.readings) ? g.readings : [];
      return (
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">
              Gas reading {g.isPreEntry ? "(pre-entry)" : ""}
            </span>
            {g.isExceedance && (
              <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[10px]">
                EXCEEDANCE
              </Badge>
            )}
            <span className="text-[11px] text-slate-500">
              {g.recordedBy?.name ?? "—"} · {formatDateTime(new Date(g.recordedAt))}
            </span>
          </div>
          {readings.length > 0 && (
            <div className="text-xs text-slate-600 mt-0.5 flex flex-wrap gap-2">
              {readings.map((r, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5"
                >
                  <span className="font-medium">{r.parameter}</span>
                  <span>{r.value}</span>
                </span>
              ))}
            </div>
          )}
          {g.instrumentSerial && (
            <div className="text-[11px] text-slate-500 mt-0.5">
              Instrument {g.instrumentSerial}
            </div>
          )}
        </div>
      );
    }
    default:
      return null;
  }
}

// ─── Standalone Approvals + Isolations summary cards ──────────────────


export function ApprovalsCard({ approvals }: { approvals: Approval[] }) {
  if (approvals.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck size={16} /> Approvals ({approvals.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {approvals.map((a) => (
          <div
            key={a.id}
            className="flex items-start justify-between gap-2 rounded-md border border-slate-200 bg-white p-2 text-xs"
          >
            <div>
              <div className="font-medium">{a.step.replace(/_/g, " ")}</div>
              <div className="text-slate-500">
                {a.approver?.name ?? "—"} · {formatDateTime(new Date(a.decidedAt))}
              </div>
              {a.comments && (
                <div className="mt-1 whitespace-pre-wrap text-slate-700">{a.comments}</div>
              )}
              {a.conditions && (
                <div className="mt-0.5 text-amber-700">
                  <span className="font-medium">Conditions: </span>
                  {a.conditions}
                </div>
              )}
            </div>
            <Badge
              className={
                a.decision === "APPROVED"
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]"
                  : "bg-rose-100 text-rose-700 border-rose-200 text-[10px]"
              }
            >
              {a.decision}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function IsolationsCard({
  isolations,
}: {
  isolations: {
    id: string;
    isolationType: string;
    description: string;
    isolationPointTag: string;
    lotoTagNumber: string | null;
    isolationVerifiedAt: string | Date | null;
    restoredAt: string | Date | null;
  }[];
}) {
  if (isolations.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Isolations ({isolations.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5 text-xs">
          {isolations.map((i) => (
            <div
              key={i.id}
              className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white p-2"
            >
              <div>
                <div className="font-medium text-slate-800">
                  {i.isolationPointTag} ·{" "}
                  <span className="text-slate-500">{i.isolationType}</span>
                </div>
                <div className="text-slate-600">{i.description}</div>
                {i.lotoTagNumber && (
                  <div className="text-[10px] text-slate-500">LOTO {i.lotoTagNumber}</div>
                )}
              </div>
              <div className="flex flex-col items-end gap-0.5">
                {i.isolationVerifiedAt ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                    Verified
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                    Pending
                  </Badge>
                )}
                {i.restoredAt && (
                  <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">
                    Restored
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
