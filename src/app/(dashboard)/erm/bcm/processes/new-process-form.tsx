"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { UserPicker } from "@/components/ui/user-picker";
import { CRITICALITY_CHIP } from "@/app/(dashboard)/erm/lib-p3";

type PlantOption = { id: string; name: string };

// Mirrors backend svc.criticality_from_rto for a live preview.
function criticalityFromRto(rto: number): string {
  if (rto <= 4) return "VITAL";
  if (rto <= 24) return "ESSENTIAL";
  if (rto <= 168) return "IMPORTANT";
  return "DEFERRABLE";
}

export function NewProcessButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-800"
      >
        <Plus size={16} /> New Process
      </button>
      {open && <NewProcessModal onClose={() => setOpen(false)} onCreated={(id) => router.push(`/erm/bcm/processes/${id}`)} />}
    </>
  );
}

function NewProcessModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [siteId, setSiteId] = useState<string>(""); // "" = Corporate
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [departmentName, setDepartmentName] = useState("");
  const [rtoHours, setRtoHours] = useState("8");
  const [rpoHours, setRpoHours] = useState("");
  const [mtpdHours, setMtpdHours] = useState("48");
  const [peakPeriods, setPeakPeriods] = useState("");
  const [plants, setPlants] = useState<PlantOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/plants")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (cancelled) return;
        const items: PlantOption[] = (data?.items ?? data ?? []).map((p: any) => ({ id: p.id, name: p.name }));
        setPlants(items);
      })
      .catch(() => {/* non-fatal — Corporate still selectable */});
    return () => { cancelled = true; };
  }, []);

  const rto = Number(rtoHours);
  const mtpd = Number(mtpdHours);
  const crit = Number.isFinite(rto) ? criticalityFromRto(rto) : "—";
  const mtpdTooLow = Number.isFinite(rto) && Number.isFinite(mtpd) && mtpd < rto;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/erm/bcm/processes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          siteId: siteId || null,
          ownerId,
          departmentName: departmentName.trim(),
          rtoHours: rto,
          rpoHours: rpoHours === "" ? null : Number(rpoHours),
          mtpdHours: mtpd,
          peakPeriods: peakPeriods.trim() || null,
          impactProfile: [],
          linkedRiskIds: [],
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.detail || j.error || `Failed to create process (${res.status}).`);
        setBusy(false);
        return;
      }
      onCreated(j.id);
    } catch (e: any) {
      setError(e?.message ?? "Network error creating process.");
      setBusy(false);
    }
  }

  const valid = name.trim().length >= 3 && ownerId && Number.isFinite(rto) && Number.isFinite(mtpd) && !mtpdTooLow;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">New business process (BIA)</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Process name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Extrusion Line 3 — Production"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Site</label>
              <select value={siteId} onChange={(e) => setSiteId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                <option value="">Corporate (no plant)</option>
                {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Department</label>
              <input value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} placeholder="e.g. Production"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Process owner</label>
            <UserPicker value={ownerId} onChange={(id) => setOwnerId(id)} placeholder="Select owner" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">RTO (hours)</label>
              <input type="number" min={0} value={rtoHours} onChange={(e) => setRtoHours(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">RPO (hours)</label>
              <input type="number" min={0} value={rpoHours} onChange={(e) => setRpoHours(e.target.value)} placeholder="optional"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">MTPD (hours)</label>
              <input type="number" min={0} value={mtpdHours} onChange={(e) => setMtpdHours(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Derived criticality:</span>
            <span className={"rounded border px-2 py-0.5 text-[11px] " + (CRITICALITY_CHIP[crit] ?? "")}>{crit}</span>
            {mtpdTooLow && <span className="font-medium text-rose-600">MTPD must be ≥ RTO</span>}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Peak periods (optional)</label>
            <input value={peakPeriods} onChange={(e) => setPeakPeriods(e.target.value)} placeholder="e.g. Festive build Q3 + month-end"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>

          {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={busy || !valid}
            className="inline-flex items-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-800 disabled:opacity-50">
            {busy ? "Creating…" : "Create process"}
          </button>
        </div>
      </div>
    </div>
  );
}
