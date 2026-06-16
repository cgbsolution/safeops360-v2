"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Plus, Trash2, Zap, X, Pencil } from "lucide-react";
import { UserPicker } from "@/components/ui/user-picker";
import { BandBadge } from "@/components/erm/shared";
import {
  CRITICALITY_CHIP,
  DEP_TYPES,
  fmtRto,
  type ProcessDetail,
} from "@/app/(dashboard)/erm/lib-p3";
import { fmtDate } from "@/app/(dashboard)/erm/lib";

const DIM_LABEL: Record<string, string> = {
  FINANCIAL: "Financial",
  REPUTATIONAL: "Reputational",
  REGULATORY: "Regulatory",
  SAFETY: "Safety",
  BUSINESS_INTERRUPTION: "Business Interruption",
};
const DEP_LABEL: Record<string, string> = {
  UPSTREAM_PROCESS: "Upstream Process",
  IT_SYSTEM: "IT System",
  EQUIPMENT: "Equipment",
  VENDOR: "Vendor",
  PEOPLE_SKILL: "People / Skill",
  UTILITY: "Utility",
  FACILITY: "Facility",
};

export function ProcessDetailView({ detail }: { detail: ProcessDetail }) {
  const router = useRouter();
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addDepOpen, setAddDepOpen] = useState(false);

  const unmitigatedSpofs = detail.dependencies.filter((d) => d.unmitigatedSpof);

  async function call(url: string, method: string, body?: unknown, okMsg?: string) {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ kind: "err", msg: j.detail || j.error || `Request failed (${res.status}).` });
        setBusy(false);
        return null;
      }
      if (okMsg) setBanner({ kind: "ok", msg: okMsg });
      setBusy(false);
      router.refresh();
      return j;
    } catch (e: any) {
      setBanner({ kind: "err", msg: e?.message ?? "Network error." });
      setBusy(false);
      return null;
    }
  }

  async function approveBia() {
    await call(`/api/erm/bcm/processes/${detail.id}/approve`, "POST", undefined, "BIA approved.");
  }
  async function raiseRisk() {
    const j = await call(`/api/erm/bcm/processes/${detail.id}/raise-risk`, "POST", undefined);
    if (j?.riskCode) setBanner({ kind: "ok", msg: `Draft risk ${j.riskCode} created and linked.` });
  }
  async function deleteDep(did: string) {
    await call(`/api/erm/bcm/dependencies/${did}`, "DELETE", undefined, "Dependency removed.");
  }

  return (
    <div className="space-y-5">
      {banner && (
        <div className={"rounded-lg border px-4 py-2.5 text-sm " + (banner.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800")}>
          {banner.msg}
        </div>
      )}

      {/* Header card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={"rounded border px-2 py-0.5 text-[11px] " + (CRITICALITY_CHIP[detail.criticality] ?? "")}>{detail.criticality}</span>
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">BIA: {detail.biaStatus}</span>
            {detail.reviewOverdue && <span className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Review overdue</span>}
            <span className="text-xs text-slate-500">{detail.siteName ?? "Corporate"} · {detail.departmentName} · Owner {detail.ownerName ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditOpen(true)} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <Pencil size={13} /> Edit
            </button>
            {detail.biaStatus !== "APPROVED" && (
              <button onClick={approveBia} disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                <CheckCircle2 size={13} /> Approve BIA
              </button>
            )}
          </div>
        </div>
        {detail.description && <p className="mt-3 text-sm text-slate-600">{detail.description}</p>}
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "RTO", value: fmtRto(detail.rtoHours) },
            { label: "RPO", value: detail.rpoHours != null ? fmtRto(detail.rpoHours) : "—" },
            { label: "MTPD", value: fmtRto(detail.mtpdHours) },
            { label: "Next BIA review", value: detail.nextBiaReviewDate ? fmtDate(detail.nextBiaReviewDate) : "—" },
          ].map((m) => (
            <div key={m.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{m.label}</p>
              <p className="text-sm font-semibold tabular-nums text-slate-800">{m.value}</p>
            </div>
          ))}
        </div>
        {detail.peakPeriods && <p className="mt-3 text-xs text-slate-500"><span className="font-medium text-slate-600">Peak periods:</span> {detail.peakPeriods}</p>}
        {detail.criticalityOverrideJustification && (
          <p className="mt-2 text-xs text-amber-700"><span className="font-medium">Criticality override:</span> {detail.criticalityOverrideJustification}</p>
        )}
      </div>

      {/* Impact profile */}
      {detail.impactProfile.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Impact over time</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-slate-50/95">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2">Dimension</th>
                  <th className="px-3 py-2 text-center">4h</th>
                  <th className="px-3 py-2 text-center">24h</th>
                  <th className="px-3 py-2 text-center">7d</th>
                  <th className="px-3 py-2 text-center">30d</th>
                </tr>
              </thead>
              <tbody>
                {detail.impactProfile.map((row: any, i: number) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-700">{DIM_LABEL[row.dimension] ?? row.dimension}</td>
                    {(["at4h", "at24h", "at7d", "at30d"] as const).map((k) => (
                      <td key={k} className="px-3 py-2 text-center">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold text-white"
                          style={{ backgroundColor: ["#94a3b8", "#2E8B57", "#E6A817", "#E67E22", "#C0392B"][Math.max(0, Math.min(4, (row[k] ?? 1) - 1))] }}>
                          {row[k] ?? "—"}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dependencies + SPOF */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Dependencies <span className="text-slate-400">({detail.dependencies.length})</span>
            {unmitigatedSpofs.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-800">
                <AlertTriangle size={11} /> {unmitigatedSpofs.length} unmitigated SPOF
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {unmitigatedSpofs.length > 0 && (
              <button onClick={raiseRisk} disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                <Zap size={13} /> Raise SPOF as risk
              </button>
            )}
            <button onClick={() => setAddDepOpen(true)} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <Plus size={13} /> Add dependency
            </button>
          </div>
        </div>
        {detail.dependencies.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No dependencies captured yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {detail.dependencies.map((d) => (
              <li key={d.id} className="flex items-start gap-3 py-3">
                <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{DEP_LABEL[d.dependencyType] ?? d.dependencyType}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    {d.name}
                    {d.isSinglePointOfFailure && (
                      <span className={"ml-2 rounded border px-1.5 py-0.5 text-[10px] font-semibold " + (d.unmitigatedSpof ? "border-rose-300 bg-rose-100 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-700")}>
                        {d.unmitigatedSpof ? "SPOF — unmitigated" : "SPOF — mitigated"}
                      </span>
                    )}
                  </p>
                  {d.description && <p className="text-xs text-slate-500">{d.description}</p>}
                  {d.workaround && (
                    <p className="text-xs text-slate-500">
                      <span className="font-medium text-slate-600">Workaround:</span> {d.workaround}
                      {d.workaroundDurationHours != null && <span className="text-slate-400"> ({fmtRto(d.workaroundDurationHours)})</span>}
                    </p>
                  )}
                </div>
                <button onClick={() => deleteDep(d.id)} disabled={busy} className="shrink-0 text-slate-300 hover:text-rose-600" aria-label="Delete dependency">
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Covering plans */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Covering plans</h2>
          {detail.coveringPlans.length === 0 ? (
            <p className="py-3 text-sm text-rose-500">No continuity plan covers this process — coverage gap.</p>
          ) : (
            <ul className="space-y-2">
              {detail.coveringPlans.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <Link href={`/erm/bcm/plans/${p.id}`} className="text-sm font-medium text-primary-700 hover:underline">{p.planCode} · {p.title}</Link>
                  <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">{p.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Linked risks */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Linked enterprise risks</h2>
          {detail.linkedRisks.length === 0 ? (
            <p className="py-3 text-sm text-slate-400">No linked risks.</p>
          ) : (
            <ul className="space-y-2">
              {detail.linkedRisks.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <Link href={`/erm/register/${r.id}`} className="truncate text-sm font-medium text-primary-700 hover:underline">{r.riskCode} · {r.title}</Link>
                  <BandBadge band={r.residualBand} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {editOpen && <EditProcessModal detail={detail} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); router.refresh(); }} />}
      {addDepOpen && <AddDependencyModal processId={detail.id} onClose={() => setAddDepOpen(false)} onSaved={() => { setAddDepOpen(false); router.refresh(); }} />}
    </div>
  );
}

// ── Add dependency modal ─────────────────────────────────────────────────────
function AddDependencyModal({ processId, onClose, onSaved }: { processId: string; onClose: () => void; onSaved: () => void }) {
  const [dependencyType, setDependencyType] = useState<string>("EQUIPMENT");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSpof, setIsSpof] = useState(false);
  const [workaround, setWorkaround] = useState("");
  const [workaroundHrs, setWorkaroundHrs] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/erm/bcm/processes/${processId}/dependencies`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dependencyType,
          name: name.trim(),
          description: description.trim() || null,
          isSinglePointOfFailure: isSpof,
          workaround: workaround.trim() || null,
          workaroundDurationHours: workaroundHrs === "" ? null : Number(workaroundHrs),
          linkedEntityRef: null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.detail || j.error || `Failed (${res.status}).`); setBusy(false); return; }
      onSaved();
    } catch (e: any) { setError(e?.message ?? "Network error."); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Add dependency</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Type</label>
              <select value={dependencyType} onChange={(e) => setDependencyType(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                {DEP_TYPES.map((t) => <option key={t} value={t}>{DEP_LABEL[t] ?? t}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={isSpof} onChange={(e) => setIsSpof(e.target.checked)} className="rounded border-slate-300" />
                Single point of failure
              </label>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 33 kV HT incomer"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Description (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Workaround (leave blank = unmitigated)</label>
              <input value={workaround} onChange={(e) => setWorkaround(e.target.value)} placeholder="e.g. Standby unit, 12h swap"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Duration (h)</label>
              <input type="number" min={0} value={workaroundHrs} onChange={(e) => setWorkaroundHrs(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
          </div>
          {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={busy || name.trim().length < 1}
            className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50">
            {busy ? "Adding…" : "Add dependency"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit process modal (PATCH — preserves impact profile + linked risks) ──────
function EditProcessModal({ detail, onClose, onSaved }: { detail: ProcessDetail; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(detail.name);
  const [ownerId, setOwnerId] = useState<string | null>(detail.ownerId);
  const [departmentName, setDepartmentName] = useState(detail.departmentName);
  const [rtoHours, setRtoHours] = useState(String(detail.rtoHours));
  const [rpoHours, setRpoHours] = useState(detail.rpoHours != null ? String(detail.rpoHours) : "");
  const [mtpdHours, setMtpdHours] = useState(String(detail.mtpdHours));
  const [peakPeriods, setPeakPeriods] = useState(detail.peakPeriods ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rto = Number(rtoHours), mtpd = Number(mtpdHours);
  const mtpdTooLow = Number.isFinite(rto) && Number.isFinite(mtpd) && mtpd < rto;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/erm/bcm/processes/${detail.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          siteId: detail.siteId,
          ownerId,
          departmentName: departmentName.trim(),
          rtoHours: rto,
          rpoHours: rpoHours === "" ? null : Number(rpoHours),
          mtpdHours: mtpd,
          peakPeriods: peakPeriods.trim() || null,
          impactProfile: detail.impactProfile, // preserve existing rows
          linkedRiskIds: detail.linkedRiskIds,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.detail || j.error || `Failed (${res.status}).`); setBusy(false); return; }
      onSaved();
    } catch (e: any) { setError(e?.message ?? "Network error."); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Edit process</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Process name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Owner</label>
              <UserPicker value={ownerId} onChange={(id) => setOwnerId(id)} placeholder="Select owner" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Department</label>
              <input value={departmentName} onChange={(e) => setDepartmentName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">RTO (h)</label>
              <input type="number" min={0} value={rtoHours} onChange={(e) => setRtoHours(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">RPO (h)</label>
              <input type="number" min={0} value={rpoHours} onChange={(e) => setRpoHours(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">MTPD (h)</label>
              <input type="number" min={0} value={mtpdHours} onChange={(e) => setMtpdHours(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
          </div>
          {mtpdTooLow && <p className="text-xs font-medium text-rose-600">MTPD must be ≥ RTO.</p>}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Peak periods</label>
            <input value={peakPeriods} onChange={(e) => setPeakPeriods(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <p className="text-[11px] text-slate-400">Criticality is recomputed from RTO on save. Editing an approved BIA keeps its status.</p>
          {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={busy || name.trim().length < 3 || mtpdTooLow}
            className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50">
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
