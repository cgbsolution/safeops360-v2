import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Lock, LayoutDashboard, ArrowLeftRight, LineChart, FileText } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { LtifrTrendChart } from "@/components/dashboard/charts";
import { Can } from "@/components/auth/can";
import { AnalyticsStripSkeleton } from "@/components/dashboard/analytics-strip";
import { ManhoursAnalyticsStrip } from "@/components/manhours/analytics-strip";
import { getAccessiblePlantIds, stripPlantWhere } from "@/lib/dashboard/scope";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const MONTH_SHORT = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// One badge style per submission status. NOT_STARTED is not a status
// in the DB — it's the "no row" presentation for empty cells.
const STATUS_STYLE: Record<string, { bg: string; label: string }> = {
  NOT_STARTED: { bg: "bg-slate-50 border-slate-200 text-slate-500", label: "Not started" },
  DRAFT: { bg: "bg-amber-50 border-amber-200 text-amber-800", label: "Draft" },
  SUBMITTED: { bg: "bg-blue-50 border-blue-200 text-blue-800", label: "Submitted" },
  UNDER_REVIEW: { bg: "bg-blue-50 border-blue-200 text-blue-800", label: "Reviewing" },
  APPROVED: { bg: "bg-emerald-50 border-emerald-200 text-emerald-800", label: "Approved" },
  LOCKED: { bg: "bg-slate-700 border-slate-700 text-white", label: "Locked" },
  UNLOCKED_FOR_REVISION: { bg: "bg-rose-50 border-rose-200 text-rose-800", label: "Reopened" },
  LEGACY: { bg: "bg-slate-100 border-slate-200 text-slate-600", label: "Legacy" }
};

