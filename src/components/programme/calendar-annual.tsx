"use client";

// WP-33 - the annual view the month grid could not give (docs/cams/09 §4.1).
//
// **What this replaces.** `cams/calendar/calendar-view.tsx` is a month grid with
// zero responsive breakpoints: seven fixed columns of 96px cells, unusable below
// ~700px. It also cannot answer the two questions a programme owner actually
// asks - "is the year covered?" and "is anyone double-booked?" - because a month
// at a time hides both.
//
// The month grid is kept for day-level detail. This adds:
//
//   * **12-month heat strip** - the whole cycle at a glance, which is the view
//     that makes an empty Q3 obvious.
//   * **Auditor load** - days per person per period, with window collisions
//     flagged. Resource conflict is a scheduling error you want to see BEFORE
//     the month it lands in.
//   * **A real 390px design** - the strip stays (12 narrow columns fit; seven
//     96px day cells do not), and below it an agenda list rather than a grid.

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarRange, AlertTriangle, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const MONTHS_SHORT = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type CalendarItem = {
  id: string;
  code: string;
  title: string;
  date: string | null;
  type: string;
  status: string;
  href: string;
  leadAuditorId?: string | null;
  leadAuditorName?: string | null;
  estimatedDays?: number | null;
};

export type LoadRow = {
  userId: string;
  userName?: string | null;
  totalDays: number;
  byPeriod: Record<string, number>;
  collisions: { a: string; b: string; reason: string }[];
};

// Density ramp for the heat strip. Deliberately not a rainbow: this encodes
// "how much is happening", one ordered dimension, so one hue varying in
// lightness is the honest encoding.
function density(n: number): string {
  if (n === 0) return "bg-slate-100 text-slate-400";
  if (n === 1) return "bg-violet-100 text-violet-800";
  if (n <= 3) return "bg-violet-300 text-violet-950";
  if (n <= 6) return "bg-violet-500 text-white";
  return "bg-violet-700 text-white";
}

export function AnnualCalendar({
  items,
  load = [],
  year: initialYear,
}: {
  items: CalendarItem[];
  load?: LoadRow[];
  year?: number;
}) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(initialYear ?? thisYear);
  const [month, setMonth] = useState<number | null>(null);

  const byMonth = useMemo(() => {
    const m: CalendarItem[][] = Array.from({ length: 12 }, () => []);
    for (const it of items) {
      if (!it.date) continue;
      const d = new Date(it.date);
      if (Number.isNaN(d.getTime()) || d.getFullYear() !== year) continue;
      m[d.getMonth()].push(it);
    }
    return m;
  }, [items, year]);

  const total = byMonth.reduce((n, m) => n + m.length, 0);
  const emptyMonths = byMonth.filter((m) => m.length === 0).length;
  const collisions = load.reduce((n, l) => n + l.collisions.length, 0);
  const selected = month == null ? [] : byMonth[month];

  return (
    <div className="space-y-4">
      <Card className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="icon" onClick={() => setYear(year - 1)}>
              <ChevronLeft size={15} />
            </Button>
            <span className="min-w-[4rem] text-center text-sm font-semibold text-slate-800">
              {year}
            </span>
            <Button type="button" variant="outline" size="icon" onClick={() => setYear(year + 1)}>
              <ChevronRight size={15} />
            </Button>
          </div>
          <span className="text-xs text-slate-500">
            {total} engagement{total === 1 ? "" : "s"}
          </span>
          {emptyMonths > 0 && (
            <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800">
              {emptyMonths} month{emptyMonths === 1 ? "" : "s"} with nothing planned
            </span>
          )}
          {collisions > 0 && (
            <span className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[11px] text-rose-700">
              <AlertTriangle size={11} /> {collisions} scheduling collision
              {collisions === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {/* 12-month heat strip. Twelve narrow columns fit 390px; seven 96px day
            cells do not — which is why the month grid had no mobile design. */}
        <div className="mt-3 grid grid-cols-12 gap-1">
          {byMonth.map((m, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setMonth(month === i ? null : i)}
              title={`${MONTHS_FULL[i]} ${year} — ${m.length} engagement(s)`}
              aria-label={`${MONTHS_FULL[i]}, ${m.length} engagements`}
              className={cn(
                "flex min-h-[44px] flex-col items-center justify-center rounded transition",
                density(m.length),
                month === i && "ring-2 ring-violet-600 ring-offset-1",
              )}
            >
              <span className="text-[10px] font-medium opacity-80">{MONTHS_SHORT[i]}</span>
              <span className="text-sm font-bold tabular-nums">{m.length || ""}</span>
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">
          Tap a month for its agenda. An empty column in a period the programme requires cover
          for is a gap, not a quiet month.
        </p>
      </Card>

      {month != null && (
        <Card className="overflow-hidden rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2">
            <CalendarRange size={14} className="text-violet-700" />
            <span className="text-sm font-semibold text-slate-800">
              {MONTHS_FULL[month]} {year}
            </span>
            <span className="ml-auto text-xs text-slate-500">{selected.length}</span>
          </div>
          {selected.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              Nothing planned in {MONTHS_FULL[month]}.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {selected
                .slice()
                .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
                .map((e) => (
                  <li key={e.id}>
                    <Link
                      href={e.href}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 hover:bg-slate-50"
                    >
                      <span className="w-16 shrink-0 text-xs tabular-nums text-slate-500">
                        {e.date
                          ? new Date(e.date).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                            })
                          : "—"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                        <span className="font-medium text-violet-800">{e.code}</span> — {e.title}
                      </span>
                      {e.leadAuditorName && (
                        <span className="shrink-0 text-[11px] text-slate-500">
                          {e.leadAuditorName}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      )}

      {load.length > 0 && <AuditorLoad rows={load} />}
    </div>
  );
}

function AuditorLoad({ rows }: { rows: LoadRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.totalDays));
  return (
    <Card className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Users size={15} className="text-violet-700" />
        Auditor load
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Estimated auditor-days per person. A collision is two slots whose windows overlap — a
        scheduling error worth seeing months before the week it lands in.
      </p>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.userId}>
            <div className="flex items-center gap-2">
              <span className="w-36 shrink-0 truncate text-sm text-slate-700">
                {r.userName ?? r.userId}
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn(
                    "h-full rounded-full",
                    r.collisions.length ? "bg-rose-500" : "bg-violet-500",
                  )}
                  style={{ width: `${(r.totalDays / max) * 100}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-slate-600">
                {r.totalDays}d
              </span>
            </div>
            {r.collisions.map((c, i) => (
              <p key={i} className="ml-0 mt-1 flex items-start gap-1 text-[11px] text-rose-700 sm:ml-36">
                <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                {c.reason}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </Card>
  );
}
