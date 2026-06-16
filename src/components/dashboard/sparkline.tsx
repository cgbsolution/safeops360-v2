"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SparkPoint {
  /** Short label for the tooltip (e.g. "May 2026"). */
  label: string;
  value: number;
}

interface SparklineProps {
  data: SparkPoint[];
  width?: number;
  height?: number;
  /** Stroke + fill colour. Caller resolves from KPI band. */
  color?: string;
  /** Index of the point to emphasise (filled dot, larger radius). Defaults
   *  to the last point — typically "the current period". */
  highlightIndex?: number;
  /** Subtle area fill under the line. Set false for ultra-minimal use. */
  area?: boolean;
  /** Accessibility label read by screen readers. */
  ariaLabel?: string;
  className?: string;
  /** Format value for the tooltip. Defaults to two-decimal toString. */
  formatValue?: (value: number) => string;
}

/**
 * Tiny inline trendline. Native SVG — no Recharts overhead at this size.
 * Renders 60×24px by default; scales linearly so it stays crisp in any
 * card variant. Includes a transparent hover layer that snaps to the
 * nearest data point and shows a tooltip with label + value.
 *
 * Used inside the KpiCard. Designed to be statically sized by the
 * parent — no ResponsiveContainer dependency, no layout thrash on
 * mount. The component is deterministic given the same data, so React
 * server components can render it without hydration mismatch.
 */
export function Sparkline({
  data,
  width = 60,
  height = 24,
  color = "#7c3aed",
  highlightIndex,
  area = true,
  ariaLabel,
  className,
  formatValue,
}: SparklineProps) {
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div
        className={cn("flex items-center justify-center text-slate-300", className)}
        style={{ width, height }}
        aria-label="No trend data"
      >
        <span className="text-[10px]">—</span>
      </div>
    );
  }

  // Single point — render a centred dot so the area doesn't collapse to
  // a zero-width artifact.
  if (data.length === 1) {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        role="img"
        aria-label={ariaLabel ?? `Sparkline: ${data[0].label} = ${data[0].value}`}
      >
        <circle cx={width / 2} cy={height / 2} r={2.5} fill={color} />
      </svg>
    );
  }

  // Layout maths. We pad horizontally so the first/last points aren't
  // clipped at the SVG edge, and vertically so the highlight dot stays
  // fully visible.
  const padX = 2;
  const padY = 3;
  const w = width - padX * 2;
  const h = height - padY * 2;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // avoid divide-by-zero on flat series

  const xAt = (i: number) => padX + (i / (data.length - 1)) * w;
  const yAt = (v: number) => padY + (1 - (v - min) / range) * h;

  const points = data.map((d, i) => ({ x: xAt(i), y: yAt(d.value), value: d.value, label: d.label }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const areaPath =
    `${linePath} L${points[points.length - 1].x.toFixed(2)},${(padY + h).toFixed(2)} ` +
    `L${points[0].x.toFixed(2)},${(padY + h).toFixed(2)} Z`;

  const lastIdx = data.length - 1;
  const highlight = highlightIndex ?? lastIdx;
  const fmt = formatValue ?? ((v: number) => v.toFixed(2));
  const gradientId = React.useId();

  // Step segments share width — each occupies (width / data.length) of
  // the chart area. The hover layer hit-tests on these segments rather
  // than the points so the user doesn't have to land on the actual dot.
  const segmentWidth = width / data.length;
  const hoverX = (i: number) => i * segmentWidth;

  return (
    <div className={cn("relative inline-block", className)} style={{ width, height }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel ?? `Sparkline trend, ${data.length} points`}
      >
        {area && (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
        )}
        {area && <path d={areaPath} fill={`url(#${gradientId})`} />}
        <path d={linePath} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
        {/* Highlight dot — emphasised current-period marker. */}
        <circle cx={points[highlight].x} cy={points[highlight].y} r={2.2} fill={color} stroke="white" strokeWidth={1} />
        {/* Hover indicator — appears only while hovering a segment. */}
        {hoverIdx != null && hoverIdx !== highlight && (
          <circle cx={points[hoverIdx].x} cy={points[hoverIdx].y} r={1.8} fill={color} stroke="white" strokeWidth={1} />
        )}
        {/* Transparent segment overlays for hover. Pointer events go
            here so the visible dot doesn't have to be a precise target. */}
        {points.map((_, i) => (
          <rect
            key={i}
            x={hoverX(i)}
            y={0}
            width={segmentWidth}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            onFocus={() => setHoverIdx(i)}
            onBlur={() => setHoverIdx(null)}
            tabIndex={-1}
            aria-hidden
          />
        ))}
      </svg>
      {hoverIdx != null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white shadow-lg"
          style={{
            left: points[hoverIdx].x,
            top: -28,
          }}
        >
          <div className="text-slate-300">{data[hoverIdx].label}</div>
          <div className="font-numeric tabular-nums">{fmt(data[hoverIdx].value)}</div>
        </div>
      )}
    </div>
  );
}
