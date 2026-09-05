"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Baby,
  Clock,
  Download,
  Filter,
  Scale,
  ShieldCheck,
  Users,
} from "lucide-react";
import { usePermission } from "@/components/auth/can";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { downloadCsv, stamp } from "../csv";
import { workforceRegisterCsv } from "../registers-csv";
import { Card } from "@/components/ui/card";
import {
  fmtNum,
  SOCIAL_FLAG_CHIP,
  SOCIAL_FLAG_DOT,
  SOCIAL_FLAG_LABEL,
  type ComplianceFlag,
  type SocialComplianceRegisterResponse,
  type SocialComplianceRegisterRow,
  type SocialComplianceRollup,
} from "../lib";

const FLAG_RANK: Record<ComplianceFlag, number> = {
  NON_COMPLIANT: 3,
  ATTENTION: 2,
  COMPLIANT: 1,
  NOT_ASSESSED: 0,
};

// Worst-of across element flags (mirrors the backend) — drives the mini-indicators.
function worstFlag(...flags: ComplianceFlag[]): ComplianceFlag {
  const assessed = flags.filter((f) => f && f !== "NOT_ASSESSED");
  if (!assessed.length) return "NOT_ASSESSED";
  return assessed.reduce((a, b) => (FLAG_RANK[b] > FLAG_RANK[a] ? b : a));
}

function rollupOf(rows: SocialComplianceRegisterRow[]): SocialComplianceRollup {
  const r: SocialComplianceRollup = {
    factoryCount: rows.length,
    totalWorkforce: 0, permanentCount: 0, contractCount: 0, apprenticeTraineeCount: 0,
    maleCount: 0, femaleCount: 0, otherGenderCount: 0, migrantWorkerCount: 0, differentlyAbledCount: 0,
    contractPct: 0, femalePct: 0, migrantPct: 0,
    flagCounts: {}, childLabourFlagCount: 0, overtimeFlagCount: 0, wageFlagCount: 0, foaFlagCount: 0,
  };
  let genderTotal = 0;
  for (const x of rows) {
    r.totalWorkforce += x.totalWorkforce;
    r.permanentCount += x.permanentCount;
    r.contractCount += x.contractCount;
    r.apprenticeTraineeCount += x.apprenticeTraineeCount;
    r.maleCount += x.maleCount;
    r.femaleCount += x.femaleCount;
    r.otherGenderCount += x.otherGenderCount;
    genderTotal += x.maleCount + x.femaleCount + x.otherGenderCount;
    r.migrantWorkerCount += x.migrantWorkerCount ?? 0;
    r.differentlyAbledCount += x.differentlyAbledCount ?? 0;
    r.flagCounts[x.effectiveFlag] = (r.flagCounts[x.effectiveFlag] ?? 0) + 1;
    if (x.childLabourFlag) r.childLabourFlagCount++;
    if (x.overtimeFlag) r.overtimeFlagCount++;
    if (x.wageFlag) r.wageFlagCount++;
    if (x.foaFlag) r.foaFlagCount++;
  }
  const r1 = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
  r.contractPct = r1(r.contractCount, r.totalWorkforce);
  r.femalePct = r1(r.femaleCount, genderTotal);
  r.migrantPct = r1(r.migrantWorkerCount, r.totalWorkforce);
  return r;
}

type SortKey =
  | "factoryName" | "state" | "totalWorkforce" | "contractPct" | "femalePct"
  | "migrantWorkerCount" | "youngestWorkerAge" | "sa8000AwarenessTrainingPct" | "effectiveFlag";

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "amber" | "rose" | "emerald" }) {
  const toneCls =
    tone === "rose" ? "text-rose-700" : tone === "amber" ? "text-amber-700" : tone === "emerald" ? "text-emerald-700" : "text-slate-900";
  return (
    <Card className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-none">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={"text-lg font-bold tabular-nums " + toneCls}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </Card>
  );
}

function FlagDot({ flag, title }: { flag: ComplianceFlag; title: string }) {
  return (
    <span
      className={"inline-block h-2.5 w-2.5 rounded-full " + SOCIAL_FLAG_DOT[flag]}
      title={`${title}: ${SOCIAL_FLAG_LABEL[flag]}`}
    />
  );
}

