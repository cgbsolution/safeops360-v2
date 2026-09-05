import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import {
  AlertTriangle,
  TrendingDown,
  Map,
  ShieldCheck,
  Layers,
  Clock,
  BarChart3,
  ScrollText
} from "lucide-react";
import { resolvePlantContext } from "@/lib/plant-context";
import { PlantSwitcher } from "@/components/plant-switcher";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type TopRisk = {
  id: string;
  type: "HIRA" | "EAI";
  moduleNumber: string;
  sequenceNumber: number;
  activityDescription: string;
  areaId: string | null;
  departmentId: string | null;
  residualLevel: string | null;
  residualScore: number | null;
  nextReviewDue: string | null;
};

type RiskTrendPoint = {
  period: string;
  meanResidualScore: number;
  entryCount: number;
  significantOrCriticalCount: number;
};

type HeatmapCell = {
  areaId: string | null;
  areaName: string | null;
  low: number;
  moderate: number;
  high: number;
  critical: number;
};

type ControlEffectivenessRow = {
  hierarchy: string;
  total: number;
  effective: number;
  partial: number;
  ineffective: number;
  notVerified: number;
  effectivenessPercent: number;
};

type CoverageStats = {
  departmentsTotal: number;
  hiraCoverageDepts: number;
  eaiCoverageDepts: number;
  hiraCoveragePercent: number;
  eaiCoveragePercent: number;
};

type ReviewComplianceStats = {
  totalActive: number;
  overdueCount: number;
  overduePercent: number;
  overdueAgingBuckets: { "0-30": number; "31-90": number; "90+": number };
};

type TopCategoryRow = {
  source: "HIRA" | "EAI";
  category: string;
  count: number;
};

type IncidentLinkageRow = {
  incidentId: string;
  incidentNumber: string | null;
  occurredAt: string | null;
  severity: string | null;
  linkedHiraEntryIds: string[];
  linkedEaiEntryIds: string[];
};

const LEVEL_COLOR: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-800",
  MODERATE: "bg-amber-100 text-amber-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-rose-100 text-rose-800",
  SIGNIFICANT: "bg-orange-100 text-orange-800",
  MAJOR: "bg-rose-100 text-rose-800"
};

