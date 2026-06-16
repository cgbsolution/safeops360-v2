"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { BAND_CHIP, BAND_HEX, type HeatMapCell } from "@/app/(dashboard)/erm/lib";

export function BandBadge({ band, score }: { band: string | null | undefined; score?: number | null }) {
  if (!band) return <span className="text-slate-400 text-xs">—</span>;
  const cls = BAND_CHIP[band.toUpperCase()] ?? "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold", cls)}>
      {score != null && <span className="tabular-nums">{score}</span>}
      {band}
    </span>
  );
}

export function ScorePair({
  inherentScore,
  inherentBand,
  residualScore,
  residualBand,
}: {
  inherentScore?: number | null;
  inherentBand?: string | null;
  residualScore?: number | null;
  residualBand?: string | null;
}) {
  const delta = inherentScore != null && residualScore != null ? residualScore - inherentScore : null;
  return (
    <div className="flex items-center gap-2">
      <BandBadge band={inherentBand} score={inherentScore} />
      <span className="text-slate-400">→</span>
      <BandBadge band={residualBand} score={residualScore} />
      {delta != null && delta < 0 && (
        <span className="text-[10px] font-medium text-emerald-600">▼ {Math.abs(delta)}</span>
      )}
    </div>
  );
}

export function TrendArrow({ trend, delta }: { trend: string; delta?: number }) {
  if (trend === "UP")
    return (
      <span className="inline-flex items-center gap-0.5 text-rose-600" title="Worsened vs last quarter">
        <ArrowUpRight size={14} /> {delta ? `+${delta}` : ""}
      </span>
    );
  if (trend === "DOWN")
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-600" title="Improved vs last quarter">
        <ArrowDownRight size={14} /> {delta ? delta : ""}
      </span>
    );
  return (
    <span className="inline-flex items-center text-slate-400" title="No change">
      <Minus size={14} />
    </span>
  );
}

/**
 * 5×5 risk heat map. Likelihood on the Y axis (5 at top → 1 at bottom),
 * Impact on the X axis (1 → 5). Cells coloured by band and showing the risk
 * count. onCellClick filters the register to that L×I combination.
 */
export function HeatMap({
  cells,
  onCellClick,
  activeCell,
  compact = false,
}: {
  cells: HeatMapCell[];
  onCellClick?: (likelihood: number, impact: number) => void;
  activeCell?: { likelihood: number; impact: number } | null;
  compact?: boolean;
}) {
  const byCell = new Map(cells.map((c) => [`${c.likelihood}-${c.impact}`, c]));
  const size = compact ? "h-10 w-10 text-[11px]" : "h-16 w-16 text-sm";
  const likelihoods = [5, 4, 3, 2, 1];
  const impacts = [1, 2, 3, 4, 5];
  return (
    <div className="inline-flex flex-col gap-1">
      <div className="flex items-stretch gap-1">
        <div className="flex flex-col justify-center pr-1">
          <span className="rotate-180 text-[10px] font-semibold uppercase tracking-wider text-slate-500 [writing-mode:vertical-rl]">
            Likelihood →
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {likelihoods.map((l) => (
            <div key={l} className="flex items-center gap-1">
              <span className="w-4 text-right text-[10px] font-semibold text-slate-400">{l}</span>
              {impacts.map((i) => {
                const c = byCell.get(`${l}-${i}`);
                const band = c?.band ?? "LOW";
                const count = c?.count ?? 0;
                const isActive = activeCell?.likelihood === l && activeCell?.impact === i;
                return (
                  <button
                    key={`${l}-${i}`}
                    type="button"
                    onClick={() => onCellClick?.(l, i)}
                    title={`Likelihood ${l} × Impact ${i} = ${l * i} (${band}) — ${count} risk(s)`}
                    className={cn(
                      "flex items-center justify-center rounded font-bold text-white transition-all",
                      size,
                      onCellClick && "cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-slate-400",
                      isActive && "ring-2 ring-offset-1 ring-slate-900",
                      count === 0 && "opacity-40",
                    )}
                    style={{ backgroundColor: BAND_HEX[band] ?? "#94a3b8" }}
                    disabled={!onCellClick}
                  >
                    {count > 0 ? count : ""}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="flex items-center gap-1 pl-5">
            {impacts.map((i) => (
              <span key={i} className={cn("text-center text-[10px] font-semibold text-slate-400", compact ? "w-10" : "w-16")}>
                {i}
              </span>
            ))}
          </div>
          <div className="pl-5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500" style={{ width: compact ? 11 * 4 + 50 : 17 * 5 + 4 }}>
            Impact →
          </div>
        </div>
      </div>
    </div>
  );
}

export function KpiTile({
  label,
  value,
  tone = "neutral",
  href,
  sub,
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "critical" | "high" | "good" | "warn";
  href?: string;
  sub?: string;
}) {
  const toneCls: Record<string, string> = {
    neutral: "text-slate-900",
    critical: "text-rose-600",
    high: "text-orange-600",
    good: "text-emerald-600",
    warn: "text-amber-600",
  };
  const inner = (
    <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <span className={cn("text-2xl font-bold tabular-nums", toneCls[tone])}>{value}</span>
      {sub && <span className="text-[11px] text-slate-400">{sub}</span>}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}
