"use client";

// The Prepared / Reviewed / Approved block — built once, used by all four screens.
//
// SIGNATURE CAPTURE
// -----------------
// An earlier revision of this panel recorded a userId and a timestamp and called
// that a sign-off. It is not one: it records who the SYSTEM believes clicked a
// button, and the sheet being reproduced prints a "Sign. & Date:" box under each
// role for a person to put their name in.
//
// The canvas is the platform's `SignatureModal` — the same drawing surface PTW
// evidence capture, training attendance and the CAMS audit sign-off panel already
// use. Not a fire-specific one: there is one signature mechanism on this platform
// and this is a fourth consumer of it.
//
// The typed fallback exists because drawing on a shop-floor tablet with gloved
// hands frequently does not work, and a system that only accepts a drawing gets
// one person's signature used by the whole shift. It is weaker evidence and the
// record says so — `signatureKind` is stored, rendered here, and printed on the
// PDF as "(typed signature)".
//
// Daily sheets do not demand a signature per record (`signatureRequired` comes
// from the backend, which decides per template): the paper original is signed
// once for the month, and demanding 31 drawn signatures would get the tablet
// handed round — weaker evidence than the stamp alone. A signature offered on a
// daily record is still captured and still printed.

import * as React from "react";
import { CheckCircle2, Circle, Loader2, Lock, PenTool, Type as TypeIcon } from "lucide-react";
import { SignatureModal } from "@/components/ui/signature-pad";
import { MX, STAGE_ORDER, SignOff, Stage, fmtDateTime } from "../lib";
import { Card } from "@/components/ui/card";

const DEFAULT_ROLES = [
  "Prepared by: Person In-charge",
  "Reviewed by: Intermediatory Head",
  "Approved by: HOD",
];

const STAGE_FOR_SLOT: Stage[] = ["SUBMITTED", "REVIEWED", "APPROVED"];
const ROLE_FOR_SLOT = ["PREPARED_BY", "REVIEWED_BY", "APPROVED_BY"] as const;
const ACTION_LABEL: Record<string, string> = {
  SUBMITTED: "Sign & submit",
  REVIEWED: "Sign & mark reviewed",
  APPROVED: "Sign & approve",
};

export type CapturedSignature = {
  role: string;
  name?: string | null;
  signatureKind: "DRAWN" | "TYPED";
  signatureImage?: string | null;
  typedName?: string | null;
  statement?: string | null;
  signedAt: string;
};

export type SignaturePayload = {
  signatureKind: "DRAWN" | "TYPED";
  signaturePayload?: string | null;
  typedName?: string | null;
};

type Slot = {
  role: (typeof ROLE_FOR_SLOT)[number];
  label: string;
  name?: string | null;
  at: string | null;
  stage: Stage;
  captured?: CapturedSignature;
};

function slots(sign: SignOff, roles: string[], captured: CapturedSignature[]): Slot[] {
  const byRole = new Map(captured.map((c) => [c.role, c]));
  return [
    { role: "PREPARED_BY", label: roles[0], name: sign.preparedByName, at: sign.preparedAt, stage: "SUBMITTED", captured: byRole.get("PREPARED_BY") },
    { role: "REVIEWED_BY", label: roles[1], name: sign.reviewedByName, at: sign.reviewedAt, stage: "REVIEWED", captured: byRole.get("REVIEWED_BY") },
    { role: "APPROVED_BY", label: roles[2], name: sign.approvedByName, at: sign.approvedAt, stage: "APPROVED", captured: byRole.get("APPROVED_BY") },
  ];
}

