"use client";

/**
 * Section 1 — the audit report's insight layer, on screen.
 *
 * Renders `snapshot.insights` and computes nothing. The block was built by
 * `services/insights/rules_audit_report` and hashed into the immutable snapshot
 * at issue, so this component and `report_pdf.py` are two renderings of one
 * frozen object — they cannot disagree about what the audit found, and neither
 * can drift from it after issue.
 *
 * Charts are inline SVG, which prints: the browser `Print` button uses the same
 * DOM, and the server-side PDF is drawn separately by fpdf2 (pure Python, no
 * headless browser anywhere in the pipeline). Nothing here is canvas-based for
 * that reason.
 */

import { useState } from "react";
import { AlertTriangle, ChevronDown, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InsightBand, ReportInsights, ReportInsightPattern } from "../../../lib";

// Band -> classes. The BANDING DECISION is not made here: the backend already
// assigned every gauge and bar its band and froze it. This only says what each
// band looks like, so the screen and the PDF cannot colour one number two ways.
const BAND_TEXT: Record<InsightBand, string> = {
  green: "text-emerald-600", amber: "text-amber-600",
  red: "text-rose-600", neutral: "text-slate-400",
};
const BAND_STROKE: Record<InsightBand, string> = {
  green: "stroke-emerald-500", amber: "stroke-amber-500",
  red: "stroke-rose-500", neutral: "stroke-slate-300",
};
const BAND_FILL: Record<InsightBand, string> = {
  green: "fill-emerald-500", amber: "fill-amber-500",
  red: "fill-rose-500", neutral: "fill-slate-200",
};

const SEV_ACCENT: Record<string, string> = {
  critical: "border-l-rose-500 bg-rose-50/60",
  high: "border-l-amber-500 bg-amber-50/60",
  watch: "border-l-primary-500 bg-primary-50/50",
  info: "border-l-slate-300 bg-slate-50",
};
const SEV_TEXT: Record<string, string> = {
  critical: "text-rose-700", high: "text-amber-700",
  watch: "text-primary-800", info: "text-slate-600",
};

