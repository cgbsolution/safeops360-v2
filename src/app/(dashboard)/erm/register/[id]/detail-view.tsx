"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Line,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { X } from "lucide-react";
import { BandBadge, ScorePair } from "@/components/erm/shared";
import { UserPicker } from "@/components/ui/user-picker";
import { RiskAttachments } from "@/components/erm/risk-attachments";
import { RiskHistory } from "@/components/erm/risk-history";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BAND_HEX,
  DIMENSION_LABEL,
  IMPACT_DIMENSIONS,
  LINKAGE_LABEL,
  STATE_CHIP,
  VELOCITY_LABEL,
  bandForScore,
  fmtDate,
  type Assessment,
  type RiskDetail,
  type ScoringMatrix,
  type Treatment,
} from "../../lib";

const TABS = ["Overview", "Assessments", "Treatments", "Contributing", "KRIs", "Loss History", "Linkages", "Reviews", "Documents", "History"] as const;
type Tab = (typeof TABS)[number];

type Phase2Context = {
  linkedKris: { id: string; kriCode: string; name: string; currentStatus: string; currentValue: number | null; unit: string; sparkline: { periodLabel: string; value: number; status: string }[] }[];
  lossEvents: { id: string; eventCode: string; title: string; eventDate: string; netLossInr: number; isNearMiss: boolean; potentialLossInr: number | null; status: string }[];
  netLoss12m: number;
  complianceStatus: string | null;
  kriBreachReview: boolean;
} | null;

const P2_STATUS_HEX: Record<string, string> = { GREEN: "#2E8B57", AMBER: "#E6A817", RED: "#C0392B", NO_DATA: "#94a3b8" };

function inr(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)} Cr`;
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(1)} L`;
  return `₹${v.toLocaleString("en-IN")}`;
}

