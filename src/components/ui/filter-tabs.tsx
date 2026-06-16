import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type FilterTone = "primary" | "emerald" | "amber" | "slate" | "rose" | "blue";

const ACTIVE_TONE: Record<FilterTone, { text: string; ring: string; countBg: string; countText: string }> = {
  primary: { text: "text-primary-700", ring: "ring-primary-100", countBg: "bg-primary-100", countText: "text-primary-700" },
  emerald: { text: "text-emerald-700", ring: "ring-emerald-100", countBg: "bg-emerald-100", countText: "text-emerald-700" },
  amber:   { text: "text-amber-700",   ring: "ring-amber-100",   countBg: "bg-amber-100",   countText: "text-amber-700" },
  slate:   { text: "text-slate-700",   ring: "ring-slate-200",   countBg: "bg-slate-200",   countText: "text-slate-700" },
  rose:    { text: "text-rose-700",    ring: "ring-rose-100",    countBg: "bg-rose-100",    countText: "text-rose-700" },
  blue:    { text: "text-blue-700",    ring: "ring-blue-100",    countBg: "bg-blue-100",    countText: "text-blue-700" }
};

export function FilterTabsList({
  label,
  className,
  children
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      {label ? (
        <span className="mt-2 hidden sm:inline-flex w-16 flex-shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
      ) : null}
      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
        {children}
      </div>
    </div>
  );
}

export function FilterTab({
  href,
  label,
  count,
  active,
  tone = "primary"
}: {
  href: string;
  label: string;
  count?: number;
  active: boolean;
  tone?: FilterTone;
}) {
  const t = ACTIVE_TONE[tone];
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1",
        active
          ? cn("bg-white font-semibold shadow-sm ring-1 ring-inset", t.text, t.ring)
          : "font-medium text-slate-600 hover:bg-white/70 hover:text-slate-900"
      )}
    >
      <span>{label}</span>
      {count !== undefined ? (
        <span
          className={cn(
            "inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
            active ? cn(t.countBg, t.countText) : "bg-slate-200/80 text-slate-600"
          )}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}
