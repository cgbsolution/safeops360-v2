"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  CLAIM_STATUS_CHIP,
  POLICY_STATUS_CHIP,
  POLICY_TYPE_LABEL,
  inrCompact,
  type Claim,
  type PolicyDetail,
} from "@/app/(dashboard)/erm/lib-t3";
import { fmtDate } from "@/app/(dashboard)/erm/lib";

const CLAIM_STATUSES = [
  "INTIMATED",
  "SURVEYOR_APPOINTED",
  "UNDER_ASSESSMENT",
  "APPROVED",
  "PARTIALLY_SETTLED",
  "SETTLED",
  "REPUDIATED",
] as const;

const TABS = ["overview", "coverage", "claims", "renewal"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  overview: "Overview",
  coverage: "Covered Risks & Processes",
  claims: "Claims",
  renewal: "Renewal",
};

function expiryNote(days: number | null) {
  if (days == null) return null;
  if (days < 0) return <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">expired {Math.abs(days)}d ago</span>;
  if (days <= 90) return <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">expires in {days}d</span>;
  return <span className="text-xs text-slate-500">{days}d to expiry</span>;
}

export function PolicyDetailView({ detail }: { detail: PolicyDetail }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [newClaimOpen, setNewClaimOpen] = useState(false);

  return (
    <div className="space-y-5">
      {banner && (
        <div className={"rounded-lg border px-4 py-2.5 text-sm " + (banner.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800")}>
          {banner.msg}
        </div>
      )}

      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={"rounded border px-2 py-0.5 text-[11px] " + (POLICY_STATUS_CHIP[detail.status] ?? "")}>{detail.status.replace(/_/g, " ")}</span>
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">{POLICY_TYPE_LABEL[detail.policyType] ?? detail.policyType}</span>
            <span className="text-xs text-slate-500">
              {detail.insurerName}
              {detail.brokerName ? ` · via ${detail.brokerName}` : ""} · Owner {detail.ownerName ?? "—"}
            </span>
          </div>
          {expiryNote(detail.daysToExpiry)}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          {[
            { label: "Sum insured", value: inrCompact(detail.sumInsuredInr) },
            { label: "Annual premium", value: inrCompact(detail.premiumAnnualInr) },
            { label: "Deductible", value: inrCompact(detail.deductibleInr) },
            { label: "Policy no.", value: detail.policyNumber },
            { label: "Coverage start", value: fmtDate(detail.coverageStartDate) },
            { label: "Coverage end", value: fmtDate(detail.coverageEndDate) },
          ].map((m) => (
            <div key={m.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{m.label}</p>
              <p className="truncate text-sm font-semibold text-slate-800">{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <Button
            key={t}
            type="button"
            variant="ghost"
            onClick={() => setTab(t)}
            className={cn(
              "h-auto gap-0 rounded-none -mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === t ? "border-primary-700 text-primary-700" : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            {TAB_LABEL[t]}
            {t === "claims" && detail.claims.length > 0 && (
              <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-600">{detail.claims.length}</span>
            )}
          </Button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Key exclusions</h2>
          {detail.keyExclusions.length === 0 ? (
            <p className="text-sm text-slate-400">No exclusions recorded.</p>
          ) : (
            <ul className="space-y-1.5">
              {detail.keyExclusions.map((ex, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" /> {ex}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Coverage */}
      {tab === "coverage" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Covered risks <span className="text-slate-400">({detail.coveredRisks.length})</span></h2>
            {detail.coveredRisks.length === 0 ? (
              <p className="text-sm text-slate-400">No risks linked to this policy.</p>
            ) : (
              <ul className="space-y-2">
                {detail.coveredRisks.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <Link href={`/erm/register/${r.id}`} className="truncate text-sm font-medium text-primary-700 hover:underline">{r.riskCode} · {r.title}</Link>
                    {r.residualBand && (
                      <span className="shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">{r.residualBand}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Covered processes <span className="text-slate-400">({detail.coveredProcesses.length})</span></h2>
            {detail.coveredProcesses.length === 0 ? (
              <p className="text-sm text-slate-400">No processes linked to this policy.</p>
            ) : (
              <ul className="space-y-2">
                {detail.coveredProcesses.map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">{p.processCode}</span>
                    <span className="truncate text-sm text-slate-600">{p.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Claims */}
      {tab === "claims" && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Claims <span className="text-slate-400">({detail.claims.length})</span></h2>
            <Button
              type="button"
              size="sm"
              onClick={() => setNewClaimOpen(true)}
              className="gap-1.5"
            >
              <Plus size={14} /> New claim
            </Button>
          </div>
          {detail.claims.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No claims logged against this policy.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Claim</TableHead>
                    <TableHead>Loss event</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Claimed</TableHead>
                    <TableHead className="text-right">Settled</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.claims.map((c) => (
                    <ClaimRow key={c.id} claim={c} setBanner={setBanner} onChanged={() => router.refresh()} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Renewal */}
      {tab === "renewal" && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Renewal</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Coverage end</p>
              <p className="text-sm font-semibold text-slate-800">{fmtDate(detail.coverageEndDate)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Renewal lead</p>
              <p className="text-sm font-semibold text-slate-800">{detail.renewalLeadDays} days</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Days to expiry</p>
              <p className="text-sm font-semibold text-slate-800">{detail.daysToExpiry != null ? `${detail.daysToExpiry}` : "—"}</p>
            </div>
          </div>
          <div className="mt-3">{expiryNote(detail.daysToExpiry)}</div>
        </div>
      )}

      {newClaimOpen && (
        <NewClaimModal
          policyId={detail.id}
          onClose={() => setNewClaimOpen(false)}
          onDone={() => { setNewClaimOpen(false); setBanner({ kind: "ok", msg: "Claim logged." }); router.refresh(); }}
        />
      )}
    </div>
  );
}

// ── Per-claim row: status update + reconcile-to-loss ──────────────────────────
function ClaimRow({ claim, setBanner, onChanged }: { claim: Claim; setBanner: (b: { kind: "ok" | "err"; msg: string }) => void; onChanged: () => void }) {
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reconcile() {
    setBusy(true);
    try {
      const res = await fetch(`/api/erm/insurance/claims/${claim.id}/reconcile-loss`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setBanner({ kind: "err", msg: j.detail || j.error || `Failed (${res.status}).` }); setBusy(false); return; }
      setBanner({ kind: "ok", msg: `Recovery reconciled — recovered ${inrCompact(j.recoveredInr)}, net loss ${inrCompact(j.netLossInr)}.` });
      setBusy(false);
      onChanged();
    } catch (e: any) { setBanner({ kind: "err", msg: e?.message ?? "Network error." }); setBusy(false); }
  }

  const canReconcile = claim.status === "SETTLED" && !!claim.lossEventId && claim.settledAmountInr != null;

  return (
    <>
      <TableRow>
        <TableCell className="font-medium text-slate-800">{claim.claimCode}</TableCell>
        <TableCell className="text-xs text-slate-600">{claim.lossEventCode ?? "—"}</TableCell>
        <TableCell className="text-xs text-slate-500">{fmtDate(claim.claimDate)}</TableCell>
        <TableCell className="text-right text-xs tabular-nums text-slate-700">{inrCompact(claim.claimedAmountInr)}</TableCell>
        <TableCell className="text-right text-xs tabular-nums text-slate-700">
          {claim.settledAmountInr != null ? inrCompact(claim.settledAmountInr) : "—"}
        </TableCell>
        <TableCell>
          <span className={"inline-block rounded border px-2 py-0.5 text-[11px] " + (CLAIM_STATUS_CHIP[claim.status] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
            {claim.status.replace(/_/g, " ")}
          </span>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditOpen(true)} className="h-auto px-2 py-1 text-[11px]">
              Update
            </Button>
            {canReconcile && (
              <Button type="button" variant="success" onClick={reconcile} disabled={busy} className="h-auto gap-1 px-2 py-1 text-[11px]">
                <Link2 size={12} /> {busy ? "Reconciling…" : "Reconcile recovery"}
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {editOpen && (
        <TableRow>
          <TableCell colSpan={7} className="bg-slate-50 px-3 py-3">
            <ClaimStatusForm claim={claim} setBanner={setBanner} onClose={() => setEditOpen(false)} onDone={() => { setEditOpen(false); onChanged(); }} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function ClaimStatusForm({ claim, setBanner, onClose, onDone }: { claim: Claim; setBanner: (b: { kind: "ok" | "err"; msg: string }) => void; onClose: () => void; onDone: () => void }) {
  const [status, setStatus] = useState(claim.status);
  const [settledAmountInr, setSettledAmountInr] = useState(claim.settledAmountInr != null ? String(claim.settledAmountInr) : "");
  const [settlementDate, setSettlementDate] = useState(claim.settlementDate ?? "");
  const [remarks, setRemarks] = useState(claim.remarks ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsSettled = status === "SETTLED";

  async function submit() {
    setBusy(true);
    setError(null);
    if (needsSettled && !(Number(settledAmountInr) > 0)) {
      setError("A settled amount is required when marking a claim SETTLED.");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(`/api/erm/insurance/claims/${claim.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status,
          settledAmountInr: settledAmountInr.trim() ? Number(settledAmountInr) : null,
          settlementDate: settlementDate || null,
          remarks: remarks.trim() || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.detail || j.error || `Failed (${res.status}).`); setBusy(false); return; }
      setBanner({ kind: "ok", msg: `Claim ${claim.claimCode} updated.` });
      onDone();
    } catch (e: any) { setError(e?.message ?? "Network error."); setBusy(false); }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Update claim {claim.claimCode}</h3>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-400 hover:text-slate-700">
          <X size={16} />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {CLAIM_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Settled amount (₹){needsSettled && <span className="text-rose-600"> *</span>}</label>
          <Input type="number" min={0} value={settledAmountInr} onChange={(e) => setSettledAmountInr(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Settlement date</label>
          <Input type="date" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)} />
        </div>
      </div>
      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-slate-600">Remarks</label>
        <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
      </div>
      {error && <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>}
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="button" size="sm" onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ── New claim modal ───────────────────────────────────────────────────────────
type LossOption = { id: string; lossEventCode: string; title?: string };

function NewClaimModal({ policyId, onClose, onDone }: { policyId: string; onClose: () => void; onDone: () => void }) {
  const [claimDate, setClaimDate] = useState("");
  const [description, setDescription] = useState("");
  const [claimedAmountInr, setClaimedAmountInr] = useState("");
  const [lossEventId, setLossEventId] = useState("");
  const [losses, setLosses] = useState<LossOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Best-effort fetch of loss events to link; optional.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/erm/loss/events")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => {
        if (cancelled) return;
        setLosses(
          (d?.items ?? d ?? [])
            .map((l: any) => ({ id: l.id, lossEventCode: l.lossEventCode ?? l.eventCode ?? l.code, title: l.title }))
            .filter((l: LossOption) => l.id && l.lossEventCode),
        );
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/erm/insurance/claims", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          policyId,
          lossEventId: lossEventId || null,
          claimDate,
          description: description.trim(),
          claimedAmountInr: Number(claimedAmountInr) || 0,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.detail || j.error || `Failed to log claim (${res.status}).`); setBusy(false); return; }
      onDone();
    } catch (e: any) { setError(e?.message ?? "Network error logging claim."); setBusy(false); }
  }

  const valid = claimDate && description.trim() && Number(claimedAmountInr) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">New claim</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-400 hover:text-slate-700">
            <X size={18} />
          </Button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Claim date</label>
              <Input type="date" value={claimDate} onChange={(e) => setClaimDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Claimed amount (₹)</label>
              <Input type="number" min={0} value={claimedAmountInr} onChange={(e) => setClaimedAmountInr(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Linked loss event (optional)</label>
            <Select value={lossEventId} onChange={(e) => setLossEventId(e.target.value)}>
              <option value="">None — standalone claim</option>
              {losses.map((l) => (
                <option key={l.id} value={l.id}>{l.lossEventCode}{l.title ? ` · ${l.title}` : ""}</option>
              ))}
            </Select>
            <p className="mt-1 text-[11px] text-slate-400">Linking a loss event enables reconciling the settled amount as a recovery once SETTLED.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={busy || !valid}>
            {busy ? "Logging…" : "Log claim"}
          </Button>
        </div>
      </div>
    </div>
  );
}
