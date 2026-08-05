"use client";

// The cycle lifecycle, as a surface: DRAFT → UNDER_REVIEW → APPROVED → ACTIVE → CLOSED.
//
// docs/cams/08 §3.1. Every one of these transitions had a working, guarded,
// tested endpoint and no caller — so a programme could be created and then
// never approved, activated or closed by a human being.
//
// The design decision that matters here: **blockers are shown before the
// click, not after.** `GET /approval-report` returns the same guard
// `approve_cycle` enforces, structured per scope unit, so the approver reads
// "Fire Safety at North Works needs a required frequency" on the row rather
// than a pipe-delimited sentence in a red box after a failed POST. The two
// cannot disagree — they call one function over one load of the plan.
//
// Four-eyes is rendered, not just enforced: when the signed-in user owns the
// programme or submitted the cycle, the Approve button is disabled with the
// reason on it, instead of letting them press a button that will always 400.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Loader2, Send, ShieldCheck, PlayCircle, Lock, AlertTriangle, CheckCircle2, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { readApiError } from "@/lib/client-errors";
import { UserRefLabel, type UserDirectory } from "@/lib/users/user-ref";
import {
  siteText,
  type ApprovalReport, type ProgrammeCycleRow, type ProgrammeRow, type ReviewRow,
} from "@/app/(dashboard)/cams/programme/lib-programme";

type Action = "submit" | "approve" | "activate" | "close" | "return-to-draft";

