"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2, HardHat } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

const TRADE_CATEGORIES = [
  "Civil",
  "Structural",
  "Electrical",
  "Mechanical",
  "Piping",
  "Insulation",
  "Painting",
  "Scaffolding",
  "Instrumentation",
  "HVAC",
];

const SIZE_CATEGORIES = [
  { value: "micro", label: "Micro (< 10 workers)" },
  { value: "small", label: "Small (10–50 workers)" },
  { value: "medium", label: "Medium (50–200 workers)" },
  { value: "large", label: "Large (> 200 workers)" },
];

type FormData = {
  companyName: string;
  tradeName: string;
  registrationNumber: string;
  panNumber: string;
  gstNumber: string;
  sizeCategory: string;
  tradeCategories: string[];
  representativeName: string;
  representativePhone: string;
  representativeEmail: string;
  safetyOfficerName: string;
  safetyOfficerPhone: string;
};

const initial: FormData = {
  companyName: "",
  tradeName: "",
  registrationNumber: "",
  panNumber: "",
  gstNumber: "",
  sizeCategory: "",
  tradeCategories: [],
  representativeName: "",
  representativePhone: "",
  representativeEmail: "",
  safetyOfficerName: "",
  safetyOfficerPhone: "",
};

export default function NewContractorPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof Omit<FormData, "tradeCategories">, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleTrade(trade: string) {
    setForm((prev) => ({
      ...prev,
      tradeCategories: prev.tradeCategories.includes(trade)
        ? prev.tradeCategories.filter((t) => t !== trade)
        : [...prev.tradeCategories, trade],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.tradeCategories.length === 0) {
      setError("Please select at least one trade category.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/epc/contractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? data.error ?? `Error ${res.status}`);
      }
      router.push("/epc/contractors");
    } catch (e: any) {
      setError(e.message ?? "Failed to register contractor");
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
          <Link href="/epc/contractors" className="hover:text-cyan-700">Contractors</Link>
          <span>/</span>
          <span className="text-slate-700 font-medium">New Contractor</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <HardHat size={22} className="text-cyan-700" /> Register Contractor Company
          </h1>
          <Link href="/epc/contractors" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
            <ArrowLeft size={14} /> Back
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {error && (
          <Alert variant="destructive" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </Alert>
        )}

        {/* Company Identity */}
        <Card className="rounded-xl border bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Company Identity</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                value={form.companyName}
                onChange={(e) => set("companyName", e.target.value)}
                placeholder="e.g. Kumar Construction Pvt Ltd"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="tradeName">Trade Name</Label>
              <Input
                id="tradeName"
                value={form.tradeName}
                onChange={(e) => set("tradeName", e.target.value)}
                placeholder="If different from company name"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="registrationNumber">Registration Number</Label>
              <Input
                id="registrationNumber"
                value={form.registrationNumber}
                onChange={(e) => set("registrationNumber", e.target.value)}
                placeholder="Company registration no."
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="panNumber">PAN Number</Label>
              <Input
                id="panNumber"
                value={form.panNumber}
                onChange={(e) => set("panNumber", e.target.value)}
                placeholder="e.g. AAAAA0000A"
                maxLength={10}
                className="mt-1 uppercase"
              />
            </div>
            <div>
              <Label htmlFor="gstNumber">GST Number</Label>
              <Input
                id="gstNumber"
                value={form.gstNumber}
                onChange={(e) => set("gstNumber", e.target.value)}
                placeholder="15-digit GSTIN"
                maxLength={15}
                className="mt-1 uppercase"
              />
            </div>
            <div>
              <Label htmlFor="sizeCategory">Company Size</Label>
              <SelectField
                id="sizeCategory"
                value={form.sizeCategory}
                onChange={(value) => set("sizeCategory", value)}
                className="mt-1"
                placeholder="Select size..."
                options={SIZE_CATEGORIES.map((s) => ({ value: String(s.value), label: s.label }))}
              />
            </div>
          </div>
        </Card>

        {/* Trade Categories */}
        <Card className="rounded-xl border bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Trade Categories *</h2>
          <p className="text-xs text-slate-500 mb-4">Select all trades this company can perform.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {TRADE_CATEGORIES.map((trade) => {
              const selected = form.tradeCategories.includes(trade);
              return (
                <Button
                  key={trade}
                  type="button"
                  variant="ghost"
                  onClick={() => toggleTrade(trade)}
                  className={cn(
                    "h-auto rounded-lg border px-3 py-2 text-sm font-medium transition-all text-left",
                    selected
                      ? "bg-cyan-600 border-cyan-600 text-white shadow-sm"
                      : "bg-white border-slate-200 text-slate-700 hover:border-cyan-400 hover:bg-cyan-50"
                  )}
                >
                  {trade}
                </Button>
              );
            })}
          </div>
          {form.tradeCategories.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              Selected: {form.tradeCategories.join(", ")}
            </p>
          )}
        </Card>

        {/* Contact Information */}
        <Card className="rounded-xl border bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Contact Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="representativeName">Representative Name *</Label>
              <Input
                id="representativeName"
                value={form.representativeName}
                onChange={(e) => set("representativeName", e.target.value)}
                placeholder="Primary contact person"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="representativePhone">Representative Phone *</Label>
              <Input
                id="representativePhone"
                type="tel"
                value={form.representativePhone}
                onChange={(e) => set("representativePhone", e.target.value)}
                placeholder="+91 9XXXXXXXXX"
                required
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="representativeEmail">Representative Email</Label>
              <Input
                id="representativeEmail"
                type="email"
                value={form.representativeEmail}
                onChange={(e) => set("representativeEmail", e.target.value)}
                placeholder="contact@company.com"
                className="mt-1"
              />
            </div>
          </div>
        </Card>

        {/* Safety Officer */}
        <Card className="rounded-xl border bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Safety Officer</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="safetyOfficerName">Safety Officer Name</Label>
              <Input
                id="safetyOfficerName"
                value={form.safetyOfficerName}
                onChange={(e) => set("safetyOfficerName", e.target.value)}
                placeholder="Designated safety officer"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="safetyOfficerPhone">Safety Officer Phone</Label>
              <Input
                id="safetyOfficerPhone"
                type="tel"
                value={form.safetyOfficerPhone}
                onChange={(e) => set("safetyOfficerPhone", e.target.value)}
                placeholder="+91 9XXXXXXXXX"
                className="mt-1"
              />
            </div>
          </div>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting} className="min-w-36">
            {submitting ? <><Loader2 size={14} className="animate-spin mr-2" /> Registering...</> : "Register Contractor"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/epc/contractors">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
