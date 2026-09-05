"use client";

// InsightBar — the shared summary-insight strip that sits directly under a
// list screen's KPI row and above its status filter tabs (spec §1.2).
//
// Renders 0–3 insight cards. Each card is grounded in real records and, when
// clicked, filters the list below to its `recordRefs` via the `insight` URL
// param (the page reads it and narrows the rows — same server-driven pattern
// as the existing FilterTabs). Empty → renders nothing (no "all clear" noise).
//
// Theme: reuses the app's violet/semantic tokens (NOT a separate navy/gold
// skin) so the strip reads as part of the screen it lives on — decided against
// the spec's literal "Midnight Executive" wording, which only applies to the
// standalone capture surfaces. Severity still maps to the spec's restraint:
// info/watch stay quiet, critical is a muted rose, never an alarm-red fill.

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlarmClock,
  AlertTriangle,
  ArrowRightCircle,
  CopyCheck,
  Layers,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Insight, InsightKind, InsightSeverity } from "@/lib/insights";
import { Button } from "@/components/ui/button";

const KIND_ICON: Record<InsightKind, LucideIcon> = {
  trend: TrendingUp,
  cluster: Layers,
  anomaly: AlertTriangle,
  predictive_risk: Activity,
  next_best_action: ArrowRightCircle,
  duplicate: CopyCheck,
  overdue_escalation: AlarmClock,
};

// Restrained severity tints on the app palette. Summary strip, not an alarm.
const SEV_STYLE: Record<InsightSeverity, { card: string; icon: string }> = {
  info: { card: "border-primary-200 bg-primary-50", icon: "text-primary-600" },
  watch: { card: "border-amber-200 bg-amber-50/70", icon: "text-amber-600" },
  high: { card: "border-amber-300 bg-amber-50", icon: "text-amber-700" },
  critical: { card: "border-rose-200 bg-rose-50", icon: "text-rose-600" },
};

export function InsightBar({ insights, className }: { insights: Insight[]; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeId = searchParams.get("insight");

  const toggle = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (params.get("insight") === id) params.delete("insight");
      else params.set("insight", id);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // Empty state: show nothing rather than force an "all clear" card (spec §1.2).
  if (!insights.length) return null;

  return (
    <div className={cn("mb-4", className)} aria-label="AI insights">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {insights.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            active={activeId === insight.id}
            onToggle={() => toggle(insight.id)}
          />
        ))}
      </div>
    </div>
  );
}

function InsightCard({
  insight,
  active,
  onToggle,
}: {
  insight: Insight;
  active: boolean;
  onToggle: () => void;
}) {
  const Icon = KIND_ICON[insight.kind] ?? Activity;
  const sev = SEV_STYLE[insight.severity] ?? SEV_STYLE.info;
  const low = insight.confidence === "low";

  return (
    <Button variant="ghost"
      type="button"
      onClick={onToggle}
      title={insight.evidence}
      aria-pressed={active}
      className={cn(
        "group relative flex w-full items-start gap-3 rounded-xl border p-3 text-left transition",
        sev.card,
        "hover:elevation-1",
        active && "ring-2 ring-primary-500 ring-offset-1",
        low && "opacity-70"
      )}>
      <span className={cn("mt-0.5 shrink-0", sev.icon)} aria-hidden>
        <Icon size={18} strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold leading-snug text-slate-900">{insight.headline}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate-600" title={insight.evidence}>
          {insight.evidence}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          {low && (
            <span className="chip border-slate-200 bg-white/70 text-[10px] text-slate-500">early signal</span>
          )}
          {insight.recordRefs.length > 0 && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-primary-700">
              {active ? "Showing " : "Filter to "}
              {insight.recordRefs.length} record{insight.recordRefs.length === 1 ? "" : "s"}
            </span>
          )}
        </span>
      </span>
      {active && (
        <span className="absolute right-2 top-2 text-slate-400 group-hover:text-slate-600" aria-hidden>
          <X size={14} />
        </span>
      )}
    </Button>
  );
}