export function InsightSummary({ insights }: { insights: ReportInsights }) {
  const { gauge, criticalBanner, categoryChart, capaStrip, repeats, patterns } = insights;
  const chart = categoryChart.filter((c) => c.total > 0);

  return (
    <div className="relative z-10 mt-5 break-inside-avoid">
      <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-primary-800">
        Insight summary
      </h2>

      {/* The gate, as a banner rather than a sentence to skim past. The RULE is
          unchanged — this is the same critical-fail gate the verdict already
          applied, only visible. */}
      {criticalBanner && (
        <div className="mb-3 flex items-start gap-2 rounded-md border-l-4 border-l-rose-600 bg-rose-50 px-3 py-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-600" />
          <div>
            <div className="text-[13px] font-bold text-rose-800">{criticalBanner.headline}</div>
            {criticalBanner.codes.length > 0 && (
              <div className="mt-0.5 font-mono text-[11px] text-rose-700">
                {criticalBanner.codes.join(", ")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gauge + headline counts */}
      <div className="flex flex-wrap items-center gap-5">
        <Gauge
          pct={gauge.pct}
          band={gauge.displayBand}
          label={(gauge.result ?? "—").replace(/_/g, " ")}
          points={gauge.scoreAllotted ? `${gauge.scoreObtained} of ${gauge.scoreAllotted} points` : null}
        />
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
          <Tile label="Assessed" value={`${gauge.assessed ?? "—"}/${gauge.applicable ?? "—"}`} />
          <Tile label="Repeat NC" value={`${repeats?.count ?? 0}`} tone={repeats?.count ? "text-rose-600" : undefined} />
          <Tile label="CAPAs open" value={`${capaStrip.open}/${capaStrip.total}`} tone={capaStrip.open ? "text-amber-600" : undefined} />
          <Tile label="CAPAs overdue" value={`${capaStrip.overdue}`} tone={capaStrip.overdue ? "text-rose-600" : undefined} />
          <Tile label="Patterns" value={`${patterns.length}`} />
          <Tile label="Band" value={gauge.bandLabel} tone={BAND_TEXT[gauge.band]} />
        </div>
      </div>

      {/* The rule behind the verdict. A number without its rule is not a result. */}
      {gauge.explanation && (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-600">{gauge.explanation}</p>
      )}
      {gauge.coverageLabel && (
        <p className="mt-1 text-[11px] italic text-slate-500">
          {gauge.coverageLabel} — no overall grade is issued for this report.
        </p>
      )}

      {/* Discipline bars — worst first. `pct == null` (nothing assessed) draws
          an empty track, never a red 0%: not-assessed is not failed-everything. */}
      {chart.length > 0 && (
        <div className="mt-4">
          <SubHead>Compliance by discipline</SubHead>
          <div className="space-y-1.5">
            {chart.map((c) => (
              <div key={c.categoryId} className="flex items-center gap-3">
                <div className="w-32 shrink-0 truncate text-[12px] text-slate-700">{c.name}</div>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  {c.pct != null && (
                    <div
                      className={cn("h-full rounded-full", {
                        green: "bg-emerald-500", amber: "bg-amber-500",
                        red: "bg-rose-500", neutral: "bg-slate-300",
                      }[c.band])}
                      style={{ width: `${Math.max(0, Math.min(100, c.pct))}%` }}
                    />
                  )}
                </div>
                <div className={cn("w-14 shrink-0 text-right text-[12px] font-semibold tabular-nums", BAND_TEXT[c.band])}>
                  {c.pct == null ? "n/a" : `${c.pct}%`}
                </div>
                {/* The arithmetic behind the percentage and the FULL outcome
                    split. This line used to read "32P 4F / 40", omitting
                    Partial even though partials earn points toward the figure
                    beside it — so the counts never summed to the total. */}
                <div className="w-24 shrink-0 text-right text-[11px] tabular-nums text-slate-400">
                  {c.scoreObtained}/{c.scoreAllotted} pts
                </div>
                <div className="hidden w-32 shrink-0 text-right text-[11px] tabular-nums text-slate-400 sm:block">
                  {c.passed}P {c.partial}Ptl {c.failed}F{c.na ? ` ${c.na}NA` : ""} / {c.total}
                </div>
              </div>
            ))}
          </div>
          {/* One sentence that answers the question the chart otherwise raises:
              what IS this percentage? Without it a reader reasonably assumes
              "85% of checkpoints passed", which it is not. */}
          <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
            Score = points earned / points available. Each assessed checkpoint is worth 3 points:
            Effective 3, Some Improvement Needed 2, Major Improvement Needed 1, Unsatisfactory 0,
            and a repeat finding &minus;1. N/A checkpoints are excluded. Same calculation as the
            overall score above.
          </p>
        </div>
      )}

      {/* Systemic patterns */}
      {patterns.length > 0 ? (
        <div className="mt-4">
          <SubHead>Systemic patterns</SubHead>
          <div className="space-y-2">
            {patterns.map((p) => <PatternCard key={p.id} pattern={p} />)}
          </div>
          {!!insights.patternsSuppressedCount && (
            <p className="mt-1 text-[10px] text-slate-400">
              {insights.patternsSuppressedCount} lower-ranked pattern(s) not shown.
            </p>
          )}
        </div>
      ) : insights.patternNote ? (
        // Say why there is nothing here. A silent gap reads as a broken component.
        <p className="mt-3 text-[11px] italic text-slate-500">{insights.patternNote}</p>
      ) : null}

      {/* Repeat non-conformances — pulled OUT of the category-grouped register
          below, which is the whole point: a repeat finding buried among its
          category peers is the one a reader most needs not to miss. */}
      {repeats && repeats.count > 0 && (
        <div className="mt-4 rounded-md border border-rose-200 bg-rose-50/70 p-3">
          <div className="flex items-center gap-2">
            <Repeat size={15} className="shrink-0 text-rose-600" />
            <div className="text-[13px] font-bold text-rose-800">{repeats.headline}</div>
          </div>
          <div className="mt-2 space-y-2">
            {repeats.items.map((it) => (
              <div key={it.checkpointCode} className="rounded border border-rose-200 bg-white p-2">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="font-mono font-semibold text-rose-700">{it.checkpointCode}</span>
                  <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700">
                    {it.statusLabel}
                  </span>
                  <span className="text-slate-400">{it.discipline}</span>
                  {it.capaNumber && (
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">{it.capaNumber}</span>
                  )}
                </div>
                <div className="mt-1 text-[12px] text-slate-700">{it.question}</div>
                {it.observation && (
                  <div className="mt-0.5 text-[11px] italic text-slate-500">{it.observation}</div>
                )}
              </div>
            ))}
          </div>
          {repeats.truncated > 0 && (
            <p className="mt-1.5 text-[10px] text-rose-700">
              {repeats.truncated} further repeat finding(s) appear in the findings register below.
            </p>
          )}
        </div>
      )}

      {/* CAPA status strip */}
      {capaStrip.chips.length > 0 && (
        <div className="mt-4">
          <SubHead>CAPA status</SubHead>
          <div className="flex flex-wrap gap-1.5">
            {capaStrip.chips.map((c) => {
              const closed = ["CLOSED", "VERIFIED", "CLOSED_RECURRED"].includes(c.status.toUpperCase());
              return (
                <span
                  key={`${c.capaNumber}-${c.checkpointCode}`}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    closed ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800",
                  )}
                >
                  <span className="font-mono font-semibold">{c.capaNumber}</span>
                  <span className="opacity-60">{c.checkpointCode}</span>
                  <span className="uppercase">{c.status.replace(/_/g, " ")}</span>
                </span>
              );
            })}
          </div>
          {capaStrip.truncated > 0 && (
            <p className="mt-1 text-[10px] text-slate-400">
              {capaStrip.truncated} further linked CAPA(s) — see the CAPA summary and findings register below.
            </p>
          )}
        </div>
      )}

      {/* Provenance, stated where it is read. Without it a reader cannot tell a
          computed summary from the auditor's written opinion, and the
          difference matters to whoever has to defend the report. */}
      <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] leading-relaxed text-slate-400">
        Computed by fixed rules from the findings recorded below and frozen into this report at
        issue. It re-presents the register; it does not add to it. No judgement here overrides the
        auditor&rsquo;s.
      </p>
    </div>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-1.5">
      <div className={cn("text-base font-extrabold tabular-nums", tone ?? "text-slate-800")}>{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

/** Radial gauge as inline SVG — a stroked circle with `stroke-dasharray`, which
 *  needs no library and prints identically to how it renders. */
function Gauge({ pct, band, label, points }: {
  pct: number | null; band: InsightBand; label: string; points?: string | null;
}) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const frac = pct == null ? 0 : Math.max(0, Math.min(100, pct)) / 100;
  return (
    <div className="shrink-0 text-center">
      <svg width="92" height="92" viewBox="0 0 92 92" role="img"
        aria-label={`Overall compliance ${pct == null ? "not available" : `${pct}%`} — ${label}`}>
        <circle cx="46" cy="46" r={R} fill="none" strokeWidth="11" className="stroke-slate-200" />
        {pct != null && (
          // Rotated -90° so the sweep starts at 12 o'clock, like a gauge.
          <circle
            cx="46" cy="46" r={R} fill="none" strokeWidth="11" strokeLinecap="butt"
            className={BAND_STROKE[band]}
            strokeDasharray={`${frac * C} ${C}`}
            transform="rotate(-90 46 46)"
          />
        )}
        <text x="46" y="45" textAnchor="middle" dominantBaseline="middle"
          className={cn("text-[15px] font-extrabold tabular-nums", BAND_FILL[band])}>
          {pct == null ? "n/a" : `${pct}%`}
        </text>
        <text x="46" y="59" textAnchor="middle" dominantBaseline="middle"
          className="fill-slate-400 text-[7px] font-semibold uppercase tracking-wider">
          overall
        </text>
      </svg>
      <div className={cn("mt-0.5 text-[11px] font-bold uppercase", BAND_TEXT[band])}>{label}</div>
      {/* What the dial is made of, so the headline reconciles by hand against
          the category table below it. */}
      {!!points && (
        <div className="text-[10px] tabular-nums text-slate-400">{points}</div>
      )}
    </div>
  );
}

function PatternCard({ pattern: p }: { pattern: ReportInsightPattern }) {
  const [open, setOpen] = useState(false);
  const extra = p.refCount - p.recordRefs.length;
  return (
    <div className={cn("rounded-md border-l-4 px-3 py-2", SEV_ACCENT[p.severity] ?? SEV_ACCENT.info)}>
      <div className="flex items-start justify-between gap-2">
        <div className={cn("text-[12.5px] font-bold", SEV_TEXT[p.severity] ?? SEV_TEXT.info)}>
          {p.headline}
        </div>
        <span className="shrink-0 rounded-full bg-white/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-500">
          {p.confidence} confidence
        </span>
      </div>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-600">{p.evidence}</p>
      {/* The wording pattern is the one tier grounded in freeform text rather
          than a structured field. Say so on the card — a reader must be able to
          tell an inference about copy from an inference about the record. */}
      {p.basis === "observation_text" && (
        <p className="mt-1 text-[10px] italic text-slate-500">
          Based on observation text, which is freeform — this reports shared wording, not a
          confirmed common cause.
        </p>
      )}
      {p.suggestedAction && (
        <p className="mt-1 text-[11px] font-medium text-primary-800">{p.suggestedAction}</p>
      )}
      {p.recordRefs.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-700 print:hidden"
        >
          <ChevronDown size={11} className={cn("transition-transform", open && "rotate-180")} />
          {p.refCount} checkpoint(s)
        </button>
      )}
      <div className={cn("mt-1 font-mono text-[10px] text-slate-500", !open && "hidden print:block")}>
        {p.recordRefs.join(", ")}
        {extra > 0 && ` +${extra} more`}
      </div>
    </div>
  );
}
