"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ENGAGEMENT_TYPES, engagementTypeLabel, type Engagement } from "../lib-cams";

// Per-type accent (dot + chip background).
const TYPE_DOT: Record<string, string> = {
  INTERNAL_AUDIT: "bg-blue-500",
  COMPLIANCE_AUDIT: "bg-rose-500",
  INSPECTION: "bg-emerald-500",
  SUPPLIER_AUDIT: "bg-amber-500",
  LAYERED_PROCESS_AUDIT: "bg-violet-500",
  MANAGEMENT_REVIEW: "bg-slate-500",
};
const TYPE_BG: Record<string, string> = {
  INTERNAL_AUDIT: "bg-blue-50 text-blue-800 hover:bg-blue-100",
  COMPLIANCE_AUDIT: "bg-rose-50 text-rose-800 hover:bg-rose-100",
  INSPECTION: "bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  SUPPLIER_AUDIT: "bg-amber-50 text-amber-800 hover:bg-amber-100",
  LAYERED_PROCESS_AUDIT: "bg-violet-50 text-violet-800 hover:bg-violet-100",
  MANAGEMENT_REVIEW: "bg-slate-100 text-slate-700 hover:bg-slate-200",
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function ymKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}`; }

export function CalendarView({ items }: { items: Engagement[] }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const filtered = useMemo(
    () => (typeFilter ? items.filter((e) => e.engagementType === typeFilter) : items),
    [items, typeFilter]
  );

  // Map engagements to "YYYY-M-D" of their planned date.
  const byDay = useMemo(() => {
    const m = new Map<string, Engagement[]>();
    for (const e of filtered) {
      const d = new Date(e.plannedDate);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      (m.get(key) ?? m.set(key, []).get(key)!).push(e);
    }
    return m;
  }, [filtered]);

  // Build the month grid (weeks × 7), Sunday-first.
  const grid = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const cells: ({ day: number } | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const monthEngagements = useMemo(
    () => filtered.filter((e) => ymKey(new Date(e.plannedDate)) === `${cursor.year}-${cursor.month}`),
    [filtered, cursor]
  );

  const step = (delta: number) => {
    let m = cursor.month + delta, y = cursor.year;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setCursor({ year: y, month: m });
  };
  const isToday = (day: number) => now.getFullYear() === cursor.year && now.getMonth() === cursor.month && now.getDate() === day;

  return (
    <div>
      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50"><ChevronLeft size={16} /></button>
          <div className="min-w-[160px] text-center text-sm font-semibold text-slate-800">{MONTHS[cursor.month]} {cursor.year}</div>
          <button onClick={() => step(1)} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50"><ChevronRight size={16} /></button>
          <button onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() })} className="ml-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs hover:bg-slate-50">Today</button>
        </div>
        <span className="ml-auto text-xs text-slate-500">{monthEngagements.length} this month · {filtered.length} total</span>
      </div>

      {/* Type legend / filter */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setTypeFilter(null)} className={"rounded-full border px-3 py-1 text-xs " + (!typeFilter ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600")}>All types</button>
        {ENGAGEMENT_TYPES.map((t) => (
          <button key={t.value} onClick={() => setTypeFilter(typeFilter === t.value ? null : t.value)}
            className={"flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs " + (typeFilter === t.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")}>
            <span className={"h-2 w-2 rounded-full " + (TYPE_DOT[t.value] ?? "bg-slate-400")} /> {t.label}
          </button>
        ))}
      </div>

      {/* Month grid */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="px-2 py-2 text-center">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((cell, i) => {
            if (!cell) return <div key={i} className="min-h-[96px] border-b border-r border-slate-100 bg-slate-50/40" />;
            const dayEngs = byDay.get(`${cursor.year}-${cursor.month}-${cell.day}`) ?? [];
            return (
              <div key={i} className="min-h-[96px] border-b border-r border-slate-100 p-1 align-top">
                <div className={"mb-1 text-right text-[11px] " + (isToday(cell.day) ? "font-bold text-primary-700" : "text-slate-400")}>
                  {isToday(cell.day) ? <span className="rounded-full bg-primary-700 px-1.5 py-0.5 text-white">{cell.day}</span> : cell.day}
                </div>
                <div className="space-y-1">
                  {dayEngs.slice(0, 3).map((e) => (
                    <Link key={e.id} href={`/cams/engagements/${e.id}`} title={`${e.engagementCode} — ${e.title}`}
                      className={"block truncate rounded px-1 py-0.5 text-[10px] leading-tight " + (TYPE_BG[e.engagementType] ?? "bg-slate-100")}>
                      {e.engagementCode}{e.sourceModule ? " ●" : ""}
                    </Link>
                  ))}
                  {dayEngs.length > 3 && <div className="px-1 text-[10px] text-slate-400">+{dayEngs.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* This-month agenda */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-800">Agenda — {MONTHS[cursor.month]} {cursor.year}</div>
        <div className="divide-y divide-slate-100">
          {monthEngagements.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">No engagements planned this month.</div>
          ) : (
            monthEngagements
              .sort((a, b) => new Date(a.plannedDate).getTime() - new Date(b.plannedDate).getTime())
              .map((e) => (
                <Link key={e.id} href={`/cams/engagements/${e.id}`} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50">
                  <span className={"h-2.5 w-2.5 shrink-0 rounded-full " + (TYPE_DOT[e.engagementType] ?? "bg-slate-400")} />
                  <span className="w-20 shrink-0 text-xs tabular-nums text-slate-500">{new Date(e.plannedDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700"><span className="font-medium text-primary-700">{e.engagementCode}</span> — {e.title}</span>
                  <span className="shrink-0 text-xs text-slate-500">{engagementTypeLabel(e.engagementType)}</span>
                  {e.sourceModule && <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">via {e.sourceModule}</span>}
                </Link>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
