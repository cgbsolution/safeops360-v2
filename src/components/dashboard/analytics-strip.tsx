"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline, type SparkPoint } from "./sparkline";

// ─────────────────────────────────────────────────────────────────────
// AnalyticsStrip — the one canonical aggregate band that sits between a
// module's page header and its data list.
//
// The brief (UI Depth sprint, Deliverable 2) calls for ONE strip design
// learned once and recognised everywhere:
//
//   [KPI-1] [KPI-2] [KPI-3] │ [SPARKLINE] │ [ALERT CHIPS]
//   primary  secondary tert.   12-mo trend    overdue / gap
//
// This file is purely PRESENTATIONAL — it takes already-computed data and
// renders it. Each module ships a tiny async server component that does
// its own data fetch (respecting that module's RBAC scope) and hands the
// result here. That keeps the strip:
//   • testable in isolation (no DB / no backend),
//   • identical across every module,
//   • independent of the list below it (the loader lives in its own
//     <Suspense> boundary, so a slow strip never blocks the list, and a
//     failed strip renders an empty band instead of nuking the page).
//
// Not a client component: it has no state. It renders <Sparkline> (which
// IS a client component) — a server→client boundary that Next handles
// transparently. Keeping the strip server-renderable means a module page
// can drop it straight into its server-component tree.
// ─────────────────────────────────────────────────────────────────────

export type StripTone = "good" | "bad" | "neutral";

/** Period-over-period change for a tile. The LOADER resolves `tone`
 *  (direction-aware: a rise in compliance is good, a rise in overdue
 *  backlog is bad) so this component stays dumb about KPI semantics. */
export interface StripDelta {
  /** e.g. "+3 this month" or "12% vs last mo". No arrow glyph — the
   *  badge renders its own directional icon. */
  text: string;
  direction: "up" | "down" | "flat";
  tone: StripTone;
  /** Optional native-title tooltip ("18 in May vs 15 in Apr"). */
  tooltip?: string;
}

/** A small inline chip pinned to a tile — e.g. the on-time-% chip on a
 *  "Closed MTD" tile. Distinct from the right-hand alert chips. */
export interface StripBadge {
  text: string;
  tone: StripTone;
}

export interface StripTile {
  label: string;
  value: string | number;
  delta?: StripDelta | null;
  badge?: StripBadge | null;
  /** When set, the whole tile becomes a drill-down link. */
  href?: string;
  /** KPI-1 ("primary") renders a touch larger. */
  emphasis?: boolean;
}

/** Right-hand alert chip. Clickable → navigates to the module filtered to
 *  the alerted items. Shown even at count 0 (greyed) — absence of an alert
 *  is itself information, per the brief. */
export interface StripAlert {
  /** Short uppercase label, e.g. "OVERDUE", "HIGH SEVERITY". */
  label: string;
  count: number;
  /** red / amber / grey. Forced grey when count is 0. */
  tone: "bad" | "warn" | "neutral";
  href: string;
}

export interface AnalyticsStripData {
  /** 1–3 KPI tiles. The first is treated as the primary metric. */
  tiles: StripTile[];
  /** 12-month trend of the primary metric. Hidden on mobile. */
  sparkline?: { points: SparkPoint[]; color?: string; label?: string } | null;
  /** Up to 3 alert chips; the component renders at most 3. */
  alerts?: StripAlert[];
}

// ─── Component ────────────────────────────────────────────────────────

