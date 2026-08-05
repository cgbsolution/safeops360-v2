"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { AlertTriangle, Plus, Repeat, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  CRITICALITY_CHIP,
  ONBOARDING_CHIP,
  RISK_BAND_CHIP,
  ESG_BAND_CHIP,
  RISK_BAND_HEX,
  ESG_BAND_HEX,
  VENDOR_FINDING_CHIP,
  inrCompact,
  type ScoringConfig,
  type VendorAssessment,
  type VendorDetail,
} from "@/app/(dashboard)/erm/lib-t3";
import { fmtDate } from "@/app/(dashboard)/erm/lib";
import { AssessmentModal } from "./assessment-modal";

const TIER_LABEL: Record<string, string> = { TIER_1: "Tier 1", TIER_2: "Tier 2", TIER_3: "Tier 3" };
const ONBOARDING_STATES = [
  "PROSPECT",
  "DUE_DILIGENCE",
  "APPROVED",
  "CONDITIONAL",
  "SUSPENDED",
  "OFFBOARDED",
] as const;

type Tab = "overview" | "risk" | "esg" | "audit";

function ScoreGauge({
  label,
  score,
  band,
  kind,
}: {
  label: string;
  score: number | null;
  band: string | null;
  kind: "RISK" | "ESG";
}) {
  const hex = kind === "RISK" ? RISK_BAND_HEX : ESG_BAND_HEX;
  const chip = kind === "RISK" ? RISK_BAND_CHIP : ESG_BAND_CHIP;
  const color = band ? hex[band] ?? "#94a3b8" : "#cbd5e1";
  return (
    <div className="flex min-w-[150px] flex-col items-center gap-1 rounded-xl border-2 bg-white px-5 py-3" style={{ borderColor: color }}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-3xl font-bold tabular-nums" style={{ color }}>
        {score != null ? score : "—"}
      </span>
      {band ? (
        <span className={"rounded border px-2 py-0.5 text-[11px] font-semibold " + (chip[band] ?? "border-slate-200 bg-slate-100 text-slate-600")}>
          {band}
        </span>
      ) : (
        <span className="text-[11px] text-slate-400">Not assessed</span>
      )}
    </div>
  );
}

