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
} from "../../lib";

const TABS = ["Overview", "Assessments", "Treatments", "Contributing", "KRIs", "Loss History", "Linkages", "Reviews"] as const;
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
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">{risk.title}</h1>
              <span className={"rounded border px-2 py-0.5 text-[11px] font-medium " + (STATE_CHIP[st] ?? "")}>
                {st.replace(/_/g, " ")}
              </span>
              {risk.categoryCode && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: risk.categoryColor ?? "#64748b" }}>
                  {risk.categoryName}
                </span>
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
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
              (tab === t ? "border-primary-700 text-primary-700" : "border-transparent text-slate-500 hover:text-slate-700")
            }
          >
            {t}
            {t === "Treatments" && risk.treatments.length > 0 && <span className="ml-1 text-[10px] text-slate-400">{risk.treatments.length}</span>}
            {t === "Contributing" && <span className="ml-1 text-[10px] text-slate-400">{risk.contributingEntries.length}</span>}
            {t === "KRIs" && phase2 && <span className="ml-1 text-[10px] text-slate-400">{phase2.linkedKris.length}</span>}
            {t === "Loss History" && phase2 && <span className="ml-1 text-[10px] text-slate-400">{phase2.lossEvents.length}</span>}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {tab === "Overview" && <OverviewTab risk={risk} />}
        {tab === "Assessments" && <AssessmentsTab risk={risk} />}
        {tab === "Treatments" && <TreatmentsTab risk={risk} />}
        {tab === "Contributing" && <ContributingTab risk={risk} />}
        {tab === "KRIs" && phase2 && <KrisTab phase2={phase2} />}
        {tab === "Loss History" && phase2 && <LossHistoryTab phase2={phase2} />}
        {tab === "Linkages" && <LinkagesTab risk={risk} />}
        {tab === "Reviews" && <ReviewsTab risk={risk} />}
      </div>

      {modal === "assess" && <AssessModal risk={risk} matrix={matrix} onClose={() => setModal(null)} onDone={() => { setModal(null); router.refresh(); }} />}
      {modal === "treat" && <TreatModal risk={risk} onClose={() => setModal(null)} onDone={() => { setModal(null); router.refresh(); }} />}
      {modal === "review" && <ReviewModal risk={risk} matrix={matrix} onClose={() => setModal(null)} onDone={() => { setModal(null); router.refresh(); }} />}
    </div>
  );
}

