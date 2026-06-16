"use client";

import * as React from "react";
import { AlertTriangle, CalendarClock, GraduationCap, ShieldAlert } from "lucide-react";
import { KpiCard, KpiCardSkeleton } from "@/components/dashboard/kpi-card";
import type { KpiResult } from "@/lib/manhours/kpi-engine";
import type { SparkPoint } from "@/components/dashboard/sparkline";

/**
 * KpiCard visual review surface. The brief calls for a side-by-side
 * comparison against Linear / Stripe / Datadog after Commit 2 — this
 * page is that surface. Mock KpiResult data is built inline so the
 * page renders without hitting the database.
 *
 * Routes: /dashboard/preview
 *
 * Delete or fold into Storybook once a real Storybook is set up.
 */

// Client component — uses `Date.now()` and renders interactive event
// handlers (onRetry, onRefresh). force-static would fail prerender
// since functions can't be serialised across the server/client boundary.

// ─── Mock data ──────────────────────────────────────────────────

function spark(values: number[]): SparkPoint[] {
  const months = ["May 25", "Jun 25", "Jul 25", "Aug 25", "Sep 25", "Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26", "Mar 26", "Apr 26", "May 26"];
  return values.map((v, i) => ({ label: months[i] ?? `M${i}`, value: v }));
}

function mockKpi(opts: Partial<KpiResult> & { kpiCode: string; kpiName: string; value: number; formattedValue: string }): KpiResult {
  return {
    kpiCode: opts.kpiCode as any,
    kpiName: opts.kpiName,
    value: opts.value,
    formattedValue: opts.formattedValue,
    numerator: opts.numerator ?? 0,
    denominator: opts.denominator ?? 0,
    formula: opts.formula ?? "Mock formula",
    band: opts.band ?? "EXCELLENT",
    bandColor: opts.bandColor ?? "#84cc16",
    higherIsBetter: opts.higherIsBetter ?? false,
    benchmarks: opts.benchmarks ?? { worldClass: 1, excellent: 2, average: 5, poor: 10 },
    period: opts.period ?? { start: new Date(), end: new Date(), label: "May 2026" },
    scope: opts.scope ?? {},
    computedAt: new Date(),
    audit: opts.audit ?? { sourceRecordIds: [], manhoursSubmissionIds: [], fellBackToLegacyGrossHours: false },
  };
}

const KPI_LTIFR = mockKpi({
  kpiCode: "LTIFR",
  kpiName: "Lost Time Injury Frequency Rate",
  value: 1.21,
  formattedValue: "1.21",
  formula: "(LTI × 1,000,000) ÷ exposure hours",
  band: "EXCELLENT",
  bandColor: "#84cc16",
  higherIsBetter: false,
  benchmarks: { worldClass: 1, excellent: 2, average: 5, poor: 10 },
});

const KPI_TRAINING = mockKpi({
  kpiCode: "TRAINING_COMPLIANCE",
  kpiName: "Training Compliance",
  value: 94.5,
  formattedValue: "94.5%",
  formula: "Valid certifications ÷ unique (employee, program) pairs",
  band: "EXCELLENT",
  bandColor: "#84cc16",
  higherIsBetter: true,
  benchmarks: { worldClass: 95, excellent: 90, average: 80, poor: 70 },
});

const KPI_DAYS = mockKpi({
  kpiCode: "DAYS_SINCE_LAST_LTI",
  kpiName: "Days Since Last LTI",
  value: 127,
  formattedValue: "127",
  formula: "Days since most recent LTI / fatality incident",
  band: null,
  bandColor: "#94a3b8",
  higherIsBetter: true,
});

const KPI_COST = mockKpi({
  kpiCode: "COST_OF_INCIDENTS",
  kpiName: "Cost of Incidents",
  value: 4_750_000,
  formattedValue: "₹47,50,000",
  formula: "Sum of Incident.costTotal in period",
  band: "POOR",
  bandColor: "#ef4444",
  higherIsBetter: false,
  benchmarks: { worldClass: 500000, excellent: 1500000, average: 3000000, poor: 6000000 },
});

