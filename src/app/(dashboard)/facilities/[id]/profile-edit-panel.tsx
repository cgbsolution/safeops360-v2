"use client";

// Edit a saved factory profile, and the approval trail that governs the edit.
//
// The profile page previously had no way to correct its own master data — only
// its children were editable — so a typo in a licence number meant recreating
// the factory. This is the missing Edit, with the control the compliance team
// asked for around it:
//
//   • While the factory is still being drafted (lifecycleStage before ACTIVE)
//     an edit saves immediately, and is still recorded as a version.
//   • Once ACTIVE the profile is governed: the edit becomes a change request
//     that the Plant Head signs off at the Unit and the Compliance Team's Lead
//     Auditor signs off finally. Nothing lands on the profile until both do,
//     and the API refuses both signatures from the same person.
//
// Every version — applied, rejected or withdrawn — stays on the record, so the
// history below is the audit trail rather than a rendering of it.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, History, Pencil, ShieldCheck, X } from "lucide-react";
import { Can, usePermission } from "@/components/auth/can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import {
  CHANGE_REQUEST_STATUS_CHIP,
  CHANGE_REQUEST_STATUS_LABEL,
  CHANGE_REQUEST_STEP_PERMISSION,
  FACTORY_STATUSES,
  OWNERSHIP_LABEL,
  OWNERSHIP_TYPES,
  fmtDate,
  titleCase,
  withUnit,
  type FactoryProfileDetail,
  type FactoryStatus,
  type OwnershipType,
  type ProfileChangeRequest,
} from "../lib";

async function post(url: string, body?: unknown): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      msg = j?.detail ?? j?.error ?? msg;
    } catch {
      /* non-JSON body */
    }
    throw new Error(msg);
  }
}

const num = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};
const str = (v: number | null | undefined) => (v == null ? "" : String(v));
const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

type Form = ReturnType<typeof formFor>;

function formFor(p: FactoryProfileDetail) {
  return {
    factoryName: p.factoryName,
    status: p.status as FactoryStatus,
    ownershipType: p.ownershipType as OwnershipType,
    primaryIndustry: p.primaryIndustry,
    addressLine: p.addressLine ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    pincode: p.pincode ?? "",
    latitude: str(p.latitude),
    longitude: str(p.longitude),
    establishedYear: str(p.establishedYear),
    factoryLicenseNo: p.factoryLicenseNo ?? "",
    factoryLicenseValidUntil: dateInput(p.factoryLicenseValidUntil),
    pollutionControlBoard: p.pollutionControlBoard ?? "",
    applicableActs: (p.applicableActs ?? []).join(", "),
    totalLandAreaSqm: str(p.totalLandAreaSqm),
    builtUpAreaSqm: str(p.builtUpAreaSqm),
  };
}

function payloadFor(f: Form) {
  return {
    factoryName: f.factoryName.trim(),
    status: f.status,
    ownershipType: f.ownershipType,
    primaryIndustry: f.primaryIndustry.trim(),
    addressLine: f.addressLine.trim(),
    city: f.city.trim(),
    state: f.state.trim(),
    pincode: f.pincode.trim(),
    latitude: num(f.latitude),
    longitude: num(f.longitude),
    establishedYear: num(f.establishedYear),
    factoryLicenseNo: f.factoryLicenseNo.trim() || null,
    factoryLicenseValidUntil: f.factoryLicenseValidUntil
      ? new Date(f.factoryLicenseValidUntil).toISOString()
      : null,
    pollutionControlBoard: f.pollutionControlBoard.trim() || null,
    applicableActs: f.applicableActs
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean),
    totalLandAreaSqm: num(f.totalLandAreaSqm),
    builtUpAreaSqm: num(f.builtUpAreaSqm),
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs font-medium text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  return (
    <span className={cn("rounded border px-2 py-0.5 text-[11px] font-medium", CHANGE_REQUEST_STATUS_CHIP[status])}>
      {CHANGE_REQUEST_STATUS_LABEL[status] ?? status}
    </span>
  );
}

function DiffList({ cr }: { cr: ProfileChangeRequest }) {
  return (
    <ul className="space-y-1">
      {cr.changes.map((c) => (
        <li key={c.field} className="flex flex-wrap items-baseline gap-2 text-xs">
          <span className="min-w-[9rem] text-slate-500">{c.label}</span>
          <span className="text-slate-400 line-through">{c.from ?? "—"}</span>
          <span className="text-slate-400">→</span>
          <span className="font-medium text-slate-800">{c.to ?? "—"}</span>
        </li>
      ))}
    </ul>
  );
}

