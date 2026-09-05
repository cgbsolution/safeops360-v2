"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { UserPicker } from "@/components/ui/user-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { CRITICALITY_CHIP } from "@/app/(dashboard)/erm/lib-p3";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

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
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus size={16} /> New Process
      </Button>
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
      <Card className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">New business process (BIA)</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 text-slate-400 hover:text-slate-700"
          >
            <X size={18} />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Process name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Extrusion Line 3 — Production" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">Site</Label>
              <SelectField value={siteId} onChange={setSiteId}
                placeholder="Corporate (no plant)"
                options={plants.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">Department</Label>
              <Input value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} placeholder="e.g. Production" />
            </div>
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Process owner</Label>
            <UserPicker value={ownerId} onChange={(id) => setOwnerId(id)} placeholder="Select owner" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">RTO (hours)</Label>
              <Input type="number" min={0} value={rtoHours} onChange={(e) => setRtoHours(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">RPO (hours)</Label>
              <Input type="number" min={0} value={rpoHours} onChange={(e) => setRpoHours(e.target.value)} placeholder="optional" />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">MTPD (hours)</Label>
              <Input type="number" min={0} value={mtpdHours} onChange={(e) => setMtpdHours(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Derived criticality:</span>
            <span className={"rounded border px-2 py-0.5 text-[11px] " + (CRITICALITY_CHIP[crit] ?? "")}>{crit}</span>
            {mtpdTooLow && <span className="font-medium text-rose-600">MTPD must be ≥ RTO</span>}
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Peak periods (optional)</Label>
            <Input value={peakPeriods} onChange={(e) => setPeakPeriods(e.target.value)} placeholder="e.g. Festive build Q3 + month-end" />
          </div>

          {error && <Alert variant="destructive" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</Alert>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={busy || !valid}>
            {busy ? "Creating…" : "Create process"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