export function AnalyticsStrip({ data, className }: { data: AnalyticsStripData; className?: string }) {
  const { tiles, sparkline, alerts = [] } = data;
  const hasSpark = !!sparkline && sparkline.points.length > 0;
  const visibleAlerts = alerts.slice(0, 3);

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white elevation-1", className)}>
      <div className="flex flex-col gap-4 p-4 xl:flex-row xl:items-stretch xl:gap-6">
        {/* KPI tiles — stacked on mobile, 2-col on tablet, 3-col inline on desktop */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:flex-1 xl:grid-cols-3 xl:divide-x xl:divide-slate-100">
          {tiles.slice(0, 3).map((t, i) => (
            <StripTileView key={i} tile={t} indented={i > 0} />
          ))}
        </div>

        {/* Sparkline — hidden on mobile (brief), centre column on desktop */}
        {hasSpark && (
          <div className="hidden md:flex md:flex-col md:justify-center md:gap-1 xl:w-44 xl:border-l xl:border-slate-100 xl:pl-6">
            <div className="text-overline text-slate-400">{sparkline!.label ?? "12-month trend"}</div>
            <Sparkline
              data={sparkline!.points}
              width={176}
              height={40}
              color={sparkline!.color ?? "#7c3aed"}
              ariaLabel={sparkline!.label ?? "12-month trend"}
              formatValue={(v) => Math.round(v).toLocaleString("en-IN")}
            />
          </div>
        )}

        {/* Alert chips — visible at every breakpoint; right rail on desktop */}
        {visibleAlerts.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 xl:w-auto xl:flex-col xl:items-end xl:justify-center xl:border-l xl:border-slate-100 xl:pl-6">
            {visibleAlerts.map((a, i) => (
              <StripAlertChip key={i} alert={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tile ─────────────────────────────────────────────────────────────

function StripTileView({ tile, indented }: { tile: StripTile; indented?: boolean }) {
  const inner = (
    <div className={cn("flex h-full flex-col gap-1 rounded-lg px-3 py-1.5 transition", tile.href && "hover:bg-slate-50", indented && "xl:pl-6")}>
      <div className="flex items-center gap-1.5">
        <span className="text-overline text-slate-500 truncate" title={tile.label}>
          {tile.label}
        </span>
        {tile.badge && <ToneBadge badge={tile.badge} />}
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-numeric leading-none text-slate-900",
            tile.emphasis ? "text-3xl font-bold" : "text-2xl font-semibold"
          )}
        >
          {tile.value}
        </span>
        {tile.delta && <DeltaBadge delta={tile.delta} />}
      </div>
    </div>
  );
  return tile.href ? (
    <Link href={tile.href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function DeltaBadge({ delta }: { delta: StripDelta }) {
  const color = delta.tone === "good" ? "text-emerald-700" : delta.tone === "bad" ? "text-rose-600" : "text-slate-500";
  const Icon = delta.direction === "up" ? ArrowUpRight : delta.direction === "down" ? ArrowDownRight : Minus;
  return (
    <span
      title={delta.tooltip}
      className={cn("inline-flex items-center gap-0.5 text-caption font-numeric tabular-nums", color)}
    >
      <Icon size={12} strokeWidth={2.5} />
      {delta.text}
    </span>
  );
}

function ToneBadge({ badge }: { badge: StripBadge }) {
  const c =
    badge.tone === "good"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : badge.tone === "bad"
        ? "bg-rose-50 text-rose-700 border-rose-200"
        : "bg-slate-100 text-slate-600 border-slate-200";
  return <span className={cn("chip text-[10px] leading-none", c)}>{badge.text}</span>;
}

function StripAlertChip({ alert }: { alert: StripAlert }) {
  const zero = alert.count === 0;
  const c = zero
    ? "bg-slate-50 text-slate-400 border-slate-200"
    : alert.tone === "bad"
      ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
      : alert.tone === "warn"
        ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
        : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200";
  return (
    <Link href={alert.href} className={cn("chip gap-1 transition", c)} aria-disabled={zero}>
      <span className="font-numeric font-bold tabular-nums">{alert.count}</span>
      <span className="text-[10px] uppercase tracking-wide">{alert.label}</span>
    </Link>
  );
}

// ─── Error band ───────────────────────────────────────────────────────

/** Rendered by a loader when its data fetch throws. Strip-shaped so the
 *  list below it never shifts, and quiet enough that a transient backend
 *  hiccup doesn't shout — the list itself is still fully usable. */
export function AnalyticsStripError({ message, className }: { message?: string; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3", className)}>
      <span className="text-caption text-slate-500">{message ?? "Summary metrics are unavailable right now."}</span>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────

/** Suspense fallback. Identical outer dimensions to the loaded strip so
 *  the list below it doesn't shift when the strip streams in (no CLS). */
export function AnalyticsStripSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white elevation-1", className)} aria-hidden>
      <div className="flex flex-col gap-4 p-4 xl:flex-row xl:items-stretch xl:gap-6">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:flex-1 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-2 px-3 py-1.5">
              <div className="h-3 w-24 rounded skeleton-shimmer" />
              <div className="h-7 w-16 rounded skeleton-shimmer" />
            </div>
          ))}
        </div>
        <div className="hidden md:block xl:w-44">
          <div className="h-10 w-full rounded skeleton-shimmer" />
        </div>
        <div className="flex gap-2 xl:flex-col xl:items-end">
          <div className="h-6 w-20 rounded-full skeleton-shimmer" />
          <div className="h-6 w-24 rounded-full skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}