function ActionBtn({ children, onClick, disabled, primary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 " +
        (primary ? "bg-primary-700 text-white hover:bg-primary-800" : "border border-slate-300 bg-white text-slate-700 hover:border-primary-500")
      }
    >
      {children}
    </button>
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
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Causes</h3>
          <Chips items={risk.causes} tone="bg-amber-50 text-amber-800 border border-amber-100" />
        </div>
        <div className="rounded-lg border-2 border-slate-300 bg-white p-3">
          <h3 className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">Risk Event</h3>
          <p className="text-center text-sm font-medium text-slate-800">{risk.title}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Consequences</h3>
          <Chips items={risk.consequences} tone="bg-rose-50 text-rose-800 border border-rose-100" />
        </div>
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
        <div className="rounded-lg border border-slate-200 p-3">
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
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
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
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Assessment history</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-2 py-1.5">Type</th><th className="px-2 py-1.5">L×I</th><th className="px-2 py-1.5">Score</th><th className="px-2 py-1.5">Band</th><th className="px-2 py-1.5">Date</th><th className="px-2 py-1.5">By</th><th className="px-2 py-1.5">Current</th>
            </tr>
          </thead>
          <tbody>
            {risk.assessmentHistory.map((a) => (
              <tr key={a.id} className="border-b border-slate-100">
                <td className="px-2 py-1.5">{a.assessmentType}</td>
                <td className="px-2 py-1.5 tabular-nums">{a.likelihood}×{a.overallImpact}</td>
                <td className="px-2 py-1.5 tabular-nums font-semibold">{a.totalScore}</td>
                <td className="px-2 py-1.5"><BandBadge band={a.ratingBand} /></td>
                <td className="px-2 py-1.5 text-xs text-slate-500">{fmtDate(a.assessmentDate)}</td>
                <td className="px-2 py-1.5 text-xs text-slate-500">{a.assessedByName ?? "—"}</td>
                <td className="px-2 py-1.5">{a.isCurrent ? "✓" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AssessmentCard({ title, a }: { title: string; a: Assessment | null }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
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
    </div>
  );
}

function TreatmentsTab({ risk }: { risk: RiskDetail }) {
  if (!risk.treatments.length) return <p className="py-6 text-center text-sm text-slate-400">No treatments yet. Use “Add Treatment”.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
          <th className="px-2 py-1.5">CAPA</th><th className="px-2 py-1.5">Strategy</th><th className="px-2 py-1.5">State</th><th className="px-2 py-1.5">Owner</th><th className="px-2 py-1.5">Due</th><th className="px-2 py-1.5">Exp. reduction</th>
        </tr>
      </thead>
      <tbody>
        {risk.treatments.map((t) => (
          <tr key={t.id} className="border-b border-slate-100">
            <td className="px-2 py-1.5">
              <Link href={`/capa/${t.id}`} className="font-medium text-primary-700 hover:underline">{t.capaNumber}</Link>
            </td>
            <td className="px-2 py-1.5"><span className="rounded bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-800">{t.treatmentStrategy}</span></td>
            <td className="px-2 py-1.5 text-xs">{t.state.replace(/_/g, " ")}{t.overdue && <span className="ml-1 rounded bg-rose-100 px-1 text-[10px] font-semibold text-rose-700">OVERDUE</span>}</td>
            <td className="px-2 py-1.5 text-xs text-slate-600">{t.primaryOwnerName ?? "—"}</td>
            <td className="px-2 py-1.5 text-xs text-slate-500">{fmtDate(t.closureTargetDate)}</td>
            <td className="px-2 py-1.5 tabular-nums text-xs">{t.expectedResidualReduction ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
            <th className="px-2 py-1.5">KRI</th><th className="px-2 py-1.5">Current</th><th className="px-2 py-1.5">Status</th><th className="px-2 py-1.5">Trend</th><th className="px-2 py-1.5"></th>
          </tr>
        </thead>
        <tbody>
          {phase2.linkedKris.map((k) => (
            <tr key={k.id} className="border-b border-slate-100">
              <td className="px-2 py-1.5"><Link href={`/erm/kris/${k.id}`} className="font-medium text-primary-700 hover:underline">{k.kriCode}</Link> <span className="text-slate-600">{k.name}</span></td>
              <td className="px-2 py-1.5 tabular-nums">{k.currentValue ?? "—"} <span className="text-[10px] text-slate-400">{k.unit}</span></td>
              <td className="px-2 py-1.5"><span className="rounded px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: P2_STATUS_HEX[k.currentStatus] ?? "#64748b" }}>{k.currentStatus}</span></td>
              <td className="px-2 py-1.5"><MiniSpark points={k.sparkline} /></td>
              <td className="px-2 py-1.5"><Link href={`/erm/kris/${k.id}`} className="text-xs text-primary-700 hover:underline">Open ↗</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LossHistoryTab({ phase2 }: { phase2: NonNullable<Phase2Context> }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-slate-500">Actual loss events evidencing this risk (12-month net).</p>
        <span className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">12-mo net: {inr(phase2.netLoss12m)}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
            <th className="px-2 py-1.5">Event</th><th className="px-2 py-1.5">Date</th><th className="px-2 py-1.5">Net loss</th><th className="px-2 py-1.5">Status</th>
          </tr>
        </thead>
        <tbody>
          {phase2.lossEvents.map((e) => (
            <tr key={e.id} className="border-b border-slate-100">
              <td className="px-2 py-1.5"><Link href="/erm/loss" className="font-medium text-primary-700 hover:underline">{e.eventCode}</Link> <span className="text-slate-600">{e.title}</span>{e.isNearMiss && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700">NEAR MISS</span>}</td>
              <td className="px-2 py-1.5 text-xs text-slate-500">{fmtDate(e.eventDate)}</td>
              <td className="px-2 py-1.5 tabular-nums">{e.isNearMiss ? <span className="text-amber-600">{inr(e.potentialLossInr)} potential</span> : inr(e.netLossInr)}</td>
              <td className="px-2 py-1.5 text-xs">{e.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
            <th className="px-2 py-1.5">Module</th><th className="px-2 py-1.5">Activity</th><th className="px-2 py-1.5">Contributing score</th><th className="px-2 py-1.5">Band</th><th className="px-2 py-1.5"></th>
          </tr>
        </thead>
        <tbody>
          {risk.contributingEntries.map((e) => (
            <tr key={e.id} className="border-b border-slate-100">
              <td className="px-2 py-1.5"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium">{e.sourceModule}</span></td>
              <td className="max-w-[420px] px-2 py-1.5 text-slate-700">{e.sourceRef}</td>
              <td className="px-2 py-1.5 tabular-nums font-semibold">{e.contributingScore}</td>
              <td className="px-2 py-1.5"><BandBadge band={e.contributingBand} /></td>
              <td className="px-2 py-1.5"><Link href={e.drilldownUrl ?? "#"} className="text-xs text-primary-700 hover:underline">Open ↗</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
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
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
          {(["INHERENT", "RESIDUAL"] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} className={"rounded-md px-3 py-1.5 " + (type === t ? "bg-white text-primary-700 shadow-sm" : "text-slate-500")}>{t}</button>
          ))}
        </div>
      )}
      <div>
        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Likelihood</h3>
        <div className="grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map((l) => {
            const ll = lLevels.find((x) => x.level === l);
            return (
              <button key={l} onClick={() => setLikelihood(l)} title={ll ? `${ll.probabilityGuide} / ${ll.frequencyGuide}` : ""}
                className={"rounded-lg border p-2 text-center text-xs " + (likelihood === l ? "border-primary-600 bg-primary-50 font-semibold text-primary-700" : "border-slate-200 hover:border-slate-400")}>
                <div className="text-base font-bold">{l}</div>
                <div className="text-[10px] leading-tight">{ll?.label ?? ""}</div>
              </button>
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
                    <button key={l} onClick={() => setLevels((p) => { const n = { ...p }; delete n[dim]; return n; })}
                      className={"rounded px-2 py-1 text-[10px] " + (!levels[dim] ? "bg-slate-200 font-semibold" : "bg-slate-50 text-slate-400")}>n/a</button>
                  ) : (
                    <button key={l} onClick={() => setLevels((p) => ({ ...p, [dim]: l }))} title={impactDescriptor(dim, l)}
                      className={"flex-1 rounded px-1 py-1 text-xs font-medium text-white " + (levels[dim] === l ? "ring-2 ring-slate-900" : "opacity-60 hover:opacity-100")}
                      style={{ backgroundColor: BAND_HEX[bandForScore(l * l) ?? "LOW"] }}>{l}</button>
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
        <label className="mb-1 block text-xs font-medium text-slate-600">Rationale (required)</label>
        <textarea value={rationale} onChange={(e) => setRationale(e.target.value)} rows={3}
          className="w-full rounded-lg border border-slate-300 p-2 text-sm" placeholder="Why this likelihood and impact…" />
      </div>
      <button
        disabled={busy || !rationale.trim() || overall === 0}
        onClick={() =>
          onSubmit({
            assessmentType: type,
            likelihood,
            impactScores: Object.entries(levels).map(([dimension, level]) => ({ dimension, level })),
            rationale,
          })
        }
        className="w-full rounded-lg bg-primary-700 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save assessment"}
      </button>
    </div>
  );
}

function AssessModal({ risk, matrix, onClose, onDone }: { risk: RiskDetail; matrix: ScoringMatrix | null; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(body: any) {
    setBusy(true);
    const res = await fetch(`/api/erm/risks/${risk.id}/assessments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.detail || j.error || "Failed"); return; }
    onDone();
  }
  return <Modal title="Record assessment" onClose={onClose} wide><AssessForm matrix={matrix} onSubmit={submit} busy={busy} /></Modal>;
}

function TreatModal({ risk, onClose, onDone }: { risk: RiskDetail; onClose: () => void; onDone: () => void }) {
  const [strategy, setStrategy] = useState("TREAT");
  const [title, setTitle] = useState("");
  const [reduction, setReduction] = useState("");
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    const body: any = { treatmentStrategy: strategy, title, expectedResidualReduction: reduction ? Number(reduction) : null };
    if (strategy === "TOLERATE") body.acceptanceJustification = justification;
    const res = await fetch(`/api/erm/risks/${risk.id}/treatments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.detail || j.error || "Failed"); return; }
    onDone();
  }
  return (
    <Modal title="Add treatment" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Strategy</label>
          <div className="grid grid-cols-4 gap-1.5">
            {["TREAT", "TOLERATE", "TRANSFER", "TERMINATE"].map((s) => (
              <button key={s} onClick={() => setStrategy(s)} className={"rounded-lg border px-2 py-2 text-xs font-medium " + (strategy === s ? "border-primary-600 bg-primary-50 text-primary-700" : "border-slate-200")}>{s}</button>
            ))}
          </div>
        </div>
        {strategy === "TOLERATE" ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Acceptance justification (required — CRO sign-off via Accept)</label>
            <textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
          </div>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Treatment title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm" placeholder="e.g. Qualify alternate polymer vendor" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Expected residual score after completion</label>
              <input type="number" min={1} max={25} value={reduction} onChange={(e) => setReduction(e.target.value)} className="w-32 rounded-lg border border-slate-300 p-2 text-sm" />
            </div>
            <p className="text-xs text-slate-500">Spawns a CAPA on the universal CAPA engine (source type RISK_TREATMENT) — one action universe, one overdue report.</p>
          </>
        )}
        <button disabled={busy || (strategy === "TOLERATE" ? !justification.trim() : !title.trim())} onClick={submit} className="w-full rounded-lg bg-primary-700 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy ? "Saving…" : "Create treatment"}
        </button>
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
          <label className="mb-1 block text-xs font-medium text-slate-600">Outcome</label>
          <div className="grid grid-cols-2 gap-1.5">
            {["NO_CHANGE", "RESCORED", "ESCALATED", "RECOMMEND_CLOSURE"].map((o) => (
              <button key={o} onClick={() => setOutcome(o)} className={"rounded-lg border px-2 py-2 text-xs font-medium " + (outcome === o ? "border-primary-600 bg-primary-50 text-primary-700" : "border-slate-200")}>{o.replace(/_/g, " ")}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Notes (required)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
        </div>
        {outcome === "RESCORED" && (
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-xs font-medium text-slate-600">New residual assessment {assessment && <span className="text-emerald-600">✓ captured</span>}</p>
            <AssessForm matrix={matrix} forceType="RESIDUAL" busy={false} onSubmit={(b) => setAssessment(b)} />
          </div>
        )}
        <button disabled={busy || !notes.trim()} onClick={submit} className="w-full rounded-lg bg-primary-700 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy ? "Saving…" : "Submit review"}
        </button>
      </div>
    </Modal>
  );
}
