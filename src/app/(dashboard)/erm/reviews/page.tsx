import Link from "next/link";
import { CalendarClock, AlertTriangle } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { BandBadge } from "@/components/erm/shared";
import { BAND_HEX, fmtDate } from "@/app/(dashboard)/erm/lib";
import { CRITICALITY_CHIP, type ProcessListResponse, type PlanListResponse } from "@/app/(dashboard)/erm/lib-p3";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type RiskReviewItem = {
  riskId: string;
  riskCode: string;
  title: string;
  residualBand: string | null;
  nextReviewDate: string | null;
  overdueDays: number;
  reviewBadge: string | null;
  riskOwnerId: string;
  riskOwnerName: string | null;
};

// Unified calendar item across risk reviews, BIA reviews and plan reviews.
type CalItem = {
  kind: "RISK" | "BIA" | "PLAN";
  id: string;
  code: string;
  title: string;
  href: string;
  band: string | null; // residual band (risk) — drives the left accent
  criticality: string | null; // BIA only
  nextReviewDate: string | null;
  overdueDays: number;
  ownerName: string | null;
};

const KIND_CHIP: Record<string, string> = {
  RISK: "bg-slate-100 text-slate-700 border-slate-200",
  BIA: "bg-violet-100 text-violet-800 border-violet-200",
  PLAN: "bg-sky-100 text-sky-800 border-sky-200",
};
const KIND_LABEL: Record<string, string> = { RISK: "Risk", BIA: "BIA", PLAN: "Plan" };
const KIND_ACCENT: Record<string, string> = { RISK: "#94a3b8", BIA: "#8b5cf6", PLAN: "#0ea5e9" };

function overdueFrom(date: string | null): number {
  if (!date) return 0;
  const diff = Date.now() - new Date(date).getTime();
  return diff > 0 ? Math.floor(diff / 86_400_000) : 0;
}

