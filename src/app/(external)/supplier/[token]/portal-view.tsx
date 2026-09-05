"use client";

// The supplier's own view of one audit's findings.
//
// Built for a factory manager on a phone, with no account and no training on
// this product. Three consequences that shaped it:
//
//   1. **Every finding is a card, not a table row.** Tables do not survive a
//      360px screen, and this audience is mobile-first.
//   2. **No jargon in the chrome.** "Checkpoint", "non-conformance" and
//      "assessment status" are our vocabulary; the page says what needs fixing
//      and what to send back.
//   3. **A failure states what to do next.** An expired link is a dead end
//      unless the page says who to contact — so it does.
//
// Reuses shadcn primitives for consistency, but no dashboard component: those
// assume a session and a permission provider, and neither exists here.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronDown, Loader2, MessageSquare,
  Paperclip, ShieldCheck, Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Finding = {
  id: string;
  checkpointCode: string;
  question: string;
  discipline: string;
  criticality: string;
  requirementReference: string;
  standard: string;
  assessmentStatus: string;
  observation: string;
  capaNumber: string | null;
  capaStatus: string | null;
  capaDueDate: string | null;
};

type Submission = {
  id: string;
  kind: "COMMENT" | "EVIDENCE";
  body: string;
  fileName: string | null;
  submittedAt: string | null;
  submittedByName: string | null;
  acknowledged: boolean;
};

type Payload = {
  audit: {
    auditNumber: string;
    title: string;
    status: string;
    scheduledDate: string | null;
    closedAt: string | null;
    overallCompliancePct: number | null;
    criticalFailureCount: number;
  };
  supplier: {
    legalName: string | null;
    contactName: string | null;
    contactEmail: string;
    vendorSiteRef: string | null;
  };
  findings: Finding[];
  findingCount: number;
  submissions: Record<string, Submission[]>;
  expiresAt: string | null;
};

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

const SEVERITY: Record<string, { label: string; cls: string }> = {
  critical: { label: "Critical", cls: "bg-rose-600 text-white" },
  major: { label: "Major", cls: "bg-amber-500 text-white" },
  minor: { label: "Minor", cls: "bg-sky-500 text-white" },
  observation: { label: "Observation", cls: "bg-slate-400 text-white" },
};

