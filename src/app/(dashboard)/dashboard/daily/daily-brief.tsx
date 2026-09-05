"use client";

// Daily Brief — Executive Sentinel. Midnight Executive skin scoped to this
// surface (DECISIONS.md D9): navy #0B1F4D header band, gold #C9A961 accents,
// Georgia display headings. The feed is one severity-ranked list — reactive
// event cards AND proactive insight-sentinel cards, interleaved by the Brief
// Priority Score (spec §1.2) — lensed to the caller's role (spec §3). The whole
// payload re-polls every 45s (paused while the tab is hidden), which also keeps
// the right-rail tiles live; a fresh CRITICAL slides in with a badge pulse.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertOctagon,
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  Gauge,
  Info,
  Mic,
  RefreshCw,
  Sparkles,
  VolumeX,
  WifiOff,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { readApiError } from "@/lib/client-errors";
import type {
  AlertOut,
  BriefLens,
  BriefTier,
  DailyBriefPayload,
  ScoreComponents,
} from "@/lib/daily-brief/types";
import { cn } from "@/lib/utils";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MX = { navy: "#0B1F4D", gold: "#C9A961", ice: "#E8EEF7", red: "#C0392B", green: "#2E7D5B" };
const POLL_MS = 45_000;
const GEORGIA = { fontFamily: "Georgia, 'Times New Roman', serif" } as const;

const TIER_META: Record<BriefTier, { label: string; border: string; bg?: string; chip: string; icon: typeof Info }> = {
  critical: { label: "CRITICAL", border: MX.red, bg: "#C0392B0D", chip: "bg-[#C0392B] text-white", icon: AlertOctagon },
  attention: { label: "ATTENTION", border: MX.gold, chip: "bg-[#C9A961] text-[#0B1F4D]", icon: BellRing },
  watch: { label: "WATCH", border: "#D9E1EF", chip: "bg-[#E8EEF7] text-[#0B1F4D]", icon: Eye },
};

const LENS_LABEL: Record<BriefLens, string> = {
  executive: "Executive · all sites",
  hse_manager: "HSE Manager",
  site_lead: "Site Lead",
};

const SCORE_LABELS: Record<keyof ScoreComponents, string> = {
  seriousPotential: "Serious potential",
  overdue: "Overdue",
  cluster: "Recurrence",
  severity: "Severity",
  freshness: "Fresh",
  confidence: "Confidence",
};

// A few insight kinds we surface as a small provenance chip on sentinel cards.
const KIND_LABEL: Record<string, string> = {
  predictive_risk: "Predictive",
  cluster: "Cluster",
  anomaly: "Risk pattern",
  correlation: "Training impact",
};

