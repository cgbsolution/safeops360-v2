import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { KpiResult } from "@/lib/manhours/kpi-engine";

/**
 * Single KPI tile. Clickable — links into the C4 drill-down.
 * Renders the value, band chip, optional trend arrow, and a hover
 * cue indicating the drill-down. Same component drives every
 * persona dashboard's KPI tiles.
 */
export function KpiTile({
  kpi,
  trend,
  href,
  highlight
}: {
  kpi: KpiResult;
  trend?: {
    direction: "UP" | "DOWN" | "FLAT";
    percentChange: number | null;
    priorPeriodLabel: string;
  } | null;
  /** Drill-down link target. If omitted, the tile is non-interactive. */
  href?: string;
  /** Larger emphasis for the persona's "headline" KPI. */
  highlight?: boolean;
}) {
  const Inner = (
    <CardContent className={cn("p-4", highlight && "p-5")}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 leading-tight">
          {kpi.kpiName}
        </div>
        {href && <ExternalLink size={11} className="text-slate-300 group-hover:text-primary-500 flex-shrink-0" />}
      </div>
      <div
        className={cn("mt-1 font-bold tabular-nums", highlight ? "text-3xl" : "text-2xl")}
        style={{ color: kpi.bandColor }}
      >
        {kpi.formattedValue}
      </div>
      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
        {kpi.band && (
          <Badge style={{ backgroundColor: kpi.bandColor, color: "white" }} className="text-[9px] px-1.5 py-0">
            {kpi.band.replace(/_/g, " ")}
          </Badge>
        )}
        {trend && trend.direction !== "FLAT" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[10px] font-medium",
              isTrendGood(trend.direction, kpi.higherIsBetter) ? "text-emerald-600" : "text-rose-600"
            )}
          >
            {trend.direction === "UP" ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {trend.percentChange == null ? "—" : `${Math.abs(trend.percentChange).toFixed(1)}%`}
          </span>
        )}
        {trend && trend.direction === "FLAT" && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500">
            <Minus size={10} /> flat
          </span>
        )}
        <span className="text-[10px] text-slate-500 font-mono">{kpi.kpiCode}</span>
      </div>
    </CardContent>
  );

  if (!href) return <Card>{Inner}</Card>;
  return (
    <Link href={href} className="block group">
      <Card className="transition hover:shadow-md hover:border-primary-300">
        {Inner}
      </Card>
    </Link>
  );
}

function isTrendGood(direction: "UP" | "DOWN" | "FLAT", higherIsBetter: boolean): boolean {
  if (direction === "FLAT") return true;
  if (higherIsBetter) return direction === "UP";
  return direction === "DOWN";
}
