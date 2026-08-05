"use client";

// The coverage matrix — the programme's hero visual (docs/cams/08 §4.4).
//
// A 16-site × 10-discipline × 4-quarter matrix does not fit a phone, and
// "desktop only" is exactly the habit this build exists to stop. So the mobile
// design is a real design, not a hidden one:
//
//   **site is the accordion · quarter is the column · discipline is the row**
//
// Four quarter columns fit 390px at 44px touch targets alongside a discipline
// label; sixteen site columns never would. Desktop renders the same data as the
// full 2-D matrix from the same component.
//
// Every cell state comes from ONE accessor (`coverage_for_cycle`). There is no
// stored coverage flag anywhere — that is the direct lesson of F-29, where four
// read paths disagreed about one fact for a month.

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  COVERAGE_META,
  pctLabel,
  siteText,
  type CoverageResponse,
  type CoverageState,
  type PeriodCell,
  type ScopeUnitCoverage,
} from "@/app/(dashboard)/cams/programme/lib-programme";

export function CoverageMatrix({ data }: { data: CoverageResponse }) {
  const [openSites, setOpenSites] = useState<Set<string>>(() => new Set());
  const [detail, setDetail] = useState<{ unit: ScopeUnitCoverage; cell: PeriodCell } | null>(null);

  // Grouped by site id (stable, unique) but LABELLED and SORTED by site name —
  // the site axis is the first thing read, and cuid order is arbitrary to a
  // human. Estate-wide sorts last: it is the catch-all, not a site.
  const bySite = useMemo(() => {
    const m = new Map<string, { label: string; units: ScopeUnitCoverage[] }>();
    for (const u of data.scopeUnits) {
      const key = u.siteId ?? "__estate__";
      const entry = m.get(key) ?? { label: siteText(u), units: [] };
      entry.units.push(u);
      m.set(key, entry);
    }
    return [...m.entries()].sort(([ka, a], [kb, b]) => {
      if (ka === "__estate__") return 1;
      if (kb === "__estate__") return -1;
      return a.label.localeCompare(b.label);
    });
  }, [data.scopeUnits]);

  function toggle(id: string) {
    setOpenSites((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (!data.scopeUnits.length) {
    return (
      <Card className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
        <p className="text-sm text-slate-500">This cycle has no scope units yet.</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
          A scope unit is the atomic covered thing — a site × discipline. The matrix is built from
          them, so it stays empty until at least one exists.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <CycleSummary data={data} />

      {/* ── Mobile: site accordion × quarter columns ───────────────── */}
      <div className="space-y-2 lg:hidden">
        {bySite.map(([siteId, { label, units }]) => {
          const open = openSites.has(siteId);
          const covered = units.reduce((n, u) => n + u.covered, 0);
          const considered = units.reduce((n, u) => n + u.considered, 0);
          return (
            <Card key={siteId} className="overflow-hidden rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => toggle(siteId)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                aria-expanded={open}
              >
                {open ? (
                  <ChevronDown size={15} className="shrink-0 text-slate-400" />
                ) : (
                  <ChevronRight size={15} className="shrink-0 text-slate-400" />
                )}
                <span className="truncate text-sm font-medium text-slate-800" title={label}>
                  {label}
                </span>
                <span className="ml-auto shrink-0 text-xs tabular-nums text-slate-500">
                  {covered}/{considered}
                </span>
              </button>

              {open && (
                <div className="border-t border-slate-100 px-2 pb-3 pt-2">
                  <div
                    className="grid items-center gap-1"
                    style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${data.periods.length}, 44px)` }}
                  >
                    <span />
                    {data.periods.map((p) => (
                      <span key={p.periodIndex} className="text-center text-[10px] text-slate-400">
                        {p.label}
                      </span>
                    ))}

                    {units.map((u) => (
                      <MatrixRow
                        key={u.scopeUnitId}
                        unit={u}
                        onCell={(cell) => setDetail({ unit: u, cell })}
                      />
                    ))}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* ── Desktop: the full 2-D matrix, same data ────────────────── */}
      <Card className="hidden overflow-x-auto rounded-xl border border-slate-200 lg:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-3 py-2 font-medium">Site</th>
              <th className="px-3 py-2 font-medium">Discipline</th>
              <th className="px-2 py-2 text-center font-medium">Req.</th>
              {data.periods.map((p) => (
                <th key={p.periodIndex} className="px-2 py-2 text-center font-medium">
                  {p.label}
                  {p.closed && <span className="ml-1 text-[10px] text-slate-400">closed</span>}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-medium">Coverage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bySite.map(([, { label, units }]) =>
              units.map((u, i) => (
                <tr key={u.scopeUnitId} className="hover:bg-slate-50/60">
                  {i === 0 && (
                    <td
                      rowSpan={units.length}
                      className="border-r border-slate-100 px-3 py-2 align-top text-xs font-medium text-slate-700"
                    >
                      {label}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-800">{u.dimensionLabel}</span>
                      <RiskWeight weight={u.riskWeight} />
                    </div>
                    {u.isWaived && (
                      <div className="text-[10px] text-violet-600">waived · {u.waiverReason}</div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center text-xs tabular-nums text-slate-600">
                    {u.requiredPerCycle ?? "—"}
                    {u.shortfall > 0 && (
                      <span className="ml-1 text-rose-600" title={`${u.shortfall} short`}>
                        −{u.shortfall}
                      </span>
                    )}
                  </td>
                  {u.periods.map((c) => (
                    <td key={c.periodIndex} className="px-1 py-1 text-center">
                      <CellButton cell={c} onClick={() => setDetail({ unit: u, cell: c })} />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center text-xs font-semibold tabular-nums text-slate-700">
                    {pctLabel(u.coveragePct)}
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </Card>

      <Legend />

      {detail && (
        <CellSheet
          unit={detail.unit}
          cell={detail.cell}
          periodLabel={data.periods[detail.cell.periodIndex]?.label ?? ""}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function MatrixRow({
  unit,
  onCell,
}: {
  unit: ScopeUnitCoverage;
  onCell: (cell: PeriodCell) => void;
}) {
  return (
    <>
      <span className="truncate py-1 pr-1 text-[12px] text-slate-700" title={unit.dimensionLabel}>
        {unit.dimensionLabel}
      </span>
      {unit.periods.map((c) => (
        <div key={c.periodIndex} className="flex justify-center py-0.5">
          <CellButton cell={c} onClick={() => onCell(c)} compact />
        </div>
      ))}
    </>
  );
}

function CellButton({
  cell,
  onClick,
  compact = false,
}: {
  cell: PeriodCell;
  onClick: () => void;
  compact?: boolean;
}) {
  const meta = COVERAGE_META[cell.state];
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${meta.label} — ${cell.label}`}
      aria-label={`${meta.label}, ${cell.label}`}
      className={cn(
        "flex items-center justify-center rounded border font-medium transition hover:ring-2 hover:ring-violet-300",
        meta.cell,
        // 40px keeps the touch target usable at 390px without overflowing four
        // columns plus a label.
        compact ? "h-10 w-10 text-[11px]" : "h-8 w-full min-w-[2.75rem] text-[11px]",
      )}
    >
      {cell.total > 0 ? cell.label : meta.glyph}
    </button>
  );
}

function RiskWeight({ weight }: { weight: number }) {
  return (
    <span
      className="text-[10px] text-slate-400"
      title={`Risk weight ${weight}/5 — gaps are ranked by this, not alphabetically`}
    >
      {"▪".repeat(Math.max(1, Math.min(5, weight)))}
    </span>
  );
}

function CycleSummary({ data }: { data: CoverageResponse }) {
  const s = data.summary;
  return (
    <Card className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <div>
          <span className="text-2xl font-extrabold tabular-nums text-slate-900">
            {pctLabel(s.coveragePct)}
          </span>
          <span className="ml-1.5 text-xs text-slate-500">covered</span>
        </div>
        <Stat label="gaps" value={s.gaps} tone={s.gaps ? "text-amber-700" : "text-slate-600"} />
        <Stat label="overdue" value={s.overdue} tone={s.overdue ? "text-rose-700" : "text-slate-600"} />
        <Stat label="by sample only" value={s.sampledOnly} tone="text-teal-700" />
        <Stat label="waived" value={s.waived} tone="text-violet-700" />
        <span className="ml-auto text-[11px] text-slate-400">
          {s.materialisedSlotCount}/{s.slotCount} slots materialised
          {s.unplannedSlotCount > 0 && ` · ${s.unplannedSlotCount} unplanned`}
          {s.externalSlotCount > 0 && ` · ${s.externalSlotCount} external`}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Full coverage means at least {data.thresholdPct}% of a scope unit&rsquo;s checkpoints were
        assessed. Waived units are excluded from the percentage — they are neither a success nor a
        gap.
      </p>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="text-sm">
      <span className={cn("font-bold tabular-nums", tone)}>{value}</span>
      <span className="ml-1 text-xs text-slate-500">{label}</span>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-[11px] text-slate-600">
      <Info size={12} className="text-slate-400" />
      {(Object.keys(COVERAGE_META) as CoverageState[]).map((k) => (
        <span key={k} className="inline-flex items-center gap-1">
          <span className={cn("inline-block size-2.5 rounded-sm", COVERAGE_META[k].dot)} />
          {COVERAGE_META[k].label}
        </span>
      ))}
      <span className="text-slate-400">
        · &ldquo;Covered by sample&rdquo; is a weaker claim than &ldquo;covered&rdquo; and is never
        merged into it
      </span>
    </div>
  );
}

function CellSheet({
  unit,
  cell,
  periodLabel,
  onClose,
}: {
  unit: ScopeUnitCoverage;
  cell: PeriodCell;
  periodLabel: string;
  onClose: () => void;
}) {
  const meta = COVERAGE_META[cell.state];
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">{unit.dimensionLabel}</h3>
          <span className={cn("rounded border px-1.5 py-0.5 text-[11px]", meta.cell)}>
            {meta.label}
          </span>
          <span className="ml-auto text-xs text-slate-500">{periodLabel}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {siteText(unit)} · risk weight {unit.riskWeight}/5
          {unit.requiredPerCycle ? ` · required ${unit.requiredPerCycle}× per cycle` : ""}
        </p>

        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
          <div className="tabular-nums text-slate-800">
            {cell.total > 0 ? `${cell.assessed} of ${cell.total} checkpoints assessed` : "Nothing assessed in this period"}
            {cell.pct != null && <span className="ml-1 text-slate-500">({cell.pct}%)</span>}
          </div>
        </div>

        {unit.isWaived && (
          <p className="mt-2 rounded-lg border border-violet-200 bg-violet-50 p-2 text-[12px] text-violet-800">
            Waived: {unit.waiverReason}
          </p>
        )}

        <h4 className="mt-4 text-xs font-semibold text-slate-700">
          Engagements behind this cell ({cell.engagements.length})
        </h4>
        {cell.engagements.length === 0 ? (
          <p className="mt-1 text-xs text-slate-400">
            No completed engagement covered this scope unit in this period.
          </p>
        ) : (
          <ul className="mt-1.5 space-y-1.5">
            {cell.engagements.map((e) => (
              <li key={e.engagementId} className="rounded-lg border border-slate-200 p-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={
                      e.engagementKind === "AUDIT"
                        ? `/cams/audits/${e.engagementId}`
                        : `/cams/engagements/${e.engagementId}`
                    }
                    className="font-medium text-violet-800 hover:underline"
                  >
                    {e.code}
                  </a>
                  {e.samplingApproach !== "FULL" && (
                    <span className="rounded border border-teal-200 bg-teal-50 px-1 text-[10px] text-teal-800">
                      sampled
                    </span>
                  )}
                  <span className="ml-auto tabular-nums text-slate-500">
                    {e.assessed}/{e.total}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-slate-300 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Close
        </button>
      </div>
    </div>
  );
}
