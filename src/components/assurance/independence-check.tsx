"use client";

// Inline independence verdict + governed waiver (docs/cams/09 §2.1.6).
//
// Two rules drove this UI:
//
//  1. **The reason is always shown next to the person.** A guard that says
//     "denied" without naming the conflicting engagement is a guard people
//     route around. Every block states which rule fired and why.
//  2. **A waiver never hides the conflict.** ISO 19011 allows proportionality,
//     so an exception is possible — but it stays visible here and in the
//     report, with its justification and its named approver.
//
// `IndependenceCheck` is designed to sit inline in an assignment step, one per
// candidate, so a conflict is caught before the form is submitted rather than
// as a submit-time failure that costs the user their work.

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck, ShieldQuestion, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UserPicker } from "@/components/ui/user-picker";
import { readApiError } from "@/lib/client-errors";
import {
  CONFLICT_SOURCE_LABEL,
  type IndependenceConflict,
  type IndependenceVerdict,
  type PreflightResponse,
} from "@/app/(dashboard)/cams/lib-assurance";

export type PreflightScope = {
  engagementKind?: "AUDIT" | "INSPECTION";
  engagementId?: string | null;
  siteId?: string | null;
  disciplineCodes?: string[];
  areaIds?: string[];
  departments?: string[];
  leadAuditorId?: string | null;
  teamAuditorIds?: string[];
  auditeeUserIds?: string[];
  /**
   * WP-45 — set when the engagement audits a SUPPLIER. `siteId` still names the
   * owning plant, so without this the relationship-owner conflict (procurement
   * auditing its own vendor) would be invisible to the guard.
   */
  vendorProfileId?: string | null;
};

export async function runPreflight(
  userIds: string[],
  scope: PreflightScope,
  assigningAs: "AUDITOR" | "AUDITEE" = "AUDITOR",
): Promise<PreflightResponse> {
  const res = await fetch("/api/assurance/independence/preflight", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      engagementKind: scope.engagementKind ?? "AUDIT",
      engagementId: scope.engagementId ?? null,
      userIds,
      assigningAs,
      siteId: scope.siteId ?? null,
      disciplineCodes: scope.disciplineCodes ?? [],
      areaIds: scope.areaIds ?? [],
      departments: scope.departments ?? [],
      leadAuditorId: scope.leadAuditorId ?? null,
      teamAuditorIds: scope.teamAuditorIds ?? [],
      auditeeUserIds: scope.auditeeUserIds ?? [],
      vendorProfileId: scope.vendorProfileId ?? null,
    }),
  });
  if (!res.ok) throw new Error(await readApiError(res, "Independence check failed"));
  return res.json();
}

/** One person's verdict, rendered inline beside them. */
export function IndependenceVerdictChip({ verdict }: { verdict: IndependenceVerdict }) {
  const blocked = verdict.blockingCount > 0 && !verdict.waived;
  const warned = !blocked && verdict.warningCount > 0;

  if (!blocked && !warned && !verdict.waived) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700">
        <ShieldCheck size={11} /> Independent
      </span>
    );
  }
  if (verdict.waived) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800">
        <ShieldQuestion size={11} /> Waived
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]",
        blocked
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-amber-200 bg-amber-50 text-amber-800",
      )}
    >
      {blocked ? <ShieldAlert size={11} /> : <AlertTriangle size={11} />}
      {blocked ? "Not independent" : "Check independence"}
    </span>
  );
}

/**
 * List-density verdict: a dot, not a sentence.
 *
 * The picker renders one of these per candidate, so the full block reason is
 * the wrong artefact at this density — it would turn a 59-row list into a wall
 * of paragraphs. The reason travels on `title` (hover) and in full in the
 * detail panel once someone is selected, which this does not replace.
 *
 * `undefined` verdict means "not checked yet" and renders nothing rather than a
 * green dot: claiming someone is independent before asking is the failure mode
 * this whole feature exists to remove.
 */
