"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SelectField } from "@/components/ui/select-field";
import { Alert } from "@/components/ui/alert";

type Site = { id: string; siteName: string; siteCode: string };
type Worker = { id: string; fullName: string; workerCode: string; primaryTrade: string; contractorCompanyName?: string };

export default function NewMobilizationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultSiteId = searchParams.get("siteId") ?? "";

  const [sites, setSites] = useState<Site[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    siteId: defaultSiteId,
    contractorWorkerId: "",
    mobilizationType: "new_deployment",
    tradeAtSite: "",
    workArea: "",
    mobilisationDate: new Date().toISOString().split("T")[0],
    plannedDemobilisationDate: "",
  });

  useEffect(() => {
    fetch("/api/epc/sites").then(r => r.json()).then(d => setSites(d.sites ?? d ?? []));
    fetch("/api/epc/workers").then(r => r.json()).then(d => setWorkers(d.workers ?? d ?? []));
  }, []);

  // When worker is selected, pre-fill tradeAtSite with their primary trade
  useEffect(() => {
    const w = workers.find(w => w.id === form.contractorWorkerId);
    if (w) setForm(f => ({ ...f, tradeAtSite: f.tradeAtSite || w.primaryTrade }));
  }, [form.contractorWorkerId, workers]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/epc/mobilization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          mobilisationDate: form.mobilisationDate ? new Date(form.mobilisationDate).toISOString() : undefined,
          plannedDemobilisationDate: form.plannedDemobilisationDate
            ? new Date(form.plannedDemobilisationDate).toISOString()
            : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail ?? `Error ${res.status}`);
      }
      router.push("/epc/mobilization");
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-5">
        <Link href="/epc/mobilization" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mb-3">
          <ArrowLeft size={13} /> Back to Mobilizations
        </Link>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <UserCheck size={20} className="text-cyan-700" /> New Mobilization
        </h1>
        <p className="text-sm text-slate-500 mt-1">Assign a contractor worker to a construction site</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border bg-white shadow-sm p-6 space-y-5">
        {error && (
          <Alert variant="destructive" className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</Alert>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="siteId">Construction Site *</Label>
            <SelectField
              id="siteId"
              required
              value={form.siteId}
              onChange={(value) => setForm(f => ({ ...f, siteId: value }))}
              className="mt-1"
              placeholder="Select a site..."
              options={sites.map((s) => ({ value: String(s.id), label: `${s.siteName} (${s.siteCode})` }))}
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="contractorWorkerId">Contractor Worker *</Label>
            <SelectField
              id="contractorWorkerId"
              required
              value={form.contractorWorkerId}
              onChange={(value) => setForm(f => ({ ...f, contractorWorkerId: value }))}
              className="mt-1"
              placeholder="Select a worker..."
              options={workers.map((w) => ({ value: String(w.id), label: `${w.fullName} — ${w.primaryTrade} (${w.workerCode})` }))}
            />
          </div>

          <div>
            <Label htmlFor="mobilizationType">Mobilization Type</Label>
            <SelectField
              id="mobilizationType"
              value={form.mobilizationType}
              onChange={(value) => setForm(f => ({ ...f, mobilizationType: value }))}
              className="mt-1"
              options={[
              { value: "new_deployment", label: "New Deployment" },
              { value: "re_deployment", label: "Re-deployment" },
              { value: "trade_change", label: "Trade Change" },
              { value: "replacement", label: "Replacement" }
            ]}
            />
          </div>

          <div>
            <Label htmlFor="tradeAtSite">Trade at This Site *</Label>
            <Input
              id="tradeAtSite"
              required
              value={form.tradeAtSite}
              onChange={e => setForm(f => ({ ...f, tradeAtSite: e.target.value }))}
              placeholder="e.g. Welder, Rigger, Mason"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="workArea">Work Area</Label>
            <Input
              id="workArea"
              value={form.workArea}
              onChange={e => setForm(f => ({ ...f, workArea: e.target.value }))}
              placeholder="e.g. Boiler Block, Turbine Hall"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="mobilisationDate">Mobilization Date *</Label>
            <Input
              id="mobilisationDate"
              type="date"
              required
              value={form.mobilisationDate}
              onChange={e => setForm(f => ({ ...f, mobilisationDate: e.target.value }))}
              className="mt-1"
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="plannedDemobilisationDate">Planned Demobilization Date</Label>
            <Input
              id="plannedDemobilisationDate"
              type="date"
              value={form.plannedDemobilisationDate}
              onChange={e => setForm(f => ({ ...f, plannedDemobilisationDate: e.target.value }))}
              className="mt-1"
            />
          </div>
        </div>

        <Alert variant="warning" className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-xs text-amber-700">
          <strong>Note:</strong> After submitting, the system will automatically run pre-mobilization checks (contractor status, medical fitness, worker eligibility). The mobilization record will be created with status <strong>Pending Checks</strong> if any gaps are found, or <strong>Pending Approval</strong> if all checks pass. A site HSE manager must then approve.
        </Alert>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/epc/mobilization">
            <Button type="button" variant="outline" size="sm">Cancel</Button>
          </Link>
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting ? <><Loader2 size={14} className="mr-1 animate-spin" /> Creating...</> : "Create Mobilization"}
          </Button>
        </div>
      </form>
    </div>
  );
}
