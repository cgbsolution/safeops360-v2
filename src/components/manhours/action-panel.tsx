"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, Lock, Unlock, RotateCw, AlertTriangle } from "lucide-react";
import { fetchSubmission } from "./wizard-api";
import type { WizardSubmission } from "./wizard-types";
import { Alert } from "@/components/ui/alert";

interface CapabilityFlags {
  /** User holds MANHOURS.APPROVE for this plant — drives Plant Head panel. */
  canReview: boolean;
  /** User holds MANHOURS.CLOSE for this plant — drives Corporate HSE panel. */
  canLock: boolean;
}

/**
 * Status-aware action panel shown above the wizard's stepper.
 *
 *   UNDER_REVIEW + canReview      → Plant Head approve / reject
 *   APPROVED     + canLock        → Corporate HSE lock / reject
 *   LOCKED       + canLock        → Unlock with reason
 *   UNLOCKED_FOR_REVISION         → Re-lock button (Corporate HSE)
 *                                   + "edits welcome" banner for the
 *                                   submitter
 *
 * Renders nothing for DRAFT (the wizard itself is the action surface).
 */
export function ManhoursActionPanel({
  submission,
  flags,
  onUpdated
}: {
  submission: WizardSubmission;
  flags: CapabilityFlags;
  onUpdated: (s: WizardSubmission) => void;
}) {
  switch (submission.status) {
    case "UNDER_REVIEW":
      return flags.canReview ? (
        <PlantHeadReviewPanel submission={submission} onUpdated={onUpdated} />
      ) : (
        <WaitingBanner
          title="With Plant Head for review"
          message="The HSE Manager's edits are locked while Plant Head reviews this submission."
        />
      );
    case "APPROVED":
      return flags.canLock ? (
        <CorporateLockPanel submission={submission} onUpdated={onUpdated} />
      ) : (
        <WaitingBanner
          title="With Corporate HSE for lock"
          message="Plant Head has approved. Corporate HSE will lock the submission and freeze KPIs."
        />
      );
    case "LOCKED":
      return flags.canLock ? (
        <UnlockPanel submission={submission} onUpdated={onUpdated} />
      ) : (
        <LockedBanner submission={submission} />
      );
    case "UNLOCKED_FOR_REVISION":
      return (
        <UnlockedBanner
          submission={submission}
          canRelock={flags.canLock}
          onUpdated={onUpdated}
        />
      );
    default:
      return null;
  }
}

// ── Plant Head — UNDER_REVIEW ──────────────────────────────────

