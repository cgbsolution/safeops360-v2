// ObservationAnalyticsPanels — the two-panel "situation" row under the Focus
// hero: "Where it's stuck" (workflow bottleneck, the Plant Head's weekly chase)
// and "Where it's concentrated" (category / root-cause, the EHS Head's lens).
//
// Server component — pure presentation over data the page already computed. Bars
// come from <BarListRows>, which scales the set against its own max and applies
// the visible-minimum floor, so they always render (no empty tracks). The
// concentration bars click through to `?cat=` (the same filter the rest of the
// screen uses); the bottleneck bars are informational.

import Link from "next/link";
import { CopyCheck, Hourglass, LayoutGrid } from "lucide-react";
import { cn, humanize } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { BarListRows, type BarListRowProps } from "@/components/ui/bar-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

/** Shared chrome for the three panels: icon + title on the left, eyebrow chip right. */
function PanelCard({
  icon: Icon,
  title,
  eyebrow,
  eyebrowVariant = "brand",
  children
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: React.ReactNode;
  eyebrow: string;
  eyebrowVariant?: "brand" | "warning";
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl border-slate-200 p-4">
      <CardHeader className="mb-3 flex-row items-center justify-between space-y-0 p-0">
        <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Icon size={15} className="text-primary-600" />
          {title}
        </CardTitle>
        <Badge variant={eyebrowVariant} size="eyebrow">
          {eyebrow}
        </Badge>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
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
  const worst = bn[0];

  // Bars are scaled on avgDays (how slow the hop is), not on the stuck count —
  // the count rides along in the right-hand meta.
  const bottleneckRows: BarListRowProps[] = bn.map((b, i) => ({
    label: (
      <>
        {b.step}
        {i === 0 && <span className="ml-1 text-orange-500">▲</span>}
      </>
    ),
    title: b.step,
    value: b.avgDays,
    emphasis: i === 0,
    indicatorClassName: dwellTone(b.avgDays),
    meta: (
      <>
        {b.avgDays}d <span className="font-sans text-[10.5px] font-normal text-slate-400">· {b.count} stuck</span>
      </>
    )
  }));

  const categoryRows: BarListRowProps[] = cat.map((c, i) => {
    const active = activeCategory === c.category;
    return {
      label: (
        <>
          {humanize(c.category)}
          {i === 0 && <span className="ml-1 text-orange-500">▲</span>}
        </>
      ),
      title: `Filter to ${humanize(c.category)}`,
      value: c.count,
      active,
      emphasis: i === 0,
      // Toggle: clicking the active category clears the filter.
      href: active ? basePath : `${basePath}?cat=${c.category}`,
      meta: (
        <>
          {c.count}{" "}
          <span className="font-sans text-[10.5px] font-normal text-slate-400">
            · {c.areaCount} area{c.areaCount === 1 ? "" : "s"}
          </span>
        </>
      )
    };
  });

  return (
    <div className={cn("mb-4 grid gap-3", duplicate ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
      {/* ── Where it's stuck ── */}
      <PanelCard icon={Hourglass} title={<>Where it&apos;s stuck</>} eyebrow="Bottleneck">
        {bn.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">No workflow steps are backed up right now.</p>
        ) : (
          <>
            <BarListRows rows={bottleneckRows} className="gap-1" />
            {worst && (
              <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11.5px] leading-relaxed text-slate-500">
                <b className="text-slate-700">{worst.step}</b> is the slowest hop at{" "}
                <b className="text-slate-700">{worst.avgDays} days</b> on average — clear it first and close-out time drops
                across the board.
              </p>
            )}
          </>
        )}
      </PanelCard>

      {/* ── Where it's concentrated ── */}
      <PanelCard icon={LayoutGrid} title={concentratedTitle} eyebrow="Root cause">
        {cat.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">No open observations to break down.</p>
        ) : (
          <BarListRows rows={categoryRows} />
        )}
      </PanelCard>

      {/* ── Likely duplicates (data quality) ── */}
      {duplicate && (
        <PanelCard icon={CopyCheck} title="Likely duplicates" eyebrow="Data quality" eyebrowVariant="warning">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold tabular-nums text-slate-900">{duplicate.sets}</span>
            <span className="text-sm text-slate-500">sets · {duplicate.records} records</span>
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">
            Same area, logged under 48h apart, near-identical text. Merging clears roughly {duplicate.pctOfOpen}% of the
            open list.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3 font-semibold text-slate-700 hover:border-primary-300 hover:text-primary-700">
            <Link
              href={basePath === "/observations" ? "/observations?insight=observation:duplicate:near-identical" : basePath}
            >
              Review {duplicate.records} records
            </Link>
          </Button>
        </PanelCard>
      )}
    </div>
  );
}
