"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight, GripVertical, X, Maximize2, Lock, RefreshCw, ShieldAlert,
  Calendar, Shield, Activity, FileText, Eye, AlertTriangle, GraduationCap, ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { WIDGET_BY_ID, type WidgetSpan } from "@/lib/dashboard/widget-catalog";
import { Sparkline } from "@/components/dashboard/sparkline";
import { HeinrichPyramid, ObservationsTrendChart } from "@/components/dashboard/charts";
import {
  RadialGauge,
  Donut,
  Pipeline,
  StackedAgeBars,
  RankedBars,
  SubBar,
  MiniStatTile,
  DaysTile,
  StatChip,
  EmptyHint,
  TONE_TEXT,
  type Tone,
} from "./primitives";

// ── KPI card visual config (icon + colours matching the EHS dashboard design) ──
const KPI_CONFIG: Record<string, { Icon: LucideIcon; iconBg: string; iconColor: string; subtitleColor: string; href: string }> = {
  "kpi-days-since-lti":        { Icon: Calendar,       iconBg: "bg-rose-100",   iconColor: "text-rose-500",   subtitleColor: "text-cyan-600",   href: "/manhours"               },
  "kpi-ltifr":                 { Icon: Shield,         iconBg: "bg-teal-100",   iconColor: "text-teal-600",   subtitleColor: "text-cyan-600",   href: "/manhours"               },
  "kpi-trir":                  { Icon: Activity,       iconBg: "bg-purple-100", iconColor: "text-purple-500", subtitleColor: "text-cyan-600",   href: "/manhours"               },
  "kpi-active-permits":        { Icon: FileText,       iconBg: "bg-blue-100",   iconColor: "text-blue-600",   subtitleColor: "text-cyan-600",   href: "/ptw?status=ACTIVE"      },
  "kpi-observations-mtd":      { Icon: Eye,            iconBg: "bg-violet-100", iconColor: "text-violet-600", subtitleColor: "text-slate-500",  href: "/observations"           },
  "kpi-nearmiss-12mo":         { Icon: AlertTriangle,  iconBg: "bg-amber-100",  iconColor: "text-amber-500",  subtitleColor: "text-amber-600",  href: "/near-miss"              },
  "kpi-training-compliance":   { Icon: GraduationCap,  iconBg: "bg-sky-100",    iconColor: "text-sky-600",    subtitleColor: "text-amber-600",  href: "/training?filter=expired"},
  "kpi-inspection-compliance": { Icon: ClipboardCheck, iconBg: "bg-orange-100", iconColor: "text-orange-500", subtitleColor: "text-orange-600", href: "/inspections?status=OVERDUE" },
};

// ─────────────────────────────────────────────────────────────────────
// DashboardWidget — the self-fetching shell every configurable-dashboard
// tile uses. Fetches /api/dashboard/widget/[id] on mount (independent of
// every other widget — one slow widget never blocks the rest), shows a
// skeleton while loading, an access-restricted state on 403, an honest
// empty state for data that isn't modelled yet, and edit-mode chrome
// (drag grip / remove / resize) when the grid is in edit mode.
// ─────────────────────────────────────────────────────────────────────

type FetchState = "loading" | "ready" | "error" | "restricted";

export interface DashboardWidgetProps {
  id: string;
  span: WidgetSpan;
  plant?: string;
  /** ISO date strings (YYYY-MM-DD) for the selected date range. */
  dateFrom?: string;
  dateTo?: string;
  /** Edit-mode affordances (supplied by the grid). */
  editing?: boolean;
  locked?: boolean;
  onRemove?: () => void;
  onCycleSize?: () => void;
  /** Admin-only: toggle this widget's mandatory-lock for the tenant. */
  isAdmin?: boolean;
  onToggleLock?: () => void;
  /** A nonce the grid can bump to force every widget to refetch. */
  refreshKey?: number;
}

