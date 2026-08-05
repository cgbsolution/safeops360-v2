"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { UserPicker } from "@/components/ui/user-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} /> Onboard Vendor
      </Button>
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
            <label className="mb-1 block text-xs font-medium text-slate-600">Legal name</label>
            <Input
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="e.g. Aravali Logistics Pvt Ltd"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Category</label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Logistics, Raw Material"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Master data ref</label>
              <Input
                value={masterDataRef}
                onChange={(e) => setMasterDataRef(e.target.value)}
                placeholder="ERP vendor code (optional)"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Criticality</label>
              <Select
                value={criticality}
                onChange={(e) => setCriticality(e.target.value)}
              >
                {VENDOR_CRITICALITIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0) + c.slice(1).toLowerCase()}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Tier</label>
              <Select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
              >
                {VENDOR_TIERS.map((t) => (
                  <option key={t} value={t}>
                    {TIER_LABEL[t] ?? t}
                  </option>
                ))}
              </Select>
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
              <Input
                type="number"
                value={annualSpend}
                onChange={(e) => setAnnualSpend(e.target.value)}
                placeholder="e.g. 25000000"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <Checkbox
                  checked={isSingleSource}
                  onChange={(e) => setIsSingleSource(e.target.checked)}
                />
                Single-source vendor
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Site scope (one per line / comma)</label>
            <Textarea
              value={siteScopeText}
              onChange={(e) => setSiteScopeText(e.target.value)}
              rows={2}
              placeholder="Site IDs or codes"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Linked risk IDs</label>
              <Textarea
                value={linkedRisksText}
                onChange={(e) => setLinkedRisksText(e.target.value)}
                rows={2}
                placeholder="One per line / comma"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Linked process IDs</label>
              <Textarea
                value={linkedProcessesText}
                onChange={(e) => setLinkedProcessesText(e.target.value)}
                rows={2}
                placeholder="One per line / comma"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={busy || !valid}>
            {busy ? "Onboarding…" : "Onboard"}
          </Button>
        </div>
      </div>
    </div>
  );
}