export function RiskDetailView({ risk, matrix, phase2 }: { risk: RiskDetail; matrix: ScoringMatrix | null; phase2?: Phase2Context }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Overview");
  const [modal, setModal] = useState<null | "assess" | "treat" | "review">(null);
  const [busy, setBusy] = useState(false);

  const isRollup = risk.isRollup;
  const hasKris = !!phase2 && phase2.linkedKris.length > 0;
  const hasLoss = !!phase2 && phase2.lossEvents.length > 0;
  const tabs: Tab[] = TABS.filter((t) => {
    if (t === "Contributing") return isRollup;
    if (t === "KRIs") return hasKris;
    if (t === "Loss History") return hasLoss;
    return true;
  });

  async function action(path: string, body?: any) {
    setBusy(true);
    try {
      const res = await fetch(`/api/erm/risks/${risk.id}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.detail || j.error || `Failed (${res.status})`);
      } else {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const st = risk.lifecycleState;

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">{risk.title}</h1>
              <span className={"rounded border px-2 py-0.5 text-[11px] font-medium " + (STATE_CHIP[st] ?? "")}>
                {st.replace(/_/g, " ")}
              </span>
              {risk.categoryCode && (
                <Badge variant="neutral" className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: risk.categoryColor ?? "#64748b" }}>
                  {risk.categoryName}
                </Badge>
              )}
              {isRollup && (
                <span className="rounded bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-700 ring-1 ring-cyan-200">
                  Score derived from {risk.contributingEntries.length} operational entries
                </span>
              )}
              {phase2?.kriBreachReview && (
                <span className="rounded bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800 ring-1 ring-rose-200" title="A linked KRI is RED">
                  ⚠ KRI breach — review recommended
                </span>
              )}
              {phase2?.complianceStatus && phase2.complianceStatus !== "COMPLIANT" && (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200" title="Linked compliance obligation status">
                  Compliance: {phase2.complianceStatus.replace(/_/g, " ")}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Owner <b>{risk.riskOwnerName ?? "—"}</b> · Champion <b>{risk.riskChampionName ?? "—"}</b> · Velocity {VELOCITY_LABEL[risk.velocity] ?? risk.velocity}
              {risk.plantName && <> · {risk.plantName}</>}
            </p>
          </div>
          <div className="text-right">
            <ScorePair inherentScore={risk.inherentScore} inherentBand={risk.inherentBand} residualScore={risk.residualScore} residualBand={risk.residualBand} />
            <div className="mt-1 text-[11px] text-slate-400">inherent → residual</div>
          </div>
        </div>

        {/* Action bar */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {st === "DRAFT" && <ActionBtn onClick={() => action("submit")} disabled={busy}>Submit for validation</ActionBtn>}
          {st === "SUBMITTED" && <ActionBtn onClick={() => action("validate")} disabled={busy} primary>Validate (Champion/CRO)</ActionBtn>}
          {!isRollup && <ActionBtn onClick={() => setModal("assess")} disabled={busy}>Re-assess</ActionBtn>}
          <ActionBtn onClick={() => setModal("treat")} disabled={busy}>Add Treatment</ActionBtn>
          <ActionBtn onClick={() => setModal("review")} disabled={busy}>Conduct Review</ActionBtn>
          {["ASSESSED", "TREATMENT_ACTIVE"].includes(st) && (
            <ActionBtn onClick={() => { const j = prompt("Acceptance justification (CRO sign-off):"); if (j) action("accept", { justification: j }); }} disabled={busy}>
              Accept (CRO)
            </ActionBtn>
          )}
          {st === "TREATMENT_ACTIVE" && <ActionBtn onClick={() => action("monitoring")} disabled={busy}>Move to Monitoring</ActionBtn>}
          {st !== "CLOSED" && (
            <ActionBtn onClick={() => { const j = prompt("Closure justification (CRO):"); if (j) action("close", { justification: j }); }} disabled={busy}>
              Close (CRO)
            </ActionBtn>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <Button
            key={t}
            type="button"
            variant="ghost"
            onClick={() => setTab(t)}
            className={cn(
              "h-auto rounded-none border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t ? "border-primary-700 text-primary-700" : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            {t}
            {t === "Treatments" && risk.treatments.length > 0 && <span className="ml-1 text-[10px] text-slate-400">{risk.treatments.length}</span>}
            {t === "Contributing" && <span className="ml-1 text-[10px] text-slate-400">{risk.contributingEntries.length}</span>}
            {t === "KRIs" && phase2 && <span className="ml-1 text-[10px] text-slate-400">{phase2.linkedKris.length}</span>}
            {t === "Loss History" && phase2 && <span className="ml-1 text-[10px] text-slate-400">{phase2.lossEvents.length}</span>}
          </Button>
        ))}
      </div>

      <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
        {tab === "Overview" && <OverviewTab risk={risk} />}
        {tab === "Assessments" && <AssessmentsTab risk={risk} />}
        {tab === "Treatments" && <TreatmentsTab risk={risk} />}
        {tab === "Contributing" && <ContributingTab risk={risk} />}
        {tab === "KRIs" && phase2 && <KrisTab phase2={phase2} />}
        {tab === "Loss History" && phase2 && <LossHistoryTab phase2={phase2} />}
        {tab === "Linkages" && <LinkagesTab risk={risk} />}
        {tab === "Reviews" && <ReviewsTab risk={risk} />}
        {tab === "Documents" && <RiskAttachments riskId={risk.id} canEdit={true} />}
        {tab === "History" && <RiskHistory riskId={risk.id} riskCode={risk.riskCode} />}
      </Card>

      {modal === "assess" && <AssessModal risk={risk} matrix={matrix} onClose={() => setModal(null)} onDone={() => { setModal(null); router.refresh(); }} />}
      {modal === "treat" && <TreatModal risk={risk} onClose={() => setModal(null)} onDone={() => { setModal(null); router.refresh(); }} />}
      {modal === "review" && <ReviewModal risk={risk} matrix={matrix} onClose={() => setModal(null)} onDone={() => { setModal(null); router.refresh(); }} />}
    </div>
  );
}

function ActionBtn({ children, onClick, disabled, primary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <Button type="button" variant={primary ? "default" : "outline"} onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}

function Chips({ items, tone }: { items: string[]; tone: string }) {
  if (!items?.length) return <span className="text-xs text-slate-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((c, i) => (
        <span key={i} className={"rounded-md px-2 py-1 text-xs " + tone}>{c}</span>
      ))}
    </div>
  );
}

function OverviewTab({ risk }: { risk: RiskDetail }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Risk statement</h3>
        <p className="text-sm text-slate-700">{risk.description || "—"}</p>
      </div>
      {/* Bow-tie */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 shadow-none">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Causes</h3>
          <Chips items={risk.causes} tone="bg-amber-50 text-amber-800 border border-amber-100" />
        </Card>
        <Card className="rounded-lg border-2 border-slate-300 bg-white p-3 shadow-none">
          <h3 className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">Risk Event</h3>
          <p className="text-center text-sm font-medium text-slate-800">{risk.title}</p>
        </Card>
        <Card className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 shadow-none">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Consequences</h3>
          <Chips items={risk.consequences} tone="bg-rose-50 text-rose-800 border border-rose-100" />
        </Card>
      </div>
      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Existing controls</h3>
        <Chips items={risk.existingControls} tone="bg-emerald-50 text-emerald-800 border border-emerald-100" />
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <Meta label="Org level" value={risk.orgLevel} />
        <Meta label="Business unit" value={risk.businessUnit ?? "—"} />
        <Meta label="Identified" value={fmtDate(risk.identifiedDate)} />
        <Meta label="Next review" value={fmtDate(risk.nextReviewDate)} />
        <Meta label="Appetite threshold" value={risk.appetiteThreshold != null ? String(risk.appetiteThreshold) : "—"} />
        <Meta label="Source" value={risk.sourceType} />
        <Meta label="Tags" value={(risk.tags ?? []).join(", ") || "—"} />
        {risk.acceptanceJustification && <Meta label="Acceptance" value={risk.acceptanceJustification} />}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-sm text-slate-700">{value}</div>
    </div>
  );
}

function AssessmentsTab({ risk }: { risk: RiskDetail }) {
  const inh = risk.currentInherent;
  const res = risk.currentResidual;
  const radarData = IMPACT_DIMENSIONS.map((d) => ({
    dimension: DIMENSION_LABEL[d],
    inherent: inh?.impactScores.find((s) => s.dimension === d)?.level ?? 0,
    residual: res?.impactScores.find((s) => s.dimension === d)?.level ?? 0,
  }));
  // trend from history (residual)
  const trend = [...risk.assessmentHistory]
    .filter((a) => a.assessmentType === "RESIDUAL")
    .reverse()
    .map((a) => ({ date: fmtDate(a.assessmentDate), score: a.totalScore }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AssessmentCard title="Inherent (current)" a={inh} />
        <AssessmentCard title="Residual (current)" a={res} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-lg border border-slate-200 p-3 shadow-none">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Per-dimension breakdown</h3>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10 }} />
              <Radar name="Inherent" dataKey="inherent" stroke="#C0392B" fill="#C0392B" fillOpacity={0.25} />
              <Radar name="Residual" dataKey="residual" stroke="#1E6FB8" fill="#1E6FB8" fillOpacity={0.3} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="rounded-lg border border-slate-200 p-3 shadow-none">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Residual score trend</h3>
          {trend.length > 1 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 25]} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="score" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-xs text-slate-400">A single residual assessment so far — re-assess to build a trend.</p>
          )}
        </Card>
      </div>
      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Assessment history</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead><TableHead>L×I</TableHead><TableHead>Score</TableHead><TableHead>Band</TableHead><TableHead>Date</TableHead><TableHead>By</TableHead><TableHead>Current</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {risk.assessmentHistory.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.assessmentType}</TableCell>
                <TableCell className="tabular-nums">{a.likelihood}×{a.overallImpact}</TableCell>
                <TableCell className="tabular-nums font-semibold">{a.totalScore}</TableCell>
                <TableCell><BandBadge band={a.ratingBand} /></TableCell>
                <TableCell className="text-xs text-slate-500">{fmtDate(a.assessmentDate)}</TableCell>
                <TableCell className="text-xs text-slate-500">{a.assessedByName ?? "—"}</TableCell>
                <TableCell>{a.isCurrent ? "✓" : ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AssessmentCard({ title, a }: { title: string; a: Assessment | null }) {
  return (
    <Card className="rounded-lg border border-slate-200 p-3 shadow-none">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {a && <BandBadge band={a.ratingBand} score={a.totalScore} />}
      </div>
      {a ? (
        <div className="space-y-2 text-sm">
          <div className="flex gap-4 text-xs text-slate-600">
            <span>Likelihood <b>{a.likelihood}</b></span>
            <span>Impact <b>{a.overallImpact}</b> ({DIMENSION_LABEL[a.dominantImpactDimension] ?? a.dominantImpactDimension})</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {a.impactScores.map((s) => (
              <span key={s.dimension} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                {DIMENSION_LABEL[s.dimension] ?? s.dimension}: {s.level}
              </span>
            ))}
          </div>
          <p className="text-xs italic text-slate-500">{a.rationale}</p>
        </div>
      ) : (
        <p className="py-4 text-center text-xs text-slate-400">Not yet assessed.</p>
      )}
    </Card>
  );
}

function TreatmentsTab({ risk }: { risk: RiskDetail }) {
  if (!risk.treatments.length) return <p className="py-6 text-center text-sm text-slate-400">No treatments yet. Use “Add Treatment”.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>CAPA</TableHead><TableHead>Strategy</TableHead><TableHead>State</TableHead><TableHead>Owner</TableHead><TableHead>Due</TableHead><TableHead>Exp. reduction</TableHead><TableHead>Progress</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {risk.treatments.map((t) => (
          <TableRow key={t.id}>
            <TableCell>
              <Link href={`/capa/${t.id}`} className="font-medium text-primary-700 hover:underline">{t.capaNumber}</Link>
            </TableCell>
            <TableCell><span className="rounded bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-800">{t.treatmentStrategy}</span></TableCell>
            <TableCell className="text-xs">{t.state.replace(/_/g, " ")}{t.overdue && <span className="ml-1 rounded bg-rose-100 px-1 text-[10px] font-semibold text-rose-700">OVERDUE</span>}</TableCell>
            <TableCell className="text-xs text-slate-600">{t.primaryOwnerName ?? "—"}</TableCell>
            <TableCell className="text-xs text-slate-500">{fmtDate(t.closureTargetDate)}</TableCell>
            <TableCell className="tabular-nums text-xs">{t.expectedResidualReduction ?? "—"}</TableCell>
            <TableCell><TreatmentProgress treatment={t} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100">
      <div
        className={"h-full rounded-full transition-all " + (p >= 100 ? "bg-emerald-500" : "bg-primary-600")}
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

function TreatmentProgress({ treatment: t }: { treatment: Treatment }) {
  const router = useRouter();
  const [value, setValue] = useState<number>(t.completionPercent ?? 0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (!t.isOpen) {
    // Closed treatment — show the % bar only, no editable control.
    const pct = t.completionPercent ?? 100;
    return (
      <div className="space-y-1">
        <ProgressBar percent={pct} />
        <span className="text-[11px] tabular-nums text-slate-500">{pct}%</span>
      </div>
    );
  }

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/erm/treatments/${t.id}/progress`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ completionPercent: value }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.detail || j.error || `Failed (${res.status})`);
        return;
      }
      const j = await res.json().catch(() => ({}));
      if (j.residualRecalculated) {
        setNote("Residual auto-recalculated.");
        setTimeout(() => setNote(null), 4000);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const dirty = value !== (t.completionPercent ?? 0);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <ProgressBar percent={value} />
        <span className="w-9 text-right text-[11px] tabular-nums text-slate-600">{value}%</span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          disabled={busy}
          className="h-1.5 w-28 cursor-pointer accent-primary-600" />
        <Input
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
          disabled={busy}
          className="w-14 rounded border border-slate-300 px-1.5 py-0.5 text-[11px] tabular-nums" />
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:border-primary-500 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      {note && <span className="text-[10px] font-medium text-emerald-600">{note}</span>}
    </div>
  );
}

