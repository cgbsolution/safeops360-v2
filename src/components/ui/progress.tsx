import * as React from "react";
import { cn } from "@/lib/utils";

// Determinate progress / meter bar. Thirty files hand-rolled this as a
// `<span className="overflow-hidden rounded-full bg-slate-100">` wrapping a
// width-styled child, each picking its own height and radius — which is why the
// same "% complete" reads at three different weights across the registers.
//
// Server-safe (no "use client"): most call sites render inside an RSC register
// row, and the width comes from an inline style rather than a transform so the
// bar is correct on first paint with no client JS.

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Current value. Clamped into 0…max. */
  value: number;
  /** Denominator. Defaults to 100 so `value` reads as a percentage. */
  max?: number;
  /** Track thickness. */
  size?: "sm" | "default" | "lg";
  /** Colour of the filled portion — the semantic band the caller computed. */
  indicatorClassName?: string;
  /**
   * Inline style for the filled portion. Needed by the one-off themed bars
   * (the navy/gold insight hero) whose colours are outside the Tailwind palette
   * and so cannot be expressed as a class.
   */
  indicatorStyle?: React.CSSProperties;
  /**
   * Floor, in percent, applied to any non-zero value so a real-but-tiny bar
   * stays visible instead of collapsing to nothing. The registers all used 6.
   */
  minVisiblePercent?: number;
}

const TRACK_SIZE = {
  sm: "h-1.5",
  default: "h-2.5",
  lg: "h-4"
} as const;

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      className,
      value,
      max = 100,
      size = "default",
      indicatorClassName,
      indicatorStyle,
      minVisiblePercent = 0,
      ...props
    },
    ref
  ) => {
    // Guard the denominator: a caller passing max={0} (an empty bucket) would
    // otherwise produce NaN% and a bar that never paints.
    const safeMax = max > 0 ? max : 1;
    const clamped = Math.min(Math.max(value, 0), safeMax);
    const raw = (clamped / safeMax) * 100;
    const percent = clamped === 0 ? 0 : Math.max(minVisiblePercent, raw);

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        className={cn("overflow-hidden rounded-full bg-slate-100", TRACK_SIZE[size], className)}
        {...props}
      >
        <div
          className={cn("h-full rounded-full bg-primary-500 transition-[width]", indicatorClassName)}
          style={{ ...indicatorStyle, width: `${percent}%` }}
        />
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