export function ProfileEditPanel({ profile }: { profile: FactoryProfileDetail }) {
  const router = useRouter();
  const { toast } = useToast();
  const canEdit = usePermission("FACILITY.UPDATE");
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<Form>(() => formFor(profile));
  const [reason, setReason] = useState("");
  const [decisionComment, setDecisionComment] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const pending = profile.pendingChangeRequest;
  const governed = profile.editRequiresApproval;
  const history = profile.changeRequests ?? [];

  async function run(fn: () => Promise<void>, success: string) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      toast({ variant: "success", title: success });
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Request failed");
    } finally {
      setBusy(false);
    }
  }

  function startEdit() {
    setF(formFor(profile));
    setReason("");
    setErr(null);
    setEditing(true);
  }

  const save = () =>
    run(async () => {
      const qs = reason.trim() ? `?reason=${encodeURIComponent(reason.trim())}` : "";
      const res = await fetch(`/api/factory/profiles/${profile.id}${qs}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payloadFor(f)),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.detail ?? j?.error ?? `Save failed (${res.status})`);
      }
      setEditing(false);
    }, governed ? "Sent for approval" : "Profile updated");

  const approve = () =>
    run(async () => {
      await post(`/api/factory/change-requests/${pending!.id}/approve`, { comment: decisionComment.trim() || null });
      setDecisionComment("");
    }, pending?.status === "PENDING_UNIT" ? "Approved — sent to Compliance" : "Approved and applied");

  const reject = () =>
    run(async () => {
      await post(`/api/factory/change-requests/${pending!.id}/reject`, { reason: rejectionReason.trim() });
      setRejecting(false);
      setRejectionReason("");
    }, "Change request rejected");

  const withdraw = () => {
    if (!confirm("Withdraw this change request? The proposed values are discarded.")) return;
    return run(async () => {
      await post(`/api/factory/change-requests/${pending!.id}/withdraw`);
    }, "Change request withdrawn");
  };

  // Whoever holds the permission for the step the request is currently sitting
  // at is the one who can act on it. The API re-checks, and additionally blocks
  // the requester and the previous approver from signing.
  const stepPermission = pending ? CHANGE_REQUEST_STEP_PERMISSION[pending.status] : undefined;
  const canDecide = usePermission(stepPermission ?? "FACILITY.PROFILE_APPROVE_UNIT") && !!stepPermission;

  return (
    <div className="mb-4 space-y-3">
      {err && <Alert variant="destructive" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</Alert>}

      {/* ── Actions row ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Can permission="FACILITY.UPDATE">
          {!editing && (
            <Button type="button" variant="outline" size="sm" onClick={startEdit} disabled={busy || !!pending}>
              <Pencil size={14} /> Edit profile
            </Button>
          )}
        </Can>
        {history.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory((s) => !s)}
            className="gap-1 text-xs text-slate-500 hover:text-slate-800"
          >
            <History size={14} /> Version history ({history.length})
          </Button>
        )}
        {governed && !pending && canEdit && (
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <ShieldCheck size={12} /> This profile is live — edits go to the Plant Head, then the Compliance Lead
            Auditor, before they take effect.
          </span>
        )}
      </div>

      {/* ── Pending change request ── */}
      {pending && (
        <Alert variant="warning" className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusChip status={pending.status} />
            <span className="text-sm font-semibold text-slate-800">Profile change v{pending.version}</span>
            <span className="text-xs text-slate-500">
              raised by {pending.requestedByName ?? "—"} · {fmtDate(pending.requestedAt)}
            </span>
          </div>
          {pending.reason && <p className="mb-2 text-xs italic text-slate-600">“{pending.reason}”</p>}
          <DiffList cr={pending} />

          {pending.unitApprovedAt && (
            <p className="mt-2 text-[11px] text-slate-500">
              Unit approved by {pending.unitApprovedByName ?? "—"} on {fmtDate(pending.unitApprovedAt)}
              {pending.unitApprovalComment ? ` — “${pending.unitApprovalComment}”` : ""}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canDecide && !rejecting && (
              <>
                <Input
                  className="max-w-xs"
                  placeholder="Approval comment (optional)"
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                />
                <Button type="button" size="sm" onClick={approve} disabled={busy}>
                  <Check size={14} />
                  {pending.status === "PENDING_UNIT" ? "Approve (Unit)" : "Approve & apply"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setRejecting(true)}
                  disabled={busy}
                  className="text-rose-700 hover:border-rose-300"
                >
                  <X size={14} /> Reject
                </Button>
              </>
            )}
            {canDecide && rejecting && (
              <>
                <Input
                  className="max-w-sm"
                  placeholder="Why is this rejected? (required)"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
                <Button type="button" size="sm" onClick={reject} disabled={busy || !rejectionReason.trim()}>
                  Confirm rejection
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setRejecting(false)} disabled={busy}>
                  Cancel
                </Button>
              </>
            )}
            <Can permission="FACILITY.UPDATE">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={withdraw}
                disabled={busy}
                className="ml-auto text-xs text-slate-500 hover:text-slate-800"
              >
                Withdraw
              </Button>
            </Can>
          </div>
          {!canDecide && (
            <p className="mt-2 text-[11px] text-slate-500">
              Awaiting {pending.status === "PENDING_UNIT" ? "the Plant Head at the Unit" : "the Compliance Team’s Lead Auditor"}.
            </p>
          )}
        </Alert>
      )}

      {/* ── Edit form ── */}
      {editing && (
        <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-none">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">Edit factory profile</h3>
            <span className="text-[11px] text-slate-500">
              {governed
                ? "Saving raises a change request — the values apply only after Plant Head and Compliance approval."
                : "This factory is still being set up, so changes save immediately (and are versioned)."}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Factory name">
              <Input value={f.factoryName} onChange={(e) => setF({ ...f, factoryName: e.target.value })} />
            </Field>
            <Field label="Status">
              <SelectField value={f.status} onChange={(value) => setF({ ...f, status: value as FactoryStatus })}
                options={FACTORY_STATUSES.map((s) => ({ value: String(s), label: `${titleCase(s)}` }))}
              />
            </Field>
            <Field label="Ownership">
              <SelectField
                value={f.ownershipType}
                onChange={(value) => setF({ ...f, ownershipType: value as OwnershipType })}
                options={OWNERSHIP_TYPES.map((o) => ({ value: String(o), label: `${OWNERSHIP_LABEL[o]}` }))}
              />
            </Field>
            <Field label="Primary industry">
              <Input value={f.primaryIndustry} onChange={(e) => setF({ ...f, primaryIndustry: e.target.value })} />
            </Field>
            <Field label="Established year">
              <Input value={f.establishedYear} onChange={(e) => setF({ ...f, establishedYear: e.target.value })} />
            </Field>
            <Field label="Pincode">
              <Input value={f.pincode} onChange={(e) => setF({ ...f, pincode: e.target.value })} />
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Address">
                <Input value={f.addressLine} onChange={(e) => setF({ ...f, addressLine: e.target.value })} />
              </Field>
            </div>
            <Field label="City">
              <Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
            </Field>
            <Field label="State">
              <Input value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Latitude">
                <Input value={f.latitude} onChange={(e) => setF({ ...f, latitude: e.target.value })} />
              </Field>
              <Field label="Longitude">
                <Input value={f.longitude} onChange={(e) => setF({ ...f, longitude: e.target.value })} />
              </Field>
            </div>
            <Field label="Factory licence no.">
              <Input value={f.factoryLicenseNo} onChange={(e) => setF({ ...f, factoryLicenseNo: e.target.value })} />
            </Field>
            <Field label="Licence valid until">
              <Input
                type="date"
                value={f.factoryLicenseValidUntil}
                onChange={(e) => setF({ ...f, factoryLicenseValidUntil: e.target.value })}
              />
            </Field>
            <Field label="Pollution Control Board">
              <Input
                value={f.pollutionControlBoard}
                onChange={(e) => setF({ ...f, pollutionControlBoard: e.target.value })}
                placeholder="KSPCB"
              />
            </Field>
            <Field label={withUnit("Total land area", "area")}>
              <Input
                type="number"
                value={f.totalLandAreaSqm}
                onChange={(e) => setF({ ...f, totalLandAreaSqm: e.target.value })}
              />
            </Field>
            <Field label={withUnit("Built-up area", "area")}>
              <Input
                type="number"
                value={f.builtUpAreaSqm}
                onChange={(e) => setF({ ...f, builtUpAreaSqm: e.target.value })}
              />
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Applicable acts (comma-separated)">
                <Input value={f.applicableActs} onChange={(e) => setF({ ...f, applicableActs: e.target.value })} />
              </Field>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label={governed ? "Reason for this change (shown to both approvers)" : "Reason for this change (optional)"}>
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button type="button" onClick={save} disabled={busy || !f.factoryName.trim()}>
              {governed ? "Submit for approval" : "Save changes"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* ── Version history ── */}
      {showHistory && (
        <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-none">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Profile version history</h3>
          <ul className="space-y-3">
            {history.map((cr) => (
              <li key={cr.id} className="rounded-lg border border-slate-100 p-3">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">v{cr.version}</span>
                  <StatusChip status={cr.status} />
                  {cr.autoApplied && (
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">pre-approval draft edit</span>
                  )}
                  <span className="text-xs text-slate-500">
                    {cr.requestedByName ?? "—"} · {fmtDate(cr.requestedAt)}
                  </span>
                </div>
                {cr.reason && <p className="mb-1.5 text-xs italic text-slate-500">“{cr.reason}”</p>}
                <DiffList cr={cr} />
                <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-500">
                  {cr.unitApprovedAt && (
                    <div>
                      Unit: {cr.unitApprovedByName ?? "—"} · {fmtDate(cr.unitApprovedAt)}
                      {cr.unitApprovalComment ? ` — “${cr.unitApprovalComment}”` : ""}
                    </div>
                  )}
                  {cr.complianceApprovedAt && (
                    <div>
                      Compliance: {cr.complianceApprovedByName ?? "—"} · {fmtDate(cr.complianceApprovedAt)}
                      {cr.complianceApprovalComment ? ` — “${cr.complianceApprovalComment}”` : ""}
                    </div>
                  )}
                  {cr.rejectedAt && (
                    <div className="text-rose-600">
                      Rejected at {cr.rejectedAtStep === "UNIT" ? "Unit" : "Compliance"} by {cr.rejectedByName ?? "—"} ·{" "}
                      {fmtDate(cr.rejectedAt)} — “{cr.rejectionReason}”
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