export function SupplierPortalView({ token }: { token: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/supplier-portal/${token}`, { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || j.error || "This link is not valid.");
      }
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <Centre>
        <Loader2 className="animate-spin text-slate-400" size={28} />
        <p className="mt-3 text-sm text-slate-500">Loading…</p>
      </Centre>
    );
  }

  if (error || !data) {
    return (
      <Centre>
        <AlertTriangle className="text-amber-500" size={30} />
        <h1 className="mt-3 text-lg font-semibold text-slate-800">This link is not available</h1>
        <p className="mt-1 max-w-sm text-sm text-slate-600">{error}</p>
        {/* A dead end is only acceptable if it says what to do next. */}
        <p className="mt-4 max-w-sm text-[13px] text-slate-500">
          Links expire for security. Please contact the audit team at the company that
          audited your facility and ask them to send a new one.
        </p>
      </Centre>
    );
  }

  const { audit, supplier, findings } = data;
  const outstanding = findings.filter(
    (f) => !(data.submissions[f.id] ?? []).length,
  ).length;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
          <ShieldCheck size={13} /> Corrective actions
        </div>
        <h1 className="mt-1 text-xl font-bold leading-tight text-slate-900 sm:text-2xl">
          {supplier.legalName ?? "Your facility"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Audit {audit.auditNumber}
          {supplier.vendorSiteRef ? ` · ${supplier.vendorSiteRef}` : ""}
          {audit.closedAt ? ` · completed ${audit.closedAt.slice(0, 10)}` : ""}
        </p>

        <Card className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-none">
          <p className="text-sm leading-relaxed text-slate-700">
            {findings.length === 0 ? (
              <>No issues were raised that need action from you.</>
            ) : (
              <>
                <strong>{findings.length}</strong> issue{findings.length === 1 ? "" : "s"} were
                found at your facility that need correcting.
                {outstanding > 0 && (
                  <> You have not yet replied to <strong>{outstanding}</strong> of them.</>
                )}
              </>
            )}
          </p>
          <p className="mt-2 text-[12px] text-slate-500">
            For each one, describe what you have done and attach a photo or document as
            proof. The audit team reviews everything you send.
          </p>
          {data.expiresAt && (
            <p className="mt-2 text-[12px] text-slate-400">
              This link works until {data.expiresAt.slice(0, 10)}.
            </p>
          )}
        </Card>
      </header>

      <div className="space-y-3">
        {findings.map((f) => (
          <FindingCard
            key={f.id}
            token={token}
            finding={f}
            submissions={data.submissions[f.id] ?? []}
            onSubmitted={load}
          />
        ))}
      </div>

      <footer className="mt-8 text-center text-[11px] text-slate-400">
        This page is private to your facility. Please do not share the link.
      </footer>
    </div>
  );
}

function FindingCard({
  token, finding, submissions, onSubmitted,
}: {
  token: string;
  finding: Finding;
  submissions: Submission[];
  onSubmitted: () => void;
}) {
  const [open, setOpen] = useState(submissions.length === 0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sev = SEVERITY[finding.criticality] ?? SEVERITY.minor;
  const replied = submissions.length > 0;

  async function sendComment() {
    if (!comment.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/supplier-portal/${token}/comment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ checkpointResponseId: finding.id, body: comment }),
      });
      if (!res.ok) throw new Error("Could not send. Please try again.");
      setComment("");
      setMsg({ tone: "ok", text: "Sent to the audit team." });
      onSubmitted();
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    if (!ALLOWED.includes(file.type)) {
      setMsg({ tone: "err", text: "Please choose a photo (JPG, PNG) or a PDF." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setMsg({ tone: "err", text: "That file is too large — the limit is 10 MB." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      // Two steps, like the internal evidence flow: ask for a signed target,
      // then PUT the bytes straight to storage so they never transit our API.
      const sig = await fetch(`/api/supplier-portal/${token}/upload-url`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          checkpointResponseId: finding.id,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
        }),
      });
      if (!sig.ok) throw new Error("Upload is unavailable right now.");
      const { storagePath, signedUrl, signed_url, token: uploadToken } = await sig.json();
      const put = await fetch(signedUrl ?? signed_url, {
        method: "PUT",
        headers: {
          "content-type": file.type,
          ...(uploadToken ? { authorization: `Bearer ${uploadToken}` } : {}),
        },
        body: file,
      });
      if (!put.ok) throw new Error("The file could not be uploaded.");

      const rec = await fetch(`/api/supplier-portal/${token}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          checkpointResponseId: finding.id,
          fileName: file.name,
          storagePath,
          mimeType: file.type,
          fileSize: file.size,
          caption: comment.trim(),
        }),
      });
      if (!rec.ok) throw new Error("The file uploaded but could not be recorded.");
      setComment("");
      setMsg({ tone: "ok", text: "Evidence sent to the audit team." });
      onSubmitted();
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <Button variant="ghost"
        type="button"
        onClick={() => setOpen((v) => !v)} className="flex w-full items-start gap-3 p-4 text-left">
        <span className={cn("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", sev.cls)}>
          {sev.label}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-snug text-slate-900">
            {finding.question}
          </span>
          <span className="mt-0.5 block text-[12px] text-slate-500">
            {finding.discipline}
            {finding.capaDueDate ? ` · due ${finding.capaDueDate.slice(0, 10)}` : ""}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {replied && <CheckCircle2 size={16} className="text-emerald-600" />}
          <ChevronDown
            size={16}
            className={cn("text-slate-400 transition-transform", open && "rotate-180")}
          />
        </span>
      </Button>

      {open && (
        <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
          {finding.observation && (
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                What the auditor saw
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
                {finding.observation}
              </p>
            </div>
          )}
          {finding.requirementReference && (
            <p className="text-[12px] text-slate-500">
              Requirement: {finding.requirementReference}
            </p>
          )}

          {submissions.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                What you have sent
              </div>
              {submissions.map((s) => (
                <Alert variant="success" key={s.id} className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2 text-[12px]">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    {s.kind === "EVIDENCE" ? <Paperclip size={11} /> : <MessageSquare size={11} />}
                    {s.submittedAt?.slice(0, 10)}
                    {s.acknowledged && (
                      <span className="ml-auto font-semibold text-emerald-700">Reviewed</span>
                    )}
                  </div>
                  {s.fileName && <div className="mt-0.5 font-medium text-slate-700">{s.fileName}</div>}
                  {s.body && <div className="mt-0.5 whitespace-pre-wrap text-slate-600">{s.body}</div>}
                </Alert>
              ))}
            </div>
          )}

          <div>
            <Label className="text-[12px] font-medium text-slate-700" htmlFor={`c-${finding.id}`}>
              What have you done to fix this?
            </Label>
            <Textarea
              id={`c-${finding.id}`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Describe the action you took, and when."
              className="mt-1 text-[14px]"
            />
          </div>

          {msg && (
            <p className={cn("text-[12px]", msg.tone === "ok" ? "text-emerald-700" : "text-rose-600")}>
              {msg.text}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={sendComment} disabled={busy || !comment.trim()} className="flex-1">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <MessageSquare size={15} />}
              Send reply
            </Button>
            <Button
              type="button" variant="outline" disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="flex-1"
            >
              <Upload size={15} /> Attach proof
            </Button>
            <Input
              ref={fileRef}
              type="file"
              accept={ALLOWED.join(",")}
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
              }} />
          </div>
          <p className="text-[11px] text-slate-400">
            Photos or PDF, up to 10 MB. Anything typed above is sent with the file.
          </p>
        </div>
      )}
    </section>
  );
}

function Centre({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}
