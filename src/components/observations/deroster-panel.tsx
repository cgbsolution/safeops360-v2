"use client";

/**
 * Deroster Review panel — appears on the observation detail view whenever a
 * named worker carries a safety review.
 *
 * Wording rule: a `pending_review` flag is a SOFT-LOCK and is never described
 * as "derostered". The server sends `displayLabel` / `punitive` for exactly
 * this reason (services/observation_deroster.visible_status) and this component
 * renders those rather than deriving its own copy from `status` — so the
 * not-yet-decided wording can't drift between surfaces.
 *
 * Confirm / Overrule / Reinstate are role-gated server-side; hiding the
 * buttons for other users is presentation only.
 */

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { readApiError } from "@/lib/client-errors";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  GraduationCap,
  HardHat,
  Loader2,
  ShieldAlert,
  UserRound,
  XCircle,
} from "lucide-react";
import { APP_TIME_ZONE, cn } from "@/lib/utils";

const MIN_REASON = 10;

export type DerosterStatus = "pending_review" | "confirmed" | "overruled" | "reinstated";

export type DerosterRecord = {
  id: string;
  status: DerosterStatus;
  displayLabel: string;
  punitive: boolean;
  flaggedAt: string;
  flaggedReason: string;
  reviewSlaHours: number;
  reviewDueAt: string;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  reviewDecisionReason?: string | null;
  correctiveActionTrainingId?: string | null;
  correctiveActionCompetencyId?: string | null;
  correctiveAction?: {
    required: boolean;
    complete: boolean;
    kind: string;
    status?: string | null;
    reason?: string | null;
  } | null;
  escalatedAt?: string | null;
  reinstatedAt?: string | null;
  reinstatementNote?: string | null;
};

export type InvolvedWorker = {
  id: string;
  // MANUAL never carries a deroster (a hand-typed name has no roster row to
  // soft-lock), so it never reaches a card here — but it does arrive in the
  // `workers` prop, and the type has to admit it.
  partyType: "USER" | "CONTRACTOR_WORKER" | "MANUAL";
  name: string;
  role?: string | null;
  employer?: string | null;
  rosterStatus?: string | null;
  deroster?: DerosterRecord | null;
};

type AuditEvent = {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorId: string | null;
  notes: string | null;
  createdAt: string;
};

function fmt(iso?: string | null) {
  if (!iso) return "—";
  // Site wall-clock, not the runtime's zone — see APP_TIME_ZONE in lib/utils.
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  });
}

/** Time remaining on the review SLA, or how far past it we are. */
function Countdown({ dueAt, escalated }: { dueAt: string; escalated: boolean }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const diffMs = new Date(dueAt).getTime() - now;
  const overdue = diffMs < 0;
  const mins = Math.floor(Math.abs(diffMs) / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const text = h > 0 ? `${h}h ${m}m` : `${m}m`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium",
        overdue ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
      )}
    >
      <Clock className="h-3 w-3" />
      {overdue ? `${text} past SLA` : `${text} left`}
      {escalated && " · escalated"}
    </span>
  );
}