export function CycleGovernance({
  programme, cycle, approval, reviews, userDir, canSchedule, canClose,
  onGoToScope, onGoToReviews,
}: {
  programme: ProgrammeRow;
  cycle: ProgrammeCycleRow;
  approval: ApprovalReport | null;
  reviews: ReviewRow[];
  userDir: UserDirectory;
  canSchedule: boolean;
  canClose: boolean;
  onGoToScope: () => void;
  onGoToReviews: () => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const me = (session?.user as { id?: string } | undefined)?.id ?? null;
  const [busy, setBusy] = useState<Action | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const blockers = approval?.blockers ?? [];
  const isOwner = !!me && me === programme.ownerUserId;
  const isSubmitter = !!me && me === cycle.submittedByUserId;
  // A cycle cannot close without at least one ISO 19011 §5.6 review — the guard
  // lives in `close_cycle`, and stating it here is the difference between a
  // disabled button and a mystery.
  const needsReview = reviews.length === 0;

  async function run(action: Action) {
    setBusy(action);
    setErr(null);
    const res = await fetch(`/api/programme/cycles/${cycle.id}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(action === "approve" ? { approvedByUserId: me } : {}),
    });
    setBusy(null);
    if (!res.ok) {
      setErr(await readApiError(res, `Could not ${action} this cycle`));
      return;
    }
    router.refresh();
  }

  return (
    <Card className="rounded-xl border border-slate-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Cycle governance
        </span>

        {cycle.status === "DRAFT" && canSchedule && (
          <Action
            label="Submit for review"
            icon={<Send size={13} />}
            busy={busy === "submit"}
            disabled={!!busy || (approval?.scopeUnitCount ?? 0) === 0}
            hint={
              (approval?.scopeUnitCount ?? 0) === 0
                ? "Add scope units first — a cycle with nothing in scope has nothing to review."
                : undefined
            }
            onClick={() => run("submit")}
          />
        )}

        {cycle.status === "UNDER_REVIEW" && (
          <>
            {canSchedule && (
              <Action
                label="Return to draft"
                variant="outline"
                busy={busy === "return-to-draft"}
                disabled={!!busy}
                hint="Reopens the scope for editing. Nothing is frozen until approval."
                onClick={() => run("return-to-draft")}
              />
            )}
            {canClose && (
              <Action
                label="Approve & freeze"
                icon={<ShieldCheck size={13} />}
                busy={busy === "approve"}
                disabled={!!busy || blockers.length > 0 || isOwner || isSubmitter}
                hint={
                  isOwner
                    ? "You own this programme — approval needs an independent second pair of eyes."
                    : isSubmitter
                      ? "You submitted this cycle — someone else has to approve it."
                      : blockers.length > 0
                        ? `${blockers.length} thing(s) still block approval.`
                        : undefined
                }
                onClick={() => run("approve")}
              />
            )}
          </>
        )}

        {cycle.status === "APPROVED" && canClose && (
          <Action
            label="Activate cycle"
            icon={<PlayCircle size={13} />}
            busy={busy === "activate"}
            disabled={!!busy}
            hint="Makes this the live plan of record. Only an active cycle can be closed."
            onClick={() => run("activate")}
          />
        )}

        {cycle.status === "ACTIVE" && canClose && (
          <Action
            label="Close cycle"
            icon={<Lock size={13} />}
            busy={busy === "close"}
            disabled={!!busy || needsReview}
            hint={
              needsReview
                ? "A cycle cannot close without at least one programme review (ISO 19011 §5.6)."
                : undefined
            }
            onClick={() => run("close")}
          />
        )}

        {cycle.status === "CLOSED" && (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2 size={13} className="text-emerald-600" />
            Closed{cycle.closedAt ? ` on ${new Date(cycle.closedAt).toLocaleDateString("en-IN")}` : ""} — the cycle is an immutable record.
          </span>
        )}

        {(cycle.approvedByUserId || cycle.submittedByUserId) && (
          <span className="ml-auto inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
            {cycle.submittedByUserId && (
              <span>submitted by <UserRefLabel dir={userDir} id={cycle.submittedByUserId} showRole={false} /></span>
            )}
            {cycle.approvedByUserId && (
              <span>approved by <UserRefLabel dir={userDir} id={cycle.approvedByUserId} showRole={false} /></span>
            )}
          </span>
        )}
      </div>

      {cycle.status === "ACTIVE" && needsReview && (
        <button
          type="button"
          onClick={onGoToReviews}
          className="mt-2 flex w-full items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-left text-xs text-sky-900 hover:bg-sky-100"
        >
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>
            This cycle has no programme review. ISO 19011 §5.6 asks how you know the
            <em> programme itself</em> is working, and closure is gated on it —{" "}
            <span className="underline">record one now</span>.
          </span>
        </button>
      )}

      {blockers.length > 0 && cycle.status === "UNDER_REVIEW" && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
            <AlertTriangle size={14} />
            {blockers.length} thing{blockers.length === 1 ? "" : "s"} block approval
          </div>
          <ul className="mt-1.5 space-y-1">
            {blockers.map((b, i) => (
              <li key={`${b.code}-${b.scopeUnitId ?? i}`} className="flex items-start gap-2 text-[12px] text-amber-900">
                <span className="mt-1 size-1 shrink-0 rounded-full bg-amber-500" />
                <span>
                  {b.scopeUnitLabel && (
                    <span className="font-medium">
                      {b.scopeUnitLabel}
                      {b.siteId && (
                        <span className="font-normal text-amber-700"> · {siteText(b)}</span>
                      )}
                      {" — "}
                    </span>
                  )}
                  {b.scopeUnitLabel ? stripLabel(b.message, b.scopeUnitLabel) : b.message}
                </span>
              </li>
            ))}
          </ul>
          {blockers.some((b) => b.scopeUnitId) && (
            <Button type="button" size="sm" variant="outline" className="mt-2 h-7 text-[11px]"
              onClick={onGoToScope}>
              Fix on the Scope tab
            </Button>
          )}
        </div>
      )}

      {err && (
        <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {err}
        </div>
      )}
    </Card>
  );
}

/** The server message already leads with the label; don't print it twice. */
function stripLabel(message: string, label: string): string {
  return message.startsWith(`${label}: `) ? message.slice(label.length + 2) : message;
}

function Action({
  label, icon, busy, disabled, hint, variant = "default", onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  busy: boolean;
  disabled: boolean;
  hint?: string;
  variant?: "default" | "outline";
  onClick: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Button type="button" size="sm" variant={variant} disabled={disabled || busy}
        onClick={onClick} title={hint}>
        {busy ? <Loader2 size={13} className="animate-spin" /> : icon}
        {label}
      </Button>
      {hint && disabled && (
        <span className={cn("max-w-xs text-[11px] text-slate-500")}>{hint}</span>
      )}
    </span>
  );
}
