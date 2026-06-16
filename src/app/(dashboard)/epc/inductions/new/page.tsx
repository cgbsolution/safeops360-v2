"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Site = { id: string; siteName: string; siteCode: string };
type Worker = { id: string; fullName: string; workerCode: string; primaryTrade: string };
type MobRecord = { id: string; mobilizationNumber: string; workerName: string; status: string };

const INDUCTION_TYPES = [
  { value: "full_site", label: "Full Site Induction" },
  { value: "refresher", label: "Refresher" },
  { value: "area_specific", label: "Area-Specific" },
  { value: "client_specific", label: "Client-Specific" },
];

const LANGUAGES = [
  { value: "hindi", label: "Hindi" },
  { value: "english", label: "English" },
  { value: "bengali", label: "Bengali" },
  { value: "telugu", label: "Telugu" },
  { value: "tamil", label: "Tamil" },
  { value: "other", label: "Other" },
];

const ACK_METHODS = [
  { value: "digital_signature", label: "Digital Signature" },
  { value: "thumb_impression", label: "Thumb Impression" },
  { value: "written_signature", label: "Written Signature" },
  { value: "verbal_recorded", label: "Verbal Recorded" },
];

const CHECKLIST_ITEMS = [
  { key: "clientRequirementsCovered", label: "Client Requirements Covered" },
  { key: "siteEmergencyProcedures", label: "Site Emergency Procedures" },
  { key: "siteLayoutFamiliarization", label: "Site Layout Familiarization" },
  { key: "musterPointIdentified", label: "Muster Point Identified" },
  { key: "ppeRequirementsCovered", label: "PPE Requirements Covered" },
  { key: "ptwSystemExplained", label: "PTW System Explained" },
  { key: "incidentReportingExplained", label: "Incident Reporting Explained" },
];

