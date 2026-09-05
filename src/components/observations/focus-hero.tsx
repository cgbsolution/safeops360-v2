"use client";

// ObservationFocusHero — the role-aware "Focus Now" headline for the Safety
// Observations screen. Replaces the three co-equal InsightBar cards (which read
// as clutter) with ONE confident hero that promotes the single most important
// insight for the viewer's role.
//
// The lens is NOT a user-facing toggle — it's determined by the signed-in role
// (resolved server-side and passed in): a Plant Head sees operational / overdue
// exposure first; an EHS Head sees the root-cause cluster first. Same screen,
// each role opens on what they actually chase. It is pure presentation over the
// existing deterministic insight `bar` — no new data, no model. The CTA reuses
// the page's existing `?insight=<id>` click-through.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlarmClock,
  AlertTriangle,
  ArrowRight,
  ArrowRightCircle,
  Building2,
  CopyCheck,
  Layers,
  ShieldCheck,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { Insight, InsightKind, InsightSeverity } from "@/lib/insights";
import { Badge } from "@/components/ui/badge";

type Lens = "plant" | "ehs";

const KIND_ICON: Record<InsightKind, LucideIcon> = {
  trend: TrendingUp,
  cluster: Layers,
  anomaly: AlertTriangle,
  predictive_risk: Activity,
  next_best_action: ArrowRightCircle,
  duplicate: CopyCheck,
  overdue_escalation: AlarmClock,
};

// Short, uniform labels for the "Also flagged" pills — a full headline truncates
// mid-word and reads as broken, so the secondary strip shows a concise kind label
// + record count instead.
const KIND_LABEL: Record<InsightKind, string> = {
  trend: "Trend",
  cluster: "Cluster",
  anomaly: "Anomaly",
  predictive_risk: "Predicted risk",
  next_best_action: "Next action",
  duplicate: "Near-duplicates",
  overdue_escalation: "Bottleneck",
};

// Which insight each role cares about most, in order. First match wins; if none
// of a role's preferred kinds are present, the highest-ranked bar insight leads.
const PRIORITY: Record<Lens, InsightKind[]> = {
  plant: ["overdue_escalation", "next_best_action", "cluster", "anomaly", "predictive_risk", "duplicate", "trend"],
  ehs: ["cluster", "anomaly", "predictive_risk", "overdue_escalation", "next_best_action", "duplicate", "trend"],
};

// Severity → the hero's left stripe + accent. Restrained (a muted rose for
// critical, never an alarm-red fill) — the strip summarises, it doesn't alarm.
const STRIPE: Record<InsightSeverity, string> = {
  critical: "#e11d48",
  high: "#dd5a12",
  watch: "#c77807",
  info: "#7c3aed",
};

const LENS_META: Record<Lens, { label: string; Icon: LucideIcon; tag: string }> = {
  plant: { label: "Plant Head", Icon: Building2, tag: "Your focus today · operational exposure" },
  ehs: { label: "EHS Head", Icon: ShieldCheck, tag: "Your focus today · leading indicator" },
};

function pickFeatured(bar: Insight[], lens: Lens): Insight {
  for (const kind of PRIORITY[lens]) {
    const hit = bar.find((i) => i.kind === kind);
    if (hit) return hit;
  }
  return bar[0];
}

