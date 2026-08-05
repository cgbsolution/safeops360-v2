"use client";

// SignalChip — a compact, row-level insight chip that renders INLINE next to a
// row's existing status/workflow chip (spec §1.3). Icon + 1–3 word label; a
// hover/click popover reveals the evidence + suggested action. Only rendered
// when a row actually has a signal — most rows have none, and that's correct.
//
// The suggested action is a real link when the caller passes `href` (the
// record's detail page — where the action is actually performed), so the popover
// is decision-support you can act on, not just a read-only note. Falls back to
// plain text when no href is supplied.
//
// Dependency-free popover (no Radix Popover primitive exists in this app and
// adding one isn't worth it here): a small controlled popover shown on
// hover/focus/click, dismissed on leave/blur-outside/escape. Close-on-blur is
// scoped to the wrapper (relatedTarget check) so focus can move from the chip
// into the action link without the popover closing before the click lands.

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  AlarmClock,
  AlertTriangle,
  ArrowRightCircle,
  CopyCheck,
  Layers,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { InsightKind, InsightSeverity, Signal } from "@/lib/insights";

const KIND_ICON: Record<InsightKind, LucideIcon> = {
  trend: TrendingUp,
  cluster: Layers,
  anomaly: AlertTriangle,
  predictive_risk: Activity,
  next_best_action: ArrowRightCircle,
  duplicate: CopyCheck,
  overdue_escalation: AlarmClock,
};

const SEV_CHIP: Record<InsightSeverity, string> = {
  info: "border-primary-200 bg-primary-50 text-primary-700",
  watch: "border-amber-200 bg-amber-50 text-amber-700",
  high: "border-amber-300 bg-amber-100 text-amber-800",
  critical: "border-rose-200 bg-rose-50 text-rose-700",
};

export function SignalChip({
  signal,
  href,
  className,
}: {
  signal: Signal;
  /** Deep link to where the suggested action is performed (usually the record's
   *  detail page). When set, the action line renders as a clickable link. */
  href?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const popId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const Icon = KIND_ICON[signal.kind] ?? Activity;

  // Part 3: a signal that carries a filterHref makes the chip click narrow the
  // list to its cluster/location. Without one, click just toggles the popover
  // (the behaviour on the other seven list screens — they pass no filterHref).
  const filterable = !!signal.filterHref;
  const onChipClick = () => {
    if (filterable) router.push(`${pathname}${signal.filterHref}`, { scroll: false });
    else setOpen((v) => !v);
  };

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      // Close only when focus leaves the whole chip+popover, so tabbing/clicking
      // into the action link keeps the popover open long enough to follow it.
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-describedby={open ? popId : undefined}
        aria-expanded={open}
        title={filterable ? "Filter the list to these records" : undefined}
        onClick={onChipClick}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className={cn(
          "chip gap-1 whitespace-nowrap border text-[10px] font-semibold",
          filterable ? "cursor-pointer" : "cursor-help",
          SEV_CHIP[signal.severity] ?? SEV_CHIP.info
        )}
      >
        <Icon size={11} strokeWidth={2.5} aria-hidden />
        {signal.label}
      </button>

      {open && (
        <span
          id={popId}
          role="group"
          aria-label={signal.label}
          className="absolute left-0 top-full z-30 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-3 text-left elevation-2"
        >
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {signal.label}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-slate-700">{signal.evidence}</span>
          {signal.suggestedAction &&
            (href ? (
              <Link
                href={href}
                className="mt-2 flex items-start gap-1 border-t border-slate-100 pt-2 text-xs font-medium text-primary-700 hover:text-primary-900 hover:underline"
              >
                <span aria-hidden>→</span>
                <span>{signal.suggestedAction}</span>
              </Link>
            ) : (
              <span className="mt-2 block border-t border-slate-100 pt-2 text-xs text-primary-700">
                → {signal.suggestedAction}
              </span>
            ))}
        </span>
      )}
    </span>
  );
}