function tierOf(a: AlertOut): BriefTier {
  return a.tier ?? (a.severity === "critical" ? "critical" : a.severity === "attention" ? "attention" : "watch");
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function DailyBrief({ initial }: { initial: DailyBriefPayload }) {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<DailyBriefPayload>(initial);
  const [refreshedAt, setRefreshedAt] = useState<string>(initial.generatedAt);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [criticalPulse, setCriticalPulse] = useState(false);
  const knownIds = useRef<Set<string>>(new Set(initial.feed.map((a) => a.id)));

  const site = data.sites.find((s) => s.id === data.siteId) ?? null;
  const multiSite = data.sites.length > 1;
  const lens = data.role;

  // Preserve the current window + site + role across every navigation.
  const navTo = useCallback(
    (patch: { window?: string; siteId?: string | null; role?: BriefLens }) => {
      const win = patch.window ?? data.window;
      const sid = patch.siteId !== undefined ? patch.siteId : data.siteId;
      const role = patch.role ?? data.role;
      const p = new URLSearchParams({ window: win, role });
      if (sid) p.set("siteId", sid);
      router.push(`/dashboard/daily?${p.toString()}`);
    },
    [router, data.window, data.siteId, data.role],
  );

  // ── live updates: re-poll the whole aggregate (feed + tiles) — DECISIONS D6 ──
  const poll = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const params = new URLSearchParams({ window: data.window, role: data.role });
      if (data.siteId) params.set("siteId", data.siteId);
      const res = await fetch(`/api/dashboard/daily-brief?${params.toString()}`);
      if (!res.ok) return;
      const next = (await res.json()) as DailyBriefPayload;
      const incoming = next.feed.map((a) => a.id);
      const fresh = new Set(incoming.filter((id) => !knownIds.current.has(id)));
      const newCriticals = next.feed.filter((a) => fresh.has(a.id) && tierOf(a) === "critical" && a.status === "new");
      knownIds.current = new Set(incoming);
      setData(next);
      setRefreshedAt(new Date().toISOString());
      if (fresh.size > 0) {
        setFreshIds(fresh);
        window.setTimeout(() => setFreshIds(new Set()), 4000);
      }
      if (newCriticals.length > 0) {
        setCriticalPulse(true);
        window.setTimeout(() => setCriticalPulse(false), 4000);
      }
    } catch {
      /* transient poll failure — next tick retries */
    }
  }, [data.window, data.siteId, data.role]);

  useEffect(() => {
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => window.clearInterval(id);
  }, [poll]);

  // ── actions ──
  async function act(alert: AlertOut, action: "ack" | "mute") {
    try {
      const res = await fetch(`/api/alerts/${alert.id}/${action}`, { method: "POST" });
      if (!res.ok) throw new Error(await readApiError(res, "Action failed"));
      const updated = (await res.json()) as AlertOut;
      setData((prev) => ({ ...prev, feed: prev.feed.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)) }));
      toast({ title: action === "ack" ? "Acknowledged" : "Muted for 24h", variant: "success" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Action failed", variant: "error" });
    }
  }

  // Backend already ranks by Brief Priority Score + applies the role lens; keep
  // that order, only drop cards muted inside their window client-side.
  const visible = useMemo(
    () => data.feed.filter((a) => !(a.status === "muted" && a.mutedUntil && new Date(a.mutedUntil) > new Date())),
    [data.feed],
  );
  const criticalCount = visible.filter((a) => tierOf(a) === "critical" && a.status === "new").length;
  const availableLenses: BriefLens[] = multiSite ? ["executive", "hse_manager", "site_lead"] : ["hse_manager", "site_lead"];
  const pulseWindow = data.fieldPulse.windowHours >= 48 ? `last ${Math.round(data.fieldPulse.windowHours / 24)}d` : "last 24h";
  const execView = lens === "executive";

  return (
    <div className="space-y-6">
      {/* ── header band ── */}
      <div
        className="rounded-xl p-6 text-white shadow-md"
        style={{ background: `linear-gradient(120deg, ${MX.navy}, #14306b 70%)`, borderBottom: `3px solid ${MX.gold}` }}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: MX.gold }}>
              Executive Sentinel · severity-ranked
            </p>
            <h1 className="mt-1 text-3xl font-semibold" style={GEORGIA}>
              Daily Brief{site ? ` — ${site.name.split("—")[0].trim()}` : execView || multiSite ? " — All sites" : ""}
            </h1>
            <p className="mt-1 text-sm text-white/70">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              <span className="mx-2">·</span>
              <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
              refreshed {timeAgo(refreshedAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {criticalCount > 0 ? (
              <span
                className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold", criticalPulse && "animate-pulse")}
                style={{ background: MX.red }}
              >
                <AlertOctagon className="h-4 w-4" /> {criticalCount} critical
              </span>
            ) : null}
            {/* role lens */}
            <SelectField
              value={lens}
              onChange={(value) => navTo({ role: value as BriefLens })}
              ariaLabel="Brief lens"
              className="rounded-full border border-white/25 bg-transparent px-3 py-1.5 text-sm text-white"
              options={availableLenses.map((l) => ({ value: l, label: LENS_LABEL[l] }))}
            />
            {/* window toggle */}
            <Card className="flex overflow-hidden rounded-full border border-white/25 shadow-none">
              {(["24h", "7d"] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => navTo({ window: w })}
                  className={cn("px-3.5 py-1.5 text-sm font-medium", data.window === w ? "bg-[#C9A961] text-[#0B1F4D]" : "text-white/80 hover:bg-white/10")}
                >
                  {w === "24h" ? "Since yesterday" : "Last 7 days"}
                </button>
              ))}
            </Card>
            {multiSite ? (
              <SelectField
                value={data.siteId ?? ""}
                onChange={(value) => navTo({ siteId: value || null })}
                ariaLabel="Site"
                placeholder="All sites"
                className="rounded-full border border-white/25 bg-transparent px-3 py-1.5 text-sm text-white"
                options={data.sites.map((site) => ({
                  value: site.id,
                  label: `${site.code} — ${site.name.split("—")[0].trim()}`
                }))}
              />
            ) : null}
          </div>
        </div>

        {/* site-comparison strip (executive rollup — "where to look", spec §3) */}
        {execView && !data.siteId && data.siteComparison.some((s) => s.critical + s.attention > 0) ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-white/15 pt-3">
            {data.siteComparison
              .filter((s) => s.critical + s.attention > 0)
              .map((s) => (
                <Button variant="ghost"
                  key={s.siteId}
                  type="button"
                  onClick={() => navTo({ siteId: s.siteId })} className="flex gap-2 rounded-full px-3 py-1 text-xs"
                  title={`${s.name} — click to focus`}>
                  <span className="font-semibold">{s.name}</span>
                  {s.critical > 0 ? (
                    <span className="flex items-center gap-0.5 font-bold" style={{ color: "#ff9c8f" }}>
                      <AlertOctagon className="h-3 w-3" />
                      {s.critical}
                    </span>
                  ) : null}
                  {s.attention > 0 ? (
                    <span className="flex items-center gap-0.5" style={{ color: MX.gold }}>
                      <BellRing className="h-3 w-3" />
                      {s.attention}
                    </span>
                  ) : null}
                </Button>
              ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── alert feed (the hero, left 2/3) ── */}
        <div className="space-y-3 lg:col-span-2">
          {visible.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-12 text-center shadow-none" style={{ borderColor: MX.ice }}>
              <CheckCircle2 className="h-12 w-12" style={{ color: MX.green }} />
              <p className="text-lg font-semibold" style={{ ...GEORGIA, color: MX.navy }}>
                Nothing needs your attention right now
              </p>
              <p className="text-sm text-[#5A6273]">{data.acknowledgedThisWeek} items acknowledged this week.</p>
            </Card>
          ) : (
            visible.map((alert) => {
              const tier = tierOf(alert);
              const meta = TIER_META[tier];
              const Icon = meta.icon;
              const isSentinel = (alert.bodyParams?.source as string) === "sentinel";
              const kind = isSentinel ? (alert.bodyParams?.kind as string) : undefined;
              const action = alert.bodyParams?.suggestedAction as string | undefined;
              return (
                <div
                  key={alert.id}
                  className={cn("rounded-xl border bg-white p-4 shadow-sm", freshIds.has(alert.id) && "mx-slide-in", tier === "watch" && "opacity-90")}
                  style={{ borderLeft: `4px solid ${meta.border}`, background: tier === "critical" ? meta.bg : undefined }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide", meta.chip)}>
                        <Icon className="h-3.5 w-3.5" /> {meta.label}
                      </span>
                      {isSentinel ? (
                        <Badge variant="neutral" className="flex items-center gap-1 rounded-full bg-[#EEF0FF] px-2 py-0.5 text-[11px] font-semibold text-[#5B2D90]">
                          <Sparkles className="h-3 w-3" /> {KIND_LABEL[kind ?? ""] ?? "Sentinel"}
                        </Badge>
                      ) : null}
                      {alert.earlySignal ? (
                        <Badge variant="neutral" className="rounded-full bg-[#E8EEF7] px-2 py-0.5 text-[11px] font-medium text-[#5A6273]">early signal</Badge>
                      ) : null}
                      {alert.count > 1 ? (
                        <Badge variant="neutral" className="rounded-full bg-[#0B1F4D] px-2 py-0.5 text-[11px] font-bold text-white">×{alert.count}</Badge>
                      ) : null}
                      {alert.status === "acknowledged" ? (
                        <Badge variant="success" className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <Check className="h-3 w-3" /> acknowledged
                        </Badge>
                      ) : null}
                    </div>
                    <span className="flex items-center gap-1 text-xs text-[#5A6273]">
                      <Clock className="h-3.5 w-3.5" /> {timeAgo(alert.updatedAt)}
                    </span>
                  </div>

                  <p className="mt-2 text-[15px] font-bold" style={{ color: MX.navy }}>
                    {alert.title}
                  </p>
                  <p className="mt-1 text-sm text-[#37415a]">{alert.bodyText}</p>
                  {action ? <p className="mt-1 text-xs italic text-[#5A6273]">→ {action}</p> : null}

                  {alert.impactedEntities.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {alert.impactedEntities.map((e, i) => (
                        <Link
                          key={`${e.id}-${i}`}
                          href={e.href}
                          className="rounded-full border px-2.5 py-1 font-mono text-xs font-semibold transition-colors hover:bg-[#E8EEF7]"
                          style={{ borderColor: MX.ice, color: MX.navy }}
                          title={e.label}
                        >
                          {e.ref || e.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}

                  {/* inspectable Brief Priority Score — no black box (spec §1.2) */}
                  <details className="group mt-3">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-semibold text-[#5A6273] hover:text-[#0B1F4D]">
                      <Gauge className="h-3.5 w-3.5" /> Priority score {alert.priorityScore}
                      <span className="text-[#9aa3b8] group-open:hidden">· why?</span>
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-[#F4F7FC] p-2.5 text-[11px] text-[#37415a]">
                      {(Object.keys(SCORE_LABELS) as (keyof ScoreComponents)[])
                        .filter((k) => (alert.scoreComponents?.[k] ?? 0) !== 0)
                        .map((k) => (
                          <span key={k} className="tabular-nums">
                            {SCORE_LABELS[k]} <b style={{ color: MX.navy }}>+{alert.scoreComponents[k]}</b>
                          </span>
                        ))}
                    </div>
                  </details>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: MX.ice }}>
                    {alert.status !== "acknowledged" ? (
                      <Button variant="ghost"
                        type="button"
                        onClick={() => void act(alert, "ack")} className="flex gap-1.5 rounded-md px-3 py-1.5 text-sm text-white"
                        style={{ background: MX.navy }}>
                        <Check className="h-4 w-4" /> Acknowledge
                      </Button>
                    ) : null}
                    {alert.deepLink ? (
                      <Link href={alert.deepLink} className="rounded-md border px-3 py-1.5 text-sm font-semibold" style={{ borderColor: MX.ice, color: MX.navy }}>
                        View →
                      </Link>
                    ) : null}
                    {tier !== "critical" && alert.status !== "acknowledged" ? (
                      <Button variant="ghost"
                        type="button"
                        onClick={() => void act(alert, "mute")} className="ml-auto flex gap-1.5 rounded-md px-3 py-1.5 text-sm text-[#5A6273]">
                        <VolumeX className="h-4 w-4" /> Mute 24h
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── right rail ── */}
        <div className="space-y-5">
          {/* today's numbers */}
          <Card className="rounded-xl border bg-white p-5 shadow-none" style={{ borderColor: MX.ice }}>
            <h2 className="text-sm font-semibold" style={{ ...GEORGIA, color: MX.navy }}>
              Today&apos;s numbers
              <span className="ml-2 font-sans text-[11px] font-normal text-[#5A6273]">
                {site ? site.name.split("—")[0].trim() : execView || multiSite ? "all sites" : ""}
              </span>
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {data.numbers.map((n) => (
                <div key={n.key} className="rounded-lg p-3" style={{ background: "#F4F7FC" }}>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: MX.navy }}>
                    {n.value}
                    {n.delta !== null && n.delta !== 0 ? (
                      <span className={cn("ml-1.5 inline-flex items-center text-xs font-semibold", n.delta > 0 ? "text-[#B7791F]" : "text-[#2E7D5B]")}>
                        {n.delta > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                        {Math.abs(n.delta)}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-[#5A6273]">{n.label}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* field pulse */}
          <Card className="rounded-xl border bg-white p-5 shadow-none" style={{ borderColor: MX.ice }}>
            <h2 className="text-sm font-semibold" style={{ ...GEORGIA, color: MX.navy }}>
              Field pulse <span className="font-sans text-xs font-normal text-[#5A6273]">{pulseWindow}</span>
            </h2>
            {data.fieldPulse.total === 0 ? (
              <p className="mt-3 text-sm text-[#5A6273]">No field reports in the {pulseWindow}.</p>
            ) : (
              <>
                <div className="mt-3 space-y-2">
                  {data.fieldPulse.byArea.map((row) => {
                    const max = data.fieldPulse.byArea[0]?.count || 1;
                    return (
                      <div key={row.area} className="flex items-center gap-2">
                        <span className="w-28 truncate text-xs text-[#37415a]" title={row.area}>{row.area}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full" style={{ background: MX.ice }}>
                          <div className="h-full rounded-full" style={{ width: `${(row.count / max) * 100}%`, background: MX.gold }} />
                        </div>
                        <span className="w-6 text-right text-xs font-bold tabular-nums" style={{ color: MX.navy }}>{row.count}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-4 border-t pt-3 text-xs text-[#5A6273]" style={{ borderColor: MX.ice }}>
                  <span className="flex items-center gap-1"><Mic className="h-3.5 w-3.5" style={{ color: MX.gold }} /> {data.fieldPulse.voicePct}% via voice</span>
                  <span className="flex items-center gap-1"><WifiOff className="h-3.5 w-3.5" style={{ color: MX.gold }} /> {data.fieldPulse.offlinePct}% offline-synced</span>
                </div>
              </>
            )}
          </Card>

          {/* aging watch */}
          <Card className="rounded-xl border bg-white p-5 shadow-none" style={{ borderColor: MX.ice }}>
            <h2 className="text-sm font-semibold" style={{ ...GEORGIA, color: MX.navy }}>
              Aging watch
            </h2>
            {data.agingWatch.length === 0 ? (
              <p className="mt-3 text-sm text-[#5A6273]">Nothing open long enough to worry about.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {data.agingWatch.map((item) => (
                  <li key={`${item.type}-${item.ref}`} className="flex items-center gap-2">
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: item.type === "RCA" ? "#5B2D90" : MX.navy }}>
                      {item.type}
                    </span>
                    <Link href={item.href} className="min-w-0 flex-1 truncate text-sm hover:underline" style={{ color: MX.navy }} title={item.label}>
                      <span className="font-mono text-xs">{item.ref}</span> {item.label}
                    </Link>
                    <Badge variant="neutral"
                      className="rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
                      style={{ background: item.ageDays > 60 ? "#C0392B22" : "#C9A96122", color: item.ageDays > 60 ? MX.red : "#8a6d2f" }}>
                      {item.ageDays}d
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
