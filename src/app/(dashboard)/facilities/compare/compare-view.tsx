"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { complianceBand, BAND_HEX, fmtNum, fmtDate, type FactoryProfile } from "../lib";
import { Card } from "@/components/ui/card";

type Row = { label: string; get: (f: FactoryProfile) => string; tone?: (f: FactoryProfile) => string | undefined; best?: "high" | "low" };

const ROWS: Row[] = [
  { label: "Compliance score", get: (f) => (f.metrics?.auditComplianceScorePct != null ? `${f.metrics.auditComplianceScorePct}%` : "—"), tone: (f) => (f.metrics?.auditComplianceScorePct != null ? BAND_HEX[complianceBand(f.metrics.auditComplianceScorePct)] : undefined), best: "high" },
  { label: "Open findings", get: (f) => fmtNum(f.metrics?.openFindings ?? 0), best: "low" },
  { label: "Critical findings", get: (f) => fmtNum(f.metrics?.criticalFindings ?? 0), best: "low" },
  { label: "Open CAPAs", get: (f) => fmtNum(f.metrics?.openCapas ?? 0), best: "low" },
  { label: "Overdue CAPAs", get: (f) => fmtNum(f.metrics?.overdueCapas ?? 0), tone: (f) => ((f.metrics?.overdueCapas ?? 0) > 0 ? "#dc2626" : undefined), best: "low" },
  { label: "Open obligations", get: (f) => fmtNum(f.metrics?.openObligations ?? 0), best: "low" },
  { label: "Incidents (12m)", get: (f) => fmtNum(f.metrics?.incidentCount12m ?? 0), best: "low" },
  { label: "Certs (expiring)", get: (f) => `${f.certCount} (${f.certsExpiringCount})`, best: "low" },
  { label: "Employees", get: (f) => fmtNum(f.totalEmployees) },
  { label: "Buildings", get: (f) => fmtNum(f.buildingCount) },
  { label: "Last audit", get: (f) => fmtDate(f.metrics?.lastAuditDate) },
];

export function CompareView({ factories }: { factories: FactoryProfile[] }) {
  const [selected, setSelected] = useState<string[]>(factories.slice(0, Math.min(3, factories.length)).map((f) => f.id));
  const chosen = factories.filter((f) => selected.includes(f.id));

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {factories.map((f) => (
          <Button
            key={f.id}
            type="button"
            variant="ghost"
            onClick={() => toggle(f.id)}
            className={cn(
              "h-auto rounded-full border px-3 py-1 text-xs font-medium",
              selected.includes(f.id) ? "border-primary-600 bg-primary-50 text-primary-700" : "border-slate-200 bg-white text-slate-500 hover:border-slate-400"
            )}
          >
            {f.factoryName}
          </Button>
        ))}
      </div>

      {chosen.length < 2 ? (
        <Card className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400 shadow-none">
          Select at least two factories to compare.
        </Card>
      ) : (
        <Card className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-none">
          <Table className="w-full min-w-[640px] text-sm">
            <TableHeader className="bg-slate-50/95">
              <TableRow className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                <TableHead className="px-3 py-2.5">Metric</TableHead>
                {chosen.map((f) => (
                  <TableHead key={f.id} className="px-3 py-2.5">
                    {f.factoryName}
                    <span className="block text-[10px] font-normal normal-case text-slate-400">{[f.city, f.state].filter(Boolean).join(", ")}</span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map((r) => {
                // highlight best/worst
                const nums = chosen.map((f) => parseFloat(r.get(f)));
                const valid = nums.filter((n) => !Number.isNaN(n));
                const best = r.best && valid.length ? (r.best === "high" ? Math.max(...valid) : Math.min(...valid)) : null;
                return (
                  <TableRow key={r.label} className="border-t border-slate-100">
                    <TableCell className="px-3 py-2.5 text-slate-500">{r.label}</TableCell>
                    {chosen.map((f) => {
                      const v = r.get(f);
                      const n = parseFloat(v);
                      const isBest = best != null && !Number.isNaN(n) && n === best && valid.length > 1;
                      return (
                        <TableCell key={f.id} className="px-3 py-2.5 font-medium tabular-nums" style={{ color: r.tone?.(f) }}>
                          {v}
                          {isBest && <span className="ml-1 rounded bg-emerald-100 px-1 text-[9px] font-semibold text-emerald-700">BEST</span>}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
