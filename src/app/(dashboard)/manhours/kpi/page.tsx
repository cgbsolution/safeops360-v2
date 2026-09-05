import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/server";
import {
  KpiEngine,
  type KpiPeriod,
  type KpiResult,
  type KpiScope
} from "@/lib/manhours/kpi-engine";
import { KPI_CODES, KPI_REGISTRY, type KpiCode } from "@/lib/manhours/kpi-registry";
import { hydrateRecords, inferDrillSourceForKpi } from "@/lib/manhours/drill-down";
import { ArrowDownRight, ArrowUpRight, Camera, Compass, FileText, Minus, Printer } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { KpiDrillDownPrint } from "./print-button";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function KpiDrillDownPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  const code = strParam(sp.code);
  if (!code || !(KPI_CODES as readonly string[]).includes(code)) {
    redirect("/manhours");
  }
  const kpiCode = code as KpiCode;
  const def = KPI_REGISTRY[kpiCode];

  const plantId = strParam(sp.plantId) ?? undefined;
  const departmentId = strParam(sp.departmentId) ?? undefined;
  const contractorCompanyId = strParam(sp.contractorCompanyId) ?? undefined;
  const year = numParam(sp.year) ?? new Date().getFullYear();
  const month = numParam(sp.month);
  const quarter = numParam(sp.quarter) as 1 | 2 | 3 | 4 | undefined;
  const isYTD = strParam(sp.isYTD) === "true";
  const isRolling12 = strParam(sp.isRolling12) === "true";
  const preferSnapshot = strParam(sp.preferSnapshot) !== "false";

  await requirePermission("MANHOURS.READ", plantId ? { plantId } : {});

  const scope: KpiScope = { plantId, departmentId, contractorCompanyId };
  const period: KpiPeriod = { year, month, quarter, isYTD, isRolling12 };
  const engine = new KpiEngine(prisma);

  let result: KpiResult;
  let fromSnapshot = false;
  let snapshotCapturedAt: string | null = null;
  let scopeError: string | null = null;

  const snapshotEligible =
    preferSnapshot && plantId && month != null && !departmentId && !contractorCompanyId && !quarter && !isYTD && !isRolling12;

  if (snapshotEligible && plantId && month != null) {
    const cached = await engine.findKpiSnapshot({ code: kpiCode, plantId, year, month });
    if (cached) {
      result = cached;
      fromSnapshot = true;
      const sub = await prisma.manhoursSubmission.findUnique({
        where: {
          plantId_reportingYear_reportingMonth: { plantId, reportingYear: year, reportingMonth: month }
        },
        select: { kpiSnapshot: true }
      });
      const env = sub?.kpiSnapshot as { capturedAt?: string } | null;
      snapshotCapturedAt = env?.capturedAt ?? null;
    } else {
      try {
        result = await engine.computeKpi(kpiCode, scope, period);
      } catch (e: any) {
        scopeError = e?.message ?? "Computation failed";
        result = emptyResult(kpiCode, scope, period);
      }
    }
  } else {
    try {
      result = await engine.computeKpi(kpiCode, scope, period);
    } catch (e: any) {
      scopeError = e?.message ?? "Computation failed";
      result = emptyResult(kpiCode, scope, period);
    }
  }

  // Hydrate contributing records.
  const drillSource = inferDrillSourceForKpi(kpiCode);
  const records = drillSource
    ? await hydrateRecords(prisma, drillSource, result.audit.sourceRecordIds.slice(0, 200))
    : [];

  // Trend — best effort.
  let trend: Awaited<ReturnType<typeof engine.computeTrend>> | null = null;
  if (!fromSnapshot) {
    try {
      trend = await engine.computeTrend(kpiCode, result.value, scope, period);
    } catch {
      trend = null;
    }
  }

  // Resolve scope labels for breadcrumbs / header context.
  const [plant, department, contractor] = await Promise.all([
    plantId ? prisma.plant.findUnique({ where: { id: plantId }, select: { name: true, code: true } }) : null,
    departmentId ? prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } }) : null,
    contractorCompanyId
      ? prisma.contractorCompany.findUnique({ where: { id: contractorCompanyId }, select: { name: true } })
      : null
  ]);

  const scopeLabel = [
    plant ? plant.name : "All plants",
    department ? department.name : null,
    contractor ? contractor.name : null
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4">
      {/* Print stylesheet — hides nav/breadcrumbs/buttons + adds
          page break safety so the audit trail prints cleanly. */}
      <style>{`
        @media print {
          aside, nav, header[data-app-header], .no-print { display: none !important; }
          body { background: white !important; }
          .print-section { page-break-inside: avoid; }
          .print-shadow { box-shadow: none !important; border: 1px solid #cbd5e1 !important; }
        }
      `}</style>

      <PageHeader
        title={def.name}
        description={`${scopeLabel} · ${result.period.label}`}
        breadcrumbs={[
          { label: "Manhours", href: "/manhours" },
          { label: "KPI drill-down" },
          { label: def.code }
        ]}
        action={
          <div className="flex items-center gap-2 no-print">
            <KpiDrillDownPrint />
            <Button variant="outline" asChild>
              <Link href="/manhours">Back</Link>
            </Button>
          </div>
        }
      />

      {scopeError && (
        <Alert variant="destructive" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 no-print">
          {scopeError}
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* HEADLINE TILE */}
        <Card className="lg:col-span-2 print-shadow print-section">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500">{def.code}</div>
                <div className="mt-1 text-4xl font-bold tabular-nums text-slate-900" style={{ color: result.bandColor }}>
                  {result.formattedValue}
                </div>
                <div className="text-xs text-slate-500 mt-2">{def.formula}</div>
                {def.statutoryReference && (
                  <div className="text-[11px] text-slate-500 mt-0.5">Reference: {def.statutoryReference}</div>
                )}
              </div>
              <div className="text-right space-y-2">
                {result.band && (
                  <Badge style={{ backgroundColor: result.bandColor, color: "white" }}>
                    {result.band.replace(/_/g, " ")}
                  </Badge>
                )}
                {trend && (
                  <div className="flex items-center justify-end gap-1 text-xs">
                    <TrendIcon direction={trend.direction} />
                    <span className="font-medium">
                      {trend.percentChange == null
                        ? "—"
                        : `${trend.percentChange > 0 ? "+" : ""}${trend.percentChange.toFixed(1)}%`}
                    </span>
                    <span className="text-slate-500">vs {trend.priorPeriodLabel}</span>
                  </div>
                )}
                {fromSnapshot && (
                  <div className="text-[10px] text-slate-500 flex items-center justify-end gap-1">
                    <Camera size={10} /> Snapshot {snapshotCapturedAt ? new Date(snapshotCapturedAt).toLocaleDateString("en-IN") : ""}
                  </div>
                )}
                {result.audit.fellBackToLegacyGrossHours && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200">⚠ Legacy gross hours</Badge>
                )}
              </div>
            </div>

            {/* Computation breakdown */}
            <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
              <Stat label="Numerator" value={formatNumber(result.numerator, def.displayFormat === "currency_indian" ? 0 : 2)} />
              <Stat label="Denominator" value={result.denominator > 0 ? formatNumber(result.denominator, 0) : "—"} />
              <Stat label="Multiplier" value={`× ${formatNumber(KPI_REGISTRY[kpiCode].multiplier, 0)}`} />
            </div>
          </CardContent>
        </Card>

        {/* SCOPE + BENCHMARKS */}
        <Card className="print-shadow print-section">
          <CardHeader>
            <CardTitle className="text-sm">Context</CardTitle>
            <CardDescription>Scope, benchmarks, and exclusion rules</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Scope</div>
              <div className="text-sm">{scopeLabel}</div>
              <div className="text-xs text-slate-500">{result.period.label}</div>
            </div>
            {def.benchmarks && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Benchmarks</div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
                  <div className="text-slate-500">World-class</div><div className="tabular-nums">{def.benchmarks.worldClass}</div>
                  <div className="text-slate-500">Excellent</div><div className="tabular-nums">{def.benchmarks.excellent}</div>
                  <div className="text-slate-500">Average</div><div className="tabular-nums">{def.benchmarks.average}</div>
                  <div className="text-slate-500">Poor</div><div className="tabular-nums">{def.benchmarks.poor}</div>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {def.higherIsBetter ? "Higher is better" : "Lower is better"}
                </div>
              </div>
            )}
            {def.exclusionRules && def.exclusionRules.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Exclusion rules</div>
                <ul className="text-xs space-y-0.5 list-disc list-inside text-slate-700">
                  {def.exclusionRules.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SOURCE RECORDS */}
      <Card className="print-shadow print-section">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText size={16} />
            Contributing records
          </CardTitle>
          <CardDescription>
            {records.length === 0
              ? drillSource
                ? "No source records contributed to this KPI in the selected period."
                : "This KPI is derived from other KPIs — drill into them individually for source records."
              : `${records.length} record${records.length === 1 ? "" : "s"} from ${drillSource}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="text-sm text-slate-500 italic">No records to display.</div>
          ) : (
            <Card className="divide-y border rounded-md shadow-none">
              {records.map((r) => (
                <Link
                  key={r.id}
                  href={r.href}
                  className="flex items-start justify-between gap-3 p-3 hover:bg-slate-50 transition"
                >
                  <div className="min-w-0">
                    {r.number && <div className="font-mono text-[11px] text-slate-500">{r.number}</div>}
                    <div className="text-sm text-slate-900 truncate">{r.title}</div>
                    <div className="text-[11px] text-slate-500">{r.meta}</div>
                  </div>
                  {r.date && (
                    <div className="text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(r.date).toLocaleDateString("en-IN")}
                    </div>
                  )}
                </Link>
              ))}
            </Card>
          )}
        </CardContent>
      </Card>

      {/* AUDIT TRAIL META */}
      <Card className="print-shadow print-section">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Compass size={16} />
            Computation audit trail
          </CardTitle>
          <CardDescription>What this number was derived from, for ISO 45001 / Inspector audit defence.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <KV label="KPI">{def.name} ({def.code})</KV>
            <KV label="Formula">{def.formula}</KV>
            <KV label="Statutory reference">{def.statutoryReference ?? "—"}</KV>
            <KV label="Period">{result.period.label}</KV>
            <KV label="Scope">{scopeLabel}</KV>
            <KV label="Source">{drillSource ?? "Derived from other KPIs"}</KV>
            <KV label="Numerator">{formatNumber(result.numerator, 2)}</KV>
            <KV label="Denominator">{result.denominator > 0 ? formatNumber(result.denominator, 0) + " hrs" : "—"}</KV>
            <KV label="Multiplier">{formatNumber(KPI_REGISTRY[kpiCode].multiplier, 0)}</KV>
            <KV label="Computed value">{result.formattedValue}</KV>
            <KV label="Performance band">{result.band ?? "—"}</KV>
            <KV label="Source records">{result.audit.sourceRecordIds.length}</KV>
            <KV label="Manhours submissions referenced">{result.audit.manhoursSubmissionIds.length}</KV>
            <KV label="Computed at">{new Date(result.computedAt).toLocaleString("en-IN")}</KV>
            <KV label="From snapshot">{fromSnapshot ? `Yes — captured ${snapshotCapturedAt ? new Date(snapshotCapturedAt).toLocaleString("en-IN") : ""}` : "No (live compute)"}</KV>
            {result.audit.fellBackToLegacyGrossHours && (
              <KV label="Hours basis" full>
                ⚠ Engine fell back to legacy gross hours (no ManhoursSubmission for this period). Per IS 3786 the
                denominator should be net exposure hours — actual LTIFR may be higher than shown once C6 demo seed
                backfills net-hours submissions.
              </KV>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function strParam(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}
function numParam(v: string | string[] | undefined): number | undefined {
  const s = strParam(v);
  if (!s) return undefined;
  const n = parseInt(s, 10);
  return isNaN(n) ? undefined : n;
}

function emptyResult(code: KpiCode, scope: KpiScope, period: KpiPeriod): KpiResult {
  return {
    kpiCode: code,
    kpiName: KPI_REGISTRY[code].name,
    value: 0,
    formattedValue: "—",
    numerator: 0,
    denominator: 0,
    formula: KPI_REGISTRY[code].formula,
    band: null,
    bandColor: "#94a3b8",
    higherIsBetter: KPI_REGISTRY[code].higherIsBetter,
    period: { start: new Date(0), end: new Date(0), label: "—" },
    scope,
    computedAt: new Date(),
    audit: { sourceRecordIds: [], manhoursSubmissionIds: [], fellBackToLegacyGrossHours: false }
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-md border bg-slate-50 p-3 shadow-none">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-lg font-bold tabular-nums text-slate-900 mt-0.5">{value}</div>
    </Card>
  );
}

function KV({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="text-[11px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{children}</dd>
    </div>
  );
}

function TrendIcon({ direction }: { direction: "UP" | "DOWN" | "FLAT" }) {
  if (direction === "UP") return <ArrowUpRight size={14} className="text-emerald-600" />;
  if (direction === "DOWN") return <ArrowDownRight size={14} className="text-rose-600" />;
  return <Minus size={14} className="text-slate-500" />;
}
