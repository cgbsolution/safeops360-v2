// InsightHero — the "This week's focus" hero in Midnight Executive navy/gold
// (navy #0B1F4D, gold #C9A961, ice #E8EEF7), driven by the Weekly Insight Engine
// view. LEFT = the claim (number, delta, qualifier, sentence, action); RIGHT rail
// = a DIFFERENT cut (type-specific bars + 3-stat footer + closing sentence, spec
// §4) — never restating the left. Generic over all insight types.

import Link from "next/link";
import type { WeeklyInsight } from "@/lib/weekly-insights";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const NAVY_BG = "linear-gradient(150deg,#0B1F4D,#0E2A5E)";
const GOLD = "#C9A961";
const ICE = "#E8EEF7";
const GEORGIA = "Georgia, 'Times New Roman', serif";

const TYPE_LABEL: Record<string, string> = {
  concentration: "concentration",
  bottleneck: "bottleneck",
  reporting_drop: "reporting drop",
  duplicate_cluster: "data quality",
  recurrence: "recurrence",
  meta_response_failure: "response gap",
};

const LIFECYCLE: Record<string, { label: string; color: string }> = {
  new: { label: "new", color: "#4FBF9F" },
  escalating: { label: "escalating", color: "#E24B4A" },
  persistent: { label: "persistent", color: GOLD },
  resolving: { label: "resolving", color: "#8FA3C4" },
  meta_response_failure: { label: "response gap", color: "#B58CE0" },
  meta: { label: "response gap", color: "#B58CE0" },
};

export function InsightHero({ hero }: { hero: WeeklyInsight }) {
  const d = hero.display;
  const r = hero.rail;
  const maxBar = Math.max(1, ...r.bars.map((b) => b.value));
  const life = LIFECYCLE[hero.type === "meta_response_failure" ? "meta" : hero.lifecycleState] ?? LIFECYCLE.new;
  const typeLabel = `This week's focus · ${TYPE_LABEL[hero.type] ?? hero.type}`;

  return (
    <div className="mb-4 overflow-hidden rounded-2xl shadow-lg" style={{ background: NAVY_BG, color: ICE }}>
      <div className="grid gap-px lg:grid-cols-[1.05fr_1fr]">
        {/* ── left: the claim ── */}
        <div className="flex flex-col gap-4 p-6 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              size="eyebrow"
              className="gap-2 px-3 py-1 text-[11px]"
              style={{ background: "rgba(201,169,97,0.14)", color: "#DBC08A" }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: GOLD }} />
              {typeLabel}
            </Badge>
            <Badge
              size="eyebrow"
              className="border-current bg-transparent px-2.5 text-[10.5px]"
              style={{ borderColor: life.color, color: life.color }}
            >
              {life.label}
            </Badge>
          </div>

          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span style={{ fontFamily: GEORGIA }} className="text-6xl font-bold leading-none">
              {d.number}
            </span>
            {d.delta && (
              <span
                className="text-sm font-semibold"
                style={{ color: d.deltaTone === "up_bad" ? "#F0776F" : d.deltaTone === "down_good" ? "#4FBF9F" : ICE }}
              >
                {d.deltaTone === "up_bad" ? "↗ " : d.deltaTone === "down_good" ? "↓ " : ""}
                {d.delta}
              </span>
            )}
            {d.qualifier && (
              <Badge
                size="sm"
                className="border-current bg-transparent px-2.5 text-[11px] font-medium normal-case tracking-normal"
                style={{ borderColor: "rgba(232,238,247,0.28)", color: "#C6D2E6" }}
              >
                {d.qualifier}
              </Badge>
            )}
          </div>

          <h2 style={{ fontFamily: GEORGIA }} className="max-w-[34ch] text-2xl font-semibold leading-snug text-balance">
            {d.headline}
          </h2>

          {d.actionLabel && (
            <Button
              asChild
              variant="outline"
              className="mt-1 w-fit border bg-transparent text-[13px] font-bold hover:bg-white/[0.06]"
              style={{ borderColor: "rgba(232,238,247,0.55)", color: ICE }}
            >
              <Link href={d.actionHref || "#"}>
                {d.actionLabel}
                <span aria-hidden>→</span>
              </Link>
            </Button>
          )}
        </div>

        {/* ── right rail: a different cut ── */}
        <div className="flex flex-col gap-5 p-6 sm:p-7" style={{ borderLeft: "0.5px solid rgba(232,238,247,0.16)" }}>
          {r.bars.length > 0 && (
            <div>
              {r.railTitle && (
                <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#8FA3C4" }}>
                  {r.railTitle}
                </div>
              )}
              <div className="flex flex-col gap-2">
                {r.bars.map((b) => (
                  <div key={b.label} className="grid grid-cols-[130px_1fr_auto] items-center gap-3">
                    <span className="truncate text-[13px]" title={b.label} style={{ color: "#DCE4F0" }}>
                      {b.label}
                    </span>
                    <Progress
                      value={b.value}
                      max={maxBar}
                      minVisiblePercent={6}
                      className="bg-transparent"
                      style={{ background: "rgba(232,238,247,0.10)" }}
                      indicatorClassName={b.emphasis ? "opacity-100" : "opacity-[0.82]"}
                      indicatorStyle={{ background: GOLD }}
                    />
                    <span className="text-right text-[13px] font-semibold tabular-nums">{b.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {r.stats.length > 0 && (
            <div className="flex gap-8">
              {r.stats.map((s) => (
                <div key={s.label} className="flex flex-col">
                  <span
                    style={{ fontFamily: GEORGIA, color: s.tone === "bad" || s.tone === "up_bad" ? "#F0776F" : ICE }}
                    className="text-2xl font-bold leading-none"
                  >
                    {s.value}
                  </span>
                  <span className="mt-1 text-[12px]" style={{ color: "#8FA3C4" }}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {r.closing && (
            <p className="text-[13px]" style={{ color: "#AFC0DA" }}>
              {r.closing}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