export function DashboardWidget({ id, span, plant, dateFrom, dateTo, editing, locked, onRemove, onCycleSize, isAdmin, onToggleLock, refreshKey = 0 }: DashboardWidgetProps) {
  const meta = WIDGET_BY_ID[id];
  const [state, setState] = React.useState<FetchState>("loading");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = React.useState<any>(null);

  React.useEffect(() => {
    let alive = true;
    setState("loading");
    const params = new URLSearchParams();
    if (plant)    params.set("plant", plant);
    if (dateFrom) params.set("from",  dateFrom);
    if (dateTo)   params.set("to",    dateTo);
    const qs = params.toString() ? `?${params.toString()}` : "";
    fetch(`/api/dashboard/widget/${id}${qs}`, { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 403) {
          if (alive) setState("restricted");
          return;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (alive) {
          setData(j);
          setState("ready");
        }
      })
      .catch(() => {
        if (alive) setState("error");
      });
    return () => {
      alive = false;
    };
  }, [id, plant, dateFrom, dateTo, refreshKey]);

  if (!meta) return null;
  const drillHref = data && typeof data === "object" && "href" in data ? (data.href as string) : undefined;

  // ── KPI card shell (screenshot-style: label + big value + subtitle + icon) ──
  if (id.startsWith("kpi-")) {
    const kpiCfg = KPI_CONFIG[id] ?? { Icon: Activity, iconBg: "bg-slate-100", iconColor: "text-slate-500", subtitleColor: "text-slate-500", href: "/" };
    const { Icon: KpiIcon, iconBg, iconColor, subtitleColor, href: kpiHref } = kpiCfg;
    const cardInner = (
      <>
        {editing && <EditChrome locked={locked} onRemove={onRemove} onCycleSize={onCycleSize} resizable={false} isAdmin={isAdmin} onToggleLock={onToggleLock} />}
        {/* Label + icon */}
        <div className="flex items-start justify-between mb-4">
          <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500 leading-snug pr-2">{meta.title}</span>
          <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg", iconBg)}>
            <KpiIcon size={17} className={iconColor} />
          </div>
        </div>
        {/* Value + subtitle */}
        <div className="flex-1 flex flex-col justify-center">
          {state === "loading" && (
            <div className="space-y-2">
              <div className="h-10 w-20 rounded skeleton-shimmer" />
              <div className="h-3 w-32 rounded skeleton-shimmer" />
            </div>
          )}
          {state === "error" && <span className="text-sm text-rose-500">Couldn&apos;t load</span>}
          {state === "restricted" && <span className="text-sm text-slate-400">No access</span>}
          {state === "ready" && data && (
            <>
              <div className="font-numeric text-4xl font-bold text-slate-900 leading-none mb-2">{data.value ?? "—"}</div>
              {data.unit && <div className={cn("text-sm font-medium", subtitleColor)}>{data.unit}</div>}
            </>
          )}
        </div>
      </>
    );
    const cardClass = cn(
      "relative flex h-full flex-col rounded-xl border bg-white p-5 elevation-1 transition-shadow",
      !editing && "hover:shadow-md hover:border-slate-300 cursor-pointer",
      editing && "border-dashed border-primary-300 ring-1 ring-primary-100",
    );
    if (editing) return <div className={cardClass}>{cardInner}</div>;
    return (
      <Link href={kpiHref} className={cardClass}>
        {cardInner}
      </Link>
    );
  }

  // ── General widget shell (charts, complex widgets) ────────────────
  return (
    <div className={cn("relative flex h-full flex-col rounded-xl border bg-white p-4 elevation-1", editing && "border-dashed border-primary-300 ring-1 ring-primary-100")}>
      {editing && <EditChrome locked={locked} onRemove={onRemove} onCycleSize={onCycleSize} resizable={(meta.allowedSpans?.length ?? 0) > 1} isAdmin={isAdmin} onToggleLock={onToggleLock} />}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-heading-3 text-slate-800" title={meta.title}>
            {meta.title}
          </h3>
          <span className="text-[10px] uppercase tracking-wide text-slate-400">{meta.category}</span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {meta.category === "AI" && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              LIVE
            </span>
          )}
          {drillHref && !editing && (
            <Link href={drillHref} className="text-slate-400 transition hover:text-primary-600" aria-label="Open module">
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>

      <div className="mt-3 min-h-[88px] flex-1">
        {state === "loading" && <WidgetSkeleton />}
        {state === "error" && <ErrorState />}
        {state === "restricted" && <RestrictedState module={meta.module} />}
        {state === "ready" && <WidgetBody id={id} data={data} />}
      </div>
    </div>
  );
}

// ─── States ──────────────────────────────────────────────────────────

function WidgetSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-8 w-24 rounded skeleton-shimmer" />
      <div className="h-3 w-full rounded skeleton-shimmer" />
      <div className="h-3 w-2/3 rounded skeleton-shimmer" />
      <div className="h-16 w-full rounded skeleton-shimmer" />
    </div>
  );
}