export default async function RiskAggregationDashboardPage(props: {
  searchParams: Promise<{ plantId?: string }>;
}) {
  const sp = await props.searchParams;
  const { plantId, plants } = await resolvePlantContext(sp.plantId);

  if (!plantId) {
    return (
      <div>
        <PageHeader
          title="Risk Aggregation Dashboard"
          description="Plant-level executive view: top risks, trends, control effectiveness, coverage, and review compliance across HIRA + EAI."
        />
        <Card className="rounded-xl border bg-white p-8 text-sm text-slate-600 shadow-none">
          No plants are accessible. Contact your Plant Head or System Admin to
          ensure you have at least one plant assignment.
        </Card>
      </div>
    );
  }

  const [
    topRisks,
    trend,
    heatmap,
    effectiveness,
    coverage,
    reviewCompliance,
    topCategories,
    incidentLinkage
  ] = await Promise.all([
    backendFetch<TopRisk[]>("/api/risk-dashboard/top-risks", {
      query: { plantId, limit: "10" }
    }).catch(() => []),
    backendFetch<RiskTrendPoint[]>("/api/risk-dashboard/risk-trend", {
      query: { plantId, months: "12" }
    }).catch(() => []),
    backendFetch<HeatmapCell[]>("/api/risk-dashboard/heatmap", {
      query: { plantId }
    }).catch(() => []),
    backendFetch<ControlEffectivenessRow[]>(
      "/api/risk-dashboard/control-effectiveness",
      { query: { plantId } }
    ).catch(() => []),
    backendFetch<CoverageStats>("/api/risk-dashboard/coverage", {
      query: { plantId }
    }).catch(() => ({
      departmentsTotal: 0,
      hiraCoverageDepts: 0,
      eaiCoverageDepts: 0,
      hiraCoveragePercent: 0,
      eaiCoveragePercent: 0
    })),
    backendFetch<ReviewComplianceStats>("/api/risk-dashboard/review-compliance", {
      query: { plantId }
    }).catch(() => ({
      totalActive: 0,
      overdueCount: 0,
      overduePercent: 0,
      overdueAgingBuckets: { "0-30": 0, "31-90": 0, "90+": 0 }
    })),
    backendFetch<TopCategoryRow[]>("/api/risk-dashboard/top-categories", {
      query: { plantId }
    }).catch(() => []),
    backendFetch<IncidentLinkageRow[]>("/api/risk-dashboard/incident-linkage", {
      query: { plantId }
    }).catch(() => [])
  ]);

  return (
    <div>
      <PageHeader
        title="Risk Aggregation Dashboard"
        description="Executive view — top risks, trends, control effectiveness across HIRA + EAI."
        action={
          <div className="flex items-center gap-2">
            <PlantSwitcher plants={plants} currentPlantId={plantId} />
            <Link
              href={`/risk-register?plantId=${plantId}`}
              className="text-xs px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50"
            >
              Open Combined Register →
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Widget title="Top 10 Risks (HIRA + EAI)" icon={<AlertTriangle size={18} />} wide>
          {topRisks.length === 0 ? (
            <Empty msg="No risk entries yet." />
          ) : (
            <ol className="space-y-1.5 text-xs">
              {topRisks.map((r, idx) => (
                <li key={`${r.type}-${r.id}`} className="flex items-center gap-2">
                  <span className="text-slate-400 w-5 text-right font-mono">
                    {idx + 1}.
                  </span>
                  <span
                    className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${
                      r.type === "HIRA"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {r.type}
                  </span>
                  <Link
                    href={
                      r.type === "HIRA"
                        ? `/hira/entries/${r.id}`
                        : `/eai/entry/${r.id}`
                    }
                    className="flex-1 truncate text-slate-700 hover:text-primary-700 hover:underline"
                  >
                    {r.activityDescription}
                  </Link>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      LEVEL_COLOR[r.residualLevel ?? ""] ??
                      "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {r.residualLevel ?? "—"} · {r.residualScore ?? 0}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Widget>

        <Widget title="Coverage" icon={<Layers size={18} />}>
          <div className="space-y-3">
            <CoverageBar
              label="HIRA"
              percent={coverage.hiraCoveragePercent}
              ratio={`${coverage.hiraCoverageDepts}/${coverage.departmentsTotal} depts`}
              color="bg-blue-500"
            />
            <CoverageBar
              label="EAI"
              percent={coverage.eaiCoveragePercent}
              ratio={`${coverage.eaiCoverageDepts}/${coverage.departmentsTotal} depts`}
              color="bg-emerald-500"
            />
          </div>
        </Widget>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Widget title="Risk Reduction Trend (12m)" icon={<TrendingDown size={18} />} wide>
          {trend.length === 0 ? (
            <Empty msg="No trend data yet." />
          ) : (
            <TrendChart points={trend} />
          )}
        </Widget>

        <Widget title="Review Compliance" icon={<Clock size={18} />}>
          <div className="text-3xl font-bold text-slate-900">
            {reviewCompliance.overdueCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            overdue of {reviewCompliance.totalActive} active entries (
            {reviewCompliance.overduePercent}%)
          </div>
          <div className="mt-3 space-y-1.5 text-xs">
            <AgingRow
              label="0-30 days"
              count={reviewCompliance.overdueAgingBuckets["0-30"]}
              tone="amber"
            />
            <AgingRow
              label="31-90 days"
              count={reviewCompliance.overdueAgingBuckets["31-90"]}
              tone="orange"
            />
            <AgingRow
              label="90+ days"
              count={reviewCompliance.overdueAgingBuckets["90+"]}
              tone="rose"
            />
          </div>
        </Widget>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Widget title="Risk Concentration by Area" icon={<Map size={18} />}>
          {heatmap.length === 0 ? (
            <Empty msg="No area data yet." />
          ) : (
            <ul className="space-y-1.5 text-xs">
              {heatmap.slice(0, 10).map((cell) => (
                <li key={cell.areaId ?? "unassigned"}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="truncate text-slate-700">
                      {cell.areaName ?? "Unassigned"}
                    </span>
                    <span className="text-slate-500 text-[10px]">
                      {cell.low + cell.moderate + cell.high + cell.critical}
                    </span>
                  </div>
                  <div className="h-2 flex rounded overflow-hidden">
                    <div
                      className="bg-emerald-500"
                      style={{
                        width: `${
                          (cell.low /
                            Math.max(
                              cell.low + cell.moderate + cell.high + cell.critical,
                              1
                            )) *
                          100
                        }%`
                      }}
                    />
                    <div
                      className="bg-amber-500"
                      style={{
                        width: `${
                          (cell.moderate /
                            Math.max(
                              cell.low + cell.moderate + cell.high + cell.critical,
                              1
                            )) *
                          100
                        }%`
                      }}
                    />
                    <div
                      className="bg-orange-500"
                      style={{
                        width: `${
                          (cell.high /
                            Math.max(
                              cell.low + cell.moderate + cell.high + cell.critical,
                              1
                            )) *
                          100
                        }%`
                      }}
                    />
                    <div
                      className="bg-rose-500"
                      style={{
                        width: `${
                          (cell.critical /
                            Math.max(
                              cell.low + cell.moderate + cell.high + cell.critical,
                              1
                            )) *
                          100
                        }%`
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget title="Control Effectiveness" icon={<ShieldCheck size={18} />}>
          {effectiveness.length === 0 ? (
            <Empty msg="No control data yet." />
          ) : (
            <ul className="space-y-1.5 text-xs">
              {effectiveness.map((row) => (
                <li key={row.hierarchy}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-slate-700">{row.hierarchy}</span>
                    <span className="text-slate-500 text-[10px]">
                      {row.effectivenessPercent}% effective ({row.total})
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${row.effectivenessPercent}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget title="Top Hazard / Aspect Categories" icon={<BarChart3 size={18} />}>
          {topCategories.length === 0 ? (
            <Empty msg="No category data yet." />
          ) : (
            <ul className="space-y-1 text-xs">
              {topCategories.slice(0, 8).map((c, i) => (
                <li key={`${c.source}-${c.category}-${i}`} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`text-[9px] uppercase tracking-wider px-1 py-0.5 rounded ${
                        c.source === "HIRA"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {c.source}
                    </span>
                    <span className="text-slate-700">
                      {c.category.replace(/_/g, " ")}
                    </span>
                  </span>
                  <span className="text-slate-500 font-mono">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Widget>
      </div>

      <Widget
        title="Recent Incidents → Risk Register"
        icon={<ScrollText size={18} />}
        wide
      >
        {incidentLinkage.length === 0 ? (
          <Empty msg="No incidents in the last 90 days." />
        ) : (
          <Table className="w-full text-xs">
            <TableHeader className="text-[10px] uppercase tracking-wider text-slate-500">
              <TableRow>
                <TableHead className="text-left py-2">Incident</TableHead>
                <TableHead className="text-left py-2">Date</TableHead>
                <TableHead className="text-left py-2">Severity</TableHead>
                <TableHead className="text-left py-2">Linked HIRA</TableHead>
                <TableHead className="text-left py-2">Linked EAI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100">
              {incidentLinkage.slice(0, 10).map((r) => (
                <TableRow key={r.incidentId}>
                  <TableCell className="py-2">
                    <Link
                      href={`/incidents/${r.incidentId}`}
                      className="font-mono text-primary-700 hover:underline"
                    >
                      {r.incidentNumber ?? r.incidentId.slice(0, 10)}
                    </Link>
                  </TableCell>
                  <TableCell className="py-2 text-slate-700">
                    {r.occurredAt
                      ? new Date(r.occurredAt).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="py-2 text-slate-700">{r.severity ?? "—"}</TableCell>
                  <TableCell className="py-2 text-slate-700">
                    {r.linkedHiraEntryIds.length || "—"}
                  </TableCell>
                  <TableCell className="py-2 text-slate-700">
                    {r.linkedEaiEntryIds.length || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Widget>
    </div>
  );
}

function Widget({
  title,
  icon,
  children,
  wide
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 ${
        wide ? "lg:col-span-2" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-slate-600 font-medium">
          {title}
        </div>
        <div className="text-slate-400">{icon}</div>
      </div>
      {children}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-xs text-slate-400 py-3">{msg}</div>;
}

function CoverageBar({
  label,
  percent,
  ratio,
  color
}: {
  label: string;
  percent: number;
  ratio: string;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-700 font-medium">{label}</span>
        <span className="text-slate-500">
          {percent}% — {ratio}
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function TrendChart({ points }: { points: RiskTrendPoint[] }) {
  const maxScore = Math.max(...points.map((p) => p.meanResidualScore), 1);
  return (
    <div>
      <div className="flex items-end gap-1 h-32">
        {points.map((p) => {
          const h = (p.meanResidualScore / maxScore) * 100;
          return (
            <div
              key={p.period}
              className="flex-1 flex flex-col items-center gap-1"
              title={`${p.period}: mean ${p.meanResidualScore} · ${p.entryCount} entries`}
            >
              <div
                className="w-full bg-primary-500 rounded-t"
                style={{ height: `${h}%`, minHeight: "2px" }}
              />
              <div className="text-[8px] text-slate-500 rotate-45 origin-left whitespace-nowrap">
                {p.period.slice(-2)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-[10px] text-slate-500 flex justify-between">
        <span>Mean residual score per month</span>
        <span>Max: {maxScore.toFixed(1)}</span>
      </div>
    </div>
  );
}

function AgingRow({
  label,
  count,
  tone
}: {
  label: string;
  count: number;
  tone: "amber" | "orange" | "rose";
}) {
  const toneCls =
    tone === "amber"
      ? "bg-amber-100 text-amber-800"
      : tone === "orange"
      ? "bg-orange-100 text-orange-800"
      : "bg-rose-100 text-rose-800";
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <span className={`px-2 py-0.5 rounded font-medium ${toneCls}`}>
        {count}
      </span>
    </div>
  );
}
