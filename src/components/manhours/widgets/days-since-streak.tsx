import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CalendarClock } from "lucide-react";

/**
 * Days Since Last LTI — the streak metric that dominates every safety
 * dashboard. Large prominent number, colour-coded by streak length.
 * Resets to red as soon as a new LTI lands (engine returns 0).
 */
export function DaysSinceStreak({
  days,
  scopeLabel
}: {
  days: number;
  scopeLabel: string;
}) {
  // Streak buckets — defensive thresholds aligned with cement-industry
  // operating reality. 365+ is the "year without LTI" benchmark.
  const t = streakTone(days);

  return (
    <Card className={cn("h-full", t.card)}>
      <CardContent className="p-6 flex flex-col items-center justify-center text-center">
        <CalendarClock size={20} className={cn("opacity-70", t.icon)} />
        <div className={cn("text-5xl font-bold tabular-nums mt-2", t.text)}>
          {days >= 9999 ? "∞" : days}
        </div>
        <div className="text-[11px] uppercase tracking-wider text-slate-600 mt-1">
          Days since last LTI
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">{scopeLabel}</div>
        <div className={cn("text-[10px] font-medium mt-1.5", t.text)}>{t.label}</div>
      </CardContent>
    </Card>
  );
}

function streakTone(days: number) {
  if (days >= 365) {
    return {
      tone: "world-class",
      label: "≥ 1 year without LTI",
      card: "bg-emerald-50 border-emerald-200",
      text: "text-emerald-700",
      icon: "text-emerald-600"
    };
  }
  if (days >= 90) {
    return {
      tone: "good",
      label: "Streak building",
      card: "bg-emerald-50/60 border-emerald-200",
      text: "text-emerald-700",
      icon: "text-emerald-600"
    };
  }
  if (days >= 30) {
    return {
      tone: "watch",
      label: "Within recovery window",
      card: "bg-amber-50 border-amber-200",
      text: "text-amber-800",
      icon: "text-amber-700"
    };
  }
  return {
    tone: "alert",
    label: "Recent LTI — investigation hot",
    card: "bg-rose-50 border-rose-200",
    text: "text-rose-700",
    icon: "text-rose-600"
  };
}