function AssessmentLensSection({
  vendorId,
  lens,
  assessments,
}: {
  vendorId: string;
  lens: "RISK" | "ESG";
  assessments: VendorAssessment[];
}) {
  const lensAssessments = assessments.filter((a) => a.lens === lens);
  const current = lensAssessments.find((a) => a.isCurrent) ?? lensAssessments[0];
  const hex = lens === "RISK" ? RISK_BAND_HEX : ESG_BAND_HEX;
  const radarColor = lens === "RISK" ? RISK_BAND_HEX.CRITICAL : ESG_BAND_HEX.LEADING;

  if (lensAssessments.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
        No {lens === "RISK" ? "risk" : "ESG"} assessment yet. Use “New assessment” to capture one.
      </p>
    );
  }

  const radarData = (current?.domainScores ?? []).map((d) => ({
    domain: d.domainKey.replace(/_/g, " "),
    score: d.rawScore,
  }));

  return (
    <div className="space-y-4">
      {/* Domain radar + summary */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Domain Breakdown (latest)</h3>
          {radarData.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">No domain scores.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="domain" tick={{ fontSize: 10, fill: "#64748b" }} />
                <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 9 }} stroke="#cbd5e1" />
                <Radar dataKey="score" stroke={radarColor} fill={radarColor} fillOpacity={0.35} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Current Assessment</h3>
          {current && (
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Weighted score</dt>
                <dd className="font-semibold tabular-nums" style={{ color: current.band ? hex[current.band] ?? undefined : undefined }}>
                  {current.weightedScore} ({current.band})
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Assessed</dt>
                <dd className="text-slate-700">{fmtDate(current.assessmentDate)} · {current.assessorName ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Method</dt>
                <dd className="text-slate-700">{current.method.replace(/_/g, " ")}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Valid until</dt>
                <dd className="text-slate-700">{fmtDate(current.validUntil)}</dd>
              </div>
              {current.summaryNotes && <p className="pt-1 text-xs text-slate-600">{current.summaryNotes}</p>}
            </dl>
          )}
        </div>
      </div>

      {/* Findings (across this lens) with raise-CAPA */}
      <FindingsList vendorId={vendorId} lensAssessments={lensAssessments} />

      {/* History */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Assessment History</h3>
        <ul className="space-y-2">
          {lensAssessments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-700">{fmtDate(a.assessmentDate)}</span>
                <span className="text-xs text-slate-400">{a.method.replace(/_/g, " ")}</span>
                {a.isCurrent && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Current</span>}
              </div>
              <span
                className={
                  "rounded border px-2 py-0.5 text-[11px] font-semibold " +
                  ((lens === "RISK" ? RISK_BAND_CHIP : ESG_BAND_CHIP)[a.band] ?? "border-slate-200 bg-slate-100 text-slate-600")
                }
              >
                {a.weightedScore} · {a.band}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FindingsList({ vendorId, lensAssessments }: { vendorId: string; lensAssessments: VendorAssessment[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = lensAssessments.flatMap((a) =>
    a.findings.map((f) => ({ ...f, assessmentId: a.id, assessmentDate: a.assessmentDate })),
  );

  async function raiseCapa(assessmentId: string, findingId: string) {
    setBusyId(findingId);
    setError(null);
    try {
      const res = await fetch(`/api/erm/vendors/assessments/${assessmentId}/findings/${findingId}/raise-capa`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.detail || j.error || `Failed to raise CAPA (${res.status}).`);
        setBusyId(null);
        return;
      }
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Network error raising CAPA.");
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Findings</h3>
      {error && <div className="mb-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>}
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400">No findings recorded.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((f) => (
            <li key={f.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
              <div className="min-w-0">
                <div className="mb-0.5 flex items-center gap-2">
                  <span
                    className={
                      "rounded border px-1.5 py-0.5 text-[11px] font-semibold " +
                      (VENDOR_FINDING_CHIP[f.severity] ?? "border-slate-200 bg-slate-100 text-slate-600")
                    }
                  >
                    {f.severity.replace(/_/g, " ")}
                  </span>
                  {f.targetCloseDate && <span className="text-[11px] text-slate-400">Target {fmtDate(f.targetCloseDate)}</span>}
                  {f.capaId && (
                    <span className="inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700">
                      CAPA raised
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700">{f.description}</p>
              </div>
              {f.severity === "CRITICAL_GAP" && !f.capaId && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => raiseCapa(f.assessmentId, f.id)}
                  disabled={busyId === f.id}
                  className="flex-shrink-0 gap-1"
                >
                  <AlertTriangle size={13} /> {busyId === f.id ? "Raising…" : "Raise CAPA"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OnboardingModal({ vendorId, current, onClose }: { vendorId: string; current: string; onClose: () => void }) {
  const router = useRouter();
  const [status, setStatus] = useState<string>(current);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/erm/vendors/${vendorId}/onboarding`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ onboardingStatus: status, note: note.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.detail || j.error || `Failed to change onboarding status (${res.status}).`);
        setBusy(false);
        return;
      }
      onClose();
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Network error changing onboarding status.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Change Onboarding Status</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="h-8 w-8 text-slate-400 hover:text-slate-700">
            <X size={18} />
          </Button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">New status</label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {ONBOARDING_STATES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-[11px] text-slate-400">
              APPROVING a Strategic/Critical vendor with an open CRITICAL_GAP is blocked; CONDITIONAL approval of such a vendor requires the CRO.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Note</label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </div>
          {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={busy || status === current}>
            {busy ? "Saving…" : "Update"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function VendorProfileView({
  vendor,
  scoringConfig,
}: {
  vendor: VendorDetail;
  scoringConfig: ScoringConfig[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [assessOpen, setAssessOpen] = useState(false);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [raiseBusy, setRaiseBusy] = useState(false);
  const [raiseResult, setRaiseResult] = useState<string | null>(null);
  const [raiseError, setRaiseError] = useState<string | null>(null);

  async function raiseRisk() {
    setRaiseBusy(true);
    setRaiseError(null);
    try {
      const res = await fetch(`/api/erm/vendors/${vendor.id}/raise-risk`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRaiseError(j.detail || j.error || `Failed to raise risk (${res.status}).`);
        setRaiseBusy(false);
        return;
      }
      setRaiseResult(j.riskCode ?? "created");
      setRaiseBusy(false);
      router.refresh();
    } catch (e: any) {
      setRaiseError(e?.message ?? "Network error raising risk.");
      setRaiseBusy(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "risk", label: "Risk Assessment" },
    { key: "esg", label: "ESG Assessment" },
    { key: "audit", label: "Audit Trail" },
  ];

  return (
    <div className="space-y-5">
      {/* Header: criticality + twin gauges + actions */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={
                    "rounded border px-2 py-0.5 text-[11px] font-semibold " +
                    (CRITICALITY_CHIP[vendor.criticality] ?? "border-slate-200 bg-slate-100 text-slate-600")
                  }
                >
                  {vendor.criticality.charAt(0) + vendor.criticality.slice(1).toLowerCase()}
                </span>
                <span
                  className={
                    "rounded border px-2 py-0.5 text-[11px] " +
                    (ONBOARDING_CHIP[vendor.onboardingStatus] ?? "border-slate-200 bg-slate-100 text-slate-600")
                  }
                >
                  {vendor.onboardingStatus.replace(/_/g, " ")}
                </span>
                {vendor.isSingleSource && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">Single-source</span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500">{vendor.category}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ScoreGauge label="Risk Score" score={vendor.currentRiskScore} band={vendor.currentRiskBand} kind="RISK" />
            <ScoreGauge label="ESG Score" score={vendor.currentEsgScore} band={vendor.currentEsgBand} kind="ESG" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <Button type="button" onClick={() => setAssessOpen(true)}>
            <Plus size={15} /> New assessment
          </Button>
          <Button type="button" variant="outline" onClick={raiseRisk} disabled={raiseBusy}>
            <ShieldAlert size={15} /> {raiseBusy ? "Raising…" : "Raise as risk"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setOnboardOpen(true)}>
            <Repeat size={15} /> Change onboarding
          </Button>
          {raiseResult && (
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              Enterprise risk {raiseResult} created
            </span>
          )}
          {raiseError && (
            <span className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs text-rose-700">{raiseError}</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <Button
            key={t.key}
            type="button"
            variant="ghost"
            onClick={() => setTab(t.key)}
            className={cn(
              "h-auto rounded-none border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-primary-700 text-primary-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Profile</h3>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Annual spend</dt>
                <dd className="font-semibold tabular-nums text-slate-800">{inrCompact(vendor.annualSpendInr)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Tier</dt>
                <dd className="text-slate-700">{TIER_LABEL[vendor.tier] ?? vendor.tier}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Relationship owner</dt>
                <dd className="text-slate-700">{vendor.relationshipOwnerName ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Single-source</dt>
                <dd className="text-slate-700">{vendor.isSingleSource ? "Yes" : "No"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Next review</dt>
                <dd className={vendor.reviewOverdue ? "font-semibold text-rose-600" : "text-slate-700"}>
                  {fmtDate(vendor.nextReviewDate)}
                  {vendor.reviewOverdue && " (overdue)"}
                </dd>
              </div>
              {vendor.masterDataRef && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Master data ref</dt>
                  <dd className="text-slate-700">{vendor.masterDataRef}</dd>
                </div>
              )}
              <div className="pt-1">
                <dt className="mb-1 text-slate-500">Site scope</dt>
                <dd className="flex flex-wrap gap-1">
                  {vendor.siteScope.length === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    vendor.siteScope.map((s) => (
                      <span key={s} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                        {s}
                      </span>
                    ))
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Linked Risks</h3>
              {vendor.linkedRisks.length === 0 ? (
                <p className="text-xs text-slate-400">No linked enterprise risks.</p>
              ) : (
                <ul className="space-y-1.5">
                  {vendor.linkedRisks.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link href={`/erm/register/${r.id}`} className="font-medium text-primary-700 hover:underline">
                        {r.riskCode}
                      </Link>
                      <span className="min-w-0 flex-1 truncate text-slate-600">{r.title}</span>
                      {r.residualBand && (
                        <span className={"rounded border px-1.5 py-0.5 text-[10px] font-semibold " + (RISK_BAND_CHIP[r.residualBand] ?? "")}>
                          {r.residualBand}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Linked Processes</h3>
              {vendor.linkedProcesses.length === 0 ? (
                <p className="text-xs text-slate-400">No linked continuity processes.</p>
              ) : (
                <ul className="space-y-1.5">
                  {vendor.linkedProcesses.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link href={`/erm/bcm/processes/${p.id}`} className="font-medium text-primary-700 hover:underline">
                        {p.processCode}
                      </Link>
                      <span className="min-w-0 flex-1 truncate text-slate-600">{p.name}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{p.criticality}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "risk" && <AssessmentLensSection vendorId={vendor.id} lens="RISK" assessments={vendor.assessments} />}
      {tab === "esg" && <AssessmentLensSection vendorId={vendor.id} lens="ESG" assessments={vendor.assessments} />}

      {tab === "audit" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                <TableHead>Date</TableHead>
                <TableHead>Lens</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Assessor</TableHead>
                <TableHead>Score / band</TableHead>
                <TableHead>Findings</TableHead>
                <TableHead>Valid until</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendor.assessments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="px-3 py-10 text-center text-sm text-slate-400">
                    No assessments recorded.
                  </TableCell>
                </TableRow>
              ) : (
                vendor.assessments.map((a) => (
                  <TableRow key={a.id} className="border-t border-slate-100">
                    <TableCell className="px-3 py-2.5 text-xs text-slate-600">{fmtDate(a.assessmentDate)}</TableCell>
                    <TableCell className="px-3 py-2.5">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">{a.lens}</span>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-xs text-slate-600">{a.method.replace(/_/g, " ")}</TableCell>
                    <TableCell className="px-3 py-2.5 text-xs text-slate-600">{a.assessorName ?? "—"}</TableCell>
                    <TableCell className="px-3 py-2.5">
                      <span
                        className={
                          "rounded border px-2 py-0.5 text-[11px] font-semibold " +
                          ((a.lens === "RISK" ? RISK_BAND_CHIP : ESG_BAND_CHIP)[a.band] ?? "border-slate-200 bg-slate-100 text-slate-600")
                        }
                      >
                        {a.weightedScore} · {a.band}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-xs tabular-nums text-slate-600">{a.findings.length}</TableCell>
                    <TableCell className="px-3 py-2.5 text-xs text-slate-500">{fmtDate(a.validUntil)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {assessOpen && (
        <AssessmentModal vendorId={vendor.id} scoringConfig={scoringConfig} onClose={() => setAssessOpen(false)} />
      )}
      {onboardOpen && (
        <OnboardingModal vendorId={vendor.id} current={vendor.onboardingStatus} onClose={() => setOnboardOpen(false)} />
      )}
    </div>
  );
}
