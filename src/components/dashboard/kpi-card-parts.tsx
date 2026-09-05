"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Diamond,
  MoreHorizontal,
  RefreshCw,
  AlertCircle,
  Info as InfoIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { KpiBand, KpiBenchmarks } from "@/lib/manhours/kpi-registry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── DeltaIndicator ───────────────────────────────────────────────

export interface DeltaProps {
  direction: "UP" | "DOWN" | "FLAT";
  /** Signed percent change vs prior period. May be null for
   *  uncomputable cases (prior was zero). */
  percentChange: number | null;
  /** When true, "UP" is good (e.g. compliance, near miss reporting).
   *  When false, "DOWN" is good (e.g. LTIFR, severity rate). */
  higherIsBetter: boolean;
  /** Optional tooltip context: "1.21 in May 2026 vs 1.38 in April 2026". */
  currentLabel?: string;
  currentValue?: string;
  priorLabel?: string;
  priorValue?: string;
}

/**
 * Direction-aware delta chip. Colour reflects "is this a good move for
 * this KPI?", not the raw sign of the percent change. That's the whole
 * point of `higherIsBetter` — a 10% rise in LTIFR is red, a 10% rise in
 * compliance is green.
 */
export function DeltaIndicator({
  direction,
  percentChange,
  higherIsBetter,
  currentLabel,
  currentValue,
  priorLabel,
  priorValue,
}: DeltaProps) {
  const good = isImproving(direction, higherIsBetter);
  const color = direction === "FLAT" ? "text-slate-500" : good ? "text-emerald-700" : "text-rose-600";
  const Icon = direction === "UP" ? ArrowUpRight : direction === "DOWN" ? ArrowDownRight : Diamond;
  const pctText =
    percentChange == null
      ? "—"
      : direction === "FLAT"
        ? "flat"
        : `${Math.abs(percentChange).toFixed(percentChange < 1 ? 1 : 0)}%`;

  const chip = (
    <span className={cn("inline-flex items-center gap-0.5 text-caption font-numeric tabular-nums", color)}>
      <Icon size={12} strokeWidth={2.5} />
      {pctText}
    </span>
  );

  // Hide tooltip if no context provided — chip stands alone.
  if (!currentLabel && !priorLabel) return chip;

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>{chip}</TooltipTrigger>
        <TooltipContent side="top" className="font-numeric">
          <div className="text-[11px] leading-tight">
            {currentValue && (
              <div>
                <span className="text-slate-300">{currentLabel ?? "Current"}</span>{" "}
                <span className="font-semibold">{currentValue}</span>
              </div>
            )}
            {priorValue && (
              <div>
                <span className="text-slate-300">{priorLabel ?? "Prior"}</span>{" "}
                <span className="font-semibold">{priorValue}</span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function isImproving(direction: "UP" | "DOWN" | "FLAT", higherIsBetter: boolean): boolean {
  if (direction === "FLAT") return true;
  if (higherIsBetter) return direction === "UP";
  return direction === "DOWN";
}

// ─── BenchmarkDots ────────────────────────────────────────────────

export interface BenchmarkProps {
  band: KpiBand | null;
  benchmarks?: KpiBenchmarks;
  higherIsBetter: boolean;
  /** Pretty-formatted current value, for the tooltip ("LTIFR 1.21"). */
  formattedValue?: string;
  /** Unit / KPI name used in the tooltip caption. */
  caption?: string;
}

const BAND_DOT_COUNT: Record<KpiBand, number> = {
  WORLD_CLASS: 4,
  EXCELLENT: 3,
  AVERAGE: 2,
  POOR: 1,
};

const BAND_LABEL: Record<KpiBand, string> = {
  WORLD_CLASS: "World class",
  EXCELLENT: "Excellent",
  AVERAGE: "Average",
  POOR: "Poor",
};

const BAND_COLOR: Record<KpiBand, string> = {
  WORLD_CLASS: "#10b981",
  EXCELLENT: "#84cc16",
  AVERAGE: "#f59e0b",
  POOR: "#ef4444",
};

/**
 * Filled-dot scale showing where the current value lands among the
 * KPI's benchmark bands. 4 dots = world-class; 1 dot = poor. The
 * engine ships 4 bands (no CRITICAL); future band additions extend
 * this map.
 */
export function BenchmarkDots({ band, benchmarks, higherIsBetter, formattedValue, caption }: BenchmarkProps) {
  if (!band) {
    return (
      <span className="inline-flex items-center gap-1.5 text-caption text-slate-400">
        <span className="inline-flex gap-0.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full bg-slate-200" />
          ))}
        </span>
        <span>No benchmark</span>
      </span>
    );
  }

  const filled = BAND_DOT_COUNT[band];
  const color = BAND_COLOR[band];
  const label = BAND_LABEL[band];

  const dots = (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex gap-0.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full transition"
            style={{ backgroundColor: i < filled ? color : "#e2e8f0" }}
          />
        ))}
      </span>
      <span className="text-caption font-medium" style={{ color }}>
        {label}
      </span>
    </span>
  );

  if (!benchmarks) return dots;

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{dots}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1 text-[11px]">
            {caption && <div className="text-slate-300">{caption}</div>}
            {formattedValue && (
              <div>
                <span className="text-slate-300">Current:</span>{" "}
                <span className="font-semibold font-numeric">{formattedValue}</span>
              </div>
            )}
            <div className="border-t border-slate-700 pt-1">
              <BenchmarkRange label="World class" value={benchmarks.worldClass} higherIsBetter={higherIsBetter} top />
              <BenchmarkRange label="Excellent" value={benchmarks.excellent} higherIsBetter={higherIsBetter} />
              <BenchmarkRange label="Average" value={benchmarks.average} higherIsBetter={higherIsBetter} />
              <BenchmarkRange label="Poor" value={benchmarks.poor} higherIsBetter={higherIsBetter} bottom />
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function BenchmarkRange({
  label,
  value,
  higherIsBetter,
  top,
  bottom,
}: {
  label: string;
  value: number;
  higherIsBetter: boolean;
  top?: boolean;
  bottom?: boolean;
}) {
  // For lower-is-better KPIs, "world class" is the lowest threshold —
  // so the display says "≤ 1.0". For higher-is-better it's "≥ 100".
  const sign = top
    ? higherIsBetter
      ? "≥"
      : "≤"
    : bottom
      ? higherIsBetter
        ? "<"
        : ">"
      : higherIsBetter
        ? "≥"
        : "≤";
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-300">{label}</span>
      <span className="font-numeric">
        {sign} {value}
      </span>
    </div>
  );
}

