"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────
// Widget viz primitives (UI Depth sprint, Deliverable 1).
//
// Small, pure presentational building blocks the 16 dashboard widgets
// compose from. Native SVG / CSS — no chart lib at this size — so they
// render instantly and stay crisp at any widget span.
// ─────────────────────────────────────────────────────────────────────

export type Tone = "good" | "warn" | "bad" | "neutral";

export const TONE_TEXT: Record<Tone, string> = {
  good: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-rose-700",
  neutral: "text-slate-700",
};
export const TONE_BAR: Record<Tone, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-rose-500",
  neutral: "bg-slate-400",
};
export const TONE_CHIP: Record<Tone, string> = {
  good: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warn: "bg-amber-50 text-amber-700 border-amber-200",
  bad: "bg-rose-50 text-rose-700 border-rose-200",
  neutral: "bg-slate-100 text-slate-600 border-slate-200",
};

export function pctTone(pct: number): Tone {
  return pct >= 80 ? "good" : pct >= 60 ? "warn" : "bad";
}

// ─── RadialGauge ─────────────────────────────────────────────────────
/** 0–100 semicircular gauge; colour follows the value band (red→amber→
 *  green). Used by the Regulatory Compliance Score widget. */
export function RadialGauge({ value, label, size = 140 }: { value: number; label?: string; size?: number }) {
  const v = Math.max(0, Math.min(100, value));
  const stroke = 12;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * r; // semicircle
  const dash = (v / 100) * circumference;
  const color = v >= 80 ? "#10b981" : v >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`} role="img" aria-label={`${label ?? "Score"}: ${v}%`}>
        <path d={`M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`} fill="none" stroke="#e2e8f0" strokeWidth={stroke} strokeLinecap="round" />
        <path
          d={`M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="-mt-7 flex flex-col items-center">
        <span className="font-numeric text-3xl font-bold leading-none text-slate-900">{Math.round(v)}</span>
        {label && <span className="text-overline text-slate-500 mt-0.5">{label}</span>}
      </div>
    </div>
  );
}

// ─── Donut ───────────────────────────────────────────────────────────
export interface DonutSegment {
  label: string;
  count: number;
  color: string;
  href?: string;
}
/** Multi-segment donut with a value in the centre. Used by Skill Matrix. */
export function Donut({ segments, centerValue, centerLabel, size = 132 }: { segments: DonutSegment[]; centerValue: string; centerLabel?: string; size?: number }) {
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.count, 0) || 1;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label="Distribution donut">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const len = (s.count / total) * c;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
        <text x={size / 2} y={size / 2} transform={`rotate(90 ${size / 2} ${size / 2})`} textAnchor="middle" dominantBaseline="central" className="rotate-90 font-numeric" style={{ fontSize: 22, fontWeight: 700, fill: "#0f172a" }}>
          {centerValue}
        </text>
      </svg>
      <ul className="flex-1 space-y-1">
        {segments.map((s, i) => {
          const row = (
            <span className="flex items-center justify-between gap-2 text-caption">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
                <span className="truncate text-slate-600">{s.label}</span>
              </span>
              <span className="font-numeric font-semibold text-slate-800">{s.count}</span>
            </span>
          );
          return (
            <li key={i}>
              {s.href ? (
                <Link href={s.href} className="block rounded px-1 -mx-1 hover:bg-slate-50">
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          );
        })}
        {centerLabel && <li className="pt-0.5 text-[10px] uppercase tracking-wide text-slate-400">{centerLabel}</li>}
      </ul>
    </div>
  );
}

// ─── Pipeline ────────────────────────────────────────────────────────
export interface PipelineStage {
  label: string;
  count: number;
  href?: string;
}
/** Horizontal stage counters with chevrons between them. Used by MOC and
 *  Incident Investigation status. */
