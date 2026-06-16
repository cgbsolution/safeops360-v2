import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { KpiResult } from "@/lib/manhours/kpi-engine";

/**
 * Speedometer-style gauge. Shows the KPI value as a needle on a
 * banded arc (world-class → poor). Pure SVG — no chart lib — so
 * it renders identically server-side and as a thumbnail in audit
 * exports.
 *
 * Falls back to a plain tile when the KPI has no benchmarks
 * defined (DAYS_SINCE_LAST_LTI, COST_OF_INCIDENTS, FSI).
 */
export function KpiGauge({
  kpi,
  href
}: {
  kpi: KpiResult;
  href?: string;
}) {
  const benchmarks = kpi.benchmarks;
  if (!benchmarks) {
    // No benchmark scale → render the value as a static panel.
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">{kpi.kpiName}</div>
          <div className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{kpi.formattedValue}</div>
          <div className="text-[10px] text-slate-500 mt-1">No benchmark scale</div>
        </CardContent>
      </Card>
    );
  }

  // Arc geometry: 180° from -90° (left) to 90° (right), value mapped
  // onto [0, π]. higherIsBetter inverts so good is always on the right.
  // Cap the value at "poor + 50%" so an extreme outlier doesn't peg
  // the needle off-arc.
  const lo = kpi.higherIsBetter ? 0 : benchmarks.worldClass;
  const hi = kpi.higherIsBetter ? benchmarks.worldClass : benchmarks.poor * 1.5;
  const clamped = Math.max(lo, Math.min(hi, kpi.value));
  const t = (clamped - lo) / Math.max(hi - lo, 0.0001);
  const angle = kpi.higherIsBetter ? t * 180 - 90 : 90 - t * 180;

  // Band thresholds → angle positions for the coloured arc segments.
  const segments = bandSegments(benchmarks, kpi.higherIsBetter, lo, hi);

  const Inner = (
    <CardContent className="p-4">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{kpi.kpiName}</div>
      <div className="mt-2 flex items-center justify-center">
        <svg viewBox="-110 -110 220 130" className="w-full max-w-[180px] h-auto">
          {segments.map((seg, i) => (
            <path
              key={i}
              d={arcPath(100, seg.startAngle, seg.endAngle)}
              stroke={seg.color}
              strokeWidth={18}
              fill="none"
              strokeLinecap="butt"
            />
          ))}
          {/* needle */}
          <g transform={`rotate(${angle})`}>
            <line x1={0} y1={0} x2={0} y2={-92} stroke="#0f172a" strokeWidth={3} strokeLinecap="round" />
            <circle cx={0} cy={0} r={6} fill="#0f172a" />
          </g>
          {/* min / max ticks */}
          <text x={-100} y={20} textAnchor="middle" className="text-[9px] fill-slate-500">
            {kpi.higherIsBetter ? lo.toFixed(0) : benchmarks.worldClass}
          </text>
          <text x={100} y={20} textAnchor="middle" className="text-[9px] fill-slate-500">
            {kpi.higherIsBetter ? benchmarks.worldClass : hi.toFixed(0)}
          </text>
        </svg>
      </div>
      <div className="mt-2 text-center">
        <div className="text-2xl font-bold tabular-nums" style={{ color: kpi.bandColor }}>
          {kpi.formattedValue}
        </div>
        {kpi.band && (
          <div
            className="text-[10px] uppercase tracking-wider font-semibold mt-0.5"
            style={{ color: kpi.bandColor }}
          >
            {kpi.band.replace(/_/g, " ")}
          </div>
        )}
      </div>
    </CardContent>
  );

  if (!href) return <Card>{Inner}</Card>;
  return (
    <Link href={href} className="block">
      <Card className={cn("transition hover:shadow-md hover:border-primary-300")}>{Inner}</Card>
    </Link>
  );
}

// ── SVG helpers ───────────────────────────────────────────────

/** Polar → cartesian for our half-circle gauge. Angle in degrees;
 *  0° points UP. Result is the (x, y) on the arc at radius r. */
function polar(r: number, angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: r * Math.cos(rad), y: r * Math.sin(rad) };
}

function arcPath(r: number, startAngle: number, endAngle: number): string {
  const start = polar(r, startAngle + 90);
  const end = polar(r, endAngle + 90);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

interface BandSeg {
  startAngle: number;
  endAngle: number;
  color: string;
}

function bandSegments(
  b: { worldClass: number; excellent: number; average: number; poor: number },
  higherIsBetter: boolean,
  lo: number,
  hi: number
): BandSeg[] {
  // Same colours as the engine's BAND_COLOR map.
  const COL = { worldClass: "#10b981", excellent: "#84cc16", average: "#f59e0b", poor: "#ef4444" };
  const toAngle = (v: number) => {
    const clamped = Math.max(lo, Math.min(hi, v));
    const t = (clamped - lo) / Math.max(hi - lo, 0.0001);
    return higherIsBetter ? t * 180 - 90 : 90 - t * 180;
  };

  // We need 4 contiguous segments. Easiest: walk from lo→hi and tag
  // each portion with its band colour. Direction-inversion (higher
  // is better vs worse) flips which thresholds map to which colours.
  if (higherIsBetter) {
    // value 0 (worst) → worldClass (best). Bands: 0..poor=POOR,
    // poor..average=AVERAGE, average..excellent=EXCELLENT, excellent..max=WORLD_CLASS
    return [
      { startAngle: toAngle(lo), endAngle: toAngle(b.poor), color: COL.poor },
      { startAngle: toAngle(b.poor), endAngle: toAngle(b.average), color: COL.average },
      { startAngle: toAngle(b.average), endAngle: toAngle(b.excellent), color: COL.excellent },
      { startAngle: toAngle(b.excellent), endAngle: toAngle(b.worldClass), color: COL.worldClass }
    ];
  }
  // Lower is better — value 0 = best, value hi = worst.
  return [
    { startAngle: toAngle(lo), endAngle: toAngle(b.worldClass), color: COL.worldClass },
    { startAngle: toAngle(b.worldClass), endAngle: toAngle(b.excellent), color: COL.excellent },
    { startAngle: toAngle(b.excellent), endAngle: toAngle(b.average), color: COL.average },
    { startAngle: toAngle(b.average), endAngle: toAngle(hi), color: COL.poor }
  ];
}