export default function NewInductionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultSiteId = searchParams.get("siteId") ?? "";

  const [sites, setSites] = useState<Site[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [mobilizations, setMobilizations] = useState<MobRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    siteId: defaultSiteId,
    contractorWorkerId: "",
    mobilizationId: "",
    inductionType: "full_site",
    conductedAt: new Date().toISOString().slice(0, 16),
    durationMinutes: 60,
    language: "hindi",
    // checklist
    clientRequirementsCovered: false,
    siteEmergencyProcedures: false,
    siteLayoutFamiliarization: false,
    musterPointIdentified: false,
    ppeRequirementsCovered: false,
    ptwSystemExplained: false,
    incidentReportingExplained: false,
    // assessment
    assessmentConducted: false,
    assessmentScore: "" as string | number,
    passScore: 70,
    // acknowledgement
    workerAcknowledged: false,
    acknowledgementMethod: "digital_signature",
    // topics + validity
    topicsCovered: "",
    validityMonths: 12,
  });

  // Fetch sites and workers on mount
  useEffect(() => {
    fetch("/api/epc/sites").then(r => r.json()).then(d => setSites(d.sites ?? d ?? []));
    fetch("/api/epc/workers").then(r => r.json()).then(d => setWorkers(d.workers ?? d ?? []));
  }, []);

  // When both worker and site are selected, fetch matching mobilizations
  useEffect(() => {
    if (!form.contractorWorkerId || !form.siteId) {
      setMobilizations([]);
      setForm(f => ({ ...f, mobilizationId: "" }));
      return;
    }
    fetch(`/api/epc/mobilization?siteId=${form.siteId}&workerId=${form.contractorWorkerId}`)
      .then(r => r.ok ? r.json() : { mobilizations: [] })
      .then(d => {
        const mobs: MobRecord[] = d.mobilizations ?? d ?? [];
        setMobilizations(mobs);
        // Auto-select if exactly one result
        if (mobs.length === 1) {
          setForm(f => ({ ...f, mobilizationId: mobs[0].id }));
        } else {
          setForm(f => ({ ...f, mobilizationId: "" }));
        }
      });
  }, [form.contractorWorkerId, form.siteId]);

  function setCheck(key: string, value: boolean) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        siteId: form.siteId,
        contractorWorkerId: form.contractorWorkerId,
        mobilizationId: form.mobilizationId || undefined,
        inductionType: form.inductionType,
        conductedAt: form.conductedAt ? new Date(form.conductedAt).toISOString() : undefined,
        durationMinutes: Number(form.durationMinutes),
        language: form.language,
        checklist: {
          clientRequirementsCovered: form.clientRequirementsCovered,
          siteEmergencyProcedures: form.siteEmergencyProcedures,
          siteLayoutFamiliarization: form.siteLayoutFamiliarization,
          musterPointIdentified: form.musterPointIdentified,
          ppeRequirementsCovered: form.ppeRequirementsCovered,
          ptwSystemExplained: form.ptwSystemExplained,
          incidentReportingExplained: form.incidentReportingExplained,
        },
        assessmentConducted: form.assessmentConducted,
        assessmentScore: form.assessmentConducted && form.assessmentScore !== "" ? Number(form.assessmentScore) : undefined,
        passScore: form.assessmentConducted ? Number(form.passScore) : undefined,
        workerAcknowledged: form.workerAcknowledged,
        acknowledgementMethod: form.workerAcknowledged ? form.acknowledgementMethod : undefined,
        topicsCovered: form.topicsCovered
          ? form.topicsCovered.split(",").map(t => t.trim()).filter(Boolean)
          : [],
        validityMonths: Number(form.validityMonths),
      };

      const res = await fetch("/api/epc/inductions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
          <GraduationCap size={20} className="text-cyan-700" /> Record Site Induction
        </h1>
        <p className="text-sm text-slate-500 mt-1">Log a safety induction conducted for a worker at a site</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border bg-white shadow-sm p-6 space-y-6">
        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {/* ── Site + Worker ── */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Worker & Site</h2>

          <div>
            <Label htmlFor="siteId">Construction Site *</Label>
            <select
              id="siteId"
              required
              value={form.siteId}
              onChange={e => setForm(f => ({ ...f, siteId: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">Select a site...</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>{s.siteName} ({s.siteCode})</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="contractorWorkerId">Contractor Worker *</Label>
            <select
              id="contractorWorkerId"
              required
              value={form.contractorWorkerId}
              onChange={e => setForm(f => ({ ...f, contractorWorkerId: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">Select a worker...</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>{w.fullName} — {w.primaryTrade} ({w.workerCode})</option>
              ))}
            </select>
          </div>

          {mobilizations.length > 0 && (
            <div>
              <Label htmlFor="mobilizationId">Mobilization Record</Label>
              <select
                id="mobilizationId"
                value={form.mobilizationId}
                onChange={e => setForm(f => ({ ...f, mobilizationId: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">None / Not linked</option>
                {mobilizations.map(m => (
                  <option key={m.id} value={m.id}>{m.mobilizationNumber} — {m.workerName} ({m.status})</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ── Induction Details ── */}
        <div className="space-y-4 pt-2 border-t">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-2">Induction Details</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="inductionType">Induction Type *</Label>
              <select
                id="inductionType"
                required
                value={form.inductionType}
                onChange={e => setForm(f => ({ ...f, inductionType: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {INDUCTION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="language">Language *</Label>
              <select
                id="language"
                required
                value={form.language}
                onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {LANGUAGES.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="conductedAt">Conducted Date & Time *</Label>
              <Input
                id="conductedAt"
                type="datetime-local"
                required
                value={form.conductedAt}
                onChange={e => setForm(f => ({ ...f, conductedAt: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="durationMinutes">Duration (minutes) *</Label>
              <Input
                id="durationMinutes"
                type="number"
                required
                min={1}
                value={form.durationMinutes}
                onChange={e => setForm(f => ({ ...f, durationMinutes: Number(e.target.value) }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="validityMonths">Validity (months)</Label>
              <Input
                id="validityMonths"
                type="number"
                min={1}
                value={form.validityMonths}
                onChange={e => setForm(f => ({ ...f, validityMonths: Number(e.target.value) }))}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* ── Checklist ── */}
        <div className="space-y-3 pt-2 border-t">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-2">Topics Checklist</h2>
          <div className="rounded-lg border divide-y">
            {CHECKLIST_ITEMS.map(item => (
              <label
                key={item.key}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={form[item.key as keyof typeof form] as boolean}
                  onChange={e => setCheck(item.key, e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
                <span className="text-sm text-slate-700">{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ── Topics Covered (free text) ── */}
        <div className="space-y-2 pt-2 border-t">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-2">Additional Topics Covered</h2>
          <Label htmlFor="topicsCovered">Topics (comma-separated)</Label>
          <textarea
            id="topicsCovered"
            value={form.topicsCovered}
            onChange={e => setForm(f => ({ ...f, topicsCovered: e.target.value }))}
            placeholder="e.g. Hot work permit, Confined space entry, Working at height"
            rows={3}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
          />
        </div>

        {/* ── Assessment ── */}
        <div className="space-y-3 pt-2 border-t">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-2">Assessment</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.assessmentConducted}
              onChange={e => setForm(f => ({ ...f, assessmentConducted: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
            />
            <span className="text-sm text-slate-700 font-medium">Assessment Conducted</span>
          </label>

          {form.assessmentConducted && (
            <div className="grid grid-cols-2 gap-4 pl-7">
              <div>
                <Label htmlFor="assessmentScore">Score (0–100) *</Label>
                <Input
                  id="assessmentScore"
                  type="number"
                  required={form.assessmentConducted}
                  min={0}
                  max={100}
                  value={form.assessmentScore}
                  onChange={e => setForm(f => ({ ...f, assessmentScore: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="passScore">Pass Score</Label>
                <Input
                  id="passScore"
                  type="number"
                  min={0}
                  max={100}
                  value={form.passScore}
                  onChange={e => setForm(f => ({ ...f, passScore: Number(e.target.value) }))}
                  className="mt-1"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Acknowledgement ── */}
        <div className="space-y-3 pt-2 border-t">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-2">Worker Acknowledgement</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.workerAcknowledged}
              onChange={e => setForm(f => ({ ...f, workerAcknowledged: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
            />
            <span className="text-sm text-slate-700 font-medium">Worker Acknowledged</span>
          </label>

          {form.workerAcknowledged && (
            <div className="pl-7">
              <Label htmlFor="acknowledgementMethod">Acknowledgement Method *</Label>
              <select
                id="acknowledgementMethod"
                required={form.workerAcknowledged}
                value={form.acknowledgementMethod}
                onChange={e => setForm(f => ({ ...f, acknowledgementMethod: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {ACK_METHODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t">
          <Link href="/epc/mobilization">
            <Button type="button" variant="outline" size="sm">Cancel</Button>
          </Link>
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting
              ? <><Loader2 size={14} className="mr-1 animate-spin" /> Saving...</>
              : <><GraduationCap size={14} className="mr-1" /> Record Induction</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