function monthKey(d: string | null): string {
  if (!d) return "0000-00";
  try {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
  } catch {
    return "0000-00";
  }
}
function monthLabel(key: string): string {
  if (key === "0000-00") return "No review date set";
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export default async function ReviewCalendarPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const mine = sp.mine === "true";

  let error: string | null = null;
  const items: CalItem[] = [];

  // ── Risk reviews (Phase 1) ──────────────────────────────────────────────────
  try {
    const risks = await backendFetch<RiskReviewItem[]>("/api/erm/reviews/calendar", {
      query: { mine: mine ? "true" : undefined },
    });
    for (const r of risks) {
      items.push({
        kind: "RISK", id: r.riskId, code: r.riskCode, title: r.title, href: `/erm/register/${r.riskId}`,
        band: r.residualBand, criticality: null, nextReviewDate: r.nextReviewDate, overdueDays: r.overdueDays, ownerName: r.riskOwnerName,
      });
    }
  } catch (e: any) {
    error = e?.message ?? "Failed to load review calendar";
  }

  // ── BIA + plan reviews (Phase 3). "My reviews" stays risk-only (BCM has no
  //    server-side owner filter here); degrade gracefully if BCM isn't seeded. ──
  if (!mine) {
    const [procs, plans] = await Promise.all([
      backendFetch<ProcessListResponse>("/api/erm/bcm/processes").catch(() => ({ items: [], total: 0, criticalityCounts: {} } as ProcessListResponse)),
      backendFetch<PlanListResponse>("/api/erm/bcm/plans").catch(() => ({ items: [], total: 0, statusCounts: {} } as PlanListResponse)),
    ]);
    for (const p of procs.items) {
      if (!p.nextBiaReviewDate) continue;
      items.push({
        kind: "BIA", id: p.id, code: p.processCode, title: `${p.name} — BIA review`, href: `/erm/bcm/processes/${p.id}`,
        band: null, criticality: p.criticality, nextReviewDate: p.nextBiaReviewDate, overdueDays: overdueFrom(p.nextBiaReviewDate), ownerName: p.ownerName,
      });
    }
    for (const pl of plans.items) {
      if (!pl.nextReviewDate || pl.status !== "APPROVED") continue;
      items.push({
        kind: "PLAN", id: pl.id, code: pl.planCode, title: `${pl.title} — plan review`, href: `/erm/bcm/plans/${pl.id}`,
        band: null, criticality: null, nextReviewDate: pl.nextReviewDate, overdueDays: overdueFrom(pl.nextReviewDate), ownerName: pl.ownerName,
      });
    }
  }

  const overdue = items.filter((i) => i.overdueDays > 0).sort((a, b) => b.overdueDays - a.overdueDays);
  const upcoming = items.filter((i) => i.overdueDays <= 0);

  const groups = new Map<string, CalItem[]>();
  for (const i of upcoming) {
    const k = monthKey(i.nextReviewDate);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(i);
  }
  const sortedKeys = [...groups.keys()].sort();
  for (const k of sortedKeys) {
    groups.get(k)!.sort((a, b) => {
      const da = a.nextReviewDate ? new Date(a.nextReviewDate).getTime() : Infinity;
      const db = b.nextReviewDate ? new Date(b.nextReviewDate).getTime() : Infinity;
      return da - db;
    });
  }

  const counts = {
    risk: items.filter((i) => i.kind === "RISK").length,
    bia: items.filter((i) => i.kind === "BIA").length,
    plan: items.filter((i) => i.kind === "PLAN").length,
  };

  const toggleLink = (target: boolean, label: string) => {
    const active = mine === target;
    return (
      <Link
        href={target ? "/erm/reviews?mine=true" : "/erm/reviews"}
        className={
          "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
          (active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")
        }
      >
        {label}
      </Link>
    );
  };

  return (
    <div>
      <PageHeader
        title="Review Calendar"
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "Reviews" }]}
        description="Scheduled risk reviews, business-impact (BIA) reviews and continuity-plan reviews — overdue first, then upcoming by month."
      />

      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</Alert>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Scope</span>
            {toggleLink(false, "All reviews")}
            {toggleLink(true, "My risk reviews")}
            <span className="ml-auto text-xs text-slate-500">
              {counts.risk} risk{!mine && ` · ${counts.bia} BIA · ${counts.plan} plan`}
            </span>
          </div>

          {overdue.length > 0 && (
            <Alert variant="destructive" className="mb-5 rounded-xl border border-rose-200 bg-rose-50/60 p-5">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-rose-800">
                <AlertTriangle size={16} /> Overdue ({overdue.length})
              </h2>
              <div className="space-y-2">
                {overdue.map((i) => <ReviewRow key={`${i.kind}-${i.id}`} item={i} />)}
              </div>
            </Alert>
          )}

          {upcoming.length === 0 && overdue.length === 0 ? (
            <Card className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-none">
              No reviews {mine ? "assigned to you " : ""}scheduled.
            </Card>
          ) : (
            <div className="space-y-5">
              {sortedKeys.map((k) => (
                <Card key={k} className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
                  <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                    <CalendarClock size={16} className="text-slate-400" /> {monthLabel(k)}
                    <span className="text-[11px] font-normal text-slate-400">({groups.get(k)!.length})</span>
                  </h2>
                  <div className="space-y-2">
                    {groups.get(k)!.map((i) => <ReviewRow key={`${i.kind}-${i.id}`} item={i} />)}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReviewRow({ item }: { item: CalItem }) {
  const accent = item.kind === "RISK" ? (BAND_HEX[(item.band ?? "").toUpperCase()] ?? KIND_ACCENT.RISK) : KIND_ACCENT[item.kind];
  return (
    <Card
      className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 bg-white py-2.5 pl-3 pr-3 shadow-none"
      style={{ borderLeft: `3px solid ${accent}` }}>
      <span className={"shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold " + (KIND_CHIP[item.kind] ?? "")}>{KIND_LABEL[item.kind]}</span>
      <Link href={item.href} className="font-medium text-primary-700 hover:underline">{item.code}</Link>
      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{item.title}</span>
      {item.kind === "RISK" ? (
        <BandBadge band={item.band} />
      ) : item.criticality ? (
        <span className={"rounded border px-1.5 py-0.5 text-[10px] " + (CRITICALITY_CHIP[item.criticality] ?? "")}>{item.criticality}</span>
      ) : null}
      <span className="hidden text-xs text-slate-500 sm:inline">{item.ownerName ?? "—"}</span>
      <span className="text-xs text-slate-500">{fmtDate(item.nextReviewDate)}</span>
      {item.overdueDays > 0 && (
        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">{item.overdueDays}d overdue</span>
      )}
    </Card>
  );
}
