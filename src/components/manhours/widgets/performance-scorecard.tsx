import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";

export interface ScorecardRow {
  plantId: string;
  plantCode: string;
  plantName: string;
  /** 0-100 composite score. */
  score: number;
  /** Display band derived from score. */
  band: "WORLD_CLASS" | "EXCELLENT" | "AVERAGE" | "POOR";
  /** Per-KPI contributions for the breakdown tooltip / drilldown. */
  contributions: { code: string; weight: number; rawValue: number; normalised: number }[];
}

/**
 * Multi-plant composite scorecard. Each plant's score is the
 * weighted average of its KPI band positions, with configurable
 * weights (see SCORECARD_WEIGHTS in lib/manhours/personas.ts).
 *
 * Brief calls this out as the key surface senior leadership uses to
 * rank plants for incentive calculations + performance reviews.
 */
export function PerformanceScorecard({
  rows,
  href
}: {
  rows: ScorecardRow[];
  /** Per-plant drill href. */
  href?: (row: ScorecardRow) => string;
}) {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Trophy size={14} className="text-amber-600" />
          Plant Performance Scorecard
        </CardTitle>
        <CardDescription>
          Weighted composite (LTIFR 25% · TRIFR 15% · Severity 15% · Near Miss 10% · Training 10% ·
          Inspection 10% · CAPA 10% · PTW-FLRA 5%). Higher is better.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500 border-b">
              <tr>
                <th className="px-2 py-2 text-left">Rank</th>
                <th className="px-2 py-2 text-left">Plant</th>
                <th className="px-2 py-2 text-right">Score</th>
                <th className="px-2 py-2 text-left">Band</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map((r, i) => {
                const tone = BAND_TONE[r.band];
                const rowHref = href ? href(r) : null;
                // Plant-name cell is the click target when href is set —
                // wrapping the whole row in an <a> would put <td>s inside
                // an anchor, which is invalid HTML and triggers React's
                // hydration error. Per-cell anchors keep the table valid.
                return (
                  <tr key={r.plantId} className={rowHref ? "hover:bg-slate-50" : ""}>
                    <td className="px-2 py-2 font-mono text-xs tabular-nums">{i + 1}</td>
                    <td className="px-2 py-2">
                      {rowHref ? (
                        <Link href={rowHref} className="block hover:text-primary-700 transition">
                          <div className="font-medium">{r.plantName}</div>
                          <div className="text-[10px] text-slate-500">{r.plantCode}</div>
                        </Link>
                      ) : (
                        <>
                          <div className="font-medium">{r.plantName}</div>
                          <div className="text-[10px] text-slate-500">{r.plantCode}</div>
                        </>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className="font-bold tabular-nums">{r.score.toFixed(1)}</span>
                      <span className="text-slate-400 text-xs"> / 100</span>
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={cn("inline-block rounded px-2 py-0.5 text-[10px] font-medium uppercase", tone.chip)}
                      >
                        {r.band.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      {/* Mini score bar */}
                      <div className="relative h-1.5 w-24 ml-auto rounded bg-slate-200 overflow-hidden">
                        <div
                          className={cn("absolute left-0 top-0 h-full", tone.bar)}
                          style={{ width: `${Math.max(0, Math.min(100, r.score))}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

const BAND_TONE: Record<ScorecardRow["band"], { chip: string; bar: string }> = {
  WORLD_CLASS: { chip: "bg-emerald-100 text-emerald-800", bar: "bg-emerald-500" },
  EXCELLENT: { chip: "bg-lime-100 text-lime-800", bar: "bg-lime-500" },
  AVERAGE: { chip: "bg-amber-100 text-amber-800", bar: "bg-amber-500" },
  POOR: { chip: "bg-rose-100 text-rose-800", bar: "bg-rose-500" }
};

/** Derive the display band from a 0-100 score. */
export function scoreBand(score: number): ScorecardRow["band"] {
  if (score >= 85) return "WORLD_CLASS";
  if (score >= 70) return "EXCELLENT";
  if (score >= 50) return "AVERAGE";
  return "POOR";
}