export default async function ManhoursPage() {
  // Build the 12-month axis ending at the most recently completed
  // month (current month is in progress — submissions are post-period).
  const now = new Date();
  const axisEnd = new Date(now.getFullYear(), now.getMonth(), 1); // first of current month
  const axisMonths: { year: number; month: number; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(axisEnd.getFullYear(), axisEnd.getMonth() - 1 - i, 1);
    axisMonths.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${MONTH_SHORT[d.getMonth() + 1]} ${String(d.getFullYear()).slice(2)}`
    });
  }
  const periodStart = new Date(axisMonths[0].year, axisMonths[0].month - 1, 1);
  const periodEnd = axisEnd;

  // Scope all queries to the caller's accessible plants (UserRole-driven;
  // group-wide roles — ADMIN, CORPORATE_HSE, etc. — see all plants).
  const [plantWhere, accessibleIds] = await Promise.all([stripPlantWhere(), getAccessiblePlantIds()]);
  const plantIdFilter = accessibleIds ? { id: { in: accessibleIds } } : undefined;

  const [plants, submissions, legacyRows] = await Promise.all([
    prisma.plant.findMany({ where: plantIdFilter, orderBy: { name: "asc" } }),
    prisma.manhoursSubmission.findMany({
      where: { ...plantWhere, reportingPeriodStart: { gte: periodStart, lt: periodEnd } },
      select: {
        id: true,
        plantId: true,
        reportingYear: true,
        reportingMonth: true,
        status: true,
        netExposureHours: true,
        submissionNumber: true
      }
    }),
    prisma.manhours.findMany({
      where: {
        ...plantWhere,
        OR: axisMonths.map((m) => ({ year: m.year, month: m.month }))
      },
      select: {
        plantId: true,
        year: true,
        month: true,
        employeeHours: true,
        contractorHours: true,
        ltiCount: true,
        rwcCount: true,
        mtcCount: true,
        ltifr: true,
        trir: true,
        locked: true
      }
    })
  ]);

  // Index for quick cell lookup.
  const submissionMap = new Map<string, typeof submissions[number]>();
  for (const s of submissions) {
    submissionMap.set(`${s.plantId}::${s.reportingYear}-${s.reportingMonth}`, s);
  }
  const legacyMap = new Map<string, typeof legacyRows[number]>();
  for (const l of legacyRows) {
    legacyMap.set(`${l.plantId}::${l.year}-${l.month}`, l);
  }

  // Existing rolling-12 KPI cards: drive from legacy data so the
  // numbers stay identical to today's page until C6 backfills.
  const ytdByPlant: Record<string, { totalHours: number; lti: number; recordable: number }> = {};
  const trendByPlant: Record<string, { month: string; ltifr: number; trir: number }[]> = {};
  for (const plant of plants) {
    const recs = legacyRows
      .filter((l) => l.plantId === plant.id)
      .sort((a, b) => b.year * 100 + b.month - (a.year * 100 + a.month));
    ytdByPlant[plant.id] = {
      totalHours: recs.reduce((s, r) => s + r.employeeHours + r.contractorHours, 0),
      lti: recs.reduce((s, r) => s + r.ltiCount, 0),
      recordable: recs.reduce((s, r) => s + r.ltiCount + r.rwcCount + r.mtcCount, 0)
    };
    trendByPlant[plant.id] = recs
      .slice()
      .reverse()
      .map((r) => ({
        month: `${MONTH_SHORT[r.month]} ${String(r.year).slice(2)}`,
        ltifr: Number(r.ltifr),
        trir: Number(r.trir)
      }));
  }

  return (
    <div>
      <PageHeader
        title="Manhours & Safety KPIs"
        description="Monthly submissions per plant, with statutory KPI roll-up. Click any cell to start or resume a submission."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/manhours/mis-dashboard">
                <LayoutDashboard size={14} /> MIS dashboard
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/manhours/compare">
                <ArrowLeftRight size={14} /> Compare plants
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/manhours/trends">
                <LineChart size={14} /> Trends
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/manhours/reports">
                <FileText size={14} /> Reports
              </Link>
            </Button>
            <Can permission="MANHOURS.CREATE">
              <Button asChild>
                <Link href="/manhours/new">
                  <Plus size={16} /> New submission
                </Link>
              </Button>
            </Can>
          </div>
        }
      />

      {/* Group-wide rolling-12 analytics strip (above the per-plant cards). */}
      <div className="mb-6">
        <Suspense fallback={<AnalyticsStripSkeleton />}>
          <ManhoursAnalyticsStrip />
        </Suspense>
      </div>

      {/* Rolling-12 KPI cards. LTIFR + TRIR tiles deep-link into the
          drill-down — clicking opens the audit trail with the same
          period the card shows. Hours stays static (no drill-down
          surface for "total hours" alone). */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {plants.map((plant) => {
          const y = ytdByPlant[plant.id];
          const ltifr = y.totalHours > 0 ? ((y.lti * 1_000_000) / y.totalHours).toFixed(2) : "0.00";
          const trir = y.totalHours > 0 ? ((y.recordable * 200_000) / y.totalHours).toFixed(2) : "0.00";
          const drillBase = `/manhours/kpi?plantId=${plant.id}&year=${new Date().getFullYear()}&month=${new Date().getMonth() + 1}&isRolling12=true&includeTrend=true&preferSnapshot=false`;
          return (
            <Card key={plant.id}>
              <CardHeader>
                <CardTitle className="text-base">{plant.name}</CardTitle>
                <CardDescription>Rolling 12-month · {plant.unitType}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <Link href={`${drillBase}&code=LTIFR`} className="rounded transition hover:bg-slate-50">
                    <Metric label="LTIFR" value={ltifr} hint="per million hrs · drill" />
                  </Link>
                  <Link href={`${drillBase}&code=TRIR`} className="rounded transition hover:bg-slate-50">
                    <Metric label="TRIR" value={trir} hint="per 200k hrs · drill" />
                  </Link>
                  <Metric label="Hours" value={formatNumber(y.totalHours / 1_000_000, 2) + "M"} hint="total" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Existing trend charts (preserved) */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {plants.map((plant) => (
          <Card key={plant.id}>
            <CardHeader>
              <CardTitle className="text-sm">{plant.name} — LTIFR & TRIR Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <LtifrTrendChart data={trendByPlant[plant.id]} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* NEW: Submission calendar grid */}
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Submission Calendar</h2>
        <div className="flex gap-3 text-[11px] text-slate-500">
          {(["NOT_STARTED", "DRAFT", "SUBMITTED", "APPROVED", "LOCKED", "LEGACY"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1">
              <span className={cn("inline-block h-2 w-2 rounded border", STATUS_STYLE[k].bg)} />
              {STATUS_STYLE[k].label}
            </span>
          ))}
        </div>
      </div>

      <Card className="mb-8">
        <CardContent className="p-0 overflow-x-auto">
          <Table className="w-full text-xs">
            <TableHeader className="border-b bg-slate-50">
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left text-[11px] uppercase tracking-wider text-slate-500">Plant</TableHead>
                {axisMonths.map((m) => (
                  <TableHead key={`${m.year}-${m.month}`} className="px-2 py-2 text-center text-[11px] uppercase tracking-wider text-slate-500">
                    {m.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {plants.map((plant) => (
                <TableRow key={plant.id} className="border-b">
                  <TableCell className="sticky left-0 z-10 bg-white px-3 py-2 text-sm font-medium text-slate-900">
                    <div>{plant.name}</div>
                    <div className="text-[11px] text-slate-500">{plant.code}</div>
                  </TableCell>
                  {axisMonths.map((m) => {
                    const key = `${plant.id}::${m.year}-${m.month}`;
                    const sub = submissionMap.get(key);
                    const legacy = legacyMap.get(key);

                    let status: keyof typeof STATUS_STYLE;
                    let netHours: number | null = null;
                    let label = "";
                    if (sub) {
                      status = sub.status as keyof typeof STATUS_STYLE;
                      netHours = sub.netExposureHours;
                      label = sub.submissionNumber ?? STATUS_STYLE[status].label;
                    } else if (legacy) {
                      status = "LEGACY";
                      netHours = legacy.employeeHours + legacy.contractorHours;
                      label = `LTIFR ${Number(legacy.ltifr).toFixed(2)}`;
                    } else {
                      status = "NOT_STARTED";
                      label = "—";
                    }

                    const style = STATUS_STYLE[status] ?? STATUS_STYLE.NOT_STARTED;
                    const href = `/manhours/${plant.id}/${m.year}/${m.month}`;
                    return (
                      <TableCell key={key} className="px-1 py-1 text-center">
                        <Link
                          href={href}
                          className={cn(
                            "block rounded border px-2 py-2 transition hover:shadow-sm hover:border-primary-400",
                            style.bg
                          )}
                          title={label}
                        >
                          <div className="text-[10px] font-semibold uppercase tracking-wider">
                            {style.label}
                            {status === "LOCKED" && <Lock size={10} className="ml-1 inline" />}
                          </div>
                          {netHours != null && netHours > 0 && (
                            <div className="text-[10px] tabular-nums opacity-80 mt-0.5">
                              {formatNumber(netHours / 1000, 0)}k hrs
                            </div>
                          )}
                        </Link>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-[11px] text-slate-500">
        Legacy cells reflect the previous flat <code>Manhours</code> table — they continue to drive the rolling-12
        KPI cards above until the C6 demo seed migrates them to <code>ManhoursSubmission</code>. Click any cell to
        open the submission detail; submissions in editable status open in the wizard.
      </p>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
      <div className="text-[10px] text-slate-500">{hint}</div>
    </div>
  );
}
