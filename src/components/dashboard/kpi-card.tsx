"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, LucideIcon, RefreshCw, Compass, Pin, EyeOff, FileDown, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkline, type SparkPoint } from "./sparkline";
import {
  DeltaIndicator,
  BenchmarkDots,
  LiveIndicator,
  KpiCardMenu,
  KpiCardInfoButton,
  StaleBadge,
  type DeltaProps,
  type KpiCardMenuAction,
} from "./kpi-card-parts";
import type { KpiResult } from "@/lib/manhours/kpi-engine";

// ─── Public API ───────────────────────────────────────────────────

export type KpiCardSize = "compact" | "default" | "feature";
export type KpiCardState = "ready" | "loading" | "empty" | "error" | "stale";

/** Trend input for KpiCard. Direction-aware colour is resolved inside
 *  the card from `kpi.higherIsBetter`, so callers don't repeat it. */
export type KpiCardTrend = Omit<DeltaProps, "higherIsBetter">;

export interface KpiCardProps {
  /** Engine output. The card derives nearly everything from this. */
  kpi: KpiResult;
  /** Trend comparison vs prior period. Omit to hide the delta chip. */
  trend?: KpiCardTrend | null;
  /** Last-13-month points feeding the sparkline. The last point should
   *  be the current period (caller's job). Omit to hide the sparkline. */
  sparkline?: SparkPoint[] | null;
  /** Optional 1-sentence description, shown in the info-icon popover. */
  description?: string;
  /** Human unit, displayed under the value (e.g. "per million hours"). */
  unit?: string;
  /** Footer hint text. Defaults to the KpiResult.period.label. */
  periodLabel?: string;
  /** When provided, the whole card becomes a link to the drill-down. */
  drillDownHref?: string;
  /** Live-indicator state. When omitted, no live chip is rendered. */
  liveIndicator?: {
    lastUpdatedAt: Date;
    live?: boolean;
    refreshSeconds?: number;
    onRefresh?: () => void | Promise<void>;
  };
  /** Size variant. */
  size?: KpiCardSize;
  /** Rendering state. Defaults to "ready". */
  state?: KpiCardState;
  /** Error message for state="error". */
  error?: string;
  /** Retry handler for state="error". */
  onRetry?: () => void;
  /** Extra context line for "feature" variant (e.g. "Best month since
   *  Feb 2024"). Ignored on compact / default. */
  context?: React.ReactNode;
  /** Lead icon. Subtle — sits in the header next to the title. */
  icon?: LucideIcon;
  /** Override / extend the default menu actions. Pass `false` to hide. */
  menuActions?: KpiCardMenuActions | false;
  /** Card-level className. */
  className?: string;
}

export interface KpiCardMenuActions {
  primary?: KpiCardMenuAction[];
  secondary?: KpiCardMenuAction[];
}

// ─── Layout maths ─────────────────────────────────────────────────

const SIZE_MAP: Record<KpiCardSize, {
  padding: string;
  valueClass: string;
  sparkline: { width: number; height: number };
  showBenchmark: boolean;
  showInfo: boolean;
  showFooter: boolean;
  showMenu: boolean;
  gap: string;
}> = {
  compact: {
    padding: "p-4",
    valueClass: "text-2xl font-bold",
    sparkline: { width: 80, height: 24 },
    showBenchmark: false,
    showInfo: false,
    showFooter: false,
    showMenu: false,
    gap: "gap-2",
  },
  default: {
    padding: "p-5",
    valueClass: "text-display-2",
    sparkline: { width: 120, height: 32 },
    showBenchmark: true,
    showInfo: true,
    showFooter: true,
    showMenu: true,
    gap: "gap-3",
  },
  feature: {
    padding: "p-6",
    valueClass: "text-display-1",
    sparkline: { width: 200, height: 48 },
    showBenchmark: true,
    showInfo: true,
    showFooter: true,
    showMenu: true,
    gap: "gap-4",
  },
};

