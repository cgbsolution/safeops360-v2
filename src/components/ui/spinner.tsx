import * as React from "react";
import { cn } from "@/lib/utils";

// The ring spinner the loading states use.
//
// Six files wrote it out as `<div className="h-12 w-12 animate-spin rounded-full
// border-4 border-[#E8EEF7] border-t-[#C9A961]" />`, each hardcoding the same
// two hex colours and picking its own size. None of them told a screen reader
// anything was loading, which is the part that actually mattered: `role="status"`
// plus a visually-hidden label is now built in.
//
// `tone="brand"` is the violet default; `tone="gold"` is the field-capture
// palette, which is deliberately a different colour system from the desk app.

const SIZES = {
  sm: "h-5 w-5 border-2",
  default: "h-8 w-8 border-[3px]",
  lg: "h-12 w-12 border-4",
  xl: "h-14 w-14 border-4"
} as const;

const TONES = {
  brand: "border-primary-100 border-t-primary-600",
  gold: "border-[#E8EEF7] border-t-[#C9A961]",
  muted: "border-slate-200 border-t-slate-500"
} as const;

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
  /** Announced to assistive tech. Set to "" to hide it from the a11y tree. */
  label?: string;
}

function Spinner({ className, size = "default", tone = "brand", label = "Loading…", ...props }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center justify-center", className)}
      {...props}
    >
      <span className={cn("animate-spin rounded-full", SIZES[size], TONES[tone])} />
      {label ? <span className="sr-only">{label}</span> : null}
    </div>
  );
}

export { Spinner };
