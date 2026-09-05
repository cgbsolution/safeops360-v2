"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Printer, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HeatMap, BandBadge } from "@/components/erm/shared";
import { Card } from "@/components/ui/card";
import {
  bandForScore,
  type DashboardSummary,
  type HeatMapCell,
  type RiskListItem,
  type RiskListResponse,
} from "../lib";

type Mode = "INHERENT" | "RESIDUAL" | "BOTH";

// Recompute residual heat-map cells from a (filtered) risk list, so category
// filtering updates the matrix counts live.
function computeResidualCells(risks: RiskListItem[]): HeatMapCell[] {
  const map = new Map<string, HeatMapCell>();
  for (let l = 1; l <= 5; l++) {
    for (let i = 1; i <= 5; i++) {
      map.set(`${l}-${i}`, {
        likelihood: l,
        impact: i,
        count: 0,
        score: l * i,
        band: bandForScore(l * i) ?? "LOW",
        riskIds: [],
      });
    }
  }
  for (const r of risks) {
    const l = r.residualLikelihood;
    const i = r.residualImpact;
    if (l == null || i == null) continue;
    const cell = map.get(`${l}-${i}`);
    if (cell) {
      cell.count += 1;
      cell.riskIds.push(r.id);
    }
  }
  return [...map.values()];
}