function ErrorState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-caption text-slate-400">
      <RefreshCw size={16} className="opacity-50" />
      Couldn&apos;t load this widget.
    </div>
  );
}

function RestrictedState({ module }: { module?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 px-2 text-center">
      <ShieldAlert size={18} className="text-slate-300" />
      <p className="text-caption text-slate-500">You don&apos;t have access to this module{module ? ` (${module})` : ""}.</p>
      <p className="text-[10px] text-slate-400">Ask an administrator to request access.</p>
    </div>
  );
}

function EditChrome({ locked, onRemove, onCycleSize, resizable, isAdmin, onToggleLock }: { locked?: boolean; onRemove?: () => void; onCycleSize?: () => void; resizable?: boolean; isAdmin?: boolean; onToggleLock?: () => void }) {
  return (
    <div className="absolute -top-2.5 right-2 left-2 z-10 flex items-center justify-between">
      <span className="inline-flex cursor-grab items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-400 shadow-sm active:cursor-grabbing">
        <GripVertical size={11} /> drag
      </span>
      <span className="flex items-center gap-1">
        {resizable && (
          <button type="button" onClick={onCycleSize} className="rounded-full border border-slate-200 bg-white p-1 text-slate-500 shadow-sm transition hover:text-primary-600" aria-label="Resize widget">
            <Maximize2 size={12} />
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={onToggleLock}
            className={cn("rounded-full border border-slate-200 bg-white p-1 shadow-sm transition", locked ? "text-primary-600" : "text-slate-400 hover:text-primary-600")}
            aria-label={locked ? "Unlock widget (allow removal)" : "Lock widget as mandatory"}
            title={locked ? "Mandatory — click to unlock" : "Lock as mandatory for all users"}
          >
            <Lock size={12} />
          </button>
        )}
        {locked ? (
          !isAdmin && (
            <span className="rounded-full border border-slate-200 bg-white p-1 text-slate-300 shadow-sm" title="Locked by admin — cannot be removed">
              <Lock size={12} />
            </span>
          )
        ) : (
          <button type="button" onClick={onRemove} className="rounded-full border border-slate-200 bg-white p-1 text-slate-500 shadow-sm transition hover:bg-rose-50 hover:text-rose-600" aria-label="Remove widget">
            <X size={12} />
          </button>
        )}
      </span>
    </div>
  );
}

// ─── Body router ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function WidgetBody({ id, data }: { id: string; data: any }) {
  if (data && data.available === false) {
    return <EmptyHint>{NOT_MODELLED[id] ?? "Not enough data yet."}</EmptyHint>;
  }
  switch (id) {
    case "open-actions-by-age":
      return <OpenActionsView data={data} />;
    case "capa-closure-trend":
      return <CapaTrendView data={data} />;
    case "compliance-score":
      return <ComplianceView data={data} />;
    case "hira-risk-profile":
      return <HiraView data={data} />;
    case "ptw-performance":
      return <PtwView data={data} />;
    case "inspection-performance":
      return <InspectionPerfView data={data} />;
    case "moc-activity":
      return <MocView data={data} />;
    case "skill-matrix-compliance":
      return <SkillView data={data} />;
    case "top-repeat-hazards":
      return <HazardsView data={data} />;
    case "incident-status":
      return <IncidentStatusView data={data} />;
    case "training-by-department":
      return <TrainingDeptView data={data} />;
    case "days-since-incident":
      return <DaysSinceView data={data} />;
    case "eai-significance":
      return <EaiView data={data} />;
    case "observation-quality":
      return <QualityView data={data} />;
    case "heinrich-pyramid":
      return <HeinrichPyramid data={data.levels} />;
    case "obs-nearmiss-trend":
      return <ObservationsTrendChart data={(data.months ?? []).map((m: { label: string; observations: number; nearMiss: number }) => ({ month: m.label, observations: m.observations, nearMiss: m.nearMiss }))} />;
    case "ai-insights":
      return <AiInsightsView data={data} />;
    default:
      if (data?.kind === "kpi") return <KpiView data={data} />;
      return <EmptyHint>Not enough data yet.</EmptyHint>;
  }
}