// ─── LiveIndicator ────────────────────────────────────────────────

export interface LiveIndicatorProps {
  /** Timestamp of the last successful data load. */
  lastUpdatedAt: Date;
  /** When true, the dot pulses and the label says "Live". */
  live?: boolean;
  /** Optional refresh handler — clicking the timestamp triggers it. */
  onRefresh?: () => void;
  /** Auto-refresh cadence in seconds (only for the tooltip label). */
  refreshSeconds?: number;
  /** Override the relative-time text (useful for SSR snapshots). */
  relativeOverride?: string;
}

/**
 * Tiny freshness chip. Pulsing dot + "Live" when auto-refreshing;
 * otherwise just a "Updated N min ago" relative-time string with an
 * optional click-to-refresh affordance.
 *
 * The relative-time calc runs client-side via a 30-second interval so
 * a card that stays open through "just now → 1 min ago → 5 min ago"
 * keeps its display current without a re-fetch. The interval clears
 * on unmount; no leaks.
 */
export function LiveIndicator({
  lastUpdatedAt,
  live,
  onRefresh,
  refreshSeconds,
  relativeOverride,
}: LiveIndicatorProps) {
  const [isRefreshing, setRefreshing] = React.useState(false);
  // Force a re-render every 30s so the relative-time string ages
  // ("just now" → "1 min ago" → "5 min ago") without a re-fetch.
  // useReducer with no observable state avoids the eslint "unused
  // setter" warning that a plain useState/setTick pair triggers.
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    const id = setInterval(bump, 30_000);
    return () => clearInterval(id);
  }, []);

  const relative = relativeOverride ?? relativeTime(lastUpdatedAt);

  async function handleRefresh() {
    if (!onRefresh || isRefreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  if (live) {
    return (
      <span className="inline-flex items-center gap-1.5 text-caption text-emerald-700">
        <span className="relative inline-flex h-2 w-2">
          <span className="absolute inset-0 inline-flex h-full w-full animate-pulse-dot rounded-full bg-emerald-500 opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="font-medium">
          Live
          {refreshSeconds != null && (
            <span className="ml-1 text-slate-400">· every {refreshSeconds}s</span>
          )}
        </span>
      </span>
    );
  }

  // suppressHydrationWarning on the relative-time text — server and
  // client may compute different "N min ago" strings if the request
  // window straddles a minute boundary, and the difference is
  // immaterial. Without this, React logs a noisy hydration warning
  // on every card.
  const inner = (
    <span className={cn("inline-flex items-center gap-1 text-caption text-slate-500", onRefresh && "hover:text-slate-700")}>
      <RefreshCw size={10} className={cn("opacity-60", isRefreshing && "animate-spin")} />
      <span suppressHydrationWarning>{relative}</span>
    </span>
  );

  if (!onRefresh) return inner;
  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={isRefreshing}
      className="rounded transition focus:outline-none focus:ring-1 focus:ring-primary-400"
    >
      {inner}
    </button>
  );
}