export function HeatmapExplorer({ summary, risks }: { summary: DashboardSummary; risks: RiskListResponse }) {
  const [mode, setMode] = useState<Mode>("RESIDUAL");
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [activeBusinessUnits, setActiveBusinessUnits] = useState<Set<string>>(new Set());
  const [activeCell, setActiveCell] = useState<{ likelihood: number; impact: number } | null>(null);

  // Category chips derived from the risk list
  const categories = useMemo(() => {
    const m = new Map<string, { name: string; color: string }>();
    for (const r of risks.items) {
      if (r.categoryCode && !m.has(r.categoryCode)) {
        m.set(r.categoryCode, { name: r.categoryName ?? r.categoryCode, color: r.categoryColor ?? "#475569" });
      }
    }
    return [...m.entries()].map(([code, v]) => ({ code, ...v }));
  }, [risks.items]);

  // Distinct business units / departments present in the loaded risks.
  const businessUnits = useMemo(() => {
    const set = new Set<string>();
    for (const r of risks.items) {
      if (r.businessUnit) set.add(r.businessUnit);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [risks.items]);

  const filteredRisks = useMemo(() => {
    return risks.items.filter((r) => {
      if (activeCategories.size > 0 && !(r.categoryCode != null && activeCategories.has(r.categoryCode))) {
        return false;
      }
      if (activeBusinessUnits.size > 0 && !(r.businessUnit != null && activeBusinessUnits.has(r.businessUnit))) {
        return false;
      }
      return true;
    });
  }, [risks.items, activeCategories, activeBusinessUnits]);

  // Residual cells recomputed from the filtered list. Inherent cells come from the
  // server summary (the risk list only carries residual L/I), and are not
  // category-filterable client-side — labelled accordingly.
  const residualCells = useMemo(() => computeResidualCells(filteredRisks), [filteredRisks]);
  const inherentCells = summary.inherentHeatMap;

  function onCell(l: number, i: number) {
    setActiveCell((prev) => (prev && prev.likelihood === l && prev.impact === i ? null : { likelihood: l, impact: i }));
  }

  function toggleCategory(code: string) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
    setActiveCell(null);
  }

  function toggleBusinessUnit(bu: string) {
    setActiveBusinessUnits((prev) => {
      const next = new Set(prev);
      if (next.has(bu)) next.delete(bu);
      else next.add(bu);
      return next;
    });
    setActiveCell(null);
  }

  // Risks sitting on the active cell. Only meaningful for residual L/I — the risk
  // list does not carry inherent L/I, so in inherent mode we only show counts.
  const cellRisks = useMemo(() => {
    if (!activeCell) return [];
    if (mode === "INHERENT") return [];
    return filteredRisks.filter(
      (r) => r.residualLikelihood === activeCell.likelihood && r.residualImpact === activeCell.impact,
    );
  }, [activeCell, filteredRisks, mode]);

  const showResidual = mode === "RESIDUAL" || mode === "BOTH";
  const showInherent = mode === "INHERENT" || mode === "BOTH";

  return (
    <div className="space-y-5">
      {/* Controls */}
      <Card className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 print:hidden shadow-none">
        <Card className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium shadow-none">
          {(["INHERENT", "RESIDUAL", "BOTH"] as const).map((m) => (
            <Button
              key={m}
              variant="ghost"
              onClick={() => {
                setMode(m);
                setActiveCell(null);
              }}
              className={cn(
                "h-auto rounded-md px-3 py-1.5 transition-all",
                mode === m ? "bg-white text-primary-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {m === "INHERENT" ? "Inherent" : m === "RESIDUAL" ? "Residual" : "Both (side-by-side)"}
            </Button>
          ))}
        </Card>

        <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <Filter size={13} /> Category
        </span>
        {categories.map((c) => {
          const active = activeCategories.has(c.code);
          return (
            <Button
              key={c.code}
              type="button"
              variant="ghost"
              onClick={() => toggleCategory(c.code)}
              className={cn(
                "h-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
              )}
              title={c.name}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
              {c.code}
            </Button>
          );
        })}

        {businessUnits.length > 0 && (
          <>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Filter size={13} /> Department
            </span>
            {businessUnits.map((bu) => {
              const active = activeBusinessUnits.has(bu);
              return (
                <Button
                  key={bu}
                  type="button"
                  variant="ghost"
                  onClick={() => toggleBusinessUnit(bu)}
                  className={cn(
                    "h-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                  )}
                  title={bu}
                >
                  {bu}
                </Button>
              );
            })}
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <a
            href="/api/erm/reports/register.csv"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400"
          >
            <Download size={14} /> Download CSV
          </a>
          <Button
            type="button"
            variant="outline"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:border-slate-400"
          >
            <Printer size={14} /> Export PNG (print)
          </Button>
        </div>
      </Card>

      {/* Matrices */}
      <div className={"grid gap-5 " + (mode === "BOTH" ? "lg:grid-cols-2" : "grid-cols-1")}>
        {showResidual && (
          <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Residual Exposure</h2>
              <p className="text-xs text-slate-500">
                After current controls · {filteredRisks.length} risk(s)
                {(activeCategories.size > 0 || activeBusinessUnits.size > 0) && " (filtered)"}
              </p>
            </div>
            <div className="flex justify-center py-2">
              <HeatMap cells={residualCells} onCellClick={onCell} activeCell={activeCell} />
            </div>
          </Card>
        )}

        {showInherent && (
          <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Inherent Exposure</h2>
              <p className="text-xs text-slate-500">
                Before controls · enterprise totals
                {activeCategories.size > 0 && " (category filter applies to residual only)"}
              </p>
            </div>
            <div className="flex justify-center py-2">
              <HeatMap cells={inherentCells} onCellClick={mode === "INHERENT" ? onCell : undefined} activeCell={mode === "INHERENT" ? activeCell : undefined} />
            </div>
          </Card>
        )}
      </div>

      <p className="text-center text-[11px] text-slate-400 print:hidden">
        This matrix is board-pack quality — print to PDF/PNG or download the register CSV for the audit committee.
      </p>

      {/* Cell drilldown */}
      {activeCell && (
        <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Cell L{activeCell.likelihood} × I{activeCell.impact}
              <span className="ml-2 text-xs font-normal text-slate-500">
                score {activeCell.likelihood * activeCell.impact} ·{" "}
                <span className="font-medium">{bandForScore(activeCell.likelihood * activeCell.impact)}</span>
              </span>
            </h2>
            <Button variant="ghost" onClick={() => setActiveCell(null)} className="text-xs">
              Clear
            </Button>
          </div>
          {mode === "INHERENT" ? (
            <p className="py-4 text-center text-xs text-slate-400">
              Per-cell risk lists are available in residual mode (the register carries residual likelihood × impact). Switch to
              Residual or Both to see the risks on this cell.
            </p>
          ) : cellRisks.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">No risks on this cell.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {cellRisks.map((r) => (
                <Link
                  key={r.id}
                  href={`/erm/register/${r.id}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs hover:border-primary-700 hover:bg-slate-50"
                >
                  <span className="font-semibold tabular-nums text-primary-700">{r.riskCode}</span>
                  <span className="max-w-[200px] truncate text-slate-600">{r.title}</span>
                  <BandBadge band={r.residualBand} score={r.residualScore} />
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
