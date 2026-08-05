// insight-hero-from-records — the ONE reusable builder that maps any module's
// records into the WeeklyInsight shape the navy/gold <InsightHero> already
// renders. Ports the "This week's focus" visual format to Near Miss / Incident /
// HIRA / EAI / Combined Risk / CAPA without new components: each page normalises
// its records to HeroRecord[] + passes a HeroConfig. Deterministic, no fetch.

import type { WeeklyInsight } from "@/lib/weekly-insights";

export interface HeroRecord {
  date: Date;
  open: boolean;
  severity: string; // potentialSeverity / severity / riskLevel / classification …
  group: string;    // the rail breakdown dimension (area / location / plant / step)
}

export interface HeroConfig {
  /** short type fragment shown as "This week's focus · <type>" */
  type: string;
  /** severities that define the featured (high-value) subset */
  critical: string[];
  headline: (count: number, topGroup: string) => string;
  qualifier: string | null;
  actionHref: string;
  railTitle: string;
  closing: (oldestDays: number) => string;
  /** the two severity buckets shown in the rail's 3-stat footer */
  statLabels?: { critical: string; high: string };
  highSeverities?: string[];
}

function rollUp(sorted: { label: string; value: number }[]): { label: string; value: number }[] {
  if (sorted.length <= 3) return sorted;
  const rest = sorted.slice(2);
  return [...sorted.slice(0, 2), { label: `${rest.length} other areas`, value: rest.reduce((s, a) => s + a.value, 0) }];
}

export function buildHeroFromRecords(records: HeroRecord[], cfg: HeroConfig): WeeklyInsight | null {
  const open = records.filter((r) => r.open);
  if (open.length < 3) return null;

  const critSet = cfg.critical.map((s) => s.toUpperCase());
  const crit = open.filter((r) => critSet.includes((r.severity || "").toUpperCase()));
  const focus = crit.length >= 3 ? crit : open; // feature the serious subset when it's real

  const now = Date.now();
  const byGroup = new Map<string, number>();
  focus.forEach((r) => {
    const g = r.group || "Unspecified";
    byGroup.set(g, (byGroup.get(g) ?? 0) + 1);
  });
  const sorted = Array.from(byGroup.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const bars = rollUp(sorted);
  const topGroup = sorted[0]?.label ?? "the plant";

  const highSet = (cfg.highSeverities ?? ["HIGH", "SIGNIFICANT", "MAJOR"]).map((s) => s.toUpperCase());
  const critCount = open.filter((r) => critSet.includes((r.severity || "").toUpperCase())).length;
  const highCount = open.filter((r) => highSet.includes((r.severity || "").toUpperCase())).length;

  const oldestDays = Math.max(0, ...focus.map((r) => Math.floor((now - r.date.getTime()) / 86_400_000)));
  const cut = now - 90 * 86_400_000;
  const delta = focus.filter((r) => r.date.getTime() >= cut).length - focus.filter((r) => r.date.getTime() < cut).length;

  return {
    identityKey: cfg.type,
    type: cfg.type,
    lifecycleState: "new",
    score: 0,
    weeksRunning: 1,
    display: {
      number: focus.length,
      numberLabel: "records",
      headline: cfg.headline(focus.length, topGroup),
      delta: delta > 0 ? `+${delta} vs prior 90d` : null,
      deltaTone: delta > 0 ? "up_bad" : "neutral",
      qualifier: cfg.qualifier,
      actionLabel: "Show me these records",
      actionHref: cfg.actionHref,
    },
    rail: {
      kind: cfg.type,
      railTitle: cfg.railTitle,
      bars,
      stats: [
        { value: String(critCount), label: cfg.statLabels?.critical ?? "critical", tone: critCount ? "bad" : "neutral" },
        { value: String(highCount), label: cfg.statLabels?.high ?? "high" },
        { value: String(open.length), label: "open total" },
      ],
      closing: cfg.closing(oldestDays),
    },
  };
}