export function SocialRegisterView({ data }: { data: SocialComplianceRegisterResponse }) {
  const canExport = usePermission("FACILITY.EXPORT");
  const allRows = data.items;
  const [stateFilter, setStateFilter] = useState<string | null>(null);
  const [exceptionOnly, setExceptionOnly] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "factoryName", dir: "asc" });

  const states = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of allRows) m.set(r.state, (m.get(r.state) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [allRows]);

  const isException = (r: SocialComplianceRegisterRow) =>
    r.effectiveFlag === "ATTENTION" || r.effectiveFlag === "NON_COMPLIANT";

  const rows = useMemo(() => {
    let out = allRows;
    if (stateFilter) out = out.filter((r) => r.state === stateFilter);
    if (exceptionOnly) out = out.filter(isException);
    const dir = sort.dir === "asc" ? 1 : -1;
    const val = (r: SocialComplianceRegisterRow): number | string => {
      switch (sort.key) {
        case "factoryName": return r.factoryName;
        case "state": return r.state;
        case "effectiveFlag": return FLAG_RANK[r.effectiveFlag];
        case "migrantWorkerCount": return r.migrantWorkerCount ?? 0;
        case "youngestWorkerAge": return r.youngestWorkerAge ?? 0;
        case "sa8000AwarenessTrainingPct": return r.sa8000AwarenessTrainingPct ?? 0;
        default: return r[sort.key] as number;
      }
    };
    return [...out].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * dir;
      return ((va as number) - (vb as number)) * dir;
    });
  }, [allRows, stateFilter, exceptionOnly, sort]);

  const view = useMemo(() => rollupOf(rows), [rows]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function exportCsv() {
    const scope = stateFilter ? `${stateFilter.toLowerCase().replace(/\s+/g, "-")}_` : "";
    downloadCsv(`workforce-sa8000-register_${scope}${stamp()}.csv`, workforceRegisterCsv(rows, view));
  }

  const compliant = view.flagCounts["COMPLIANT"] ?? 0;
  const attention = view.flagCounts["ATTENTION"] ?? 0;
  const nonCompliant = view.flagCounts["NON_COMPLIANT"] ?? 0;

  const SortHead = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <TableHead className={"px-3 py-2.5 " + (className ?? "")}>
      <Button
        type="button"
        variant="ghost"
        onClick={() => toggleSort(k)}
        className="h-auto gap-0.5 p-0 hover:bg-transparent hover:text-slate-700"
      >
        {label}
        {sort.key === k && (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </Button>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      {/* Roll-up strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Group Workforce" value={fmtNum(view.totalWorkforce)} sub={`${view.factoryCount} factories`} />
        <Kpi
          label="Perm / Contract / Appr."
          value={`${fmtNum(view.permanentCount)} / ${fmtNum(view.contractCount)} / ${fmtNum(view.apprenticeTraineeCount)}`}
          sub={`${view.contractPct}% contract`}
        />
        <Kpi label="Female %" value={`${view.femalePct}%`} sub={`${fmtNum(view.femaleCount)} women`} />
        <Kpi label="Migrant %" value={`${view.migrantPct}%`} sub={`${fmtNum(view.migrantWorkerCount)} migrant`} />
        <Kpi
          label="Social-Compliant"
          value={fmtNum(compliant)}
          sub={`of ${view.factoryCount} factories`}
          tone="emerald"
        />
        <Kpi
          label="Attention / Non-Compliant"
          value={`${fmtNum(attention)} / ${fmtNum(nonCompliant)}`}
          sub={view.childLabourFlagCount > 0 ? `${view.childLabourFlagCount} child-labour flag` : "buyer-audit flags"}
          tone={attention + nonCompliant > 0 ? "amber" : undefined}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStateFilter(null)}
            className={cn(
              "h-auto rounded-full border px-2.5 py-1 text-[11px] font-medium",
              stateFilter === null ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            )}
          >
            All states
          </Button>
          {states.map(([s, n]) => (
            <Button
              key={s}
              type="button"
              variant="ghost"
              onClick={() => setStateFilter(s)}
              className={cn(
                "h-auto rounded-full border px-2.5 py-1 text-[11px] font-medium",
                stateFilter === s ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              )}
            >
              {s} <span className="tabular-nums opacity-70">{n}</span>
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setExceptionOnly((v) => !v)}
            className={cn(
              "h-auto inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium",
              exceptionOnly
                ? "border-amber-400 bg-amber-50 text-amber-800"
                : "border-slate-300 bg-white text-slate-700 hover:border-amber-300 hover:text-amber-700"
            )}
            title="Show only factories that would raise a flag in a buyer audit today"
          >
            <Filter size={15} /> Exception lens{exceptionOnly ? ` · ${rows.length}` : ""}
          </Button>
          {canExport && (
            <Button
              type="button"
              variant="outline"
              onClick={exportCsv}
              className="gap-1.5 text-slate-700 hover:border-primary-400 hover:text-primary-700"
            >
              <Download size={15} /> Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Register table */}
      <Card className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-none">
        <Table className="w-full min-w-[1180px] text-sm">
          <TableHeader className="bg-slate-50/95">
            <TableRow className="text-left text-[11px] uppercase tracking-wider text-slate-500">
              <SortHead k="factoryName" label="Factory" />
              <SortHead k="state" label="State" />
              <SortHead k="totalWorkforce" label="Workforce" className="text-right" />
              <TableHead className="px-3 py-2.5 text-right">Perm / Cont / Appr</TableHead>
              <SortHead k="contractPct" label="Contract %" className="text-right" />
              <SortHead k="femalePct" label="Female %" className="text-right" />
              <SortHead k="migrantWorkerCount" label="Migrant" className="text-right" />
              <TableHead className="px-3 py-2.5 text-right">Diff-Abled</TableHead>
              <SortHead k="youngestWorkerAge" label="Youngest" className="text-right" />
              <TableHead className="px-3 py-2.5 text-center">Wage · Hours · FoA · Griev.</TableHead>
              <SortHead k="sa8000AwarenessTrainingPct" label="Training %" className="text-right" />
              <SortHead k="effectiveFlag" label="Social Flag" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const wageDot = worstFlag(r.minimumWageCompliant, r.wagesPaidOnTime);
              const hoursDot = worstFlag(
                r.overtimeVoluntary,
                r.weeklyRestDayProvided,
                r.overtimeFlag ? "ATTENTION" : "COMPLIANT",
              );
              return (
                <TableRow key={r.factoryProfileId} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <TableCell className="px-3 py-2.5">
                    <Link href={`/facilities/${r.factoryProfileId}?tab=Workforce`} className="font-medium text-primary-700 hover:underline">
                      {r.factoryName}
                    </Link>
                    <span className="block text-[10px] text-slate-400">{r.factoryCode}</span>
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-slate-600">{r.state}</TableCell>
                  <TableCell className="px-3 py-2.5 text-right font-semibold tabular-nums">{fmtNum(r.totalWorkforce)}</TableCell>
                  <TableCell className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                    {fmtNum(r.permanentCount)} / {fmtNum(r.contractCount)} / {fmtNum(r.apprenticeTraineeCount)}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-right tabular-nums">{r.contractPct}%</TableCell>
                  <TableCell className="px-3 py-2.5 text-right tabular-nums">{r.femalePct}%</TableCell>
                  <TableCell className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                    {r.migrantWorkerCount != null ? fmtNum(r.migrantWorkerCount) : "—"}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                    {r.differentlyAbledCount != null ? fmtNum(r.differentlyAbledCount) : "—"}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-right tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      {r.youngestWorkerAge ?? "—"}
                      {r.childLabourFlag && (
                        <span title="Child-labour flag: under-18 workers below the hiring-age policy">
                          <Baby size={13} className="text-rose-600" />
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <FlagDot flag={wageDot} title="Wages" />
                      <FlagDot flag={hoursDot} title="Working hours" />
                      <FlagDot flag={r.unionOrWorkerCommitteePresent} title="Freedom of association" />
                      <FlagDot flag={r.grievanceMechanismPresent} title="Grievance mechanism" />
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                    {r.sa8000AwarenessTrainingPct != null ? `${r.sa8000AwarenessTrainingPct}%` : "—"}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <span className={"inline-block rounded border px-2 py-0.5 text-[11px] font-medium " + SOCIAL_FLAG_CHIP[r.effectiveFlag]}>
                      {SOCIAL_FLAG_LABEL[r.effectiveFlag]}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="px-3 py-10 text-center text-sm text-slate-400">
                  {exceptionOnly ? "No factories raise a flag — clean estate for this view." : "No factories match this filter."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Legend / exception summary */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><Users size={13} /> {fmtNum(view.totalWorkforce)} workers across {view.factoryCount} factories</span>
        <span className="inline-flex items-center gap-1.5"><Scale size={13} /> {view.wageFlagCount} wage flag{view.wageFlagCount === 1 ? "" : "s"}</span>
        <span className="inline-flex items-center gap-1.5"><Clock size={13} /> {view.overtimeFlagCount} overtime (&gt;12h) flag{view.overtimeFlagCount === 1 ? "" : "s"}</span>
        <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} /> {view.foaFlagCount} freedom-of-association flag{view.foaFlagCount === 1 ? "" : "s"}</span>
        <span className="inline-flex items-center gap-1.5"><AlertTriangle size={13} className="text-rose-600" /> {view.childLabourFlagCount} child-labour flag{view.childLabourFlagCount === 1 ? "" : "s"}</span>
      </div>
    </div>
  );
}
