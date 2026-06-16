import Link from "next/link";
import { Camera, FileText, AlertTriangle, Sparkles, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatNumber } from "@/lib/utils";
import type { ReportData } from "@/lib/manhours/report-builder";
import { KPI_REGISTRY, type KpiCode } from "@/lib/manhours/kpi-registry";
import { PerformanceScorecard } from "@/components/manhours/widgets/performance-scorecard";
import { KpiDrillDownPrint } from "@/app/(dashboard)/manhours/kpi/print-button";

const HEADLINE_KPIS: KpiCode[] = ["LTIFR", "TRIFR", "DART_RATE", "SEVERITY_RATE", "NEAR_MISS_RATE", "DAYS_SINCE_LAST_LTI"];
const SECONDARY_KPIS: KpiCode[] = ["FSI", "HEINRICH_RATIO", "OBSERVATION_RATE", "TRAINING_COMPLIANCE", "INSPECTION_COMPLIANCE", "PTW_FLRA_COMPLIANCE", "CAPA_CLOSURE_RATE", "COST_OF_INCIDENTS"];

/**
 * One renderer for all three report shapes — monthly, quarterly,
 * annual. Layout sections (headline tiles, exec summary, KPI table,
 * scorecard, incidents) appear conditionally based on which fields
 * ReportData carries. Designed to look right both on-screen and
 * after `window.print()`.
 */