// ─── KpiCard ──────────────────────────────────────────────────────

/**
 * The signature card. Every dashboard's hero metric, secondary metric,
 * and compact mini-tile is the same component rendered with different
 * size + state. Composes Sparkline + DeltaIndicator + BenchmarkDots +
 * LiveIndicator + KpiCardMenu around a KPI engine result.
 *
 * Behaviour:
 *   • Entire card is clickable when drillDownHref is set; hover lifts
 *     subtly via elevation-hover.
 *   • State machine: loading → ready → stale → error. Each state has
 *     identical outer dimensions so transitions cause no CLS.
 *   • Sparkline colour resolves from the KPI's band (good = green,
 *     watch = amber, problem = red, none = neutral).
 *   • The menu sits inside the card but stops propagation so clicking
 *     "View source records" doesn't double-navigate.
 *
 * Not handled here (deliberately):
 *   • Period / scope pickers — those are global, fed via search params.
 *   • Drag-drop reorder — Commit 4 wraps the card in a Sortable.
 *   • Auto-refresh — fired by the caller via liveIndicator.onRefresh
 *     on a setInterval the page owns. The card is presentational.
 */
export function KpiCard(props: KpiCardProps) {
  const { state = "ready" } = props;
  if (state === "loading") return <KpiCardSkeleton size={props.size ?? "default"} className={props.className} />;
  if (state === "error") return <KpiCardError {...props} />;
  if (state === "empty") return <KpiCardEmpty {...props} />;
  return <KpiCardReady {...props} />;
}

function KpiCardReady(props: KpiCardProps) {
  const {
    kpi,
    trend,
    sparkline,
    description,
    unit,
    periodLabel,
    drillDownHref,
    liveIndicator,
    size = "default",
    state = "ready",
    context,
    icon: Icon,
    menuActions,
    className,
  } = props;

  const cfg = SIZE_MAP[size];
  const sparkColor = sparklineColor(kpi);
  const showFooter = cfg.showFooter;
  const resolvedMenu = menuActions === false ? null : resolveMenuActions(kpi, drillDownHref, menuActions, liveIndicator);

  const inner = (
    <div className={cn("flex h-full flex-col", cfg.padding, cfg.gap)}>
      {/* Header — label, info, menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {Icon && <Icon size={12} className="text-slate-400 flex-shrink-0" />}
          <span className="text-overline text-slate-500 truncate" title={kpi.kpiName}>
            {kpi.kpiName}
          </span>
          {cfg.showInfo && <KpiCardInfoButton formula={kpi.formula} description={description} />}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {state === "stale" && <StaleBadge />}
          {cfg.showMenu && resolvedMenu && (
            <KpiCardMenu primary={resolvedMenu.primary} secondary={resolvedMenu.secondary} />
          )}
        </div>
      </div>

      {/* Value + delta */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className={cn(cfg.valueClass, "font-numeric leading-none text-slate-900")}>{kpi.formattedValue}</div>
          {unit && <div className="mt-1.5 text-caption text-slate-500">{unit}</div>}
        </div>
        {trend && trend.percentChange !== null && (
          <div className="flex flex-col items-end gap-0.5 pb-1">
            <DeltaIndicator
              direction={trend.direction}
              percentChange={trend.percentChange}
              higherIsBetter={kpi.higherIsBetter}
              currentLabel={kpi.period.label}
              currentValue={kpi.formattedValue}
              priorLabel={trend.priorLabel}
              priorValue={trend.priorValue}
            />
            {trend.priorLabel && (
              <div className="text-[10px] text-slate-400">vs {trend.priorLabel}</div>
            )}
          </div>
        )}
      </div>

      {/* Feature-variant context */}
      {size === "feature" && context && (
        <div className="text-caption text-slate-500">{context}</div>
      )}

      {/* Sparkline + benchmark */}
      {(sparkline || cfg.showBenchmark) && (
        <div className="flex items-center justify-between gap-3 mt-auto">
          {sparkline && sparkline.length > 0 ? (
            <Sparkline
              data={sparkline}
              width={cfg.sparkline.width}
              height={cfg.sparkline.height}
              color={sparkColor}
              ariaLabel={`${kpi.kpiName} trend, ${sparkline.length} periods`}
              formatValue={(v) => formatForSparkline(v, kpi)}
            />
          ) : (
            <span className="text-caption text-slate-300">—</span>
          )}
          {cfg.showBenchmark && (
            <BenchmarkDots
              band={kpi.band}
              benchmarks={kpi.benchmarks}
              higherIsBetter={kpi.higherIsBetter}
              formattedValue={kpi.formattedValue}
              caption={kpi.kpiName}
            />
          )}
        </div>
      )}

      {/* Footer — period, live indicator, drill arrow */}
      {showFooter && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 -mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-caption text-slate-500 truncate">{periodLabel ?? kpi.period.label}</span>
            {liveIndicator && (
              <>
                <span className="text-slate-200">·</span>
                <LiveIndicator
                  lastUpdatedAt={liveIndicator.lastUpdatedAt}
                  live={liveIndicator.live}
                  refreshSeconds={liveIndicator.refreshSeconds}
                  onRefresh={liveIndicator.onRefresh}
                />
              </>
            )}
          </div>
          {drillDownHref && (
            <span className="text-caption text-primary-600 group-hover:text-primary-700 flex items-center gap-0.5 transition">
              <ArrowRight size={12} className="transition group-hover:translate-x-0.5" />
            </span>
          )}
        </div>
      )}
    </div>
  );

  const cardClass = cn(
    "h-full overflow-hidden transition duration-200",
    "elevation-1",
    drillDownHref && "group cursor-pointer hover:elevation-hover hover:border-primary-200",
    state === "stale" && "border-warning-bg",
    className
  );

  if (drillDownHref) {
    return (
      <Link href={drillDownHref} className="block h-full">
        <Card className={cardClass}>{inner}</Card>
      </Link>
    );
  }
  return <Card className={cardClass}>{inner}</Card>;
}