function AuditTrail({ observationId, workerId }: { observationId: string; workerId: string }) {
  const [open, setOpen] = React.useState(false);
  const [events, setEvents] = React.useState<AuditEvent[] | null>(null);

  React.useEffect(() => {
    if (!open || events) return;
    fetch(`/api/observations/${observationId}/deroster/${workerId}/audit-log`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setEvents(Array.isArray(d) ? d : []))
      .catch(() => setEvents([]));
  }, [open, events, observationId, workerId]);

  return (
    <div className="mt-3 border-t border-slate-200 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        Audit trail
      </button>
      {open && (
        <ol className="mt-2 space-y-2">
          {events === null && (
            <li className="text-xs text-slate-500">
              <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
              Loading…
            </li>
          )}
          {events?.length === 0 && <li className="text-xs text-slate-500">No entries.</li>}
          {events?.map((e) => (
            <li key={e.id} className="border-l-2 border-slate-200 pl-2.5 text-xs">
              <div className="font-medium text-slate-800">
                {e.action.replace(/_/g, " ")}
                {e.fromStatus && e.toStatus && (
                  <span className="font-normal text-slate-500">
                    {" "}
                    · {e.fromStatus.replace(/_/g, " ")} → {e.toStatus.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <div className="text-slate-500">
                {fmt(e.createdAt)}
                {!e.actorId && " · system"}
              </div>
              {e.notes && <div className="mt-0.5 text-slate-600">{e.notes}</div>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function WorkerCard({
  observationId,
  worker,
  canDecide,
  onChanged,
}: {
  observationId: string;
  worker: InvolvedWorker;
  canDecide: boolean;
  onChanged: (updated: InvolvedWorker) => void;
}) {
  const d = worker.deroster!;
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState<"" | "confirm" | "overrule" | "reinstate">("");
  const [error, setError] = React.useState("");

  async function act(action: "confirm" | "overrule" | "reinstate") {
    setError("");
    if (action !== "reinstate" && reason.trim().length < MIN_REASON) {
      setError(`A decision reason of at least ${MIN_REASON} characters is required.`);
      return;
    }
    setBusy(action);
    try {
      const res = await fetch(
        `/api/observations/${observationId}/deroster/${worker.id}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "reinstate" ? { note: reason.trim() || null } : { reason: reason.trim() }
          ),
        }
      );
      if (!res.ok) {
        setError(await readApiError(res, `Could not ${action} this review.`));
        return;
      }
      const updated = await res.json();
      setReason("");
      onChanged(updated);
    } catch {
      setError("Network error — the review was not changed.");
    } finally {
      setBusy("");
    }
  }

  const pending = d.status === "pending_review";
  const confirmed = d.status === "confirmed";
  const ca = d.correctiveAction;
  const canReinstate = confirmed && !!ca?.complete;

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {worker.partyType === "USER" ? (
            <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <HardHat className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{worker.name}</p>
            <p className="truncate text-xs text-slate-500">
              {[worker.role, worker.employer].filter(Boolean).join(" · ") ||
                "Role & employer not set on profile"}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium",
            d.punitive
              ? "bg-rose-100 text-rose-800"
              : pending
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-100 text-emerald-800"
          )}
        >
          {d.punitive ? <ShieldAlert className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
          {d.displayLabel}
        </span>
      </div>

      <p className="mt-2 text-sm text-slate-700">{d.flaggedReason}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>Flagged {fmt(d.flaggedAt)}</span>
        {pending && <Countdown dueAt={d.reviewDueAt} escalated={!!d.escalatedAt} />}
        {d.reviewedAt && <span>· Decided {fmt(d.reviewedAt)}</span>}
      </div>

      {d.reviewDecisionReason && (
        <p className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-700">
          <span className="font-medium">Decision: </span>
          {d.reviewDecisionReason}
        </p>
      )}

      {/* Corrective action — shown once confirmed, because that is when one
          is minted and when it starts gating reinstatement. */}
      {confirmed && ca && (
        <div
          className={cn(
            "mt-2 flex items-start gap-2 rounded border p-2 text-xs",
            ca.complete
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          )}
        >
          <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-medium">
              {ca.kind === "TRAINING_ASSIGNMENT"
                ? "Corrective training"
                : "Contractor competency evidence"}
              {ca.status ? ` — ${ca.status.replace(/_/g, " ")}` : ""}
            </p>
            {!ca.complete && <p className="mt-0.5">{ca.reason}</p>}
            {ca.complete && <p className="mt-0.5">Complete — this worker can be reinstated.</p>}
          </div>
        </div>
      )}

      {canDecide && (pending || confirmed) && (
        <div className="mt-3 space-y-2">
          <Textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              pending
                ? "Reason for confirming or overruling (required, recorded in the audit trail)…"
                : "Reinstatement note (optional)…"
            }
            className="text-sm"
          />
          <div className="flex flex-wrap gap-2">
            {pending && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={!!busy}
                  onClick={() => act("confirm")}
                >
                  {busy === "confirm" ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ShieldAlert className="mr-1 h-3.5 w-3.5" />
                  )}
                  Confirm deroster
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => act("overrule")}
                >
                  {busy === "overrule" ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <XCircle className="mr-1 h-3.5 w-3.5" />
                  )}
                  Overrule
                </Button>
              </>
            )}
            {confirmed && (
              <span title={canReinstate ? undefined : ca?.reason ?? "Corrective action incomplete."}>
                <Button
                  type="button"
                  size="sm"
                  disabled={!!busy || !canReinstate}
                  onClick={() => act("reinstate")}
                >
                  {busy === "reinstate" ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  )}
                  Reinstate
                </Button>
              </span>
            )}
          </div>
          {error && (
            <p className="flex items-start gap-1.5 text-xs text-rose-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}
        </div>
      )}

      <AuditTrail observationId={observationId} workerId={worker.id} />
    </li>
  );
}

export function DerosterPanel({
  observationId,
  workers,
  canDecide,
}: {
  observationId: string;
  workers: InvolvedWorker[];
  canDecide: boolean;
}) {
  const [rows, setRows] = React.useState(workers);
  React.useEffect(() => setRows(workers), [workers]);

  // The server-rendered rows come from Prisma and carry no `correctiveAction`
  // state — resolving it means reading a TrainingAssignment (employees) or
  // scanning EPC competency JSON (contractors), which the API already does
  // authoritatively. Hydrate from it rather than duplicating that logic here,
  // so the Reinstate button's enabled state and the server's 409 always agree.
  React.useEffect(() => {
    let alive = true;
    fetch(`/api/observations/${observationId}/workers-involved`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && Array.isArray(data)) setRows(data);
      })
      .catch(() => {
        /* keep the server-rendered rows; Reinstate stays disabled until known */
      });
    return () => {
      alive = false;
    };
  }, [observationId]);

  const flagged = rows.filter((w) => w.deroster);
  if (flagged.length === 0) return null;

  const openCount = flagged.filter((w) => w.deroster!.status === "pending_review").length;

  return (
    <Card id="deroster" className="scroll-mt-20 border-amber-200">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          <h2 className="text-sm font-semibold text-slate-900">Safety Review</h2>
          {openCount > 0 && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {openCount} awaiting decision
            </span>
          )}
        </div>
        {!canDecide && openCount > 0 && (
          <p className="mb-3 text-xs text-slate-500">
            Only a Section Head or HSE Manager can confirm or overrule a review.
          </p>
        )}
        <ul className="space-y-2">
          {flagged.map((w) => (
            <WorkerCard
              key={w.id}
              observationId={observationId}
              worker={w}
              canDecide={canDecide}
              onChanged={(updated) =>
                setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
              }
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
