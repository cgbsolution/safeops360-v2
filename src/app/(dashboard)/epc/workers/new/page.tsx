"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Users } from "lucide-react";

const TRADES = [
  "Welder", "Rigger", "Electrician", "Mason", "Carpenter", "Painter",
  "Helper", "Fitter", "Plumber", "Scaffolder", "Crane Operator", "JCB Operator", "Other",
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const EDUCATION_LEVELS = [
  { value: "no_formal", label: "No Formal Education" },
  { value: "primary", label: "Primary (up to Class 5)" },
  { value: "middle", label: "Middle School (Class 8)" },
  { value: "secondary", label: "Secondary (Class 10)" },
  { value: "higher_secondary", label: "Higher Secondary (Class 12)" },
  { value: "iti", label: "ITI / Vocational" },
  { value: "diploma", label: "Diploma" },
  { value: "graduate", label: "Graduate" },
];

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu & Kashmir", "Ladakh", "Puducherry",
];

type Contractor = { id: string; companyName: string };

type FormData = {
  contractorCompanyId: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  mobileNumber: string;
  primaryTrade: string;
  yearsExperience: string;
  educationLevel: string;
  aadhaarLast4: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  homeState: string;
};

const initial: FormData = {
  contractorCompanyId: "",
  fullName: "",
  dateOfBirth: "",
  gender: "",
  bloodGroup: "",
  mobileNumber: "",
  primaryTrade: "",
  yearsExperience: "",
  educationLevel: "",
  aadhaarLast4: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  homeState: "",
};

export default function NewWorkerPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(initial);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/epc/contractors")
      .then((r) => r.json())
      .then((d) => setContractors(d.contractors ?? d ?? []))
      .catch(() => {});
  }, []);

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
        yearsExperience: form.yearsExperience ? parseInt(form.yearsExperience) : null,
        aadhaarLast4: form.aadhaarLast4 || null,
      };
      const res = await fetch("/api/epc/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? data.error ?? `Error ${res.status}`);
      }
      router.push("/epc/workers");
    } catch (e: any) {
      setError(e.message ?? "Failed to register worker");
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
          <Link href="/epc/workers" className="hover:text-cyan-700">Workers</Link>
          <span>/</span>
          <span className="text-slate-700 font-medium">New Worker</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users size={22} className="text-cyan-700" /> Register Construction Worker
          </h1>
          <Link href="/epc/workers" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
            <ArrowLeft size={14} /> Back
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        {/* Contractor */}
        <div className="rounded-xl border bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Contractor Company</h2>
          <div>
            <Label htmlFor="contractorCompanyId">Contractor Company *</Label>
            <select
              id="contractorCompanyId"
              value={form.contractorCompanyId}
              onChange={(e) => set("contractorCompanyId", e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600"
            >
              <option value="">Select contractor company...</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>{c.companyName}</option>
              ))}
            </select>
            {contractors.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                Loading companies...{" "}
                <Link href="/epc/contractors/new" className="underline">Register a company first</Link> if none appear.
              </p>
            )}
          </div>
        </div>

        {/* Personal Details */}
        <div className="rounded-xl border bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Personal Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                placeholder="e.g. Rajesh Kumar Sharma"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => set("dateOfBirth", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                value={form.gender}
                onChange={(e) => set("gender", e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600"
              >
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label htmlFor="bloodGroup">Blood Group</Label>
              <select
                id="bloodGroup"
                value={form.bloodGroup}
                onChange={(e) => set("bloodGroup", e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600"
              >
                <option value="">Select...</option>
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="homeState">Home State</Label>
              <select
                id="homeState"
                value={form.homeState}
                onChange={(e) => set("homeState", e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600"
              >
                <option value="">Select state...</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="aadhaarLast4">Aadhaar Last 4 Digits</Label>
              <Input
                id="aadhaarLast4"
                value={form.aadhaarLast4}
                onChange={(e) => set("aadhaarLast4", e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="XXXX"
                maxLength={4}
                pattern="\d{4}"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Trade & Experience */}
        <div className="rounded-xl border bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Trade & Experience</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="primaryTrade">Primary Trade *</Label>
              <select
                id="primaryTrade"
                value={form.primaryTrade}
                onChange={(e) => set("primaryTrade", e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600"
              >
                <option value="">Select trade...</option>
                {TRADES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="yearsExperience">Years of Experience</Label>
              <Input
                id="yearsExperience"
                type="number"
                min="0"
                max="50"
                value={form.yearsExperience}
                onChange={(e) => set("yearsExperience", e.target.value)}
                placeholder="e.g. 5"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="educationLevel">Education Level</Label>
              <select
                id="educationLevel"
                value={form.educationLevel}
                onChange={(e) => set("educationLevel", e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600"
              >
                <option value="">Select...</option>
                {EDUCATION_LEVELS.map((el) => (
                  <option key={el.value} value={el.value}>{el.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="mobileNumber">Mobile Number *</Label>
              <Input
                id="mobileNumber"
                type="tel"
                value={form.mobileNumber}
                onChange={(e) => set("mobileNumber", e.target.value)}
                placeholder="+91 9XXXXXXXXX"
                required
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="rounded-xl border bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Emergency Contact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="emergencyContactName">Contact Name</Label>
              <Input
                id="emergencyContactName"
                value={form.emergencyContactName}
                onChange={(e) => set("emergencyContactName", e.target.value)}
                placeholder="e.g. Sunita Sharma"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="emergencyContactPhone">Contact Phone</Label>
              <Input
                id="emergencyContactPhone"
                type="tel"
                value={form.emergencyContactPhone}
                onChange={(e) => set("emergencyContactPhone", e.target.value)}
                placeholder="+91 9XXXXXXXXX"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting} className="min-w-36">
            {submitting ? <><Loader2 size={14} className="animate-spin mr-2" /> Registering...</> : "Register Worker"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/epc/workers">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