export function ObservationFocusHero({
  bar,
  lens = "plant",
}: {
  bar: Insight[];
  /** The viewer's role lens, resolved server-side from their role. */
  lens?: Lens;
}) {
  const pathname = usePathname();

  // Empty state: show nothing rather than an "all clear" hero (same rule as the
  // InsightBar it replaces).
  if (!bar.length) return null;

  const featured = pickFeatured(bar, lens);
  const others = bar.filter((i) => i.id !== featured.id);

  const stripe = STRIPE[featured.severity] ?? STRIPE.info;
  const Icon = KIND_ICON[featured.kind] ?? Activity;
  const meta = LENS_META[lens];
  const bigNum = featured.recordRefs.length;
  const cta = `${pathname}?insight=${featured.id}`;

  return (
    <div className="mb-4">
      <div
        className="relative overflow-hidden rounded-2xl text-white shadow-lg"
        style={{ background: "linear-gradient(150deg,#241645,#2e1c56)" }}
      >
        {/* soft accent glow, decorative — kept low so it never competes with
            the record panel on the right */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-8 left-1/4 h-48 w-1/2"
          style={{ background: "radial-gradient(70% 80% at 50% 0%, rgba(124,58,237,.28), transparent 70%)" }}
        />
        {/* severity stripe */}
        <span
          aria-hidden
          className="absolute left-0 top-4 bottom-4 w-1 rounded"
          style={{ background: stripe }}
        />

        <div className="relative grid gap-px lg:grid-cols-[1.4fr_1fr]">
          {/* ── main ── */}
          <div className="flex flex-col gap-3 p-5 pl-7 sm:p-6 sm:pl-8">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="neutral" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-white/90">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: stripe }} />
                {meta.tag}
              </Badge>

              {/* static role badge — this is the viewer's role, not a control */}
              <Badge variant="neutral" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80">
                <meta.Icon size={13} />
                <span className="hidden sm:inline">{meta.label} view</span>
              </Badge>
            </div>

            <div className="flex items-center gap-4">
              {bigNum > 0 && (
                <div className="flex shrink-0 flex-col items-center leading-none">
                  <span className="font-mono text-[52px] font-bold tracking-tight tabular-nums sm:text-[58px]">
                    {bigNum}
                  </span>
                  <span className="mt-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/55">
                    records
                  </span>
                </div>
              )}
              <h2 className="text-lg font-semibold leading-snug text-balance sm:text-[22px]">
                {featured.headline}
              </h2>
            </div>

            <p className="line-clamp-2 max-w-[54ch] text-[13px] leading-relaxed text-white/65">
              {featured.evidence}
            </p>

            <Link
              href={cta}
              className="mt-1 inline-flex w-fit items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-[13px] font-bold text-[#23163f] shadow-md transition hover:-translate-y-px hover:shadow-lg"
            >
              {featured.suggestedAction
                ? "Show me these records"
                : bigNum > 0
                  ? `Show me the ${bigNum} records`
                  : "Open this insight"}
              <ArrowRight size={15} />
            </Link>
          </div>

          {/* ── side rail: the records this focus is grounded in. The panel
              blends with the hero background; the record pills are OPAQUE, so
              they read uniformly without the gradient bleeding through. ── */}
          <div className="relative flex flex-col gap-1.5 border-t border-white/10 p-5 sm:p-6 lg:border-l lg:border-t-0">
            <span className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/50">
              <Icon size={12} /> Grounded in {featured.recordRefs.length || "these"} record
              {featured.recordRefs.length === 1 ? "" : "s"}
            </span>
            {featured.recordRefs.slice(0, 4).map((ref, i) => (
              <div
                key={ref}
                className="flex items-center gap-3 rounded-lg px-3 py-2 shadow-sm"
                style={{ background: "#f3f0fb" }}
              >
                <span className="w-4 shrink-0 font-mono text-[10.5px] tabular-nums" style={{ color: "#9488c0" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="truncate font-mono text-[12.5px] font-semibold" style={{ color: "#23163f" }}>
                  {ref}
                </span>
              </div>
            ))}
            {featured.recordRefs.length > 4 && (
              <span className="mt-0.5 pl-1 text-[11px] text-white/45">
                +{featured.recordRefs.length - 4} more in the filtered list
              </span>
            )}
            {featured.recordRefs.length === 0 && (
              <span className="text-[12px] text-white/60">A plant-wide trend — open the list to explore it.</span>
            )}
          </div>
        </div>
      </div>

      {/* secondary strip — the other signals, demoted from co-equal cards to a
          quiet row of compact, uniform pills (icon + short label + count). */}
      {others.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Also flagged</span>
          {others.slice(0, 3).map((o) => {
            const OIcon = KIND_ICON[o.kind] ?? Activity;
            return (
              <Link
                key={o.id}
                href={`${pathname}?insight=${o.id}`}
                title={o.headline}
                className="group inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-600 shadow-sm transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
              >
                <OIcon size={13} className="text-primary-500" />
                <span>{KIND_LABEL[o.kind] ?? "Insight"}</span>
                {o.recordRefs.length > 0 && (
                  <Badge variant="brand" className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums text-slate-500 group-hover:bg-primary-100 group-hover:text-primary-700">
                    {o.recordRefs.length}
                  </Badge>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
