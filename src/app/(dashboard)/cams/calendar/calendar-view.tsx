"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarRange, Grid3x3 } from "lucide-react";
import { AnnualCalendar, type CalendarItem } from "@/components/programme/calendar-annual";
import { ENGAGEMENT_TYPES, engagementTypeLabel, type Engagement } from "../lib-cams";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  // WP-33: the month grid answers "what is on the 14th"; it cannot answer
  // "is the year covered". Annual is the default because that is the question
  // a programme owner opens this screen with.
  const [mode, setMode] = useState<"annual" | "month">("annual");

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
      {/* View switcher */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" onClick={() => setMode("annual")}
          className={cn("flex h-auto items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs",
            mode === "annual" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600")}>
          <CalendarRange size={13} /> Year
        </Button>
        <Button type="button" variant="ghost" onClick={() => setMode("month")}
          className={cn("flex h-auto items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs",
            mode === "month" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600")}>
          <Grid3x3 size={13} /> Month
        </Button>
      </div>

      {mode === "annual" && (
        <AnnualCalendar
          items={filtered.map<CalendarItem>((e) => ({
            id: e.id, code: e.engagementCode, title: e.title,
            date: e.plannedDate, type: e.engagementType, status: e.status,
            href: e.href ?? `/cams/engagements/${e.id}`,
            leadAuditorId: e.leadAuditorId, leadAuditorName: e.leadAuditorName,
          }))}
        />
      )}

      {mode === "month" && (
      <>
      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" onClick={() => step(-1)} className="border-slate-200"><ChevronLeft size={16} /></Button>
          <div className="min-w-[160px] text-center text-sm font-semibold text-slate-800">{MONTHS[cursor.month]} {cursor.year}</div>
          <Button type="button" variant="outline" size="icon" onClick={() => step(1)} className="border-slate-200"><ChevronRight size={16} /></Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() })} className="ml-1 border-slate-200">Today</Button>
        </div>
        <span className="ml-auto text-xs text-slate-500">{monthEngagements.length} this month · {filtered.length} total</span>
      </div>

      {/* Type legend / filter */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setTypeFilter(null)}
          className={cn(
            "h-auto rounded-full border px-3 py-1 text-xs",
            !typeFilter ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"
          )}
        >
          All types
        </Button>
        {ENGAGEMENT_TYPES.map((t) => (
          <Button
            key={t.value}
            type="button"
            variant="ghost"
            onClick={() => setTypeFilter(typeFilter === t.value ? null : t.value)}
            className={cn(
              "flex h-auto items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
              typeFilter === t.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
            )}
          >
            <span className={"h-2 w-2 rounded-full " + (TYPE_DOT[t.value] ?? "bg-slate-400")} /> {t.label}
          </Button>
        ))}
      </div>

      {/* Month grid */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white sm:block">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="px-2 py-2 text-center">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((cell, i) => {
            if (!cell) return <div key={i} className="min-h-[80px] border-b border-r border-slate-100 bg-slate-50/40 lg:min-h-[96px]" />;
            const dayEngs = byDay.get(`${cursor.year}-${cursor.month}-${cell.day}`) ?? [];
            return (
              <div key={i} className="min-h-[80px] border-b border-r border-slate-100 p-1 align-top lg:min-h-[96px]">
                <div className={"mb-1 text-right text-[11px] " + (isToday(cell.day) ? "font-bold text-primary-700" : "text-slate-400")}>
                  {isToday(cell.day) ? <span className="rounded-full bg-primary-700 px-1.5 py-0.5 text-white">{cell.day}</span> : cell.day}
                </div>
                <div className="space-y-1">
                  {dayEngs.slice(0, 3).map((e) => (
                    <Link key={e.id} href={e.href ?? `/cams/engagements/${e.id}`} title={`${e.engagementCode} — ${e.title}`}
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
                <Link key={e.id} href={e.href ?? `/cams/engagements/${e.id}`} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50">
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
      </>
      )}
    </div>
  );
}
