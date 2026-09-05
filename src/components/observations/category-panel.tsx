import Link from "next/link";
import { humanize } from "@/lib/utils";
import { Card } from "@/components/ui/card";

// Observation category breakdown (Row-Level Insight Layer, Part 4).
//
// A compact horizontal-bar panel of the OPEN backlog grouped by hazard
// category, sorted by volume. Each bar is a drill link into the same row-filter
// mechanism the insight cards and repeat/duplicate chips use (?cat=…), so the
// list below narrows without a re-query. Server component — pure links, no
// client JS. Violet/semantic tokens, consistent with the rest of the screen.

export interface CategoryDatum {
  category: string;
  /** Open observations in this category, across all areas. */
  count: number;
  /** Distinct plant areas this category is open in (the × plantArea spread). */
  areaCount: number;
}

const MAX_BARS = 8;

export function ObservationCategoryPanel({
  data,
  activeCategory,
}: {
  data: CategoryDatum[];
  activeCategory: string | null;
}) {
  if (!data.length) return null;

  const bars = data.slice(0, MAX_BARS);
  const max = Math.max(...bars.map((d) => d.count), 1);
  const hidden = data.length - bars.length;

  return (
    <Card className="mb-4 rounded-xl border border-slate-200 bg-white p-4 elevation-1 shadow-none">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-overline text-slate-500">Open observations by category</span>
        <span className="text-caption text-slate-400">click a bar to filter</span>
      </div>

      <ul className="space-y-1.5">
        {bars.map((d) => {
          const active = activeCategory === d.category;
          const pct = Math.max(4, Math.round((d.count / max) * 100));
          // Toggle: clicking the active category clears the filter.
          const href = active ? "/observations" : `/observations?cat=${encodeURIComponent(d.category)}`;
          return (
            <li key={d.category}>
              <Link
                href={href}
                aria-pressed={active}
                title={`${d.count} open · ${d.areaCount} area${d.areaCount === 1 ? "" : "s"}`}
                className="group flex items-center gap-3 rounded-md px-1 py-1 transition hover:bg-slate-50"
              >
                <span className="w-32 shrink-0 truncate text-xs font-medium text-slate-700">
                  {humanize(d.category)}
                </span>
                <span className="relative h-4 flex-1 overflow-hidden rounded bg-slate-100">
                  <span
                    className={active ? "block h-full rounded bg-primary-600" : "block h-full rounded bg-primary-400 group-hover:bg-primary-500"}
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="w-24 shrink-0 text-right text-xs tabular-nums text-slate-500">
                  <span className="font-semibold text-slate-800">{d.count}</span>
                  <span className="text-slate-400"> · {d.areaCount} area{d.areaCount === 1 ? "" : "s"}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {hidden > 0 && (
        <div className="mt-2 text-caption text-slate-400">+{hidden} more categor{hidden === 1 ? "y" : "ies"}</div>
      )}
    </Card>
  );
}
