// Shared presentational pieces for the Chemical / Hazmat screens.
//
// Server components (no "use client"): every chemical screen is a read-first
// page and the data is fetched server-side, so shipping React state for a
// coloured chip would be pure cost.

import Link from "next/link";
import { hazardTone, prettyLabel, statusTone } from "@/lib/chemicals/types";

export const TILE = "rounded-xl border border-slate-200 bg-white p-4";

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
    <div className={TILE + (href ? " transition hover:border-slate-300 hover:shadow-sm" : "")}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={"text-2xl font-bold tabular-nums " + color}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
  // The Command Centre brief asks for interactive/clickable widgets (§7 #8) —
  // a KPI you cannot drill into is a number, not a tool.
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Chip({ label, tone }: { label: string; tone: string }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>
      {label}
    </span>
  );
}

export function HazardChips({ classes }: { classes: string[] }) {
  if (!classes?.length) {
    // An unclassified chemical is invisible to the threshold and co-storage
    // engines, so it is called out rather than left blank.
    return <span className="text-[11px] text-amber-600">Unclassified</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {classes.map((c) => (
        <Chip key={c} label={prettyLabel(c)} tone={hazardTone(c)} />
      ))}
    </span>
  );
}

export function StatusChip({ status }: { status: string }) {
  return <Chip label={prettyLabel(status)} tone={statusTone(status)} />;
}

/** Horizontal fill bar for quantity-vs-threshold. Over 100% is clamped for
 *  width but the label still shows the true figure — hiding an overage behind a
 *  full bar is how a breach looks like a near-miss. */
export function ThresholdBar({ percent }: { percent: number | null }) {
  const p = percent ?? 0;
  const width = Math.max(2, Math.min(100, p));
  const tone = p >= 100 ? "bg-rose-500" : p >= 80 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
      <span className={`text-[11px] tabular-nums ${p >= 100 ? "font-semibold text-rose-600" : "text-slate-500"}`}>
        {percent === null ? "—" : `${p.toFixed(0)}%`}
      </span>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <div className="text-sm font-medium text-slate-600">{title}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  // Loud on purpose. This module's whole premise is that a silent failure is
  // worse than a visible one, and a page that renders an empty table when the
  // backend is down teaches people the store is empty.
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
      <div className="text-sm font-semibold text-rose-800">Could not load this data</div>
      <div className="mt-1 text-xs text-rose-600">{message}</div>
      <div className="mt-2 text-xs text-rose-500">
        This is a load failure, not an empty register — do not read it as “nothing to show”.
      </div>
    </div>
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
          className={
            "px-3 py-2 text-sm font-medium transition " +
            (t.href === current
              ? "border-b-2 border-slate-900 text-slate-900"
              : "border-b-2 border-transparent text-slate-500 hover:text-slate-800")
          }
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
