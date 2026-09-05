"use client";

// WP-41 — engagement sign-off (docs/cams/09 §3.1).
//
// `AuditReport.signOffs` shipped with the original audit build and was never
// written to: the report rendered "Awaiting sign-off" and nothing in the
// product could ever change that. This is the missing half.
//
// **Sign-off is a closure gate, not a formality.** The finalizability gate
// proves the WORK is done; this proves someone ACCEPTED it. Both a lead auditor
// and an auditee owner must sign before `close_audit` will run, and the panel
// says plainly which is outstanding.
//
// Signature capture reuses the platform `SignatureModal` — the same drawing
// surface PTW and training attendance use — rather than a third canvas. The
// typed fallback exists because drawing on a shop floor with gloved hands does
// not always work; it is weaker, and the panel does not pretend otherwise.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  PenTool, CheckCircle2, CircleDashed, Loader2, Trash2, Lock, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { SignatureModal } from "@/components/ui/signature-pad";
import { readApiError } from "@/lib/client-errors";
import { fmtDateTime } from "@/app/(dashboard)/cams/lib-assurance";
import { Alert } from "@/components/ui/alert";

export type SignOffEntry = {
  role: string;
  userId: string;
  name: string;
  designation?: string | null;
  disciplineCode?: string | null;
  signatureKind: "DRAWN" | "TYPED";
  signatureImage?: string | null;
  typedName?: string | null;
  statement?: string | null;
  signedAt: string;
};

export type SignOffStatus = {
  signOffs: SignOffEntry[];
  signedRoles: string[];
  missingRequiredRoles: string[];
  canClose: boolean;
  disciplines: { disciplineCode: string; disciplineLabel: string; signed: boolean }[];
  disciplinesSigned: number;
  disciplinesTotal: number;
  statement: string;
};

const ROLE_LABEL: Record<string, string> = {
  LEAD_AUDITOR: "Lead auditor",
  AUDITEE_OWNER: "Auditee owner",
  DISCIPLINE_AUDITOR: "Discipline auditor",
  PLANT_MANAGER: "Plant manager",
  EXTERNAL_OBSERVER: "External observer",
};

export function SignOffPanel({
  auditId,
  status,
  locked,
}: {
  auditId: string;
  status: SignOffStatus | null;
  locked: boolean;
}) {
  const [signing, setSigning] = useState(false);

  if (!status) return null;

  return (
    <Card className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <PenTool size={16} className="text-violet-700" />
          Sign-off
        </div>
        <span
          className={cn(
            "rounded border px-2 py-0.5 text-[11px]",
            status.canClose
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800",
          )}
        >
          {status.canClose ? "Complete" : "Outstanding"}
        </span>
        {!locked && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto h-7 text-[11px]"
            onClick={() => setSigning(true)}
          >
            <PenTool size={12} /> Sign
          </Button>
        )}
        {locked && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-400">
            <Lock size={11} /> locked
          </span>
        )}
      </div>

      <p className="mt-1.5 text-xs text-slate-500">{status.statement}</p>
      {!status.canClose && (
        <p className="mt-1 text-[11px] text-slate-400">
          The audit cannot be closed until both a lead auditor and an auditee owner have signed.
          Completing every checkpoint proves the work is done; sign-off proves it was accepted.
        </p>
      )}

      {/* Required roles, each shown as signed or outstanding. */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {["LEAD_AUDITOR", "AUDITEE_OWNER"].map((role) => {
          const entry = status.signOffs.find((s) => s.role === role);
          return <RoleCard key={role} role={role} entry={entry} auditId={auditId} locked={locked} />;
        })}
      </div>

      {/* Supplementary signatures, if any. */}
      {status.signOffs.filter((s) => !["LEAD_AUDITOR", "AUDITEE_OWNER"].includes(s.role)).length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] font-semibold text-slate-600">Additional signatures</div>
          <ul className="mt-1 space-y-1">
            {status.signOffs
              .filter((s) => !["LEAD_AUDITOR", "AUDITEE_OWNER"].includes(s.role))
              .map((s, i) => (
                <li key={i} className="text-[11px] text-slate-600">
                  {ROLE_LABEL[s.role] ?? s.role}
                  {s.disciplineCode ? ` (${s.disciplineCode})` : ""}: {s.name} —{" "}
                  {fmtDateTime(s.signedAt)}
                </li>
              ))}
          </ul>
        </div>
      )}

      {status.disciplinesTotal > 0 && (
        <p className="mt-2 text-[11px] text-slate-400">
          Per-discipline sign-off: {status.disciplinesSigned} of {status.disciplinesTotal}. Optional —
          it does not gate closure, but a certification body reads it as evidence each auditor
          stood behind their own section.
        </p>
      )}

      {signing && (
        <SignDialog auditId={auditId} status={status} onClose={() => setSigning(false)} />
      )}
    </Card>
  );
}