const NOT_MODELLED: Record<string, string> = {
  "contractor-compliance": "Contractors aren't modelled as a distinct workforce entity yet — this widget activates once contractor profiles land.",
  "permit-agent-activity": "Permit Risk Reviewer agent activity isn't recorded in the data model yet.",
};

// ─── Views ───────────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */

function KpiView({ data }: { data: any }) {
  const tone: Tone = data.tone ?? "neutral";
  const sparkColor = tone === "good" ? "#10b981" : tone === "bad" ? "#ef4444" : tone === "warn" ? "#f59e0b" : "#7c3aed";
  return (
    <div className="flex h-full flex-col justify-between gap-3">
      <div>
        <div className={cn("font-numeric text-3xl font-bold leading-none", tone === "neutral" ? "text-slate-900" : TONE_TEXT[tone])}>{data.value}</div>
        {data.unit && <div className="mt-1.5 text-caption text-slate-500">{data.unit}</div>}
      </div>
      {Array.isArray(data.spark) && data.spark.length > 0 && (
        <Sparkline data={data.spark} width={180} height={36} color={sparkColor} formatValue={(v) => (Number.isInteger(v) ? String(v) : v.toFixed(2))} />
      )}
    </div>
  );
}

function OpenActionsView({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-caption">
        <Stat n={data.total} label="open" />
        <Stat n={`${data.pctOverdue}%`} label="overdue" tone="bad" />
        <Stat n={data.oldestDays} label="oldest (d)" />
      </div>
      {data.sources?.length > 0 ? <StackedAgeBars rows={data.sources} /> : <EmptyHint>No open actions.</EmptyHint>}
    </div>
  );
}

const CAPA_CHART_CONFIG = {
  opened: { label: "Opened", color: "#f97316" },
  closed:  { label: "Closed",  color: "#10b981" },
};

function CapaTrendView({ data }: { data: any }) {
  const n = data.months?.length ?? 12;
  const tickInterval = n <= 9 ? 0 : 1;
  return (
    <div>
      {/* Summary row */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          <span className="text-[11px] text-slate-500">Opened</span>
          <span className="font-mono text-sm font-bold text-slate-800">{data.currentOpened ?? 0}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-[11px] text-slate-500">Closed</span>
          <span className="font-mono text-sm font-bold text-slate-800">{data.currentClosed ?? 0}</span>
        </div>
        <div className="ml-auto flex items-baseline gap-1">
          <span className="font-mono text-lg font-bold text-slate-800">{data.closureRate ?? 0}%</span>
          <span className="text-[11px] text-slate-400">closure rate</span>
        </div>
      </div>

      {/* Shadcn-style area chart */}
      <ChartContainer config={CAPA_CHART_CONFIG} className="h-[130px] w-full">
        <AreaChart data={data.months} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id="capaGradOpened" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f97316" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="capaGradClosed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: "#94a3b8" }}
            interval={tickInterval}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={24}
            allowDecimals={false}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area type="monotone" dataKey="opened" stroke="#f97316" strokeWidth={2} fill="url(#capaGradOpened)" dot={false} />
          <Area type="monotone" dataKey="closed"  stroke="#10b981" strokeWidth={2} fill="url(#capaGradClosed)"  dot={false} />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

function ComplianceView({ data }: { data: any }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <RadialGauge value={data.score} label="Compliance" />
      <div className="w-full space-y-0.5">
        {data.sub.map((s: any) => (
          <SubBar key={s.key} label={s.label} pct={s.pct} href={s.href} />
        ))}
      </div>
      {!data.ppeLive && <p className="text-[10px] leading-tight text-slate-400">PPE weight redistributed until the PPE module is fully live.</p>}
    </div>
  );
}

