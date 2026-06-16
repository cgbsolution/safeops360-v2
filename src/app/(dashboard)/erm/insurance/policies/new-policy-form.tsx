"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { UserPicker } from "@/components/ui/user-picker";
import { POLICY_TYPES, POLICY_TYPE_LABEL } from "@/app/(dashboard)/erm/lib-t3";

type PlantOption = { id: string; name: string };
type RiskOption = { id: string; riskCode: string; title: string };
type ProcOption = { id: string; processCode: string; name: string };

export function NewPolicyButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-800"
      >
        <Plus size={16} /> New Policy
      </button>
      {open && (
        <NewPolicyModal
          onClose={() => setOpen(false)}
          onDone={(id) => {
            setOpen(false);
            router.push(`/erm/insurance/policies/${id}`);
          }}
        />
      )}
    </>
  );
}

function NewPolicyModal({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const [policyName, setPolicyName] = useState("");
  const [policyType, setPolicyType] = useState<string>("PROPERTY_FIRE");
  const [insurerName, setInsurerName] = useState("");
  const [brokerName, setBrokerName] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [siteScope, setSiteScope] = useState<string[]>([]);
  const [sumInsuredInr, setSumInsuredInr] = useState("");
  const [premiumAnnualInr, setPremiumAnnualInr] = useState("");
  const [deductibleInr, setDeductibleInr] = useState("");
  const [coverageStartDate, setCoverageStartDate] = useState("");
  const [coverageEndDate, setCoverageEndDate] = useState("");
  const [renewalLeadDays, setRenewalLeadDays] = useState("30");
  const [exclusionsText, setExclusionsText] = useState("");
  const [coveredRiskIds, setCoveredRiskIds] = useState<string[]>([]);
  const [coveredProcessIds, setCoveredProcessIds] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  const [plants, setPlants] = useState<PlantOption[]>([]);
  const [risks, setRisks] = useState<RiskOption[]>([]);
  const [procs, setProcs] = useState<ProcOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/plants").then((r) => (r.ok ? r.json() : [])).then((d) => { if (!cancelled) setPlants((d?.items ?? d ?? []).map((p: any) => ({ id: p.id, name: p.name }))); }).catch(() => {});
    fetch("/api/erm/risks").then((r) => (r.ok ? r.json() : { items: [] })).then((d) => { if (!cancelled) setRisks((d?.items ?? d ?? []).map((p: any) => ({ id: p.id, riskCode: p.riskCode, title: p.title }))); }).catch(() => {});
    fetch("/api/erm/bcm/processes").then((r) => (r.ok ? r.json() : { items: [] })).then((d) => { if (!cancelled) setProcs((d?.items ?? d ?? []).map((p: any) => ({ id: p.id, processCode: p.processCode, name: p.name }))); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function toggleSite(id: string) {
    setSiteScope((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleRisk(id: string) {
    setCoveredRiskIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleProc(id: string) {
    setCoveredProcessIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const keyExclusions = exclusionsText.split("\n").map((s) => s.trim()).filter(Boolean);
    try {
      const res = await fetch("/api/erm/insurance/policies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          policyName: policyName.trim(),
          policyType,
          insurerName: insurerName.trim(),
          brokerName: brokerName.trim() || null,
          policyNumber: policyNumber.trim(),
          siteScope,
          sumInsuredInr: Number(sumInsuredInr) || 0,
          premiumAnnualInr: Number(premiumAnnualInr) || 0,
          deductibleInr: deductibleInr.trim() ? Number(deductibleInr) : null,
          coverageStartDate,
          coverageEndDate,
          renewalLeadDays: Number(renewalLeadDays) || 0,
          keyExclusions,
          coveredRiskIds,
          coveredProcessIds,
          ownerId,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.detail || j.error || `Failed to create policy (${res.status}).`);
        setBusy(false);
        return;
      }
      onDone(j.id);
    } catch (e: any) {
      setError(e?.message ?? "Network error creating policy.");
      setBusy(false);
    }
  }

  const valid =
    policyName.trim() &&
    insurerName.trim() &&
    policyNumber.trim() &&
    coverageStartDate &&
    coverageEndDate &&
    ownerId &&
    Number(sumInsuredInr) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">New Policy</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Policy name</label>
            <input
              value={policyName}
              onChange={(e) => setPolicyName(e.target.value)}
              placeholder="e.g. Standard Fire & Special Perils — Plant A"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Policy type</label>
              <select
                value={policyType}
                onChange={(e) => setPolicyType(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              >
                {POLICY_TYPES.map((t) => (
                  <option key={t} value={t}>{POLICY_TYPE_LABEL[t] ?? t.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Policy number</label>
              <input
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
                placeholder="Insurer policy no."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Insurer</label>
              <input
                value={insurerName}
                onChange={(e) => setInsurerName(e.target.value)}
                placeholder="e.g. New India Assurance"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Broker (optional)</label>
              <input
                value={brokerName}
                onChange={(e) => setBrokerName(e.target.value)}
                placeholder="Broker name"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Sum insured (₹)</label>
              <input
                type="number"
                min={0}
                value={sumInsuredInr}
                onChange={(e) => setSumInsuredInr(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Annual premium (₹)</label>
              <input
                type="number"
                min={0}
                value={premiumAnnualInr}
                onChange={(e) => setPremiumAnnualInr(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Deductible (₹, optional)</label>
              <input
                type="number"
                min={0}
                value={deductibleInr}
                onChange={(e) => setDeductibleInr(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Coverage start</label>
              <input
                type="date"
                value={coverageStartDate}
                onChange={(e) => setCoverageStartDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Coverage end</label>
              <input
                type="date"
                value={coverageEndDate}
                onChange={(e) => setCoverageEndDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Renewal lead (days)</label>
              <input
                type="number"
                min={0}
                value={renewalLeadDays}
                onChange={(e) => setRenewalLeadDays(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>
          <p className="-mt-2 text-[11px] text-slate-400">Coverage end must be after the start date.</p>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Owner</label>
            <UserPicker value={ownerId} onChange={(id) => setOwnerId(id)} placeholder="Select policy owner" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Site scope</label>
            {plants.length === 0 ? (
              <p className="text-xs text-slate-400">No sites available.</p>
            ) : (
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
                {plants.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-slate-50">
                    <input type="checkbox" checked={siteScope.includes(p.id)} onChange={() => toggleSite(p.id)} className="rounded border-slate-300" />
                    <span className="text-slate-700">{p.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Covered risks</label>
            {risks.length === 0 ? (
              <p className="text-xs text-slate-400">No risks available.</p>
            ) : (
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
                {risks.map((r) => (
                  <label key={r.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-slate-50">
                    <input type="checkbox" checked={coveredRiskIds.includes(r.id)} onChange={() => toggleRisk(r.id)} className="rounded border-slate-300" />
                    <span className="font-medium text-primary-700">{r.riskCode}</span>
                    <span className="truncate text-slate-600">{r.title}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Covered processes</label>
            {procs.length === 0 ? (
              <p className="text-xs text-slate-400">No processes available.</p>
            ) : (
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
                {procs.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-slate-50">
                    <input type="checkbox" checked={coveredProcessIds.includes(p.id)} onChange={() => toggleProc(p.id)} className="rounded border-slate-300" />
                    <span className="font-medium text-primary-700">{p.processCode}</span>
                    <span className="truncate text-slate-600">{p.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Key exclusions (one per line)</label>
            <textarea
              value={exclusionsText}
              onChange={(e) => setExclusionsText(e.target.value)}
              rows={3}
              placeholder={"War & terrorism\nWear and tear\nConsequential loss"}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !valid}
            className="inline-flex items-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-800 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create policy"}
          </button>
        </div>
      </div>
    </div>
  );
}
