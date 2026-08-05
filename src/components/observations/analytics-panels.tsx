// ObservationAnalyticsPanels — the two-panel "situation" row under the Focus
// hero: "Where it's stuck" (workflow bottleneck, the Plant Head's weekly chase)
// and "Where it's concentrated" (category / root-cause, the EHS Head's lens).
//
// Server component — pure presentation over data the page already computed. Bars
// get their width from an inline style (no client JS), so they always render (no
// empty tracks). The concentration bars click through to `?cat=` (the same
// filter the rest of the screen uses); the bottleneck bars are informational.

import Link from "next/link";
import { CopyCheck, Hourglass, LayoutGrid } from "lucide-react";
import { cn, humanize } from "@/lib/utils";

export interface BottleneckDatum {
  step: string;
  count: number;
  avgDays: number;
}
export interface CategoryDatum {
  category: string;
  count: number;
  areaCount: number;
}
export interface DuplicateDatum {
  sets: number;
  records: number;
  pctOfOpen: number;
}

// Dwell → colour band. Semantic status, not the violet accent.
function dwellTone(days: number): string {
  if (days >= 30) return "bg-rose-500";
  if (days >= 15) return "bg-orange-500";
  if (days >= 7) return "bg-amber-500";
  return "bg-primary-500";
}

export function ObservationAnalyticsPanels({
  bottleneck,
  category,
  activeCategory,
  duplicate,
  basePath = "/observations",
  concentratedTitle = "Where it's concentrated",
}: {
  bottleneck: BottleneckDatum[];
  category: CategoryDatum[];
  activeCategory: string | null;
  duplicate?: DuplicateDatum | null;
  /** Screen this row lives on — the concentration/duplicate links resolve against
   *  it, so the same component reuses across modules (Observations, Near Miss …). */
  basePath?: string;
  concentratedTitle?: string;
}) {
  const bn = bottleneck.slice(0, 6);
  const cat = category.slice(0, 6);
  const maxAvg = Math.max(1, ...bn.map((b) => b.avgDays));
  const maxCount = Math.max(1, ...cat.map((c) => c.count));
  const worst = bn[0];

  return (
    <div className={cn("mb-4 grid gap-3", duplicate ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
      {/* ── Where it's stuck ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Hourglass size={15} className="text-primary-600" />
            Where it&apos;s stuck
          </h3>
          <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-700">
            Bottleneck
          </span>
        </div>

        {bn.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">No workflow steps are backed up right now.</p>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              {bn.map((b, i) => (
                <div key={b.step} className="grid grid-cols-[130px_1fr_auto] items-center gap-3 py-1">
                  <span
                    className={cn("truncate text-[12.5px]", i === 0 ? "font-semibold text-slate-800" : "text-slate-600")}
                    title={b.step}
                  >
                    {b.step}
                    {i === 0 && <span className="ml-1 text-orange-500">▲</span>}
                  </span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className={cn("block h-full rounded-full", dwellTone(b.avgDays))}
                      style={{ width: `${Math.max(6, (b.avgDays / maxAvg) * 100)}%` }}
                    />
                  </span>
                  <span className="whitespace-nowrap text-right font-mono text-[12.5px] font-bold tabular-nums text-slate-800">
                    {b.avgDays}d <span className="font-sans text-[10.5px] font-normal text-slate-400">· {b.count} stuck</span>
                  </span>
                </div>
              ))}
            </div>
            {worst && (
              <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11.5px] leading-relaxed text-slate-500">
                <b className="text-slate-700">{worst.step}</b> is the slowest hop at{" "}
                <b className="text-slate-700">{worst.avgDays} days</b> on average — clear it first and close-out time drops
                across the board.
              </p>
            )}
          </>
        )}
      </section>

      {/* ── Where it's concentrated ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <LayoutGrid size={15} className="text-primary-600" />
            {concentratedTitle}
          </h3>
          <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-700">
            Root cause
          </span>
        </div>

        {cat.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">No open observations to break down.</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {cat.map((c, i) => {
              const active = activeCategory === c.category;
              const href = active ? basePath : `${basePath}?cat=${c.category}`;
              return (
                <Link
                  key={c.category}
                  href={href}
                  className={cn(
                    "grid grid-cols-[130px_1fr_auto] items-center gap-3 rounded-lg px-1.5 py-1 transition hover:bg-slate-50",
                    active && "bg-primary-50"
                  )}
                  title={`Filter to ${humanize(c.category)}`}
                >
                  <span
                    className={cn(
                      "truncate text-[12.5px]",
                      active || i === 0 ? "font-semibold text-slate-800" : "text-slate-600"
                    )}
                  >
                    {humanize(c.category)}
                    {i === 0 && <span className="ml-1 text-orange-500">▲</span>}
                  </span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className={cn("block h-full rounded-full", active ? "bg-primary-600" : "bg-primary-400")}
                      style={{ width: `${Math.max(6, (c.count / maxCount) * 100)}%` }}
                    />
                  </span>
                  <span className="whitespace-nowrap text-right font-mono text-[12.5px] font-bold tabular-nums text-slate-800">
                    {c.count}{" "}
                    <span className="font-sans text-[10.5px] font-normal text-slate-400">
                      · {c.areaCount} area{c.areaCount === 1 ? "" : "s"}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Likely duplicates (data quality) ── */}
      {duplicate && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <CopyCheck size={15} className="text-primary-600" />
              Likely duplicates
            </h3>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Data quality
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold tabular-nums text-slate-900">{duplicate.sets}</span>
            <span className="text-sm text-slate-500">
              sets · {duplicate.records} records
            </span>
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">
            Same area, logged under 48h apart, near-identical text. Merging clears roughly {duplicate.pctOfOpen}% of the
            open list.
          </p>
          <Link
            href={basePath === "/observations" ? "/observations?insight=observation:duplicate:near-identical" : basePath}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:border-primary-300 hover:text-primary-700"
          >
            Review {duplicate.records} records
          </Link>
        </section>
      )}
    </div>
  );
}
