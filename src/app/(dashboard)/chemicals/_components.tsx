// Shared presentational pieces for the Chemical / Hazmat screens.
//
// Built on the platform's shadcn primitives (Card, Badge, Table, Button) rather
// than hand-rolled divs, so this module inherits the same spacing, borders,
// focus rings and dark-mode behaviour as every other register — and picks up
// design-system changes for free instead of drifting.
//
// Server components: these screens are read-first and fetched server-side, so
// shipping React state for a coloured chip would be pure cost. The interactive
// pieces live in the "use client" files alongside.

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hazardTone, prettyLabel, statusTone } from "@/lib/chemicals/types";
import { cn } from "@/lib/utils";

export function Kpi({
  label,
  value,
  tone,
  sub,
  href,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "critical" | "warn" | "good";
  sub?: string;
  href?: string;
}) {
  const color =
    tone === "critical" ? "text-rose-600"
    : tone === "warn" ? "text-amber-600"
    : tone === "good" ? "text-emerald-600"
    : "text-slate-900";
  const body = (
    <Card className={cn("h-full", href && "transition hover:border-slate-300 hover:shadow-sm")}>
      <CardContent className="p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
        <div className={cn("text-2xl font-bold tabular-nums", color)}>{value}</div>
        {sub && <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>}
      </CardContent>
    </Card>
  );
  // The Command Centre brief asks for interactive widgets (§7 #8) — a KPI you
  // cannot drill into is a number, not a tool.
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export function HazardChips({ classes }: { classes: string[] }) {
  if (!classes?.length) {
    // An unclassified chemical is invisible to the threshold and co-storage
    // engines, so it is called out rather than left blank.
    return <span className="text-[11px] font-medium text-amber-600">Unclassified</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {classes.map((c) => (
        <Badge key={c} className={hazardTone(c)}>{prettyLabel(c)}</Badge>
      ))}
    </span>
  );
}

export function StatusChip({ status }: { status: string }) {
  return <Badge className={statusTone(status)}>{prettyLabel(status)}</Badge>;
}

/** Quantity-vs-threshold fill. Over 100% is clamped for width but the label
 *  still shows the true figure — hiding an overage behind a full bar makes a
 *  breach look like a near miss. */
export function ThresholdBar({ percent }: { percent: number | null }) {
  const p = percent ?? 0;
  const width = Math.max(2, Math.min(100, p));
  const tone = p >= 100 ? "bg-rose-500" : p >= 80 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full", tone)} style={{ width: `${width}%` }} />
      </div>
      <span className={cn("text-[11px] tabular-nums", p >= 100 ? "font-semibold text-rose-600" : "text-slate-500")}>
        {percent === null ? "—" : `${p.toFixed(0)}%`}
      </span>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-dashed bg-slate-50">
      <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
        <div className="text-sm font-medium text-slate-600">{title}</div>
        {hint && <div className="max-w-lg text-xs text-slate-400">{hint}</div>}
        {action && <div className="mt-2">{action}</div>}
      </CardContent>
    </Card>
  );
}

export function ErrorState({ message }: { message: string }) {
  // Loud on purpose. This module's premise is that a silent failure is worse
  // than a visible one, and a page rendering an empty table when the backend is
  // down teaches people the store is empty.
  return (
    <Card className="border-rose-200 bg-rose-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-rose-800">Could not load this data</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-rose-600">{message}</p>
        <p className="mt-2 text-xs text-rose-500">
          This is a load failure, not an empty register — do not read it as “nothing to show”.
        </p>
      </CardContent>
    </Card>
  );
}

export function SubNav({ current }: { current: string }) {
  const tabs = [
    { href: "/chemicals", label: "Register" },
    { href: "/chemicals/inventory", label: "Inventory" },
    { href: "/chemicals/storage", label: "Storage" },
    { href: "/chemicals/thresholds", label: "Thresholds" },
    { href: "/chemicals/disposals", label: "Disposals" },
    { href: "/chemicals/trigger-log", label: "MOC trigger log" },
  ];
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "border-b-2 px-3 py-2 text-sm font-medium transition",
            t.href === current
              ? "border-primary-700 text-primary-800"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

/** Footnote under a table. Used consistently to state WHY a register behaves
 *  the way it does — the ledger rules are non-obvious and get questioned. */
export function TableNote({ children }: { children: React.ReactNode }) {
  return <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">{children}</div>;
}
