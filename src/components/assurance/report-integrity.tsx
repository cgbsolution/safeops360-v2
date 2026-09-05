"use client";

// Report integrity — verify, and correct without editing (docs/cams/09 §2.5).
//
// The report already carried a snapshot hash and already displayed it. What it
// could not do was *check* it, so the hash was a string nobody verified. This
// adds the check, and the two governed ways to correct an issued report:
//
//   erratum — appended, dated, approved. The snapshot and its hash are untouched.
//   reopen  — the audit goes back to review; prior reports are superseded.
//
// A legacy report generated before full-length hashing verifies as
// LEGACY_TRUNCATED, not as tampered. Flagging an old report as altered because
// the product changed would be worse than useless.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, FilePlus2, RotateCcw, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UserPicker } from "@/components/ui/user-picker";
import { readApiError } from "@/lib/client-errors";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import {
  INTEGRITY_CHIP,
  INTEGRITY_LABEL,
  fmtDateTime,
  type Erratum,
  type IntegrityVerdict,
} from "@/app/(dashboard)/cams/lib-assurance";

export function ReportIntegrity({
  reportId,
  auditId,
  auditClosed,
  errata,
  canGovern,
}: {
  reportId: string;
  auditId: string;
  auditClosed: boolean;
  errata: Erratum[];
  canGovern: boolean;
}) {
  const [verdict, setVerdict] = useState<IntegrityVerdict | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showErratum, setShowErratum] = useState(false);
  const [showReopen, setShowReopen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function verify() {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/assurance/reports/${reportId}/verify`);
    setBusy(false);
    if (!res.ok) {
      setErr(await readApiError(res, "Could not verify this report"));
      return;
    }
    setVerdict(await res.json());
  }

  return (
    <Card className="rounded-xl border border-slate-200 bg-white p-4 print:hidden shadow-none">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <ShieldCheck size={16} className="text-violet-700" />
          Record integrity
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={verify} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            Verify integrity
          </Button>
          {canGovern && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowErratum(true)}
              >
                <FilePlus2 size={14} /> Add erratum
              </Button>
              {auditClosed && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowReopen(true)}
                >
                  <RotateCcw size={14} /> Reopen audit
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <p className="mt-2 max-w-prose text-xs text-slate-500">
        The report snapshot is hashed at generation. Verifying recomputes that hash and reports
        whether the stored record has changed since it was issued. Corrections are made by erratum
        or by a governed reopen — never by a silent edit.
      </p>

      {err && (
        <Alert variant="destructive" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {err}
        </Alert>
      )}

      {verdict && (
        <Card className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-none">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded border px-2 py-0.5 text-xs font-medium",
                INTEGRITY_CHIP[verdict.status] ?? "",
              )}
            >
              {INTEGRITY_LABEL[verdict.status] ?? verdict.status}
            </span>
            <span className="text-xs text-slate-500">
              {verdict.reportCode} · generated {fmtDateTime(verdict.generatedAt)}
            </span>
          </div>
          {verdict.note && <p className="mt-1.5 text-[12px] text-slate-600">{verdict.note}</p>}
          <dl className="mt-2 space-y-1 text-[11px] text-slate-600">
            <div className="flex flex-wrap items-center gap-1">
              <dt className="font-medium">Computed</dt>
              <dd className="break-all font-mono">{verdict.computedHashFull}</dd>
              <Button variant="ghost"
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(verdict.computedHashFull);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                aria-label="Copy hash">
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </Button>
            </div>
            {verdict.storedHashFull && (
              <div className="flex flex-wrap gap-1">
                <dt className="font-medium">Stored</dt>
                <dd className="break-all font-mono">{verdict.storedHashFull}</dd>
              </div>
            )}
            <div className="text-slate-400">{verdict.algorithm}</div>
          </dl>
        </Card>
      )}

      {errata.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-slate-700">
            Errata ({errata.length})
          </h4>
          <ul className="mt-1.5 space-y-1.5">
            {errata.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-900"
              >
                <div className="text-[11px] font-semibold">
                  Erratum {e.sequence} · {fmtDateTime(e.createdAt)}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap">{e.text}</p>
                <div className="mt-1 text-[11px] text-amber-700">
                  Raised by {e.raisedBy} · approved by {e.approvedBy}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showErratum && (
        <GovernedTextDialog
          title="Add an erratum"
          blurb="The original snapshot and its hash stay untouched. The erratum is appended and renders as a dated block at the head of the report."
          label="Correction text"
          placeholder="What is being corrected, and what the correct position is…"
          confirmLabel="Append erratum"
          onClose={() => setShowErratum(false)}
          onSubmit={async (text, approver) => {
            const res = await fetch(`/api/assurance/reports/${reportId}/errata`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ text, approvedByUserId: approver }),
            });
            if (!res.ok) throw new Error(await readApiError(res, "Could not append the erratum"));
          }}
        />
      )}

      {showReopen && (
        <GovernedTextDialog
          title="Reopen this audit"
          blurb="The audit returns to review, every finalised checkpoint is unlocked and logged, and every prior report is marked superseded. The reopen is counted and stated in future reports."
          label="Reason for reopening"
          placeholder="Why does this closed audit need to be reopened…"
          confirmLabel="Reopen audit"
          destructive
          onClose={() => setShowReopen(false)}
          onSubmit={async (text, approver) => {
            const res = await fetch(`/api/assurance/audits/${auditId}/reopen`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ reason: text, approvedByUserId: approver }),
            });
            if (!res.ok) throw new Error(await readApiError(res, "Could not reopen the audit"));
          }}
        />
      )}
    </Card>
  );
}

/** Shared shape for the two governed actions: text + named approver, both required. */
function GovernedTextDialog({
  title,
  blurb,
  label,
  placeholder,
  confirmLabel,
  destructive = false,
  onClose,
  onSubmit,
}: {
  title: string;
  blurb: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  destructive?: boolean;
  onClose: () => void;
  onSubmit: (text: string, approverId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [approver, setApprover] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      await onSubmit(text.trim(), approver);
      onClose();
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">{blurb}</p>

        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="governed-text" className="text-xs">
              {label} <span className="text-rose-600">*</span>
            </Label>
            <Textarea
              id="governed-text"
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              className="mt-1"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              {text.trim().length}/10 characters minimum.
            </p>
          </div>
          <div>
            <Label className="text-xs">
              Approver <span className="text-rose-600">*</span>
            </Label>
            <div className="mt-1">
              <UserPicker
                value={approver || null}
                onChange={(id) => setApprover(id ?? "")}
                placeholder="Select an approver…"
              />
            </div>
          </div>
        </div>

        {err && (
          <Alert variant="destructive" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {err}
          </Alert>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant={destructive ? "destructive" : "default"}
            onClick={go}
            disabled={busy || text.trim().length < 10 || !approver}
          >
            {busy && <Loader2 size={14} className="animate-spin" />} {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