export function IndependenceDot({
  verdict,
  pending = false,
}: {
  verdict?: IndependenceVerdict;
  pending?: boolean;
}) {
  if (pending && !verdict) {
    return (
      <span
        className="inline-block size-2 shrink-0 animate-pulse rounded-full bg-slate-300"
        aria-label="Checking independence"
        title="Checking independence…"
      />
    );
  }
  if (!verdict) return <span className="inline-block size-2 shrink-0" aria-hidden />;

  const blocked = verdict.blockingCount > 0 && !verdict.waived;
  const warned = !blocked && verdict.warningCount > 0;

  // Three colours, not four. A WARN does not stop an assignment, and on live
  // data 51 of 59 candidates carry one — nearly every user holds a site-scoped
  // role at the site being audited, which `role_scope_conflicts` warns about by
  // design. Giving that its own colour would paint the list amber and leave the
  // reader no better off than before the feature existed.
  //
  // So the dot answers the question the picker is actually for — can I assign
  // this person — and the warning rides along in the tooltip and in full in the
  // detail panel once they are selected.
  const tone = verdict.waived
    ? "bg-amber-500"
    : blocked
      ? "bg-rose-500"
      : "bg-emerald-500";
  const label = verdict.waived
    ? "Waived"
    : blocked
      ? "Not independent"
      : warned
        ? "Assignable — with a caution"
        : "Independent";

  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        tone,
        // A hairline ring is the most a warning earns at 8px: visible when
        // looked for, invisible when scanning for blockers.
        warned && "ring-1 ring-amber-400 ring-offset-1",
      )}
      role="img"
      aria-label={label}
      title={verdict.summary ? `${label} — ${verdict.summary}` : label}
    />
  );
}

export function ConflictList({ conflicts }: { conflicts: IndependenceConflict[] }) {
  if (!conflicts.length) return null;
  return (
    <ul className="mt-1.5 space-y-1">
      {conflicts.map((c, i) => (
        <li
          key={i}
          className={cn(
            "rounded-md border px-2 py-1.5 text-[11px] leading-snug",
            c.severity === "BLOCK"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-amber-200 bg-amber-50 text-amber-900",
          )}
        >
          <span className="font-semibold">
            {c.severity === "BLOCK" ? "Blocked" : "Warning"} ·{" "}
            {CONFLICT_SOURCE_LABEL[c.source] ?? c.source}
          </span>
          <br />
          {c.reason}
        </li>
      ))}
    </ul>
  );
}

/**
 * Live per-candidate check. Re-runs whenever the scope or the candidate list
 * changes, so the answer tracks the form rather than a stale snapshot.
 */
export function IndependenceCheck({
  userIds,
  scope,
  assigningAs = "AUDITOR",
  names = {},
  onResult,
  allowWaiver = false,
}: {
  userIds: string[];
  scope: PreflightScope;
  assigningAs?: "AUDITOR" | "AUDITEE";
  names?: Record<string, string>;
  onResult?: (r: PreflightResponse) => void;
  allowWaiver?: boolean;
}) {
  const [data, setData] = useState<PreflightResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [waiverFor, setWaiverFor] = useState<IndependenceVerdict | null>(null);

  const key = JSON.stringify([userIds, scope, assigningAs]);

  const run = useCallback(async () => {
    if (!userIds.length) {
      setData(null);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await runPreflight(userIds, scope, assigningAs);
      setData(r);
      onResult?.(r);
    } catch (e: any) {
      setErr(e?.message ?? "Independence check failed");
    } finally {
      setBusy(false);
    }
    // `key` intentionally drives this — it is the serialised input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    run();
  }, [run]);

  if (!userIds.length) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
        <ShieldCheck size={13} className="text-violet-700" />
        Auditor independence
        <span className="font-normal text-slate-400">ISO 19011 §7.2.3</span>
        {busy && <Loader2 size={12} className="ml-auto animate-spin text-slate-400" />}
      </div>

      {err && <p className="mt-2 text-[11px] text-rose-700">{err}</p>}

      <ul className="mt-2 space-y-2">
        {(data?.results ?? []).map((v) => (
          <li key={v.userId} className="rounded-md bg-white p-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-medium text-slate-800">
                {v.userName || names[v.userId] || v.userId}
              </span>
              <IndependenceVerdictChip verdict={v} />
              {allowWaiver && v.blockingCount > 0 && !v.waived && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7 text-[11px]"
                  onClick={() => setWaiverFor(v)}
                >
                  Request waiver
                </Button>
              )}
            </div>
            <ConflictList conflicts={v.conflicts} />
          </li>
        ))}
      </ul>

      {data && data.blockedCount > 0 && (
        <p className="mt-2 text-[11px] text-rose-700">
          {data.blockedCount} assignment{data.blockedCount === 1 ? " is" : "s are"} blocked. Choose
          another auditor, or record a documented independence waiver — waivers appear in the audit
          report.
        </p>
      )}

      {waiverFor && scope.engagementId && (
        <WaiverDialog
          verdict={waiverFor}
          engagementKind={scope.engagementKind ?? "AUDIT"}
          engagementId={scope.engagementId}
          onClose={() => setWaiverFor(null)}
          onGranted={() => {
            setWaiverFor(null);
            run();
          }}
        />
      )}
    </div>
  );
}

