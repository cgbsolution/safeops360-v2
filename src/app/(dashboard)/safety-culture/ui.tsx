"use client";

// Shared presentational components for the Safety Culture module.
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  COMPONENT_META,
  PALETTE,
  STAGE_BG,
  STAGE_COLOR,
  STAGES,
  type ComponentScores,
  type PlantOption,
  type Stage,
  scoreColor,
} from "./lib";

export function StageBadge({ stage, className = "" }: { stage: Stage; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
      style={{ background: STAGE_BG[stage], color: STAGE_COLOR[stage] }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: STAGE_COLOR[stage] }} />
      {stage}
    </span>
  );
}

/** Circular gauge for a 0-100 score. */
export function ScoreDial({ score, size = 132, label }: { score: number; size?: number; label?: string }) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const color = scoreColor(score);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E8EEF7" strokeWidth={10} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold" style={{ color: PALETTE.navy }}>
          {score.toFixed(1)}
        </span>
        {label && <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>}
      </div>
    </div>
  );
}

/** Horizontal bars for the five component scores with their weights. Each label
 *  carries a disclosure tooltip (§Fix 6); the Leading/Lagging row links to its
 *  drill-down when a plantId is supplied (§Fix 2). */
export function ComponentBars({ scores, plantId }: { scores: ComponentScores; plantId?: string | null }) {
  return (
    <div className="space-y-2.5">
      {COMPONENT_META.map((c) => {
        const v = Math.round(scores?.[c.key] ?? 0);
        const isLL = c.key === "leadingLaggingRatio";
        const label = (
          <span className="inline-flex items-center gap-1 font-medium text-slate-700" title={c.tip}>
            {c.label}
            <span className="cursor-help text-[10px] text-slate-400" aria-hidden>
              ⓘ
            </span>
          </span>
        );
        return (
          <div key={c.key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              {isLL && plantId ? (
                <Link
                  href={`/safety-culture/leading-lagging?plant=${plantId}`}
                  className="inline-flex items-center gap-1 font-medium text-slate-700 hover:underline"
                  style={{ color: PALETTE.navy }}
                  title={c.tip}
                >
                  {c.label} <span className="text-[10px]">↗</span>
                </Link>
              ) : (
                label
              )}
              <span className="text-slate-500">
                <span className="font-semibold" style={{ color: PALETTE.navy }}>
                  {v}
                </span>{" "}
                · {c.weight}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${v}%`, background: scoreColor(v) }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Inline SVG sparkline for a series of scores. */
export function Sparkline({ values, width = 160, height = 40, color = PALETTE.gold }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (!values || values.length < 2) {
    return <div className="text-xs text-slate-400">Not enough history yet</div>;
  }
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 100);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 4) + 2;
    const y = height - 2 - ((v - min) / span) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r={2.5} fill={color} />
    </svg>
  );
}

/** The maturity-stage legend row. */
export function StageLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
      {STAGES.map((s, i) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STAGE_COLOR[s] }} />
          {s} <span className="text-slate-400">({i * 25 + (i === 0 ? 0 : 1)}–{(i + 1) * 25})</span>
        </span>
      ))}
    </div>
  );
}

/** Banner explaining that culture scores are live ERM KRIs (the differentiator). */
export function KriBanner() {
  return (
    <div
      className="mb-5 flex items-start gap-3 rounded-xl border p-4 text-sm"
      style={{ borderColor: PALETTE.gold, background: "linear-gradient(90deg,#0B1F4D,#122a5e)" }}
    >
      <span className="mt-0.5 text-lg" style={{ color: PALETTE.gold }}>◆</span>
      <div className="text-white/90">
        <span className="font-semibold text-white">Live on the Enterprise Risk Register.</span>{" "}
        These culture scores auto-feed the ERM engine as Key Risk Indicators against the{" "}
        <span className="font-medium" style={{ color: PALETTE.gold }}>“Human Factor / Safety Culture Risk”</span>{" "}
        entry — no manual data entry, no disconnected culture app. A breach triggers the same escalation workflow as any operational risk KRI.
      </div>
    </div>
  );
}

/** Plant selector that drives the `?plant=` query param. When `allowAll` is set it
 *  offers an "All Sites" option (value "all") that switches the page to the §Fix 7
 *  portfolio rollup. */
export function PlantSelect({
  plants,
  current,
  allowAll = false,
}: {
  plants: PlantOption[];
  current: string | null;
  allowAll?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(search.toString());
    params.set("plant", e.target.value);
    router.push(`${pathname}?${params.toString()}`);
  }
  return (
    <select
      value={current ?? ""}
      onChange={onChange}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none"
    >
      {!current && <option value="">Select a site…</option>}
      {allowAll && <option value="all">◆ All sites (portfolio)</option>}
      {plants.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

// ── §Fix 7 multi-site rollup — ranked portfolio comparison ────────────────────
export type RollupRow = Record<string, unknown> & {
  plantId: string;
  plantName: string;
  plantCode: string;
  state?: string | null;
};

// String format specs (not functions) so a server component can render this
// client component directly — function props can't cross the RSC boundary.
export type RollupFormat = "int" | "pct" | "ratio" | "points" | "score" | "raw";
export type RollupColumn = { key: string; label: string; format?: RollupFormat };

function asNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function fmt(v: unknown, spec: RollupFormat = "int"): string {
  if (spec === "raw") return v == null ? "—" : String(v);
  const n = asNum(v);
  switch (spec) {
    case "pct":
      return `${Math.round(n)}%`;
    case "ratio":
      return `${n >= 10 ? Math.round(n) : n.toFixed(1)}:1`;
    case "points":
      return `${Math.round(n).toLocaleString()} pts`;
    case "score":
    case "int":
    default:
      return String(Math.round(n));
  }
}

/** Ranked, horizontally-barred site comparison — matches the "Sites by Maturity
 *  Stage" language on the Culture Maturity dashboard. */
export function SiteRollupTable({
  rows,
  headlineKey,
  headlineFormat = "int",
  headlineLabel,
  barKey,
  barColorMode = "score",
  columns = [],
  average,
  averageLabel,
  emptyHint,
}: {
  rows: RollupRow[];
  headlineKey: string;
  headlineFormat?: RollupFormat;
  headlineLabel: string;
  barKey: string;
  barColorMode?: "score" | "fixed";
  columns?: RollupColumn[];
  average?: number | null;
  averageLabel?: string;
  emptyHint?: string;
}) {
  const maxBar = Math.max(1, ...rows.map((r) => asNum(r[barKey])));
  const fmtHead = (r: RollupRow) => fmt(r[headlineKey], headlineFormat);

  if (rows.length === 0) {
    return <EmptyState title="No sites in your scope" hint={emptyHint} />;
  }

  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: PALETTE.navy }}>
          {headlineLabel} — {rows.length} sites
        </p>
        {average != null && (
          <span className="text-xs text-slate-500">
            {averageLabel ?? "Average"}: <span className="font-semibold text-slate-700">{average}</span>
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {rows.map((r, i) => {
          const barVal = asNum(r[barKey]);
          const width = (barVal / maxBar) * 100;
          const color = barColorMode === "score" ? scoreColor(barVal) : PALETTE.navy;
          return (
            <div key={r.plantId} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: "#F1F5F9", color: PALETTE.navy }}
              >
                {i + 1}
              </span>
              <div className="w-40 shrink-0">
                <p className="truncate text-sm font-medium text-slate-800">{r.plantName}</p>
                <p className="text-[11px] text-slate-400">
                  {r.plantCode}
                  {r.state ? ` · ${r.state}` : ""}
                </p>
              </div>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
              </div>
              {columns.map((c) => (
                <span key={c.key} className="hidden w-24 shrink-0 text-right text-[11px] text-slate-500 sm:inline">
                  <span className="font-semibold text-slate-700">{fmt(r[c.key], c.format)}</span>
                  <span className="ml-1 text-slate-400">{c.label}</span>
                </span>
              ))}
              <span className="w-20 shrink-0 text-right text-sm font-bold" style={{ color }}>
                {fmtHead(r)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