function HiraView({ data }: { data: any }) {
  const COLORS: Record<string, string> = { LOW: "#10b981", MODERATE: "#f59e0b", HIGH: "#f97316", CRITICAL: "#ef4444" };
  return (
    <div>
      <div className="mb-2 text-caption text-slate-500">
        <span className="font-numeric font-semibold text-slate-800">{data.total}</span> active entries
      </div>
      <div className="grid grid-cols-2 gap-2">
        {data.levels.map((l: any) => (
          <Link key={l.level} href="/risk-register" className="flex items-center gap-2 rounded-lg border border-slate-100 p-2 transition hover:border-primary-200">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-numeric text-sm font-bold text-white" style={{ backgroundColor: COLORS[l.level] ?? "#94a3b8" }}>
              {l.count}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-caption capitalize text-slate-700">{l.level.toLowerCase()}</span>
              {l.recent > 0 && <span className="block text-[10px] text-slate-400">+{l.recent} new 3mo</span>}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PtwView({ data }: { data: any }) {
  const onTimeTone: Tone = data.onTimePct === null ? "neutral" : data.onTimePct > 90 ? "good" : data.onTimePct >= 70 ? "warn" : "bad";
  return (
    <div className="grid grid-cols-2 gap-2">
      <MiniStatTile label="Active permits" value={data.active} href="/ptw?status=ACTIVE" />
      <MiniStatTile label="Closed MTD" value={data.closedThisMonth} sub={data.onTimePct !== null ? `${data.onTimePct}% on-time` : undefined} tone={onTimeTone} href="/ptw?status=CLOSED" />
      <MiniStatTile label="Competency blocks" value={data.competencyBlocks} href="/ptw" />
      <MiniStatTile label="Avg cycle" value={data.avgCycleDays !== null ? `${data.avgCycleDays}d` : "—"} href="/ptw" />
    </div>
  );
}

function InspectionPerfView({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <MiniStatTile label="Completed 60d" value={data.completed60} href="/inspections?status=COMPLETED" />
        <MiniStatTile label="Overdue" value={data.overdue} tone={data.overdue > 0 ? "bad" : "neutral"} href="/inspections?status=OVERDUE" />
        <MiniStatTile label="Findings open" value={data.findingsOpen} sub={data.findingsCritical > 0 ? `${data.findingsCritical} critical` : undefined} tone={data.findingsCritical > 0 ? "bad" : "neutral"} href="/inspections" />
      </div>
      {data.types?.length > 0 && (
        <div className="space-y-0.5">
          {data.types.map((t: any) => {
            const pct = t.total ? Math.round((t.pass / t.total) * 100) : 0;
            return <SubBar key={t.name} label={t.name} pct={pct} suffix={<span className="text-[10px] text-slate-400">{t.pass}/{t.total}</span>} />;
          })}
        </div>
      )}
    </div>
  );
}

function MocView({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <Pipeline stages={data.stages.map((s: any) => ({ ...s, href: "/moc" }))} />
      <div className="flex flex-wrap gap-2">
        <StatChip value={data.overdue} label="overdue" tone={data.overdue > 0 ? "bad" : "neutral"} href="/moc" />
        <StatChip value={data.tempExpiring} label="temp expiring 30d" tone={data.tempExpiring > 0 ? "warn" : "neutral"} href="/moc" />
      </div>
    </div>
  );
}

function SkillView({ data }: { data: any }) {
  const COLORS: Record<string, string> = { valid: "#10b981", expiring: "#f59e0b", expired: "#ef4444", inprogress: "#3b82f6", suspended: "#f97316" };
  const segs = data.segments.map((s: any) => ({ label: s.label, count: s.count, color: COLORS[s.key] ?? "#94a3b8", href: "/skill-matrix" }));
  return (
    <div className="space-y-3">
      <Donut segments={segs} centerValue={`${data.validityPct}%`} centerLabel="valid" />
      <StatChip value={data.expiringThisMonth} label="expiring this month" tone={data.expiringThisMonth > 0 ? "warn" : "neutral"} href="/skill-matrix" />
    </div>
  );
}

function HazardsView({ data }: { data: any }) {
  const rows = (data.items ?? []).map((it: any) => ({
    label: it.hazard,
    value: it.total,
    href: "/risk-register",
    meta: (
      <span className="flex gap-1">
        {it.sources.NM > 0 && <span className="rounded bg-amber-50 px-1 text-[9px] text-amber-700">NM {it.sources.NM}</span>}
        {it.sources.OBS > 0 && <span className="rounded bg-violet-50 px-1 text-[9px] text-violet-700">OBS {it.sources.OBS}</span>}
      </span>
    ),
  }));
  return <RankedBars rows={rows} />;
}

function IncidentStatusView({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <Pipeline stages={data.stages.map((s: any) => ({ ...s, href: "/incidents" }))} />
      <div className="flex flex-wrap gap-2">
        <StatChip value={data.stalled} label="stalled >30d" tone={data.stalled > 0 ? "bad" : "neutral"} href="/incidents" />
        <StatChip value={data.ltiOpen} label="LTI open >10d" tone={data.ltiOpen > 0 ? "bad" : "neutral"} href="/incidents?type=LTI" />
        <StatChip value={data.avgCloseDays !== null ? `${data.avgCloseDays}d` : "—"} label="avg close" tone="neutral" />
      </div>
    </div>
  );
}

function TrainingDeptView({ data }: { data: any }) {
  if (!data.depts?.length) return <EmptyHint>No department training data.</EmptyHint>;
  return (
    <div className="space-y-0.5">
      {data.depts.map((d: any) => (
        <SubBar key={d.name} label={d.name} pct={d.pct} suffix={d.expiring > 0 ? <span className="text-[10px] text-amber-600">{d.expiring} exp</span> : undefined} href="/training" />
      ))}
    </div>
  );
}

function DaysSinceView({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {data.tiles.map((t: any) => (
        <DaysTile key={t.key} label={t.label.replace("Days Since ", "")} days={t.days} href="/incidents" />
      ))}
    </div>
  );
}

function EaiView({ data }: { data: any }) {
  const allControlled = data.uncontrolled === 0;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MiniStatTile label="Significant aspects" value={data.significantTotal} tone={allControlled ? "good" : "bad"} sub={`${data.controlled} controlled`} href="/eai" />
        <MiniStatTile label="Obligations due 30d" value={data.obligationsDue} tone={data.obligationsDue > 0 ? "warn" : "neutral"} href="/eai" />
      </div>
      {!allControlled && (
        <div>
          <StatChip value={data.uncontrolled} label="uncontrolled significant" tone="bad" href="/eai" />
        </div>
      )}
    </div>
  );
}

function QualityView({ data }: { data: any }) {
  const total = data.high + data.medium + data.low || 1;
  return (
    <div className="space-y-3">
      <div className="flex h-4 overflow-hidden rounded">
        <div style={{ width: `${(data.high / total) * 100}%` }} className="bg-emerald-500" title={`High ${data.high}`} />
        <div style={{ width: `${(data.medium / total) * 100}%` }} className="bg-amber-500" title={`Medium ${data.medium}`} />
        <div style={{ width: `${(data.low / total) * 100}%` }} className="bg-rose-500" title={`Low ${data.low}`} />
      </div>
      <div className="flex justify-between text-caption">
        <Link href="/observations" className="text-emerald-700 hover:underline">High {data.high}</Link>
        <Link href="/observations" className="text-amber-700 hover:underline">Medium {data.medium}</Link>
        <Link href="/observations" className="text-rose-700 hover:underline">Low {data.low}</Link>
      </div>
    </div>
  );
}

function AiInsightsView({ data }: { data: any }) {
  const BORDER: Record<string, string> = {
    good:    "border-l-emerald-500 bg-emerald-50/50",
    warn:    "border-l-amber-500   bg-amber-50/50",
    bad:     "border-l-rose-500    bg-rose-50/50",
    neutral: "border-l-slate-300   bg-slate-50/50",
  };
  const DOT: Record<string, string> = {
    good: "bg-emerald-500", warn: "bg-amber-400", bad: "bg-rose-500", neutral: "bg-slate-400",
  };
  if (!data.insights?.length) return <EmptyHint>No insights available yet.</EmptyHint>;
  return (
    <div className="space-y-2">
      {data.insights.map((ins: any, i: number) => (
        <div key={i} className={cn("flex items-start gap-2.5 rounded-r-lg border-l-[3px] px-3 py-2", BORDER[ins.tone] ?? BORDER.neutral)}>
          <span className={cn("mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full", DOT[ins.tone] ?? DOT.neutral)} />
          <p className="text-[13px] leading-snug text-slate-700">{ins.text}</p>
        </div>
      ))}
    </div>
  );
}

function Stat({ n, label, tone = "neutral" }: { n: React.ReactNode; label: string; tone?: Tone }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className={cn("font-numeric text-lg font-bold", tone === "neutral" ? "text-slate-900" : TONE_TEXT[tone])}>{n}</span>
      <span className="text-slate-500">{label}</span>
    </span>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