/**
 * Governed waiver. Requires a justification and a named approver who is not the
 * subject — the same segregation primitive ERM Internal Controls uses.
 */
export function WaiverDialog({
  verdict,
  engagementKind,
  engagementId,
  onClose,
  onGranted,
}: {
  verdict: IndependenceVerdict;
  engagementKind: "AUDIT" | "INSPECTION";
  engagementId: string;
  onClose: () => void;
  onGranted: () => void;
}) {
  const [justification, setJustification] = useState("");
  const [approver, setApprover] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const blocking = verdict.conflicts.find((c) => c.severity === "BLOCK");
  const tooShort = justification.trim().length < 20;
  const selfApproval = approver === verdict.userId;

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/assurance/independence/waivers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        engagementKind,
        engagementId,
        subjectUserId: verdict.userId,
        ruleViolated: blocking?.rule ?? "OWN_WORK",
        justification: justification.trim(),
        approvedByUserId: approver,
        scope: "ENGAGEMENT",
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(await readApiError(res, "Could not record the waiver"));
      return;
    }
    onGranted();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ShieldQuestion size={16} className="text-amber-600" />
          Independence waiver
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          ISO 19011 recognises that full independence is not always achievable. A waiver is
          permitted — but it is recorded, approved by a named person, and{" "}
          <strong>printed in the audit report</strong>.
        </p>

        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[12px] text-rose-800">
          <div className="font-semibold">
            {verdict.userName || verdict.userId} — conflict being waived
          </div>
          <div className="mt-0.5">{blocking?.reason ?? verdict.summary}</div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="waiver-justification" className="text-xs">
              Justification <span className="text-rose-600">*</span>
            </Label>
            <Textarea
              id="waiver-justification"
              rows={4}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Why is this assignment necessary despite the conflict, and what compensating controls apply? (e.g. findings reviewed independently by the certification body)"
              className="mt-1"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              {justification.trim().length}/20 characters minimum. This text appears verbatim in the
              report.
            </p>
          </div>

          <div>
            <Label className="text-xs">
              Approver <span className="text-rose-600">*</span>
            </Label>
            <div className="mt-1">
              <UserPicker
                value={approver || null}
                onChange={(userId) => setApprover(userId ?? "")}
                placeholder="Select an approver…"
              />
            </div>
            {selfApproval && (
              <p className="mt-1 text-[11px] text-rose-700">
                A waiver cannot be approved by the person it exempts.
              </p>
            )}
          </div>
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {err}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={busy || tooShort || !approver || selfApproval}
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Record waiver
          </Button>
        </div>
      </div>
    </div>
  );
}
