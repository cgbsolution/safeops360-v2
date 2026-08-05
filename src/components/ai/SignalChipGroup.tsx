"use client";

// SignalChipGroup — renders a row's full set of insight chips (Row-Level
// Insight Layer, Part 2). The Observations table uses this so a single row can
// carry several signals (repeat-location, stale-step, duplicate, …). The first
// `maxVisible` render as normal SignalChips; the rest collapse into a "+N" pill
// whose popover lists them, keeping the row compact.
//
// The seven other list screens still render a single <SignalChip>; only
// Observations opted into the group. Dependency-free popover, mirroring
// SignalChip's own (no Radix primitive exists in this app).

import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import type { Signal } from "@/lib/insights";
import { SignalChip } from "./SignalChip";

export function SignalChipGroup({
  signals,
  href,
  maxVisible = 2,
  className,
}: {
  signals: Signal[];
  /** Deep link to where a signal's suggested action is performed (the record's
   *  detail page); forwarded to each chip's popover action. */
  href?: string;
  /** Chips shown before the rest collapse into "+N" (spec default 2). */
  maxVisible?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const popId = useId();

  if (!signals.length) return null;

  const visible = signals.slice(0, maxVisible);
  const overflow = signals.slice(maxVisible);

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      {visible.map((s, i) => (
        <SignalChip key={`${s.recordId}-${s.kind}-${i}`} signal={s} href={href} />
      ))}

      {overflow.length > 0 && (
        <span
          className="relative inline-flex"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
          }}
        >
          <button
            type="button"
            aria-describedby={open ? popId : undefined}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            className="chip cursor-help gap-0.5 whitespace-nowrap border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-600"
          >
            +{overflow.length}
          </button>

          {open && (
            <span
              id={popId}
              role="group"
              aria-label={`${overflow.length} more signals`}
              className="absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 text-left elevation-2"
            >
              <span className="block px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {overflow.length} more signal{overflow.length === 1 ? "" : "s"}
              </span>
              <ul className="space-y-1">
                {overflow.map((s, i) => (
                  <li
                    key={`${s.recordId}-more-${i}`}
                    className="rounded-md px-1 py-1 text-left"
                  >
                    <span className="block text-[11px] font-semibold text-slate-700">{s.label}</span>
                    <span className="block text-[11px] leading-snug text-slate-500">{s.evidence}</span>
                  </li>
                ))}
              </ul>
            </span>
          )}
        </span>
      )}
    </span>
  );
}
