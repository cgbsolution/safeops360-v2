"use client";

// The Prepared / Reviewed / Approved block — built once, used by all four screens.
//
// The build spec is explicit that this must not become a second signature
// capture, and there is nothing to reuse: no e-signature mechanism exists
// anywhere in the platform (searched). So a "signature" here is what every other
// approval on this platform records — who, and when — presented in the layout
// the source sheets print ("Sign. & Date:" under each role).
//
// The three buttons are stage transitions, not a state field the user picks. The
// backend enforces the order; this component's job is to offer exactly the one
// action that is legal next, so the operator never gets to press a button that
// will 409.

import * as React from "react";
import { CheckCircle2, Circle, Loader2, Lock } from "lucide-react";
import { MX, STAGE_ORDER, SignOff, Stage, fmtDateTime } from "../lib";

const DEFAULT_ROLES = [
  "Prepared by: Person In-charge",
  "Reviewed by: Intermediatory Head",
  "Approved by: HOD",
];

const STAGE_FOR_SLOT: Stage[] = ["SUBMITTED", "REVIEWED", "APPROVED"];
const ACTION_LABEL: Record<string, string> = {
  SUBMITTED: "Submit",
  REVIEWED: "Mark reviewed",
  APPROVED: "Approve & lock",
};

type Slot = { role: string; name?: string | null; at: string | null; stage: Stage };

function slots(sign: SignOff, roles: string[]): Slot[] {
  return [
    { role: roles[0], name: sign.preparedByName, at: sign.preparedAt, stage: "SUBMITTED" },
    { role: roles[1], name: sign.reviewedByName, at: sign.reviewedAt, stage: "REVIEWED" },
    { role: roles[2], name: sign.approvedByName, at: sign.approvedAt, stage: "APPROVED" },
  ];
}

export function SignOffPanel({
  stage,
  signOff,
  roles,
  canWrite = true,
  disabledReason,
  onAdvance,
}: {
  stage: Stage;
  signOff: SignOff;
  roles?: string[] | null;
  canWrite?: boolean;
  /** Why the next action is unavailable — e.g. unanswered mandatory items. */
  disabledReason?: string | null;
  onAdvance: (to: Stage) => Promise<void>;
}) {
  const [pending, setPending] = React.useState<Stage | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const useRoles = roles?.length === 3 ? roles : DEFAULT_ROLES;
  const done = STAGE_ORDER.indexOf(stage);

  // Exactly one stage is legal next, and only while the previous one is current.
  const nextStage = STAGE_FOR_SLOT.find((s) => STAGE_ORDER.indexOf(s) === done + 1) ?? null;

  async function advance(to: Stage) {
    setPending(to);
    setError(null);
    try {
      await onAdvance(to);
    } catch (e: any) {
      setError(e?.message ?? "Could not record the sign-off.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border bg-white" style={{ borderColor: MX.iceLine }}>
      <div
        className="flex items-center gap-2 px-4 py-2"
        style={{ background: MX.ice, borderBottom: `1px solid ${MX.iceLine}` }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: MX.navy }}>
          Sign-off
        </span>
        {stage === "APPROVED" && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: MX.greenSoft, color: MX.green }}
          >
            <Lock size={10} /> Approved — record locked
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0" style={{ borderColor: MX.iceLine }}>
        {slots(signOff, useRoles).map((s, i) => {
          const complete = STAGE_ORDER.indexOf(s.stage) <= done;
          return (
            <div key={i} className="px-4 py-3" style={{ borderColor: MX.iceLine }}>
              <div className="flex items-center gap-1.5">
                {complete ? (
                  <CheckCircle2 size={13} style={{ color: MX.green }} />
                ) : (
                  <Circle size={13} style={{ color: MX.iceLine }} />
                )}
                <span className="text-[11px] font-semibold" style={{ color: MX.navy }}>
                  {s.role}
                </span>
              </div>
              {/* Blank when the stage is not reached — an unsigned record must
                  read as unsigned, not as awaiting a name we could guess. */}
              <div className="mt-1.5 text-[12px]" style={{ color: complete ? MX.ink : MX.muted }}>
                {complete ? s.name || "—" : "Sign. & Date:"}
              </div>
              <div className="text-[11px]" style={{ color: MX.muted }}>
                {complete ? fmtDateTime(s.at) : " "}
              </div>
            </div>
          );
        })}
      </div>

      {(nextStage || error || disabledReason) && (
        <div
          className="flex flex-wrap items-center gap-3 px-4 py-2.5"
          style={{ borderTop: `1px solid ${MX.iceLine}` }}
        >
          {nextStage && canWrite && (
            <button
              type="button"
              disabled={!!pending || !!disabledReason}
              onClick={() => advance(nextStage)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
              style={{ background: nextStage === "APPROVED" ? MX.green : MX.navy }}
            >
              {pending === nextStage && <Loader2 size={12} className="animate-spin" />}
              {ACTION_LABEL[nextStage]}
            </button>
          )}
          {disabledReason && (
            <span className="text-[11px]" style={{ color: MX.amber }}>
              {disabledReason}
            </span>
          )}
          {!canWrite && (
            <span className="text-[11px]" style={{ color: MX.muted }}>
              You have read-only access to this plant.
            </span>
          )}
          {error && (
            <span className="text-[11px] font-medium" style={{ color: MX.red }}>
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