function RoleCard({
  role, entry, auditId, locked,
}: {
  role: string; entry?: SignOffEntry; auditId: string; locked: boolean;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const me = (session?.user as any)?.id as string | undefined;
  const [busy, setBusy] = useState(false);

  async function withdraw() {
    if (!confirm("Withdraw your signature? The audit will no longer be closable.")) return;
    setBusy(true);
    const res = await fetch(`/api/assurance/audits/${auditId}/signoff?role=${role}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  if (!entry) {
    return (
      <Card className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-2.5 shadow-none">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <CircleDashed size={13} className="text-slate-400" />
          {ROLE_LABEL[role] ?? role}
        </div>
        <p className="mt-0.5 text-[11px] text-slate-500">Not yet signed.</p>
      </Card>
    );
  }

  return (
    <Card className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-none">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
        <CheckCircle2 size={13} className="text-emerald-600" />
        {ROLE_LABEL[role] ?? role}
        {/* Only the signer may withdraw their own signature. */}
        {!locked && entry.userId === me && (
          <Button variant="ghost"
            type="button"
            onClick={withdraw}
            disabled={busy} className="ml-auto"
            aria-label="Withdraw signature">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          </Button>
        )}
      </div>
      <div className="mt-0.5 text-[12px] text-slate-700">{entry.name}</div>
      {entry.designation && (
        <div className="text-[10px] text-slate-400">{entry.designation}</div>
      )}
      {entry.signatureKind === "DRAWN" && entry.signatureImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.signatureImage}
          alt={`Signature of ${entry.name}`}
          className="mt-1 h-10 rounded border border-slate-200 bg-white"
        />
      ) : (
        <div className="mt-1 font-serif text-sm italic text-slate-700">
          {entry.typedName}
          <span className="ml-1 text-[10px] not-italic text-slate-400">(typed)</span>
        </div>
      )}
      <div className="mt-1 text-[10px] text-slate-400">{fmtDateTime(entry.signedAt)}</div>
      {entry.statement && (
        <p className="mt-1 text-[11px] italic text-slate-600">&ldquo;{entry.statement}&rdquo;</p>
      )}
    </Card>
  );
}

function SignDialog({
  auditId, status, onClose,
}: {
  auditId: string; status: SignOffStatus; onClose: () => void;
}) {
  const router = useRouter();
  const [role, setRole] = useState(status.missingRequiredRoles[0] ?? "LEAD_AUDITOR");
  const [kind, setKind] = useState<"DRAWN" | "TYPED">("DRAWN");
  const [signature, setSignature] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const [disciplineCode, setDisciplineCode] = useState("");
  const [statement, setStatement] = useState("");
  const [padOpen, setPadOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ready = kind === "DRAWN" ? !!signature : typedName.trim().length > 1;

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/assurance/audits/${auditId}/signoff`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role,
        signatureKind: kind,
        signaturePayload: kind === "DRAWN" ? signature : null,
        typedName: kind === "TYPED" ? typedName.trim() : null,
        disciplineCode: role === "DISCIPLINE_AUDITOR" ? disciplineCode || null : null,
        statement: statement.trim() || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(await readApiError(res, "Could not record the sign-off"));
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
        <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ShieldCheck size={16} className="text-violet-700" /> Record your sign-off
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            You are signing as yourself — the signature is recorded against your authenticated
            account and a server-side timestamp.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="so-role" className="text-xs">Signing as</Label>
              <SelectField id="so-role" value={role} onChange={setRole} className="mt-1"
                options={Object.entries(ROLE_LABEL).map(([v, l]) => ({ value: v, label: String(l) }))}
              />
            </div>

            {role === "DISCIPLINE_AUDITOR" && (
              <div>
                <Label htmlFor="so-disc" className="text-xs">Discipline</Label>
                <SelectField id="so-disc" value={disciplineCode}
                  onChange={setDisciplineCode} className="mt-1"
                  placeholder="— select —"
                  options={status.disciplines.map((d) => ({ value: d.disciplineCode, label: `${d.disciplineLabel}${d.signed ? " (signed)" : ""}` }))}
                />
              </div>
            )}

            <div>
              <Label className="text-xs">Signature</Label>
              <div className="mt-1 flex gap-1.5">
                <Button type="button" size="sm" variant={kind === "DRAWN" ? "default" : "outline"}
                  onClick={() => setKind("DRAWN")}>Draw</Button>
                <Button type="button" size="sm" variant={kind === "TYPED" ? "default" : "outline"}
                  onClick={() => setKind("TYPED")}>Type</Button>
              </div>

              {kind === "DRAWN" ? (
                <div className="mt-2">
                  {signature ? (
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={signature} alt="Your signature"
                        className="h-14 rounded border border-slate-200 bg-white" />
                      <Button type="button" size="sm" variant="outline" onClick={() => setPadOpen(true)}>
                        Redraw
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" size="sm" variant="outline" onClick={() => setPadOpen(true)}>
                      <PenTool size={13} /> Sign here
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <Input value={typedName} onChange={(e) => setTypedName(e.target.value)}
                    placeholder="Your full name, as you would write it" className="mt-2" />
                  <p className="mt-1 text-[11px] text-slate-400">
                    A typed signature is weaker than a drawn one. What makes it defensible is that
                    you are authenticated and the timestamp is server-side.
                  </p>
                </>
              )}
            </div>

            <div>
              <Label htmlFor="so-stmt" className="text-xs">Statement (optional)</Label>
              <Textarea id="so-stmt" rows={2} value={statement}
                onChange={(e) => setStatement(e.target.value)}
                placeholder="e.g. Findings accepted; CAPAs agreed with the site team."
                className="mt-1" />
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
            <Button type="button" size="sm" onClick={submit} disabled={busy || !ready}>
              {busy && <Loader2 size={14} className="animate-spin" />} Record sign-off
            </Button>
          </div>
        </div>
      </div>

      {padOpen && (
        <SignatureModal
          title="Sign here"
          onSave={(dataUrl) => { setSignature(dataUrl); setPadOpen(false); }}
          onClose={() => setPadOpen(false)}
        />
      )}
    </>
  );
}