function relativeTime(d: Date): string {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 30) return "Just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

// ─── KpiCardMenu ─────────────────────────────────────────────────

export interface KpiCardMenuAction {
  label: string;
  icon?: React.ReactNode;
  onSelect?: () => void;
  href?: string;
  disabled?: boolean;
  destructive?: boolean;
}

export interface KpiCardMenuProps {
  /** Primary action — typically "View source records". Rendered above
   *  the separator. Omit to skip the primary group. */
  primary?: KpiCardMenuAction[];
  /** Secondary actions (period, scope, compare, pin, hide, export). */
  secondary?: KpiCardMenuAction[];
  /** Stop click from propagating to a parent card link. */
  stopPropagation?: boolean;
}

/**
 * The three-dot menu in the card's top-right. Renders nothing if no
 * actions are passed — callers can opt out for ultra-minimal variants.
 */
export function KpiCardMenu({ primary, secondary, stopPropagation = true }: KpiCardMenuProps) {
  if (!primary?.length && !secondary?.length) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation();
        }}
      >
        <Button variant="ghost"
          type="button" className="flex h-6 w-6 rounded"
          aria-label="KPI options">
          <MoreHorizontal size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {primary?.length ? (
          <>
            {primary.map((a, i) => (
              <MenuAction key={`p-${i}`} action={a} />
            ))}
            {secondary?.length ? <DropdownMenuSeparator /> : null}
          </>
        ) : null}
        {secondary?.length ? (
          <>
            <DropdownMenuLabel className="text-overline text-slate-500">More</DropdownMenuLabel>
            {secondary.map((a, i) => (
              <MenuAction key={`s-${i}`} action={a} />
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuAction({ action }: { action: KpiCardMenuAction }) {
  const inner = (
    <span className={cn("flex w-full items-center gap-2 text-body", action.destructive && "text-rose-700")}>
      {action.icon}
      {action.label}
    </span>
  );
  if (action.href) {
    return (
      <DropdownMenuItem asChild disabled={action.disabled}>
        <Link href={action.href} onClick={(e) => e.stopPropagation()}>
          {inner}
        </Link>
      </DropdownMenuItem>
    );
  }
  return (
    <DropdownMenuItem
      disabled={action.disabled}
      onSelect={(e) => {
        e.preventDefault();
        action.onSelect?.();
      }}
    >
      {inner}
    </DropdownMenuItem>
  );
}

// ─── KpiCardInfoButton ───────────────────────────────────────────

/**
 * Small info icon next to the KPI title. Hover reveals the formula
 * and a short definition. The brief calls this out as a trust signal —
 * shows the user how the number was actually computed.
 */
export function KpiCardInfoButton({ formula, description }: { formula?: string; description?: string }) {
  if (!formula && !description) return null;
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost"
            type="button"
            onClick={(e) => e.stopPropagation()} className="flex h-4 w-4 rounded"
            aria-label="KPI definition">
            <InfoIcon size={12} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1 text-[11px]">
            {description && <div>{description}</div>}
            {formula && (
              <div className="font-mono text-slate-300 border-t border-slate-700 pt-1">{formula}</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── StaleBadge / ErrorBadge ─────────────────────────────────────

export function StaleBadge() {
  return (
    <Badge variant="neutral" className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-1.5 py-0.5 text-[10px] font-medium text-warning-dark">
      <AlertCircle size={10} /> Stale
    </Badge>
  );
}