export function SignOffPanel({
  stage,
  signOff,
  roles,
  canWrite = true,
  disabledReason,
  signatureRequired = true,
  onAdvance,
}: {
  stage: Stage;
  signOff: SignOff;
  roles?: string[] | null;
  canWrite?: boolean;
  /** Why the next action is unavailable — e.g. unanswered mandatory items. */
  disabledReason?: string | null;
  /** Per template, from the backend. Daily sheets are exempt; see the header. */
  signatureRequired?: boolean;
  onAdvance: (to: Stage, signature?: SignaturePayload) => Promise<void>;
}) {
  const [pending, setPending] = React.useState<Stage | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [drawingFor, setDrawingFor] = React.useState<Stage | null>(null);
  const [typedFor, setTypedFor] = React.useState<Stage | null>(null);
  const [typedName, setTypedName] = React.useState("");

  const useRoles = roles?.length === 3 ? roles : DEFAULT_ROLES;
  const captured = (signOff.signatures ?? []) as CapturedSignature[];
  const done = STAGE_ORDER.indexOf(stage);
  const nextStage = STAGE_FOR_SLOT.find((s) => STAGE_ORDER.indexOf(s) === done + 1) ?? null;
  const nextRole = nextStage ? ROLE_FOR_SLOT[STAGE_FOR_SLOT.indexOf(nextStage)] : null;
  const statement = nextRole
    ? captured.find((c) => c.role === nextRole)?.statement ?? STATEMENT_FALLBACK[nextRole]
    : null;

  async function go(to: Stage, signature?: SignaturePayload) {
    setPending(to);
    setError(null);
    try {
      await onAdvance(to, signature);
      setTypedFor(null);
      setTypedName("");
    } catch (e: any) {
      setError(e?.message ?? "Could not record the sign-off.");
    } finally {
      setPending(null);
      setDrawingFor(null);
    }
  }

  return (
    <Card className="mt-4 overflow-hidden rounded-xl shadow-none" style={{ borderColor: MX.iceLine }}>
      <div
        className="flex flex-wrap items-center gap-2 px-4 py-2"
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
        {!signatureRequired && (
          <span className="text-[10.5px]" style={{ color: MX.muted }}>
            Signature optional on this sheet — the paper original is signed once for the period.
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0" style={{ borderColor: MX.iceLine }}>
        {slots(signOff, useRoles, captured).map((s) => {
          const complete = STAGE_ORDER.indexOf(s.stage) <= done;
          return (
            <div key={s.role} className="px-4 py-3" style={{ borderColor: MX.iceLine }}>
              <div className="flex items-center gap-1.5">
                {complete ? (
                  <CheckCircle2 size={13} style={{ color: MX.green }} />
                ) : (
                  <Circle size={13} style={{ color: MX.iceLine }} />
                )}
                <span className="text-[11px] font-semibold" style={{ color: MX.navy }}>
                  {s.label}
                </span>
              </div>

              {/* The captured mark, at the size the PDF prints it. */}
              <div
                className="mt-1.5 flex h-[46px] items-center justify-start rounded border px-2"
                style={{
                  borderColor: MX.iceLine,
                  background: s.captured ? MX.paper : "transparent",
                  borderStyle: s.captured ? "solid" : "dashed",
                }}
              >
                {s.captured?.signatureKind === "DRAWN" && s.captured.signatureImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.captured.signatureImage}
                    alt={`Signature — ${s.label}`}
                    className="max-h-[40px] max-w-full object-contain"
                  />
                ) : s.captured?.signatureKind === "TYPED" ? (
                  <div className="leading-tight">
                    <div className="text-[15px] italic" style={{ color: MX.navy, fontFamily: "Georgia, serif" }}>
                      {s.captured.typedName || s.captured.name}
                    </div>
                    <div className="text-[9px]" style={{ color: MX.muted }}>
                      (typed signature)
                    </div>
                  </div>
                ) : (
                  <span className="text-[11px]" style={{ color: MX.iceLine }}>
                    Sign. &amp; Date:
                  </span>
                )}
              </div>

              <div className="mt-1 text-[12px]" style={{ color: complete ? MX.ink : MX.muted }}>
                {complete ? s.name || "—" : " "}
              </div>
              <div className="text-[11px]" style={{ color: MX.muted }}>
                {complete ? fmtDateTime(s.captured?.signedAt ?? s.at) : " "}
              </div>
              {/* Stamped by the workflow but never actually signed — said plainly,
                  because otherwise this box reads identically to a signed one. */}
              {complete && !s.captured && (
                <div className="mt-0.5 text-[10px] font-medium" style={{ color: MX.amber }}>
                  No signature captured
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(nextStage || error || disabledReason) && (
        <div className="px-4 py-2.5" style={{ borderTop: `1px solid ${MX.iceLine}` }}>
          {nextStage && canWrite && statement && (
            <p className="mb-2 text-[11px] italic" style={{ color: MX.muted }}>
              {statement}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {nextStage && canWrite && (
              <>
                <button
                  type="button"
                  disabled={!!pending || !!disabledReason}
                  onClick={() => setDrawingFor(nextStage)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
                  style={{ background: nextStage === "APPROVED" ? MX.green : MX.navy }}
                >
                  {pending === nextStage ? <Loader2 size={12} className="animate-spin" /> : <PenTool size={12} />}
                  {ACTION_LABEL[nextStage]}
                </button>

                <button
                  type="button"
                  disabled={!!pending || !!disabledReason}
                  onClick={() => setTypedFor(typedFor ? null : nextStage)}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium disabled:opacity-45"
                  style={{ borderColor: MX.iceLine, color: MX.navy }}
                  title="Type your name instead — weaker evidence, and recorded as typed"
                >
                  <TypeIcon size={12} /> Type instead
                </button>

                {/* Only offered where the sheet does not require a mark. Not a
                    bypass: the backend decides per template, and this button is
                    absent where it would be one. */}
                {!signatureRequired && (
                  <button
                    type="button"
                    disabled={!!pending || !!disabledReason}
                    onClick={() => go(nextStage)}
                    className="rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium disabled:opacity-45"
                    style={{ borderColor: MX.iceLine, color: MX.muted }}
                  >
                    Without signature
                  </button>
                )}
              </>
            )}

            {disabledReason && (
              <span className="text-[11px]" style={{ color: MX.amber }}>
                {disabledReason}
              </span>
            )}
            {!canWrite && (
              <span className="text-[11px]" style={{ color: MX.muted }}>
                You do not hold the permission for this stage.
              </span>
            )}
            {error && (
              <span className="text-[11px] font-medium" style={{ color: MX.red }}>
                {error}
              </span>
            )}
          </div>

          {typedFor && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                autoFocus
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Your full name, as you would write it"
                className="rounded-lg border px-2.5 py-1.5 text-[12px] outline-none"
                style={{ borderColor: MX.iceLine, color: MX.ink, minWidth: 280 }}
              />
              <button
                type="button"
                disabled={typedName.trim().length < 3 || !!pending}
                onClick={() => go(typedFor, { signatureKind: "TYPED", typedName: typedName.trim() })}
                className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-45"
                style={{ background: MX.navy }}
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => {
                  setTypedFor(null);
                  setTypedName("");
                }}
                className="rounded-lg border px-2.5 py-1.5 text-[11.5px]"
                style={{ borderColor: MX.iceLine, color: MX.muted }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {drawingFor && (
        <SignatureModal
          title={`${useRoles[STAGE_FOR_SLOT.indexOf(drawingFor)]} — sign here`}
          onSave={(dataUrl) => go(drawingFor, { signatureKind: "DRAWN", signaturePayload: dataUrl })}
          onClose={() => setDrawingFor(null)}
        />
      )}
    </Card>
  );
}

// Shown before the first signature exists, so the signer reads what they are
// attesting to BEFORE they sign rather than after. Mirrors
// services/fire_signoff.STATEMENT.
const STATEMENT_FALLBACK: Record<string, string> = {
  PREPARED_BY:
    "I certify that I carried out the checks recorded on this sheet and that the responses are a true record of what I observed.",
  REVIEWED_BY:
    "I have reviewed this record for completeness and consistency, and any failed check has been raised for corrective action.",
  APPROVED_BY: "I approve this record as the controlled inspection record for the period stated.",
};