// ─── Skeleton ────────────────────────────────────────────────────

export function KpiCardSkeleton({ size = "default", className }: { size?: KpiCardSize; className?: string }) {
  const cfg = SIZE_MAP[size];
  return (
    <Card className={cn("h-full elevation-1 animate-fade-in", className)}>
      <div className={cn("flex h-full flex-col", cfg.padding, cfg.gap)}>
        <div className="h-3 w-32 rounded skeleton-shimmer" />
        <div className={cn("rounded skeleton-shimmer", size === "compact" ? "h-7 w-20" : size === "feature" ? "h-12 w-36" : "h-9 w-28")} />
        {cfg.showBenchmark && (
          <div className="flex items-center justify-between gap-3 mt-auto">
            <div className="h-6 rounded skeleton-shimmer" style={{ width: cfg.sparkline.width }} />
            <div className="h-3 w-20 rounded skeleton-shimmer" />
          </div>
        )}
        {cfg.showFooter && (
          <div className="border-t border-slate-100 pt-3 -mb-1">
            <div className="h-3 w-24 rounded skeleton-shimmer" />
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Empty ───────────────────────────────────────────────────────

function KpiCardEmpty(props: KpiCardProps) {
  const { kpi, size = "default", className } = props;
  const cfg = SIZE_MAP[size];
  return (
    <Card className={cn("h-full elevation-1", className)}>
      <div className={cn("flex h-full flex-col", cfg.padding, cfg.gap)}>
        <div className="text-overline text-slate-500">{kpi?.kpiName ?? "—"}</div>
        <div className={cn(cfg.valueClass, "font-numeric leading-none text-slate-300")}>—</div>
        <div className="text-body text-slate-500 mt-auto">Not enough data yet</div>
      </div>
    </Card>
  );
}

// ─── Error ───────────────────────────────────────────────────────

function KpiCardError(props: KpiCardProps) {
  const { kpi, size = "default", error, onRetry, className } = props;
  const cfg = SIZE_MAP[size];
  return (
    <Card className={cn("h-full elevation-1 border-rose-200 bg-rose-50/40", className)}>
      <div className={cn("flex h-full flex-col", cfg.padding, cfg.gap)}>
        <div className="text-overline text-rose-700">{kpi?.kpiName ?? "Unknown KPI"}</div>
        <div className="text-body text-rose-700 font-medium">Unable to compute</div>
        {error && <div className="text-caption text-rose-600/80 break-words">{error}</div>}
        {onRetry && (
          <Button onClick={onRetry} size="sm" variant="outline" className="mt-auto w-fit gap-1.5">
            <RefreshCw size={12} /> Try again
          </Button>
        )}
      </div>
    </Card>
  );
}

// ─── Defaults — colour / formatting / menu ───────────────────────

/** Pick the sparkline stroke colour from the KPI's current band. The
 *  trendline communicates "where you are" at a glance — colour is the
 *  fastest channel for that. */
function sparklineColor(kpi: KpiResult): string {
  if (!kpi.band) return "#7c3aed"; // brand purple — informational
  switch (kpi.band) {
    case "WORLD_CLASS":
      return "#10b981";
    case "EXCELLENT":
      return "#84cc16";
    case "AVERAGE":
      return "#f59e0b";
    case "POOR":
      return "#ef4444";
  }
}

/** Sparkline values come straight from KpiResult.value (engine output).
 *  This formatter keeps the tooltip numbers aligned with how the card
 *  itself displays the value, so the user can mentally compare. */
function formatForSparkline(v: number, kpi: KpiResult): string {
  // Heuristic: percentage KPIs round to whole, currency KPIs are
  // integer-only (with grouping), everything else two decimals.
  if (kpi.formattedValue.endsWith("%")) return `${v.toFixed(1)}%`;
  if (kpi.formattedValue.startsWith("₹")) return `₹${Math.round(v).toLocaleString("en-IN")}`;
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString("en-IN");
  return v.toFixed(2);
}

function resolveMenuActions(
  kpi: KpiResult,
  drillDownHref?: string,
  override?: KpiCardMenuActions,
  liveIndicator?: KpiCardProps["liveIndicator"]
): KpiCardMenuActions | null {
  const primary: KpiCardMenuAction[] = [];
  if (drillDownHref) {
    primary.push({
      label: "View source records",
      icon: <Compass size={14} />,
      href: drillDownHref,
    });
  }
  if (override?.primary) primary.push(...override.primary);

  const secondary: KpiCardMenuAction[] = [];
  if (liveIndicator?.onRefresh) {
    secondary.push({
      label: "Refresh now",
      icon: <RefreshCw size={14} />,
      onSelect: () => liveIndicator.onRefresh?.(),
    });
  }
  secondary.push(
    { label: "Compare to…", icon: <Activity size={14} />, disabled: true },
    { label: "Pin to top", icon: <Pin size={14} />, disabled: true },
    { label: "Hide from dashboard", icon: <EyeOff size={14} />, disabled: true },
    { label: "Export CSV", icon: <FileDown size={14} />, disabled: true }
  );
  if (override?.secondary) secondary.push(...override.secondary);

  if (primary.length === 0 && secondary.length === 0) return null;
  return { primary: primary.length ? primary : undefined, secondary };
}

// KpiCardLegacy is intentionally NOT in this file. It lives in
// ./kpi-card-legacy.tsx (no "use client") so the existing
// /dashboard/page.tsx server component can pass it Lucide icon
// functions as props — those would fail the RSC serialiser if the
// adapter were inside this client module. Delete the legacy file in
// Commit 3 when /dashboard/page.tsx adopts the engine-driven API.