export function ReportRenderer({ data }: { data: ReportData }) {
  const kindLabel =
    data.kind === "monthly" ? "Monthly Safety Performance Report"
      : data.kind === "quarterly" ? "Quarterly Board Report"
        : "Annual Safety Report";

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          aside, nav, header[data-app-header], .no-print { display: none !important; }
          body { background: white !important; }
          .print-section { page-break-inside: avoid; }
          .print-shadow { box-shadow: none !important; border: 1px solid #cbd5e1 !important; }
          h1, h2, h3 { color: #0f172a !important; }
          @page { margin: 18mm 14mm; }
        }
      `}</style>

      {/* Cover header */}
      <div className="rounded-lg border bg-white p-6 print-section print-shadow">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">
              SafeOps360 · {kindLabel}
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              {data.plant ? data.plant.name : "Group-wide"} · {data.periodLabel}
            </h1>
            <div className="mt-1 text-xs text-slate-500">
              Period {data.periodStart} → {data.periodEnd}
              {data.plant && (
                <>
                  {" "}· {data.plant.code} · {data.plant.unitType}
                </>
              )}
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="no-print">
              <KpiDrillDownPrint />
            </div>
            {data.fromSnapshot ? (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                <Camera size={11} /> Snapshot {data.snapshotCapturedAt ? new Date(data.snapshotCapturedAt).toLocaleDateString("en-IN") : ""}
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                Live compute
              </Badge>
            )}
            <div className="text-[10px] text-slate-500">
              Generated {new Date(data.generatedAt).toLocaleString("en-IN")}
            </div>
          </div>
        </div>
      </div>

      {/* Executive narrative */}
      <div className="rounded-lg border bg-white p-6 print-section print-shadow">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-primary-700" />
          <h2 className="text-base font-semibold text-slate-900">Executive summary</h2>
          {data.narrative.source === "claude" && (
            <Badge className="bg-primary-50 text-primary-700 border-primary-200 text-[10px]">
              AI-generated · Opus 4.7
            </Badge>
          )}
          {data.narrative.source === "template" && (
            <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">
              Template
            </Badge>
          )}
        </div>
        <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-line">
          {data.narrative.narrative}
        </p>
        {data.narrative.fallbackReason && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800 no-print">
            <Lightbulb size={12} className="inline mr-1" />
            {data.narrative.fallbackReason}
          </div>
        )}
        {data.narrative.tokenUsage && (
          <div className="mt-2 text-[10px] text-slate-400 no-print">
            {data.narrative.tokenUsage.input} input · {data.narrative.tokenUsage.output} output tokens
          </div>
        )}
      </div>

      {/* Headline KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 print-section">
        {HEADLINE_KPIS.map((code) => {
          const kpi = data.kpis[code];
          if (!kpi) return null;
          const prior = data.priorKpis?.[code];
          return (
            <ReportKpiTile
              key={code}
              kpi={kpi}
              prior={prior}
              priorLabel={data.priorPeriodLabel}
            />
          );
        })}
      </div>

      {/* Full KPI table */}
      <div className="rounded-lg border bg-white print-section print-shadow">
        <div className="border-b bg-slate-50 px-4 py-2 text-xs uppercase tracking-wider text-slate-500">
          Full KPI table
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">KPI</th>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Reference</th>
                <th className="px-3 py-2 text-right">Value</th>
                {data.priorKpis && <th className="px-3 py-2 text-right">{data.priorPeriodLabel}</th>}
                <th className="px-3 py-2 text-left">Band</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...HEADLINE_KPIS, ...SECONDARY_KPIS].map((code) => {
                const kpi = data.kpis[code];
                const prior = data.priorKpis?.[code];
                const def = KPI_REGISTRY[code];
                if (!kpi) return null;
                return (
                  <tr key={code}>
                    <td className="px-3 py-2 font-medium">{kpi.kpiName}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{code}</td>
                    <td className="px-3 py-2 text-[11px] text-slate-500">
                      {def.statutoryReference ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="font-bold tabular-nums" style={{ color: kpi.bandColor }}>
                        {kpi.formattedValue}
                      </span>
                    </td>
                    {data.priorKpis && (
                      <td className="px-3 py-2 text-right text-slate-500 tabular-nums">
                        {prior?.formattedValue ?? "—"}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      {kpi.band ? (
                        <span
                          className="inline-block rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                          style={{ backgroundColor: kpi.bandColor, color: "white" }}
                        >
                          {kpi.band.replace(/_/g, " ")}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Plant scorecard — quarterly + annual only */}
      {data.scorecard && (
        <div className="print-section">
          <PerformanceScorecard rows={data.scorecard} />
        </div>
      )}

      {/* Incidents in period */}
      <div className="rounded-lg border bg-white print-section print-shadow">
        <div className="flex items-center gap-2 border-b bg-slate-50 px-4 py-2">
          <AlertTriangle size={14} className="text-rose-700" />
          <span className="text-xs uppercase tracking-wider text-slate-600">
            Recordable incidents · {data.incidents.length}
          </span>
        </div>
        {data.incidents.length === 0 ? (
          <div className="px-4 py-3 text-sm text-emerald-700">
            No recordable incidents recorded in this period.
          </div>
        ) : (
          <div className="divide-y">
            {data.incidents.map((i) => (
              <Link key={i.id} href={i.href} className="block px-4 py-2 hover:bg-slate-50 no-print">
                <IncidentRow incident={i} />
              </Link>
            ))}
            {/* Static (non-link) version for print */}
            <div className="hidden print:block">
              {data.incidents.map((i) => (
                <div key={i.id} className="px-4 py-2 border-b">
                  <IncidentRow incident={i} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Open findings — monthly only */}
      {data.openFindings.length > 0 && (
        <div className="rounded-lg border bg-white print-section print-shadow">
          <div className="flex items-center gap-2 border-b bg-slate-50 px-4 py-2">
            <FileText size={14} className="text-amber-700" />
            <span className="text-xs uppercase tracking-wider text-slate-600">
              Top open findings ({data.openFindings.length} oldest)
            </span>
          </div>
          <div className="divide-y">
            {data.openFindings.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate">{f.title}</div>
                  <div className="text-[11px] text-slate-500">{f.status}</div>
                </div>
                <div className="text-xs text-slate-500 whitespace-nowrap">
                  {f.daysOpen} day{f.daysOpen === 1 ? "" : "s"} open
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer attribution */}
      <div className="rounded-lg border bg-slate-50 p-4 text-[11px] text-slate-600 print-section">
        <div className="font-semibold text-slate-700 mb-1">About this report</div>
        <div>
          KPIs computed per IS 3786:1983 (LTIFR, Severity Rate, FSI) and OSHA 29 CFR 1904 (TRIFR, TRIR, DART).
          {data.fromSnapshot
            ? " Numbers in this report are the immutable snapshot captured at lock — they will not change even if source incidents are reclassified later."
            : " Numbers in this report are computed live from the current state of source modules; running this report again later may produce different values if source incidents are reclassified."}
          {" "}Drill into any KPI from the live dashboard at <code className="text-slate-700">/manhours/kpi</code>.
        </div>
      </div>
    </div>
  );
}

// ── Tiles & rows ───────────────────────────────────────────────

function ReportKpiTile({
  kpi,
  prior,
  priorLabel
}: {
  kpi: import("@/lib/manhours/kpi-engine").KpiResult;
  prior?: import("@/lib/manhours/kpi-engine").KpiResult;
  priorLabel: string | null;
}) {
  const delta =
    prior && prior.value !== 0
      ? ((kpi.value - prior.value) / Math.abs(prior.value)) * 100
      : null;
  const goodDirection =
    delta == null
      ? "flat"
      : Math.abs(delta) < 5
        ? "flat"
        : (delta > 0) === kpi.higherIsBetter
          ? "good"
          : "bad";

  return (
    <div className="rounded-md border bg-white p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 leading-tight">{kpi.kpiName}</div>
      <div className="mt-1 text-xl font-bold tabular-nums" style={{ color: kpi.bandColor }}>
        {kpi.formattedValue}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
        {kpi.band && (
          <span
            className="inline-block rounded px-1.5 py-0 text-[8px] font-medium uppercase tracking-wider"
            style={{ backgroundColor: kpi.bandColor, color: "white" }}
          >
            {kpi.band.replace(/_/g, " ")}
          </span>
        )}
        {delta != null && priorLabel && (
          <span
            className={cn(
              "text-[10px] tabular-nums",
              goodDirection === "good" && "text-emerald-700",
              goodDirection === "bad" && "text-rose-700",
              goodDirection === "flat" && "text-slate-500"
            )}
          >
            {delta > 0 ? "↑" : delta < 0 ? "↓" : "→"} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

function IncidentRow({ incident }: { incident: import("@/lib/manhours/report-builder").ReportIncidentSummary }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {incident.number && (
          <span className="font-mono text-[11px] text-slate-500">{incident.number} · </span>
        )}
        <span className="text-sm font-medium text-slate-900">{incident.type}</span>
        {incident.severity && (
          <span className="ml-2 text-[10px] uppercase tracking-wider text-slate-500">
            {incident.severity}
          </span>
        )}
        <div className="text-xs text-slate-700 mt-0.5">{incident.description}</div>
      </div>
      <div className="text-right text-[11px] text-slate-500 whitespace-nowrap">
        <div>{new Date(incident.date).toLocaleDateString("en-IN")}</div>
        {incident.lostDays > 0 && <div className="text-rose-700">{incident.lostDays} lost days</div>}
      </div>
    </div>
  );
}