function PlantHeadReviewPanel({
  submission,
  onUpdated
}: {
  submission: WizardSubmission;
  onUpdated: (s: WizardSubmission) => void;
}) {
  const [mode, setMode] = useState<"idle" | "approve" | "reject" | "return">("idle");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(decision: "APPROVED" | "REJECTED" | "RETURNED_FOR_REVISION") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/manhours-submissions/${submission.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, notes: notes.trim() || null })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const fresh = await fetchSubmission(submission.id);
      onUpdated(fresh);
      setMode("idle");
      setNotes("");
    } catch (e: any) {
      setError(e?.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-blue-200 bg-blue-50/60">
      <CardContent className="p-4 space-y-3">
        <Header
          icon={<AlertTriangle size={16} className="text-blue-700" />}
          title="Plant Head Review"
          subtitle="Approve to advance to Corporate HSE lock, or return for HSE Manager edits."
        />

        {mode === "idle" && (
          <div className="flex flex-wrap gap-2">
            <Button variant="success" size="sm" onClick={() => setMode("approve")}>
              <CheckCircle2 size={14} /> Approve
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMode("return")}>
              <RotateCw size={14} /> Return for revision
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setMode("reject")}>
              <XCircle size={14} /> Reject
            </Button>
          </div>
        )}

        {mode !== "idle" && (
          <ReasonForm
            label={
              mode === "approve"
                ? "Approval notes (optional)"
                : mode === "return"
                  ? "What needs revision? (required, min 5 chars)"
                  : "Reason for rejection (required, min 5 chars)"
            }
            placeholder={
              mode === "approve"
                ? "e.g. Numbers check out against attendance roster"
                : "Cite the specific item(s) the HSE Manager needs to fix."
            }
            value={notes}
            onChange={setNotes}
            busy={busy}
            error={error}
            onCancel={() => {
              setMode("idle");
              setNotes("");
              setError(null);
            }}
            onConfirm={() =>
              submit(
                mode === "approve"
                  ? "APPROVED"
                  : mode === "return"
                    ? "RETURNED_FOR_REVISION"
                    : "REJECTED"
              )
            }
            confirmLabel={
              mode === "approve" ? "Confirm approve" : mode === "return" ? "Return for revision" : "Reject"
            }
            confirmVariant={mode === "approve" ? "success" : mode === "return" ? "outline" : "destructive"}
            confirmDisabled={mode !== "approve" && notes.trim().length < 5}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ── Corporate HSE — APPROVED ───────────────────────────────────

function CorporateLockPanel({
  submission,
  onUpdated
}: {
  submission: WizardSubmission;
  onUpdated: (s: WizardSubmission) => void;
}) {
  const [mode, setMode] = useState<"idle" | "lock" | "reject">("idle");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(decision: "LOCK" | "REJECT") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/manhours-submissions/${submission.id}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, notes: notes.trim() || null })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const fresh = await fetchSubmission(submission.id);
      onUpdated(fresh);
      setMode("idle");
      setNotes("");
    } catch (e: any) {
      setError(e?.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-violet-200 bg-violet-50/60">
      <CardContent className="p-4 space-y-3">
        <Header
          icon={<Lock size={16} className="text-violet-700" />}
          title="Corporate HSE Lock"
          subtitle="Locking captures the IS-3786 KPI snapshot and freezes this period. Rejecting returns the submission to the HSE Manager."
        />

        {mode === "idle" && (
          <div className="flex flex-wrap gap-2">
            <Button variant="success" size="sm" onClick={() => setMode("lock")}>
              <Lock size={14} /> Lock + snapshot KPIs
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setMode("reject")}>
              <XCircle size={14} /> Reject
            </Button>
          </div>
        )}

        {mode !== "idle" && (
          <ReasonForm
            label={
              mode === "lock"
                ? "Lock notes (optional)"
                : "Reason for rejection (required, min 5 chars)"
            }
            placeholder={
              mode === "lock"
                ? "Any audit-trail context worth capturing"
                : "Be specific — this returns the submission to the HSE Manager"
            }
            value={notes}
            onChange={setNotes}
            busy={busy}
            error={error}
            onCancel={() => {
              setMode("idle");
              setNotes("");
              setError(null);
            }}
            onConfirm={() => submit(mode === "lock" ? "LOCK" : "REJECT")}
            confirmLabel={mode === "lock" ? "Confirm lock" : "Reject"}
            confirmVariant={mode === "lock" ? "success" : "destructive"}
            confirmDisabled={mode === "reject" && notes.trim().length < 5}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ── Corporate HSE — LOCKED (unlock affordance) ─────────────────

function UnlockPanel({
  submission,
  onUpdated
}: {
  submission: WizardSubmission;
  onUpdated: (s: WizardSubmission) => void;
}) {
  const [mode, setMode] = useState<"idle" | "unlock">("idle");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/manhours-submissions/${submission.id}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const fresh = await fetchSubmission(submission.id);
      onUpdated(fresh);
      setMode("idle");
      setReason("");
    } catch (e: any) {
      setError(e?.message ?? "Unlock failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-slate-300 bg-slate-50">
      <CardContent className="p-4 space-y-3">
        <Header
          icon={<Lock size={16} className="text-slate-700" />}
          title="Locked — Corporate HSE"
          subtitle="KPIs for this period are frozen. Unlock only when correction is genuinely required; the reason is permanently logged."
        />

        {mode === "idle" ? (
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setMode("unlock")}>
              <Unlock size={14} /> Unlock for revision…
            </Button>
            <span className="text-xs text-slate-500">
              Locked {submission.kpiSnapshot ? "with KPI snapshot" : "(no snapshot)"} ·{" "}
              {submission.lockedById ? "audit trail in workflow tracker" : ""}
            </span>
          </div>
        ) : (
          <ReasonForm
            label="Reason for unlock (required, min 10 chars)"
            placeholder="e.g. HR system export was incomplete — June contractor hours under-reported by ~12k. Re-running with corrected payroll."
            value={reason}
            onChange={setReason}
            busy={busy}
            error={error}
            onCancel={() => {
              setMode("idle");
              setReason("");
              setError(null);
            }}
            onConfirm={submit}
            confirmLabel="Unlock"
            confirmVariant="destructive"
            confirmDisabled={reason.trim().length < 10}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ── UNLOCKED_FOR_REVISION ──────────────────────────────────────

function UnlockedBanner({
  submission,
  canRelock,
  onUpdated
}: {
  submission: WizardSubmission;
  canRelock: boolean;
  onUpdated: (s: WizardSubmission) => void;
}) {
  const [mode, setMode] = useState<"idle" | "relock">("idle");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/manhours-submissions/${submission.id}/relock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes.trim() || null })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const fresh = await fetchSubmission(submission.id);
      onUpdated(fresh);
      setMode("idle");
      setNotes("");
    } catch (e: any) {
      setError(e?.message ?? "Re-lock failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-rose-300 bg-rose-50">
      <CardContent className="p-4 space-y-3">
        <Header
          icon={<Unlock size={16} className="text-rose-700" />}
          title="Unlocked for revision"
          subtitle="All KPIs for this period are currently flagged PROVISIONAL. HSE Manager edits via the wizard; Corporate HSE re-locks below to capture a fresh snapshot."
        />

        {canRelock && mode === "idle" && (
          <div className="flex items-center gap-3">
            <Button variant="success" size="sm" onClick={() => setMode("relock")}>
              <Lock size={14} /> Re-lock with fresh snapshot
            </Button>
            <span className="text-xs text-slate-500">
              The previous snapshot is preserved in the unlock event's change log.
            </span>
          </div>
        )}

        {canRelock && mode === "relock" && (
          <ReasonForm
            label="Re-lock notes (optional)"
            placeholder="What was corrected during the revision window"
            value={notes}
            onChange={setNotes}
            busy={busy}
            error={error}
            onCancel={() => {
              setMode("idle");
              setNotes("");
              setError(null);
            }}
            onConfirm={submit}
            confirmLabel="Confirm re-lock"
            confirmVariant="success"
            confirmDisabled={false}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ── Read-only banners ──────────────────────────────────────────

function LockedBanner({ submission }: { submission: WizardSubmission }) {
  return (
    <Card className="border-slate-300 bg-slate-50">
      <CardContent className="p-4">
        <Header
          icon={<Lock size={16} className="text-slate-700" />}
          title="Locked"
          subtitle={
            submission.kpiSnapshot
              ? "KPIs for this period are frozen. The KPI snapshot below is the authoritative audit record."
              : "KPIs for this period are frozen."
          }
        />
      </CardContent>
    </Card>
  );
}

function WaitingBanner({ title, message }: { title: string; message: string }) {
  return (
    <Card className="border-blue-200 bg-blue-50/40">
      <CardContent className="p-4">
        <Header
          icon={<AlertTriangle size={16} className="text-blue-700" />}
          title={title}
          subtitle={message}
        />
      </CardContent>
    </Card>
  );
}

// ── Shared bits ────────────────────────────────────────────────

function Header({
  icon,
  title,
  subtitle
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5">{icon}</div>
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-600 mt-0.5">{subtitle}</div>
      </div>
    </div>
  );
}

function ReasonForm({
  label,
  placeholder,
  value,
  onChange,
  busy,
  error,
  onCancel,
  onConfirm,
  confirmLabel,
  confirmVariant,
  confirmDisabled
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmVariant: "success" | "destructive" | "outline";
  confirmDisabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-slate-700">{label}</div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
      />
      {error && (
        <Alert variant="destructive" className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
          {error}
        </Alert>
      )}
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant={confirmVariant}
          size="sm"
          onClick={onConfirm}
          disabled={busy || confirmDisabled}
        >
          {busy ? "…" : confirmLabel}
        </Button>
      </div>
    </div>
  );
}