export function Pipeline({ stages }: { stages: PipelineStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
      {stages.map((s, i) => {
        const intensity = s.count === 0 ? 0 : 0.25 + 0.75 * (s.count / max);
        const inner = (
          <div className="flex min-w-[64px] flex-1 flex-col items-center rounded-lg border border-slate-100 px-1.5 py-2 transition hover:border-primary-200">
            <span className="font-numeric text-lg font-bold leading-none" style={{ color: `rgba(124,58,237,${Math.max(0.35, intensity)})` }}>
              {s.count}
            </span>
            <span className="mt-1 text-center text-[10px] leading-tight text-slate-500">{s.label}</span>
          </div>
        );
        return (
          <React.Fragment key={i}>
            {s.href ? (
              <Link href={s.href} className="flex-1">
                {inner}
              </Link>
            ) : (
              <div className="flex-1">{inner}</div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── StackedAgeBars (Open Actions by Age) ────────────────────────────
export interface AgeRow {
  source: string;
  buckets: number[]; // [0-7, 8-30, 31-90, 90+]
}
const AGE_COLORS = ["#10b981", "#f59e0b", "#f97316", "#ef4444"];
const AGE_LABELS = ["0–7d", "8–30d", "31–90d", "90d+"];
export function StackedAgeBars({ rows }: { rows: AgeRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.buckets.reduce((a, b) => a + b, 0)));
  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const total = r.buckets.reduce((a, b) => a + b, 0);
        return (
          <div key={r.source}>
            <div className="mb-1 flex items-center justify-between text-caption">
              <span className="text-slate-600">{r.source}</span>
              <span className="font-numeric text-slate-500">{total}</span>
            </div>
            <div className="flex h-3 overflow-hidden rounded bg-slate-100">
              {r.buckets.map((b, i) => (
                <div key={i} style={{ width: `${(b / max) * 100}%`, backgroundColor: AGE_COLORS[i] }} title={`${AGE_LABELS[i]}: ${b}`} />
              ))}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
        {AGE_LABELS.map((l, i) => (
          <span key={l} className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: AGE_COLORS[i] }} />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── RankedBars (Top Repeat Hazards) ─────────────────────────────────
export interface RankedRow {
  label: string;
  value: number;
  meta?: React.ReactNode;
  href?: string;
}
export function RankedBars({ rows, color = "#7c3aed" }: { rows: RankedRow[]; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <EmptyHint>No data in the selected period.</EmptyHint>;
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => {
        const inner = (
          <>
            <div className="mb-0.5 flex items-center justify-between gap-2 text-caption">
              <span className="truncate text-slate-700">{r.label}</span>
              <span className="flex items-center gap-2">
                {r.meta}
                <span className="font-numeric font-semibold text-slate-800">{r.value}</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-slate-100">
              <div className="h-full rounded" style={{ width: `${(r.value / max) * 100}%`, backgroundColor: color }} />
            </div>
          </>
        );
        return (
          <li key={i}>
            {r.href ? (
              <Link href={r.href} className="block rounded px-1 -mx-1 hover:bg-slate-50">
                {inner}
              </Link>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ─── SubBar (compliance sub-scores / dept coverage) ──────────────────
export function SubBar({ label, pct, suffix, href }: { label: string; pct: number | null; suffix?: React.ReactNode; href?: string }) {
  const tone: Tone = pct === null ? "neutral" : pctTone(pct);
  const inner = (
    <div className="py-1">
      <div className="mb-0.5 flex items-center justify-between text-caption">
        <span className="truncate text-slate-600">{label}</span>
        <span className="flex items-center gap-2">
          {suffix}
          <span className={cn("font-numeric font-semibold", TONE_TEXT[tone])}>{pct === null ? "—" : `${pct}%`}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-slate-100">
        <div className={cn("h-full rounded", TONE_BAR[tone])} style={{ width: pct === null ? "0%" : `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded px-1 -mx-1 hover:bg-slate-50">
      {inner}
    </Link>
  ) : (
    inner
  );
}

// ─── MiniStatTile (2×2 KPI grids: PTW, EAI) ──────────────────────────
export function MiniStatTile({ label, value, sub, tone = "neutral", href }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: Tone; href?: string }) {
  const inner = (
    <div className="flex h-full flex-col rounded-lg border border-slate-100 p-2.5 transition hover:border-primary-200">
      <span className="text-overline text-slate-500">{label}</span>
      <span className={cn("font-numeric text-2xl font-bold leading-tight", TONE_TEXT[tone])}>{value}</span>
      {sub && <span className="mt-0.5 text-[10px] text-slate-500">{sub}</span>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}

// ─── DaysTile (Days Since Last Incident) ─────────────────────────────
export function DaysTile({ label, days, href }: { label: string; days: number | null; href?: string }) {
  const color = days === null ? "text-slate-400" : days > 365 ? "text-amber-500" : days >= 90 ? "text-emerald-600" : days >= 30 ? "text-amber-600" : "text-rose-600";
  const inner = (
    <div className="flex h-full flex-col items-center justify-center rounded-lg border border-slate-100 px-2 py-3 text-center transition hover:border-primary-200">
      <span className={cn("font-numeric text-3xl font-bold leading-none", color)}>{days === null ? "—" : days}</span>
      <span className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}

// ─── Shared small bits ───────────────────────────────────────────────
export function StatChip({ value, label, tone = "neutral", href }: { value: React.ReactNode; label: string; tone?: Tone; href?: string }) {
  const cls = cn("chip gap-1", TONE_CHIP[tone]);
  const body = (
    <>
      <span className="font-numeric font-bold tabular-nums">{value}</span>
      <span className="text-[10px] uppercase tracking-wide">{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className={cn(cls, "transition hover:brightness-95")}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center px-3 py-6 text-center text-caption text-slate-400">{children}</div>;
}
