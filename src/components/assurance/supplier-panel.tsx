"use client";

// The audited party, on the audit detail screen (WP-45).
//
// Two jobs, and the second is the one that matters:
//
//  1. Name the supplier, and show whether its risk posture has moved since the
//     audit was scheduled. A vendor re-tiered from HIGH to CRITICAL mid-audit
//     changes what the audit is for, and the auditor should see that.
//  2. Manage the supplier's response channel HONESTLY. The panel reports what
//     the backend derived from whether a portal token actually exists and is
//     live — it never claims "the supplier can respond" on the basis that the
//     feature exists.

import { useState } from "react";
import {
  Building2, Copy, KeyRound, Link2, MessageSquare, Paperclip, ShieldAlert, AlertTriangle, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { readApiError } from "@/lib/client-errors";
import type { SupplierDetail } from "@/app/(dashboard)/cams/audits/lib";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type PortalSubmission = {
  id: string;
  actorType: "SUPPLIER";
  kind: "COMMENT" | "EVIDENCE";
  checkpointResponseId: string | null;
  capaId: string | null;
  body: string;
  fileName: string | null;
  submittedByName: string | null;
  submittedByEmail: string;
  submittedAt: string | null;
  acknowledgedAt: string | null;
};

export function SupplierPanel({
  auditId,
  supplier,
  submissions = [],
  canManage = false,
  onChanged,
}: {
  auditId: string;
  supplier: SupplierDetail;
  submissions?: PortalSubmission[];
  canManage?: boolean;
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(supplier.supplierContactEmail ?? "");
  // Shown once and never again — only a hash is stored server-side.
  const [issuedLink, setIssuedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const live = supplier.responseChannel === "PORTAL";

  async function issue() {
    setBusy(true);
    try {
      const res = await fetch("/api/cams-completion/suppliers/portal/issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ auditId, contactEmail: email || null }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Could not issue access"));
      const j = await res.json();
      setIssuedLink(`${window.location.origin}${j.portalPath}`);
      toast({
        variant: "success",
        title: j.emailSent ? "Access issued and emailed" : "Access issued",
        description: j.emailSent
          ? `Sent to ${j.contactEmail}.`
          : "Email could not be sent — copy the link below and share it yourself.",
      });
      onChanged?.();
    } catch (e) {
      toast({ variant: "error", title: "Couldn't issue access", description: String((e as Error).message) });
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!supplier.portalTokenId) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/cams-completion/suppliers/portal/${supplier.portalTokenId}/revoke`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await readApiError(res, "Could not revoke access"));
      setIssuedLink(null);
      toast({ variant: "success", title: "Access withdrawn", description: "The link no longer works." });
      onChanged?.();
    } catch (e) {
      toast({ variant: "error", title: "Couldn't withdraw access", description: String((e as Error).message) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Alert variant="warning" className="rounded-xl border border-amber-200 bg-amber-50/40">
      <div className="flex flex-wrap items-start gap-3 border-b border-amber-200 p-4">
        <Building2 size={18} className="mt-0.5 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">{supplier.legalName}</span>
            {supplier.vendorCode && (
              <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                {supplier.vendorCode}
              </span>
            )}
            {supplier.criticality && (
              <Badge variant="warning" className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                {supplier.criticality}
              </Badge>
            )}
            {supplier.isSingleSource && (
              <Badge variant="danger" className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                Single source
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            External supplier — the site on this audit is the operation that holds the
            relationship, not the audited premises.
            {supplier.vendorSiteRef ? ` Audited unit: ${supplier.vendorSiteRef}.` : ""}
          </p>

          {/* Posture drift since scheduling. Snapshotted server-side precisely
              so a later re-tier cannot silently rewrite why this was scheduled. */}
          {supplier.riskPostureChanged && (
            <p className="mt-1.5 inline-flex items-start gap-1.5 rounded-md bg-white px-2 py-1 text-[11px] text-amber-800">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              Criticality changed since scheduling: was{" "}
              <strong>{supplier.criticalityAtScheduling ?? "unset"}</strong>, now{" "}
              <strong>{supplier.criticality ?? "unset"}</strong>.
            </p>
          )}
        </div>
        <a
          href={`/erm/vendors/${supplier.vendorProfileId}`}
          className="shrink-0 text-[11px] font-medium text-violet-800 hover:underline"
        >
          Vendor profile →
        </a>
      </div>

      {/* ── Response channel ─────────────────────────────────────────── */}
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              live
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-600",
            )}
          >
            {live ? <Link2 size={11} /> : <ShieldAlert size={11} />}
            {live ? "Supplier can respond" : "Recorded on their behalf"}
          </span>
          {typeof supplier.portalSubmissionCount === "number" && supplier.portalSubmissionCount > 0 && (
            <span className="text-[11px] text-slate-500">
              {supplier.portalSubmissionCount} submission(s) received
            </span>
          )}
        </div>
        <p className="text-[11px] leading-relaxed text-slate-600">{supplier.responseChannelNote}</p>

        {canManage && (
          <Card className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-none">
            {!live && (
              <>
                <Label className="text-[11px]">Supplier contact email</Label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@supplier.com"
                    className="h-8 flex-1 min-w-[200px] text-sm"
                  />
                  <Button type="button" size="sm" onClick={issue} disabled={busy || !email.trim()}>
                    <KeyRound size={13} /> {busy ? "Issuing…" : "Issue access"}
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Sends a private, expiring link to this one audit. The supplier can view
                  their findings, comment and upload evidence — nothing else.
                </p>
              </>
            )}

            {live && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1 text-[11px] text-slate-600">
                  Issued to <strong>{supplier.portalContactEmail}</strong>, expires{" "}
                  {supplier.portalExpiresAt?.slice(0, 10)}.
                  {supplier.portalLastAccessedAt
                    ? ` Last opened ${supplier.portalLastAccessedAt.slice(0, 10)}.`
                    : " Not opened yet."}
                </div>
                <Button type="button" size="sm" variant="outline" onClick={issue} disabled={busy}>
                  Re-issue
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={revoke} disabled={busy}>
                  Withdraw
                </Button>
              </div>
            )}

            {/* The link is displayed exactly once — the server stores only a
                hash, so there is no way to show it again later. */}
            {issuedLink && (
              <Alert variant="success" className="rounded-md border border-emerald-200 bg-emerald-50 p-2">
                <div className="mb-1 text-[11px] font-semibold text-emerald-800">
                  Copy this link now — it cannot be shown again.
                </div>
                <div className="flex gap-2">
                  <Input readOnly value={issuedLink} className="h-8 flex-1 font-mono text-[11px]" />
                  <Button
                    type="button" size="sm" variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(issuedLink);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </Button>
                </div>
              </Alert>
            )}
          </Card>
        )}

        {/* ── What the supplier actually sent ────────────────────────── */}
        {submissions.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              From the supplier
            </div>
            {submissions.map((s) => (
              <Alert variant="info"
                key={s.id}
                className="rounded-lg border border-sky-200 bg-sky-50/60 p-2 text-[12px]">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  {/* The structural distinction: these rows come from
                      SupplierPortalSubmission, never from CapaComment, so a
                      supplier's own words can never be mistaken for an internal
                      user updating on their behalf. */}
                  <span className="rounded bg-sky-600 px-1.5 py-0.5 font-bold uppercase text-white">
                    Supplier
                  </span>
                  {s.kind === "EVIDENCE" ? <Paperclip size={11} /> : <MessageSquare size={11} />}
                  <span className="font-medium text-slate-700">
                    {s.submittedByName || s.submittedByEmail}
                  </span>
                  <span className="text-slate-400">{s.submittedAt?.slice(0, 10)}</span>
                  {!s.acknowledgedAt && (
                    <Badge variant="warning" className="ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                      Not yet reviewed
                    </Badge>
                  )}
                </div>
                {s.fileName && <div className="mt-1 font-medium text-slate-700">{s.fileName}</div>}
                {s.body && <div className="mt-0.5 whitespace-pre-wrap text-slate-600">{s.body}</div>}
              </Alert>
            ))}
          </div>
        )}
      </div>
    </Alert>
  );
}
