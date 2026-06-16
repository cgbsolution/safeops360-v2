"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { UserPicker } from "@/components/ui/user-picker";
import {
  VENDOR_CRITICALITIES,
  VENDOR_TIERS,
} from "@/app/(dashboard)/erm/lib-t3";

const TIER_LABEL: Record<string, string> = {
  TIER_1: "Tier 1",
  TIER_2: "Tier 2",
  TIER_3: "Tier 3",
};

export function OnboardVendorButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-800"
      >
        <Plus size={16} /> Onboard Vendor
      </button>
      {open && <OnboardModal onClose={() => setOpen(false)} />}
    </>
  );
}

function OnboardModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [legalName, setLegalName] = useState("");
  const [category, setCategory] = useState("");
  const [criticality, setCriticality] = useState<string>("IMPORTANT");
  const [tier, setTier] = useState<string>("TIER_2");
  const [siteScopeText, setSiteScopeText] = useState("");
  const [relationshipOwnerId, setRelationshipOwnerId] = useState<string | null>(null);
  const [annualSpend, setAnnualSpend] = useState("");
  const [isSingleSource, setIsSingleSource] = useState(false);
  const [linkedRisksText, setLinkedRisksText] = useState("");
  const [linkedProcessesText, setLinkedProcessesText] = useState("");
  const [masterDataRef, setMasterDataRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function splitList(v: string): string[] {
    return v
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const spend = annualSpend.trim() ? Number(annualSpend) : undefined;
    try {
      const res = await fetch("/api/erm/vendors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          legalName: legalName.trim(),
          category: category.trim(),
          criticality,
          tier,
          siteScope: splitList(siteScopeText),
          relationshipOwnerId,
          annualSpendInr: spend != null && !Number.isNaN(spend) ? spend : undefined,
          isSingleSource,
          linkedProcessIds: splitList(linkedProcessesText),
          linkedRiskIds: splitList(linkedRisksText),
          masterDataRef: masterDataRef.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.detail || j.error || `Failed to onboard vendor (${res.status}).`);
        setBusy(false);
        return;
      }
      if (j?.id) {
        router.push(`/erm/vendors/${j.id}`);
      } else {
        onClose();
        router.refresh();
      }
    } catch (e: any) {
      setError(e?.message ?? "Network error onboarding vendor.");
      setBusy(false);
    }
  }

  const valid = legalName.trim() && category.trim() && relationshipOwnerId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Onboard Vendor</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Legal name</label>
            <input
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="e.g. Aravali Logistics Pvt Ltd"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Category</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Logistics, Raw Material"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Master data ref</label>
              <input
                value={masterDataRef}
                onChange={(e) => setMasterDataRef(e.target.value)}
                placeholder="ERP vendor code (optional)"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Criticality</label>
              <select
                value={criticality}
                onChange={(e) => setCriticality(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              >
                {VENDOR_CRITICALITIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0) + c.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Tier</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              >
                {VENDOR_TIERS.map((t) => (
                  <option key={t} value={t}>
                    {TIER_LABEL[t] ?? t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Relationship owner</label>
            <UserPicker
              value={relationshipOwnerId}
              onChange={(id) => setRelationshipOwnerId(id)}
              placeholder="Select relationship owner"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Annual spend (₹)</label>
              <input
                type="number"
                value={annualSpend}
                onChange={(e) => setAnnualSpend(e.target.value)}
                placeholder="e.g. 25000000"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={isSingleSource}
                  onChange={(e) => setIsSingleSource(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Single-source vendor
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Site scope (one per line / comma)</label>
            <textarea
              value={siteScopeText}
              onChange={(e) => setSiteScopeText(e.target.value)}
              rows={2}
              placeholder="Site IDs or codes"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Linked risk IDs</label>
              <textarea
                value={linkedRisksText}
                onChange={(e) => setLinkedRisksText(e.target.value)}
                rows={2}
                placeholder="One per line / comma"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Linked process IDs</label>
              <textarea
                value={linkedProcessesText}
                onChange={(e) => setLinkedProcessesText(e.target.value)}
                rows={2}
                placeholder="One per line / comma"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !valid}
            className="inline-flex items-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-800 disabled:opacity-50"
          >
            {busy ? "Onboarding…" : "Onboard"}
          </button>
        </div>
      </div>
    </div>
  );
}
