"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Building2,
  Users,
  ClipboardCheck,
  Settings2,
  Calendar,
  MapPin,
  Mail,
  Phone,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  HardHat,
  GraduationCap,
  BarChart3,
  FileText,
} from "lucide-react";

type SiteDetail = {
  id: string;
  siteCode: string;
  siteName: string;
  projectNumber: string;
  clientName: string;
  clientContactName: string | null;
  clientContactEmail: string | null;
  address: string;
  district: string | null;
  state: string;
  projectType: string;
  scopeDescription: string;
  contractValue: number | null;
  status: string;
  awardDate: string | null;
  plannedStartDate: string;
  plannedCompletionDate: string;
  peakWorkforcePlanned: number;
  currentWorkforceCount: number;
};

type MobilizationRecord = {
  id: string;
  mobilizationNumber: string;
  workerName: string;
  trade: string;
  companyName: string;
  status: string;
  mobilisationDate: string | null;
};

type GateLogEntry = {
  id: string;
  workerCode: string;
  workerName: string;
  result: string;
  checkMethod: string;
  checkedAt: string;
  gatePassNumber: string | null;
  failureReasons: string[];
};

type ComplianceConfig = {
  inductionRequired: boolean;
  medicalFitnessRequired: boolean;
  prequalificationRequired: boolean;
  gatePassValidityHours: number;
};

type InductionCompliance = {
  total_workers: number;
  inducted: number;
  expired: number;
  never_inducted: number;
  compliance_pct: number;
  expiring_soon: { contractorWorkerId: string; validUntil: string }[];
};

function humanizeStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "suspended") return "bg-rose-100 text-rose-800 border-rose-200";
  if (s === "demobilising" || s === "demobilizing") return "bg-amber-100 text-amber-800 border-amber-200";
  if (s === "planning") return "bg-blue-100 text-blue-800 border-blue-200";
  if (s === "completed") return "bg-slate-100 text-slate-700 border-slate-200";
  if (s === "active" || s === "approved") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "pending_checks" || s === "checks_complete_pending_approval") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function gateResultClass(result: string): string {
  const r = result.toLowerCase();
  if (r === "cleared") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (r === "cleared_with_warnings") return "bg-amber-100 text-amber-800 border-amber-200";
  if (r === "not_cleared") return "bg-rose-100 text-rose-800 border-rose-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtCurrency(v: number | null): string {
  if (v === null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
}

function fmtDateTime(d: string): string {
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ─── Lifecycle progress steps ────────────────────────────────────────────────
const LIFECYCLE_STEPS = ["planning", "active", "demobilising", "completed"];

function LifecycleProgress({ status }: { status: string }) {
  const idx = LIFECYCLE_STEPS.indexOf(status.toLowerCase());
  return (
    <div className="flex items-center gap-0">
      {LIFECYCLE_STEPS.map((step, i) => {
        const done = i <= idx;
        const active = i === idx;
        return (
          <div key={step} className="flex items-center">
            <div
              className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-colors ${
                done
                  ? active
                    ? "bg-cyan-600 border-cyan-600 text-white"
                    : "bg-cyan-100 border-cyan-400 text-cyan-700"
                  : "bg-white border-slate-200 text-slate-400"
              }`}
            >
              {i + 1}
            </div>
            {i < LIFECYCLE_STEPS.length - 1 && (
              <div className={`h-0.5 w-10 ${i < idx ? "bg-cyan-400" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
      <div className="ml-3 flex gap-3 text-[11px] text-slate-500">
        {LIFECYCLE_STEPS.map((step, i) => (
          <span key={step} className={i === idx ? "font-semibold text-cyan-700" : ""}>
            {humanizeStatus(step)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main page component (client) ────────────────────────────────────────────
export default function SiteDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [site, setSite] = useState<SiteDetail | null>(null);
  const [mobilizations, setMobilizations] = useState<MobilizationRecord[]>([]);
  const [gateLog, setGateLog] = useState<GateLogEntry[]>([]);
  const [complianceConfig, setComplianceConfig] = useState<ComplianceConfig | null>(null);
  const [inductionCompliance, setInductionCompliance] = useState<InductionCompliance | null>(null);
  const [contractors, setContractors] = useState<{companyName: string; companyCode: string; workerCount: number; prequalificationStatus: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [siteRes, mobRes, gateRes, inductionRes] = await Promise.all([
          fetch(`/api/epc/sites/${id}`),
          fetch(`/api/epc/mobilization?siteId=${id}`),
          fetch(`/api/epc/gate/log?siteId=${id}`),
          fetch(`/api/epc/inductions/site/${id}/compliance`),
        ]);
        if (!siteRes.ok) throw new Error("Failed to load site");
        const siteData = await siteRes.json();
        setSite(siteData.site ?? siteData);

        if (mobRes.ok) {
          const mobData = await mobRes.json();
          const mobs: MobilizationRecord[] = mobData.mobilizations ?? mobData ?? [];
          setMobilizations(mobs);
          // Derive unique contractor companies from mobilization records
          const companyMap = new Map<string, { companyName: string; companyCode: string; workerCount: number; prequalificationStatus: string }>();
          for (const m of mobs) {
            const key = m.companyName;
            if (!companyMap.has(key)) {
              companyMap.set(key, { companyName: m.companyName, companyCode: (m as any).companyCode ?? "", workerCount: 0, prequalificationStatus: (m as any).prequalificationStatus ?? "approved" });
            }
            companyMap.get(key)!.workerCount += 1;
          }
          setContractors(Array.from(companyMap.values()));
        }
        if (gateRes.ok) {
          const gateData = await gateRes.json();
          setGateLog(gateData.entries ?? gateData ?? []);
          if (gateData.complianceConfig) setComplianceConfig(gateData.complianceConfig);
        }
        if (inductionRes.ok) {
          const inductionData = await inductionRes.json();
          setInductionCompliance(inductionData);
        }
      } catch (e: any) {
        setError(e.message ?? "Failed to load site");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-sm text-rose-600">
        {error ?? "Site not found."}
      </div>
    );
  }

  const workforcePercent = site.peakWorkforcePlanned > 0
    ? Math.round((site.currentWorkforceCount / site.peakWorkforcePlanned) * 100)
    : 0;

  return (
    <div>
      {/* Breadcrumb + header */}
      <div className="mb-5">
        <div className="flex items-center text-xs text-slate-500 mb-2 gap-1">
          <Link href="/epc" className="hover:text-cyan-700">EPC</Link>
          <span>/</span>
          <Link href="/epc/sites" className="hover:text-cyan-700">Sites</Link>
          <span>/</span>
          <span className="text-slate-700 font-medium">{site.siteCode}</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              {site.siteName}
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(site.status)}`}>
                {humanizeStatus(site.status)}
              </span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {site.siteCode} &middot; {site.projectType} &middot; {site.state}
            </p>
          </div>
          <Link href="/epc/sites" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mt-1">
            <ArrowLeft size={14} /> Back
          </Link>
        </div>
      </div>

      {/* Lifecycle progress */}
      <div className="mb-5 rounded-xl border bg-white px-5 py-4 shadow-sm overflow-x-auto">
        <p className="text-xs text-slate-500 font-medium mb-2">Project Lifecycle</p>
        <LifecycleProgress status={site.status} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview"><Building2 size={14} className="mr-1" /> Overview</TabsTrigger>
          <TabsTrigger value="workforce"><Users size={14} className="mr-1" /> Workforce</TabsTrigger>
          <TabsTrigger value="gate"><ClipboardCheck size={14} className="mr-1" /> Gate Today</TabsTrigger>
          <TabsTrigger value="compliance"><Settings2 size={14} className="mr-1" /> Compliance Config</TabsTrigger>
          <TabsTrigger value="contractors"><HardHat size={14} className="mr-1" /> Contractors</TabsTrigger>
          <TabsTrigger value="induction"><GraduationCap size={14} className="mr-1" /> Induction Status</TabsTrigger>
          <TabsTrigger value="performance"><BarChart3 size={14} className="mr-1" /> Performance</TabsTrigger>
          <TabsTrigger value="audit"><FileText size={14} className="mr-1" /> Audit Trail</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Site identity */}
            <div className="rounded-xl border bg-white shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Building2 size={15} /> Site Identity
              </h3>
              <dl className="space-y-2.5 text-sm">
                <InfoRow label="Site Code" value={site.siteCode} />
                <InfoRow label="Project Number" value={site.projectNumber} />
                <InfoRow label="Project Type" value={humanizeStatus(site.projectType)} />
                <InfoRow label="Contract Value" value={fmtCurrency(site.contractValue)} />
                <InfoRow label="Address" value={site.address} />
                <InfoRow label="District" value={site.district ?? "—"} />
                <InfoRow label="State" value={site.state} />
              </dl>
            </div>

            {/* Client + dates */}
            <div className="space-y-4">
              <div className="rounded-xl border bg-white shadow-sm p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Mail size={15} /> Client Information
                </h3>
                <dl className="space-y-2.5 text-sm">
                  <InfoRow label="Client" value={site.clientName} />
                  <InfoRow label="Contact Name" value={site.clientContactName ?? "—"} />
                  <InfoRow label="Contact Email" value={site.clientContactEmail ?? "—"} />
                </dl>
              </div>

              <div className="rounded-xl border bg-white shadow-sm p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Calendar size={15} /> Key Dates
                </h3>
                <dl className="space-y-2.5 text-sm">
                  <InfoRow label="Award Date" value={fmtDate(site.awardDate)} />
                  <InfoRow label="Planned Start" value={fmtDate(site.plannedStartDate)} />
                  <InfoRow label="Planned Completion" value={fmtDate(site.plannedCompletionDate)} />
                </dl>
              </div>
            </div>
          </div>

          {/* Scope + Workforce */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <div className="rounded-xl border bg-white shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Scope Description</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{site.scopeDescription || "—"}</p>
            </div>
            <div className="rounded-xl border bg-white shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Users size={15} /> Workforce Status
              </h3>
              <div className="flex items-end gap-3 mb-2">
                <span className="text-3xl font-bold text-slate-900 tabular-nums">{site.currentWorkforceCount}</span>
                <span className="text-slate-500 text-sm mb-1">of {site.peakWorkforcePlanned} planned ({workforcePercent}%)</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-cyan-500 transition-all"
                  style={{ width: `${Math.min(workforcePercent, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Peak workforce planned: {site.peakWorkforcePlanned}</p>
            </div>
          </div>
        </TabsContent>

        {/* ── Workforce ── */}
        <TabsContent value="workforce">
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Mobilized Workers ({mobilizations.length})</h3>
              <Link href="/epc/mobilization" className="text-xs text-cyan-700 hover:underline">+ New Mobilization</Link>
            </div>
            {mobilizations.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                <Users size={32} className="mx-auto mb-2 text-slate-300" />
                No mobilizations found for this site.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mob. No.</TableHead>
                    <TableHead>Worker</TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mob. Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mobilizations.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs text-slate-500">{m.mobilizationNumber}</TableCell>
                      <TableCell className="font-medium text-slate-900">{m.workerName}</TableCell>
                      <TableCell className="text-slate-600">{m.trade}</TableCell>
                      <TableCell className="text-slate-600">{m.companyName}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(m.status)}`}>
                          {humanizeStatus(m.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-600">{fmtDate(m.mobilisationDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ── Gate Today ── */}
        <TabsContent value="gate">
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Today&apos;s Gate Log</h3>
              <Link href="/epc/gate" className="text-xs text-cyan-700 hover:underline">Open Gate Clearance</Link>
            </div>
            {gateLog.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                <ClipboardCheck size={32} className="mx-auto mb-2 text-slate-300" />
                No gate activity today.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Worker</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Gate Pass</TableHead>
                    <TableHead>Method</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gateLog.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">{fmtDateTime(entry.checkedAt)}</TableCell>
                      <TableCell className="font-medium text-slate-900">{entry.workerName}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">{entry.workerCode}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${gateResultClass(entry.result)}`}>
                          {humanizeStatus(entry.result)}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">{entry.gatePassNumber ?? "—"}</TableCell>
                      <TableCell className="text-xs text-slate-500">{humanizeStatus(entry.checkMethod)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ── Compliance Config ── */}
        <TabsContent value="compliance">
          <div className="rounded-xl border bg-white shadow-sm p-6 max-w-lg">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Settings2 size={15} /> Compliance Configuration
            </h3>
            {complianceConfig ? (
              <dl className="space-y-3">
                <ConfigRow label="Induction Required" value={complianceConfig.inductionRequired} />
                <ConfigRow label="Medical Fitness Required" value={complianceConfig.medicalFitnessRequired} />
                <ConfigRow label="Prequalification Required" value={complianceConfig.prequalificationRequired} />
                <div className="flex items-center justify-between py-2 border-b last:border-0">
                  <dt className="text-sm text-slate-600">Gate Pass Validity</dt>
                  <dd className="text-sm font-medium text-slate-900">{complianceConfig.gatePassValidityHours} hours</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-slate-500">Compliance configuration not available. It will be loaded from the site record.</p>
            )}
          </div>
        </TabsContent>

        {/* ── Contractors ── */}
        <TabsContent value="contractors">
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Contractor Companies at This Site</h3>
              <Link href="/epc/contractors" className="text-xs text-cyan-700 hover:underline">View All</Link>
            </div>
            {contractors.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                <HardHat size={32} className="mx-auto mb-2 text-slate-300" />
                <p>No contractor companies are active at this site.</p>
                <p className="text-xs text-slate-400 mt-1">Companies appear here when their workers are mobilized.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company Code</TableHead>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Workers</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contractors.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs text-slate-500">{c.companyCode ?? "—"}</TableCell>
                      <TableCell className="font-medium text-slate-900">{c.companyName}</TableCell>
                      <TableCell className="text-slate-600 tabular-nums">{c.workerCount}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(c.prequalificationStatus)}`}>
                          {humanizeStatus(c.prequalificationStatus)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link href={`/epc/contractors`} className="text-xs text-cyan-700 hover:underline">View</Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2">Derived from active mobilization records at this site.</p>
        </TabsContent>

        {/* ── Induction Status ── */}
        <TabsContent value="induction">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {[
              { label: "Total Workers", value: inductionCompliance?.total_workers ?? 0, color: "text-slate-900" },
              { label: "Fully Inducted", value: inductionCompliance?.inducted ?? 0, color: "text-emerald-600" },
              { label: "Induction Expired", value: inductionCompliance?.expired ?? 0, color: "text-rose-600" },
              { label: "Never Inducted", value: inductionCompliance?.never_inducted ?? 0, color: "text-amber-600" },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border bg-white shadow-sm p-4">
                <p className="text-xs text-slate-500 mb-1">{card.label}</p>
                <p className={`text-3xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {inductionCompliance && (
            <div className="rounded-xl border bg-white shadow-sm p-5 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">Overall Induction Compliance</span>
                <span className="text-lg font-bold text-slate-900 tabular-nums">
                  {inductionCompliance.compliance_pct.toFixed(1)}%
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    inductionCompliance.compliance_pct >= 90 ? "bg-emerald-500" :
                    inductionCompliance.compliance_pct >= 70 ? "bg-amber-500" : "bg-rose-500"
                  }`}
                  style={{ width: `${Math.min(inductionCompliance.compliance_pct, 100)}%` }}
                />
              </div>
            </div>
          )}

          {inductionCompliance && inductionCompliance.expiring_soon.length > 0 && (
            <div className="rounded-xl border bg-amber-50 border-amber-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                <AlertTriangle size={15} /> Inductions Expiring Within 30 Days ({inductionCompliance.expiring_soon.length})
              </h3>
              <ul className="space-y-1.5">
                {inductionCompliance.expiring_soon.map((w) => (
                  <li key={w.contractorWorkerId} className="text-xs text-amber-700 flex items-center justify-between">
                    <Link href={`/epc/workers/${w.contractorWorkerId}`} className="hover:underline font-medium">
                      Worker {w.contractorWorkerId.slice(-6)}
                    </Link>
                    <span>Expires {fmtDate(w.validUntil)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!inductionCompliance && (
            <div className="rounded-xl border bg-white shadow-sm p-10 text-center text-sm text-slate-500">
              <GraduationCap size={32} className="mx-auto mb-2 text-slate-300" />
              Induction compliance data not available. Record inductions for workers at this site.
            </div>
          )}

          <div className="mt-4">
            <Link
              href={`/epc/inductions/new?siteId=${id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-800"
            >
              <GraduationCap size={15} /> Record New Induction
            </Link>
          </div>
        </TabsContent>

        {/* ── Safety Performance ── */}
        <TabsContent value="performance">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="rounded-xl border bg-white shadow-sm p-5">
              <p className="text-xs text-slate-500 mb-1">LTIFR (12-month rolling)</p>
              <p className="text-2xl font-bold text-slate-900">—</p>
              <p className="text-xs text-slate-400 mt-1">Requires incident data integration</p>
            </div>
            <div className="rounded-xl border bg-white shadow-sm p-5">
              <p className="text-xs text-slate-500 mb-1">TRIR (12-month rolling)</p>
              <p className="text-2xl font-bold text-slate-900">—</p>
              <p className="text-xs text-slate-400 mt-1">Requires incident data integration</p>
            </div>
            <div className="rounded-xl border bg-white shadow-sm p-5">
              <p className="text-xs text-slate-500 mb-1">Gate Rejection Rate (today)</p>
              <p className="text-2xl font-bold text-slate-900">
                {gateLog.length > 0
                  ? `${Math.round((gateLog.filter(g => g.result === "not_cleared").length / gateLog.length) * 100)}%`
                  : "—"}
              </p>
              <p className="text-xs text-slate-400 mt-1">{gateLog.filter(g => g.result === "not_cleared").length} rejected of {gateLog.length} today</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-white shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Gate Activity Breakdown (Today)</h3>
              {gateLog.length > 0 ? (
                <div className="space-y-2">
                  {[
                    { label: "Cleared", value: gateLog.filter(g => g.result === "cleared").length, color: "bg-emerald-500" },
                    { label: "Cleared with Warnings", value: gateLog.filter(g => g.result === "cleared_with_warnings").length, color: "bg-amber-500" },
                    { label: "Not Cleared", value: gateLog.filter(g => g.result === "not_cleared").length, color: "bg-rose-500" },
                  ].map((bar) => (
                    <div key={bar.label} className="flex items-center gap-3">
                      <span className="text-xs text-slate-600 w-44 flex-shrink-0">{bar.label}</span>
                      <div className="flex-1 h-4 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${bar.color}`}
                          style={{ width: gateLog.length > 0 ? `${(bar.value / gateLog.length) * 100}%` : "0%" }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 w-6 text-right tabular-nums">{bar.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No gate activity today.</p>
              )}
            </div>

            <div className="rounded-xl border bg-white shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Workforce Status Breakdown</h3>
              {mobilizations.length > 0 ? (
                <div className="space-y-2">
                  {(["active", "pending_checks", "checks_complete_pending_approval", "suspended", "demobilised"] as const).map((s) => {
                    const count = mobilizations.filter((m) => m.status === s).length;
                    if (count === 0) return null;
                    return (
                      <div key={s} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">{humanizeStatus(s)}</span>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(s)}`}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No workforce data.</p>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-4">
            Note: LTIFR and TRIR will be automatically populated once incident data integration is enabled.
          </p>
        </TabsContent>

        {/* ── Audit Trail ── */}
        <TabsContent value="audit">
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold text-slate-700">Mobilization History</h3>
              <p className="text-xs text-slate-400 mt-0.5">Record of all worker mobilizations and status changes at this site</p>
            </div>
            {mobilizations.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                <FileText size={32} className="mx-auto mb-2 text-slate-300" />
                No mobilization records found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mob. Number</TableHead>
                    <TableHead>Worker</TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mobilised</TableHead>
                    <TableHead>Demobilised</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mobilizations.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs text-slate-500">{m.mobilizationNumber}</TableCell>
                      <TableCell className="font-medium text-slate-900">{m.workerName}</TableCell>
                      <TableCell className="text-slate-600">{m.trade}</TableCell>
                      <TableCell className="text-slate-600">{m.companyName}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(m.status)}`}>
                          {humanizeStatus(m.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{fmtDate(m.mobilisationDate)}</TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {(m as any).actualDemobilisationDate ? fmtDate((m as any).actualDemobilisationDate) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-2 last:border-0 last:pb-0">
      <dt className="text-slate-500 text-xs flex-shrink-0 w-36">{label}</dt>
      <dd className="text-slate-900 font-medium text-right break-all">{value}</dd>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd>
        {value ? (
          <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold">
            <CheckCircle2 size={13} /> Yes
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-slate-400 text-xs">
            <XCircle size={13} /> No
          </span>
        )}
      </dd>
    </div>
  );
}
