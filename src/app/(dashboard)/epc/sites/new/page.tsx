"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { ArrowLeft, Loader2, Building2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

const PROJECT_TYPES = [
  "Power Plant",
  "Refinery/Petrochemical",
  "Infrastructure/Civil",
  "Industrial Plant",
  "Renewable Energy",
  "Building Construction",
  "Pipeline",
  "Railway",
  "Port/Terminal",
  "Other",
];

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu & Kashmir", "Ladakh", "Puducherry",
];

type FormData = {
  siteName: string;
  projectNumber: string;
  clientName: string;
  clientContactName: string;
  clientContactEmail: string;
  address: string;
  state: string;
  district: string;
  projectType: string;
  scopeDescription: string;
  plannedStartDate: string;
  plannedCompletionDate: string;
  peakWorkforcePlanned: string;
  contractValue: string;
};

const initial: FormData = {
  siteName: "",
  projectNumber: "",
  clientName: "",
  clientContactName: "",
  clientContactEmail: "",
  address: "",
  state: "",
  district: "",
  projectType: "",
  scopeDescription: "",
  plannedStartDate: "",
  plannedCompletionDate: "",
  peakWorkforcePlanned: "",
  contractValue: "",
};

export default function NewSitePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        peakWorkforcePlanned: form.peakWorkforcePlanned ? parseInt(form.peakWorkforcePlanned) : null,
        contractValue: form.contractValue ? parseFloat(form.contractValue) : null,
      };
      const res = await fetch("/api/epc/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? data.error ?? `Error ${res.status}`);
      }
      router.push("/epc/sites");
    } catch (e: any) {
      setError(e.message ?? "Failed to create site");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-5">
        <div className="flex items-center text-xs text-slate-500 mb-2 gap-1">
          <Link href="/epc" className="hover:text-cyan-700">EPC</Link>
          <span>/</span>
          <Link href="/epc/sites" className="hover:text-cyan-700">Sites</Link>
          <span>/</span>
          <span className="text-slate-700 font-medium">New Site</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 size={22} className="text-cyan-700" /> Register New Site
          </h1>
          <Link href="/epc/sites" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
            <ArrowLeft size={14} /> Back to Sites
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {error && (
          <Alert variant="destructive" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </Alert>
        )}

        {/* Section: Site Identity */}
        <Card className="rounded-xl border bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Site Identity</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="siteName">Site Name *</Label>
              <Input
                id="siteName"
                value={form.siteName}
                onChange={(e) => set("siteName", e.target.value)}
                placeholder="e.g. Sipat Phase II Power Plant"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="projectNumber">Project Number *</Label>
              <Input
                id="projectNumber"
                value={form.projectNumber}
                onChange={(e) => set("projectNumber", e.target.value)}
                placeholder="e.g. PRJ-2026-001"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="projectType">Project Type *</Label>
              <SelectField
                id="projectType"
                value={form.projectType}
                onChange={(value) => set("projectType", value)}
                required
                className="mt-1"
                placeholder="Select project type..."
                options={PROJECT_TYPES.map((t) => ({ value: String(t), label: t }))}
              />
            </div>
            <div>
              <Label htmlFor="contractValue">Contract Value (INR)</Label>
              <Input
                id="contractValue"
                type="number"
                value={form.contractValue}
                onChange={(e) => set("contractValue", e.target.value)}
                placeholder="e.g. 50000000"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="peakWorkforcePlanned">Peak Workforce Planned</Label>
              <Input
                id="peakWorkforcePlanned"
                type="number"
                value={form.peakWorkforcePlanned}
                onChange={(e) => set("peakWorkforcePlanned", e.target.value)}
                placeholder="e.g. 500"
                className="mt-1"
              />
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="scopeDescription">Scope Description</Label>
            <Textarea
              id="scopeDescription"
              value={form.scopeDescription}
              onChange={(e) => set("scopeDescription", e.target.value)}
              placeholder="Brief description of the project scope..."
              rows={3}
              className="mt-1"
            />
          </div>
        </Card>

        {/* Section: Location */}
        <Card className="rounded-xl border bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Location</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Full address of the construction site"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="state">State *</Label>
              <SelectField
                id="state"
                value={form.state}
                onChange={(value) => set("state", value)}
                required
                className="mt-1"
                placeholder="Select state..."
                options={INDIAN_STATES.map((s) => ({ value: String(s), label: s }))}
              />
            </div>
            <div>
              <Label htmlFor="district">District</Label>
              <Input
                id="district"
                value={form.district}
                onChange={(e) => set("district", e.target.value)}
                placeholder="e.g. Korba"
                className="mt-1"
              />
            </div>
          </div>
        </Card>

        {/* Section: Client */}
        <Card className="rounded-xl border bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Client Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="clientName">Client / Owner Name *</Label>
              <Input
                id="clientName"
                value={form.clientName}
                onChange={(e) => set("clientName", e.target.value)}
                placeholder="e.g. NTPC Limited"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="clientContactName">Client Contact Name</Label>
              <Input
                id="clientContactName"
                value={form.clientContactName}
                onChange={(e) => set("clientContactName", e.target.value)}
                placeholder="e.g. Ramesh Gupta"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="clientContactEmail">Client Contact Email</Label>
              <Input
                id="clientContactEmail"
                type="email"
                value={form.clientContactEmail}
                onChange={(e) => set("clientContactEmail", e.target.value)}
                placeholder="contact@client.com"
                className="mt-1"
              />
            </div>
          </div>
        </Card>

        {/* Section: Schedule */}
        <Card className="rounded-xl border bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Project Schedule</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="plannedStartDate">Planned Start Date *</Label>
              <Input
                id="plannedStartDate"
                type="date"
                value={form.plannedStartDate}
                onChange={(e) => set("plannedStartDate", e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="plannedCompletionDate">Planned Completion Date *</Label>
              <Input
                id="plannedCompletionDate"
                type="date"
                value={form.plannedCompletionDate}
                onChange={(e) => set("plannedCompletionDate", e.target.value)}
                required
                className="mt-1"
              />
            </div>
          </div>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting} className="min-w-32">
            {submitting ? <><Loader2 size={14} className="animate-spin mr-2" /> Registering...</> : "Register Site"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/epc/sites">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