const TREND_DOWN_GOOD = {
  direction: "DOWN" as const,
  percentChange: -12.4,
  priorValue: "1.38",
  priorLabel: "April 2026",
};

const TREND_UP_GOOD = {
  direction: "UP" as const,
  percentChange: 8.1,
  priorValue: "87.4%",
  priorLabel: "April 2026",
};

const TREND_UP_BAD = {
  direction: "UP" as const,
  percentChange: 24.3,
  priorValue: "₹38,20,000",
  priorLabel: "April 2026",
};

const TREND_FLAT = {
  direction: "FLAT" as const,
  percentChange: 0.4,
  priorValue: "126",
  priorLabel: "Yesterday",
};

// ─── Page ───────────────────────────────────────────────────────

export default function DashboardPreviewPage() {
  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <h1 className="text-heading-1 text-slate-900">KpiCard preview</h1>
        <p className="text-body text-slate-500">
          Visual review surface for the new world-class KpiCard. Compare side-by-side with Linear, Stripe Dashboard,
          Vercel Analytics. If anything looks cheaper than those references, iterate before Commit 3.
        </p>
      </header>

      {/* Default size — variations */}
      <Section title="Default size · realistic dashboard row">
        <Row cols={4}>
          <KpiCard
            kpi={KPI_LTIFR}
            trend={TREND_DOWN_GOOD}
            sparkline={spark([1.84, 1.72, 1.69, 1.58, 1.55, 1.50, 1.48, 1.46, 1.42, 1.4, 1.38, 1.31, 1.21])}
            unit="per million hours"
            description="IS 3786 standard. Measures recordable lost-time injuries normalised to one million exposure hours."
            drillDownHref="/manhours/kpi?code=LTIFR&year=2026&month=5&isRolling12=true"
            liveIndicator={{ lastUpdatedAt: new Date(Date.now() - 2 * 60_000), live: true, refreshSeconds: 60 }}
          />
          <KpiCard
            kpi={KPI_TRAINING}
            trend={TREND_UP_GOOD}
            sparkline={spark([72, 75, 78, 81, 83, 85, 87, 88, 89, 91, 92, 93, 94.5])}
            unit="of (employee × program) pairs"
            description="Percentage of training records that are passed and currently valid."
            drillDownHref="/manhours/kpi?code=TRAINING_COMPLIANCE&year=2026&month=5"
            liveIndicator={{ lastUpdatedAt: new Date(Date.now() - 90 * 1000), live: true, refreshSeconds: 60 }}
          />
          <KpiCard
            kpi={KPI_DAYS}
            sparkline={spark([3, 19, 35, 51, 67, 83, 99, 0, 15, 31, 67, 93, 127])}
            unit="streak"
            description="Calendar days elapsed since the most recent LTI or fatality across the selected scope."
            drillDownHref="/manhours/kpi?code=DAYS_SINCE_LAST_LTI"
            liveIndicator={{ lastUpdatedAt: new Date(Date.now() - 4 * 60_000) }}
          />
          <KpiCard
            kpi={KPI_COST}
            trend={TREND_UP_BAD}
            sparkline={spark([22, 24, 27, 26, 28, 29, 30, 32, 34, 36, 38, 38, 47].map((v) => v * 100000))}
            unit="rupees, period total"
            description="Sum of direct + indirect incident costs."
            drillDownHref="/manhours/kpi?code=COST_OF_INCIDENTS&year=2026&month=5"
            liveIndicator={{ lastUpdatedAt: new Date(Date.now() - 12 * 60_000) }}
          />
        </Row>
      </Section>

      {/* Size variants */}
      <Section title="Size variants · same KPI, three sizes">
        <Row cols={6}>
          <div className="col-span-12 lg:col-span-2">
            <KpiCard kpi={KPI_LTIFR} size="compact" sparkline={spark([1.5, 1.48, 1.46, 1.42, 1.4, 1.38, 1.31, 1.21])} />
          </div>
          <div className="col-span-12 lg:col-span-2">
            <KpiCard
              kpi={KPI_LTIFR}
              size="default"
              trend={TREND_DOWN_GOOD}
              sparkline={spark([1.84, 1.72, 1.69, 1.58, 1.55, 1.5, 1.48, 1.46, 1.42, 1.4, 1.38, 1.31, 1.21])}
              unit="per million hours"
              drillDownHref="/manhours/kpi?code=LTIFR"
              liveIndicator={{ lastUpdatedAt: new Date(Date.now() - 2 * 60_000), live: true, refreshSeconds: 60 }}
            />
          </div>
          <div className="col-span-12 lg:col-span-2">
            <KpiCard
              kpi={KPI_LTIFR}
              size="feature"
              trend={TREND_DOWN_GOOD}
              sparkline={spark([1.84, 1.72, 1.69, 1.58, 1.55, 1.5, 1.48, 1.46, 1.42, 1.4, 1.38, 1.31, 1.21])}
              unit="per million hours"
              context={<span><span className="text-emerald-600 font-medium">Best month</span> since Feb 2024 · group target &lt; 1.5</span>}
              drillDownHref="/manhours/kpi?code=LTIFR"
              liveIndicator={{ lastUpdatedAt: new Date(Date.now() - 2 * 60_000), live: true, refreshSeconds: 60 }}
            />
          </div>
        </Row>
      </Section>

      {/* States */}
      <Section title="States · loading, empty, error, stale">
        <Row cols={4}>
          <KpiCardSkeleton />
          <KpiCard kpi={KPI_LTIFR} state="empty" />
          <KpiCard kpi={KPI_LTIFR} state="error" error="Connection pool exhausted (P2024)" onRetry={() => {}} />
          <KpiCard
            kpi={KPI_LTIFR}
            state="stale"
            sparkline={spark([1.84, 1.72, 1.69, 1.58, 1.55, 1.5, 1.48, 1.46, 1.42, 1.4, 1.38, 1.31, 1.21])}
            trend={TREND_DOWN_GOOD}
            unit="per million hours"
            liveIndicator={{ lastUpdatedAt: new Date(Date.now() - 2 * 60 * 60_000) }}
          />
        </Row>
      </Section>

      {/* Trend variations */}
      <Section title="Trend variations · direction + improving/worsening colour logic">
        <Row cols={4}>
          <KpiCard
            kpi={KPI_LTIFR}
            trend={{ direction: "DOWN", percentChange: -12.4, priorValue: "1.38", priorLabel: "April 2026" }}
            sparkline={spark([1.5, 1.48, 1.46, 1.42, 1.4, 1.38, 1.31, 1.21])}
            unit="LTIFR ↓ = good"
            drillDownHref="/manhours/kpi?code=LTIFR"
          />
          <KpiCard
            kpi={KPI_LTIFR}
            trend={{ direction: "UP", percentChange: 18.2, priorValue: "1.03", priorLabel: "April 2026" }}
            sparkline={spark([0.9, 0.95, 1.0, 1.02, 1.05, 1.08, 1.12, 1.21])}
            unit="LTIFR ↑ = bad"
            drillDownHref="/manhours/kpi?code=LTIFR"
          />
          <KpiCard
            kpi={KPI_TRAINING}
            trend={{ direction: "UP", percentChange: 8.1, priorValue: "87.4%", priorLabel: "April 2026" }}
            sparkline={spark([85, 86, 87, 88, 89, 91, 92, 94.5])}
            unit="Training ↑ = good"
            drillDownHref="/manhours/kpi?code=TRAINING_COMPLIANCE"
          />
          <KpiCard
            kpi={KPI_DAYS}
            trend={{ direction: "FLAT", percentChange: 0.4, priorValue: "126", priorLabel: "Yesterday" }}
            sparkline={spark([99, 100, 101, 102, 103, 104, 105, 127])}
            unit="streak"
            drillDownHref="/manhours/kpi?code=DAYS_SINCE_LAST_LTI"
          />
        </Row>
      </Section>

      {/* Benchmark band variations */}
      <Section title="Benchmark bands · world class → poor">
        <Row cols={4}>
          {(["WORLD_CLASS", "EXCELLENT", "AVERAGE", "POOR"] as const).map((band) => (
            <KpiCard
              key={band}
              kpi={mockKpi({
                kpiCode: "LTIFR",
                kpiName: "LTIFR",
                value: band === "WORLD_CLASS" ? 0.4 : band === "EXCELLENT" ? 1.5 : band === "AVERAGE" ? 3.2 : 7.8,
                formattedValue: band === "WORLD_CLASS" ? "0.40" : band === "EXCELLENT" ? "1.50" : band === "AVERAGE" ? "3.20" : "7.80",
                band,
                higherIsBetter: false,
                benchmarks: { worldClass: 1, excellent: 2, average: 5, poor: 10 },
              })}
              sparkline={spark([1.5, 1.48, 1.46, 1.42, 1.4, 1.38, 1.31, band === "WORLD_CLASS" ? 0.4 : band === "EXCELLENT" ? 1.5 : band === "AVERAGE" ? 3.2 : 7.8])}
              unit={`Band: ${band}`}
              drillDownHref="/manhours/kpi?code=LTIFR"
            />
          ))}
        </Row>
      </Section>

      {/* Icon usage and minimal variants */}
      <Section title="Minimal & iconography">
        <Row cols={4}>
          <KpiCard kpi={KPI_LTIFR} icon={ShieldAlert} unit="per million hours" sparkline={spark([1.5, 1.48, 1.46, 1.42, 1.4, 1.38, 1.31, 1.21])} />
          <KpiCard kpi={KPI_DAYS} icon={CalendarClock} unit="days" sparkline={spark([3, 19, 35, 51, 67, 83, 99, 127])} />
          <KpiCard kpi={KPI_TRAINING} icon={GraduationCap} unit="of pairs" sparkline={spark([85, 86, 87, 88, 89, 91, 92, 94.5])} />
          <KpiCard
            kpi={mockKpi({ kpiCode: "NEAR_MISS_RATE", kpiName: "Near Miss Rate", value: 245, formattedValue: "245", higherIsBetter: true, band: "EXCELLENT", benchmarks: { worldClass: 300, excellent: 200, average: 100, poor: 50 } })}
            icon={AlertTriangle}
            unit="per million hours"
            sparkline={spark([180, 190, 200, 210, 215, 220, 230, 245])}
            menuActions={false}
          />
        </Row>
      </Section>
    </div>
  );
}

// ─── Layout helpers ────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-overline text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children, cols = 4 }: { children: React.ReactNode; cols?: 2 | 3 | 4 | 6 }) {
  // Tailwind JIT only picks up literal class strings. Use a switch
  // rather than `lg:col-span-${n}` template literals so the scanner
  // finds every variant.
  const span = colSpan(cols);
  return (
    <div className="grid grid-cols-12 gap-4">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && (child.props as { className?: string }).className?.includes("col-span")) {
          return child;
        }
        return <div className={`col-span-12 sm:col-span-6 ${span}`}>{child}</div>;
      })}
    </div>
  );
}

function colSpan(cols: 2 | 3 | 4 | 6): string {
  switch (cols) {
    case 2:
      return "lg:col-span-6";
    case 3:
      return "lg:col-span-4";
    case 4:
      return "lg:col-span-3";
    case 6:
      return "lg:col-span-2";
  }
}