function MiniSpark({ points }: { points: { value: number; status: string }[] }) {
  if (!points.length) return null;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const w = 120, h = 28;
  const pts = points.map((p, i) => `${(i / Math.max(1, points.length - 1)) * w},${h - ((p.value - min) / range) * h}`).join(" ");
  const last = points[points.length - 1];
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={P2_STATUS_HEX[last.status] ?? "#64748b"} strokeWidth={2} />
    </svg>
  );
}

function KrisTab({ phase2 }: { phase2: NonNullable<Phase2Context> }) {
  return (
    <div>
      <p className="mb-3 text-xs text-slate-500">Key Risk Indicators linked to this risk — continuous early-warning signal.</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>KRI</TableHead><TableHead>Current</TableHead><TableHead>Status</TableHead><TableHead>Trend</TableHead><TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {phase2.linkedKris.map((k) => (
            <TableRow key={k.id}>
              <TableCell><Link href={`/erm/kris/${k.id}`} className="font-medium text-primary-700 hover:underline">{k.kriCode}</Link> <span className="text-slate-600">{k.name}</span></TableCell>
              <TableCell className="tabular-nums">{k.currentValue ?? "—"} <span className="text-[10px] text-slate-400">{k.unit}</span></TableCell>
              <TableCell><span className="rounded px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: P2_STATUS_HEX[k.currentStatus] ?? "#64748b" }}>{k.currentStatus}</span></TableCell>
              <TableCell><MiniSpark points={k.sparkline} /></TableCell>
              <TableCell><Link href={`/erm/kris/${k.id}`} className="text-xs text-primary-700 hover:underline">Open ↗</Link></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LossHistoryTab({ phase2 }: { phase2: NonNullable<Phase2Context> }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-slate-500">Actual loss events evidencing this risk (12-month net).</p>
        <Badge variant="neutral" className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">12-mo net: {inr(phase2.netLoss12m)}</Badge>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead><TableHead>Date</TableHead><TableHead>Net loss</TableHead><TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {phase2.lossEvents.map((e) => (
            <TableRow key={e.id}>
              <TableCell><Link href="/erm/loss" className="font-medium text-primary-700 hover:underline">{e.eventCode}</Link> <span className="text-slate-600">{e.title}</span>{e.isNearMiss && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700">NEAR MISS</span>}</TableCell>
              <TableCell className="text-xs text-slate-500">{fmtDate(e.eventDate)}</TableCell>
              <TableCell className="tabular-nums">{e.isNearMiss ? <span className="text-amber-600">{inr(e.potentialLossInr)} potential</span> : inr(e.netLossInr)}</TableCell>
              <TableCell className="text-xs">{e.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ContributingTab({ risk }: { risk: RiskDetail }) {
  if (!risk.contributingEntries.length) return <p className="py-6 text-center text-sm text-slate-400">No contributing operational entries.</p>;
  return (
    <div>
      <p className="mb-3 text-xs text-slate-500">
        This enterprise risk is auto-aggregated from the Combined Risk Register. Its residual score is derived from the live HIRA/EAI entries below — manage them at source.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Module</TableHead><TableHead>Activity</TableHead><TableHead>Contributing score</TableHead><TableHead>Band</TableHead><TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {risk.contributingEntries.map((e) => (
            <TableRow key={e.id}>
              <TableCell><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium">{e.sourceModule}</span></TableCell>
              <TableCell className="max-w-[420px] text-slate-700">{e.sourceRef}</TableCell>
              <TableCell className="tabular-nums font-semibold">{e.contributingScore}</TableCell>
              <TableCell><BandBadge band={e.contributingBand} /></TableCell>
              <TableCell><Link href={e.drilldownUrl ?? "#"} className="text-xs text-primary-700 hover:underline">Open ↗</Link></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LinkagesTab({ risk }: { risk: RiskDetail }) {
  if (!risk.linkages.length) return <p className="py-6 text-center text-sm text-slate-400">No linkages. Map them on the Interconnection Map.</p>;
  return (
    <ul className="space-y-2">
      {risk.linkages.map((l) => (
        <li key={l.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{l.direction === "OUT" ? "→" : "←"} {LINKAGE_LABEL[l.linkageType] ?? l.linkageType}</span>
          <Link href={`/erm/register/${l.otherRiskId}`} className="font-medium text-primary-700 hover:underline">{l.otherRiskCode}</Link>
          <span className="truncate text-slate-600">{l.otherRiskTitle}</span>
          {l.notes && <span className="ml-auto truncate text-xs italic text-slate-400">{l.notes}</span>}
        </li>
      ))}
    </ul>
  );
}

function ReviewsTab({ risk }: { risk: RiskDetail }) {
  if (!risk.reviews.length) return <p className="py-6 text-center text-sm text-slate-400">No reviews recorded.</p>;
  return (
    <ul className="space-y-2">
      {risk.reviews.map((r) => (
        <li key={r.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-800">{r.outcome.replace(/_/g, " ")}</span>
            <span className="text-xs text-slate-400">{fmtDate(r.reviewDate)} · {r.reviewedByName ?? "—"}</span>
          </div>
          <p className="text-xs text-slate-600">{r.notes}</p>
        </li>
      ))}
    </ul>
  );
}

// ── Modals ──────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className={"max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl " + (wide ? "w-full max-w-3xl" : "w-full max-w-xl")}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="h-8 w-8 text-slate-400 hover:text-slate-700"><X size={18} /></Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AssessForm({
  matrix,
  forceType,
  onSubmit,
  busy,
}: {
  matrix: ScoringMatrix | null;
  forceType?: "INHERENT" | "RESIDUAL";
  onSubmit: (body: any) => void;
  busy: boolean;
}) {
  const [type, setType] = useState<"INHERENT" | "RESIDUAL">(forceType ?? "INHERENT");
  const [likelihood, setLikelihood] = useState(3);
  const [levels, setLevels] = useState<Record<string, number>>({ FINANCIAL: 3 });
  const [rationale, setRationale] = useState("");

  const overall = Math.max(0, ...Object.values(levels));
  const score = likelihood * overall;
  const band = bandForScore(score);
  const lLevels = matrix?.likelihoodLevels ?? [];
  const impactDescriptor = (dim: string, lvl: number) =>
    matrix?.impactLevels.find((x) => x.dimension === dim && x.level === lvl)?.descriptor ?? "";

  return (
    <div className="space-y-4">
      {!forceType && (
        <Card className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium shadow-none">
          {(["INHERENT", "RESIDUAL"] as const).map((t) => (
            <Button key={t} type="button" variant="ghost" onClick={() => setType(t)} className={cn("h-auto rounded-md px-3 py-1.5", type === t ? "bg-white text-primary-700 shadow-sm" : "text-slate-500")}>{t}</Button>
          ))}
        </Card>
      )}
      <div>
        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Likelihood</h3>
        <div className="grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map((l) => {
            const ll = lLevels.find((x) => x.level === l);
            return (
              <Button key={l} type="button" variant="ghost" onClick={() => setLikelihood(l)} title={ll ? `${ll.probabilityGuide} / ${ll.frequencyGuide}` : ""}
                className={cn("h-auto flex-col rounded-lg border p-2 text-center text-xs", likelihood === l ? "border-primary-600 bg-primary-50 font-semibold text-primary-700" : "border-slate-200 hover:border-slate-400")}>
                <div className="text-base font-bold">{l}</div>
                <div className="text-[10px] leading-tight">{ll?.label ?? ""}</div>
              </Button>
            );
          })}
        </div>
      </div>
      <div>
        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Impact (select one level per scored dimension — overall = max)</h3>
        <div className="space-y-1.5">
          {IMPACT_DIMENSIONS.map((dim) => (
            <div key={dim} className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-xs font-medium text-slate-600">{DIMENSION_LABEL[dim]}</span>
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3, 4, 5].map((l) =>
                  l === 0 ? (
                    <Button key={l} type="button" variant="ghost" onClick={() => setLevels((p) => { const n = { ...p }; delete n[dim]; return n; })}
                      className={cn("h-auto rounded px-2 py-1 text-[10px]", !levels[dim] ? "bg-slate-200 font-semibold" : "bg-slate-50 text-slate-400")}>n/a</Button>
                  ) : (
                    <Button key={l} type="button" variant="ghost" onClick={() => setLevels((p) => ({ ...p, [dim]: l }))} title={impactDescriptor(dim, l)}
                      className={cn("h-auto flex-1 rounded px-1 py-1 text-xs font-medium text-white", levels[dim] === l ? "ring-2 ring-slate-900" : "opacity-60 hover:opacity-100")}
                      style={{ backgroundColor: BAND_HEX[bandForScore(l * l) ?? "LOW"] }}>{l}</Button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
        <span className="text-xs text-slate-500">Preview</span>
        <BandBadge band={band} score={score} />
        <span className="text-xs text-slate-500">= {likelihood} × {overall}</span>
      </div>
      <div>
        <Label className="mb-1 block text-xs font-medium text-slate-600">Rationale (required)</Label>
        <Textarea value={rationale} onChange={(e) => setRationale(e.target.value)} rows={3}
          placeholder="Why this likelihood and impact…" />
      </div>
      <Button
        type="button"
        disabled={busy || !rationale.trim() || overall === 0}
        onClick={() =>
          onSubmit({
            assessmentType: type,
            likelihood,
            impactScores: Object.entries(levels).map(([dimension, level]) => ({ dimension, level })),
            rationale,
          })
        }
        className="w-full"
      >
        {busy ? "Saving…" : "Save assessment"}
      </Button>
    </div>
  );
}

function AssessModal({ risk, matrix, onClose, onDone }: { risk: RiskDetail; matrix: ScoringMatrix | null; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [overridePrompt, setOverridePrompt] = useState<{ message: string; body: any } | null>(null);
  const [justification, setJustification] = useState("");
  async function doPost(body: any) {
    setBusy(true);
    const res = await fetch(`/api/erm/risks/${risk.id}/assessments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      const detail = j.detail;
      // Governance guard: a residual materially more optimistic than controls
      // justify needs a short justification — reveal it inline instead of erroring.
      if (res.status === 400 && detail && typeof detail === "object" && detail.code === "OVERRIDE_JUSTIFICATION_REQUIRED") {
        setOverridePrompt({ message: detail.message as string, body });
        return;
      }
      const msg = detail && typeof detail === "object" ? (detail.message || JSON.stringify(detail)) : (detail || j.error || "Failed");
      alert(msg);
      return;
    }
    onDone();
  }
  async function submit(body: any) { setOverridePrompt(null); await doPost(body); }
  async function confirmOverride() {
    if (!justification.trim() || !overridePrompt) return;
    await doPost({ ...overridePrompt.body, overrideJustification: justification.trim() });
  }
  return (
    <Modal title="Record assessment" onClose={onClose} wide>
      {overridePrompt ? (
        <div className="space-y-3">
          <Alert variant="warning" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">{overridePrompt.message}</Alert>
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Override justification (required)</Label>
            <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={3} placeholder="Why is this residual supportable despite the control-derived value?" />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => { setOverridePrompt(null); setJustification(""); }} className="flex-1">Back</Button>
            {/* Bespoke amber "confirm override" action — no Button variant matches this warning color; left as a raw styled button to avoid guessing a visual change. */}
            <Button disabled={busy || !justification.trim()} onClick={confirmOverride} className="flex-1 rounded-lg bg-amber-600 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "Saving…" : "Confirm override & save"}</Button>
          </div>
        </div>
      ) : (
        <AssessForm matrix={matrix} onSubmit={submit} busy={busy} />
      )}
    </Modal>
  );
}

function TreatModal({ risk, onClose, onDone }: { risk: RiskDetail; onClose: () => void; onDone: () => void }) {
  const [strategy, setStrategy] = useState("TREAT");
  const [title, setTitle] = useState("");
  const [reduction, setReduction] = useState("");
  const [justification, setJustification] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    const body: any = {
      treatmentStrategy: strategy,
      title,
      expectedResidualReduction: reduction ? Number(reduction) : null,
      primaryOwnerUserId: ownerId || null,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
    };
    if (strategy === "TOLERATE") body.acceptanceJustification = justification;
    const res = await fetch(`/api/erm/risks/${risk.id}/treatments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); const d = j.detail; alert((d && typeof d === "object" ? d.message : d) || j.error || "Failed"); return; }
    onDone();
  }
  return (
    <Modal title="Add treatment" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <Label className="mb-1 block text-xs font-medium text-slate-600">Strategy</Label>
          <div className="grid grid-cols-4 gap-1.5">
            {["TREAT", "TOLERATE", "TRANSFER", "TERMINATE"].map((s) => (
              <Button key={s} type="button" variant="ghost" onClick={() => setStrategy(s)} className={cn("h-auto rounded-lg border px-2 py-2 text-xs font-medium", strategy === s ? "border-primary-600 bg-primary-50 text-primary-700" : "border-slate-200")}>{s}</Button>
            ))}
          </div>
        </div>
        {strategy === "TOLERATE" ? (
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Acceptance justification (required — CRO sign-off via Accept)</Label>
            <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={3} />
          </div>
        ) : (
          <>
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">Treatment title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Qualify alternate polymer vendor" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs font-medium text-slate-600">Action owner</Label>
                <UserPicker value={ownerId} onChange={(id) => setOwnerId(id)} filter={{ plantId: risk.plantId ?? undefined }} placeholder="Assign an owner" />
              </div>
              <div>
                <Label className="mb-1 block text-xs font-medium text-slate-600">Due date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-slate-600">Expected residual score after completion</Label>
              <Input type="number" min={1} max={25} value={reduction} onChange={(e) => setReduction(e.target.value)} className="w-32" />
            </div>
            <p className="text-xs text-slate-500">Spawns a CAPA on the universal CAPA engine (source type RISK_TREATMENT) — one action universe, one overdue report. The owner is notified on assignment.</p>
          </>
        )}
        <Button type="button" disabled={busy || (strategy === "TOLERATE" ? !justification.trim() : !title.trim())} onClick={submit} className="w-full">
          {busy ? "Saving…" : "Create treatment"}
        </Button>
      </div>
    </Modal>
  );
}

function ReviewModal({ risk, matrix, onClose, onDone }: { risk: RiskDetail; matrix: ScoringMatrix | null; onClose: () => void; onDone: () => void }) {
  const [outcome, setOutcome] = useState("NO_CHANGE");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [assessment, setAssessment] = useState<any | null>(null);

  async function submit() {
    if (outcome === "RESCORED" && !assessment) { alert("Record the new residual assessment below first."); return; }
    setBusy(true);
    const body: any = { outcome, notes };
    if (outcome === "RESCORED") body.newAssessment = assessment;
    const res = await fetch(`/api/erm/risks/${risk.id}/reviews`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.detail || j.error || "Failed"); return; }
    onDone();
  }
  return (
    <Modal title="Conduct review" onClose={onClose} wide={outcome === "RESCORED"}>
      <div className="space-y-3">
        <div>
          <Label className="mb-1 block text-xs font-medium text-slate-600">Outcome</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {["NO_CHANGE", "RESCORED", "ESCALATED", "RECOMMEND_CLOSURE"].map((o) => (
              <Button key={o} type="button" variant="ghost" onClick={() => setOutcome(o)} className={cn("h-auto rounded-lg border px-2 py-2 text-xs font-medium", outcome === o ? "border-primary-600 bg-primary-50 text-primary-700" : "border-slate-200")}>{o.replace(/_/g, " ")}</Button>
            ))}
          </div>
        </div>
        <div>
          <Label className="mb-1 block text-xs font-medium text-slate-600">Notes (required)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        {outcome === "RESCORED" && (
          <Card className="rounded-lg border border-slate-200 p-3 shadow-none">
            <p className="mb-2 text-xs font-medium text-slate-600">New residual assessment {assessment && <span className="text-emerald-600">✓ captured</span>}</p>
            <AssessForm matrix={matrix} forceType="RESIDUAL" busy={false} onSubmit={(b) => setAssessment(b)} />
          </Card>
        )}
        <Button type="button" disabled={busy || !notes.trim()} onClick={submit} className="w-full">
          {busy ? "Saving…" : "Submit review"}
        </Button>
      </div>
    </Modal>
  );
}
