"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ScoreDial, ComponentBars, StageBadge, StageLegend, Sparkline } from "./ui";
import {
  PALETTE,
  STAGES,
  STAGE_COLOR,
  cultureSend,
  type EnterpriseRollup,
  type EnterpriseSite,
  type MaturityProfile,
} from "./lib";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function MaturityView({
  rollup,
  siteDetail,
  selectedSite,
}: {
  rollup: EnterpriseRollup;
  siteDetail: MaturityProfile | null;
  selectedSite: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  function selectSite(id: string | null) {
    const params = new URLSearchParams(search.toString());
    if (id) params.set("site", id);
    else params.delete("site");
    router.push(`${pathname}${params.toString() ? `?${params}` : ""}`);
  }

  const totalSites = rollup.siteCount || 1;

  return (
    <div className="space-y-6">
      {/* Enterprise summary strip */}
      <div className="grid gap-4 lg:grid-cols-[auto,1fr]">
        <Card className="flex items-center gap-5 rounded-xl border bg-white p-5 shadow-none">
          <ScoreDial score={rollup.enterpriseScore} label="Enterprise" />
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Enterprise culture score</p>
            <p className="mt-0.5 text-sm text-slate-600">
              Mean maturity across <span className="font-semibold text-slate-800">{rollup.siteCount}</span> scored sites.
            </p>
            <div className="mt-3">
              <StageBadge stage={require_stage(rollup.enterpriseScore)} />
            </div>
          </div>
        </Card>

        {/* Stage distribution */}
        <Card className="rounded-xl border bg-white p-5 shadow-none">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-slate-500">Sites by maturity stage</p>
            <StageLegend />
          </div>
          <div className="flex h-7 w-full overflow-hidden rounded-lg">
            {STAGES.map((s) => {
              const n = rollup.stageCounts[s] ?? 0;
              const w = (n / totalSites) * 100;
              if (n === 0) return null;
              return (
                <div
                  key={s}
                  className="flex items-center justify-center text-[11px] font-semibold text-white"
                  style={{ width: `${w}%`, background: STAGE_COLOR[s] }}
                  title={`${s}: ${n}`}
                >
                  {w > 8 ? n : ""}
                </div>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {STAGES.map((s) => (
              <div key={s} className="rounded-lg bg-slate-50 p-2">
                <p className="text-lg font-bold" style={{ color: STAGE_COLOR[s] }}>
                  {rollup.stageCounts[s] ?? 0}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-slate-500">{s}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Site grid + drill-down */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
        <Card className="rounded-xl border bg-white p-5 shadow-none">
          <p className="mb-3 text-sm font-semibold" style={{ color: PALETTE.navy }}>
            Sites
          </p>
          <div className="space-y-2">
            {rollup.sites.length === 0 && <p className="text-sm text-slate-500">No site scores yet — run a recalculation.</p>}
            {rollup.sites.map((site) => (
              <SiteRow key={site.plantId} site={site} active={site.plantId === selectedSite} onClick={() => selectSite(site.plantId)} />
            ))}
          </div>
        </Card>

        <SiteDetailPanel detail={siteDetail} onClose={() => selectSite(null)} />
      </div>
    </div>
  );
}

function require_stage(score: number) {
  if (score <= 25) return "Reactive" as const;
  if (score <= 50) return "Dependent" as const;
  if (score <= 75) return "Independent" as const;
  return "Interdependent" as const;
}

function SiteRow({ site, active, onClick }: { site: EnterpriseSite; active: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={`h-auto flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
        active ? "border-primary-400 bg-primary-50/40" : "border-slate-200 hover:bg-slate-50"
      }`}
    >
      <div className="w-32 shrink-0">
        <p className="truncate text-sm font-medium text-slate-800">{site.plantName}</p>
        <p className="text-[11px] text-slate-400">{site.plantCode}{site.state ? ` · ${site.state}` : ""}</p>
      </div>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${site.stageScore}%`, background: STAGE_COLOR[site.currentStage] }} />
      </div>
      <span className="w-10 text-right text-sm font-semibold" style={{ color: STAGE_COLOR[site.currentStage] }}>
        {site.stageScore.toFixed(0)}
      </span>
      <StageBadge stage={site.currentStage} />
    </Button>
  );
}

function SiteDetailPanel({ detail, onClose }: { detail: MaturityProfile | null; onClose: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const router = useRouter();

  if (!detail) {
    return (
      <Card className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 shadow-none">
        Select a site to see its five component scores and 12-month trend.
      </Card>
    );
  }

  async function recalc() {
    if (!detail) return;
    setBusy(true);
    setMsg(null);
    try {
      await cultureSend(`/api/culture/maturity/recalculate/${detail.plantId}`, "POST");
      setMsg("Recalculated.");
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message ?? "Recalculation failed");
    } finally {
      setBusy(false);
    }
  }

  const trend = (detail.history ?? []).map((h) => h.stageScore);

  return (
    <Card className="rounded-xl border bg-white p-5 shadow-none">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <ScoreDial score={detail.stageScore} size={96} />
          <div>
            <StageBadge stage={detail.currentStage} />
            {detail.industryVertical && (
              <p className="mt-1 text-[11px] text-slate-400">{detail.industryVertical}</p>
            )}
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} className="h-auto w-auto p-1 text-xs text-slate-400 hover:text-slate-600">
          ✕
        </Button>
      </div>

      <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Component breakdown</p>
      <ComponentBars scores={detail.componentScores} plantId={detail.plantId} />

      <div className="mt-5 flex items-end justify-between">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Maturity trend</p>
          <Sparkline values={trend} />
        </div>
        <Button
          type="button"
          onClick={recalc}
          disabled={busy}
          className="text-xs font-semibold text-white disabled:opacity-60"
          style={{ background: PALETTE.navy }}
        >
          {busy ? "Recalculating…" : "Recalculate now"}
        </Button>
      </div>
      {msg && <p className="mt-2 text-xs text-slate-500">{msg}</p>}
      {detail.lastCalculatedAt && (
        <p className="mt-2 text-[11px] text-slate-400">
          Last calculated {new Date(detail.lastCalculatedAt).toLocaleString()}
        </p>
      )}
    </Card>
  );
}
