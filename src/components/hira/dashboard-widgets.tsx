import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { ShieldAlert, AlertTriangle, Calendar, ListChecks, TrendingUp, ScrollText } from "lucide-react";

// HIRA dashboard widgets — pure 3-tier.
//
// Each widget is a server component that fetches its KPI from the FastAPI
// backend (no direct Prisma). The backend handles plant-scope filtering
// based on the caller's role; widgets don't need a `plantIds` prop any more.

/** Tile 1 — Coverage. */
export async function HiraCoverageWidget() {
  const data = await backendFetch<{
    totalDepartments: number;
    coveredDepartments: number;
    coveragePct: number;
  }>("/api/hira/dashboard/coverage").catch(() => ({
    totalDepartments: 0,
    coveredDepartments: 0,
    coveragePct: 0
  }));
  return (
    <WidgetCard title="HIRA Coverage" icon={<ListChecks size={18} />} href="/hira">
      <div className="text-3xl font-bold text-slate-900">{data.coveragePct}%</div>
      <div className="text-xs text-slate-500 mt-1">
        {data.coveredDepartments} of {data.totalDepartments} active departments have a current HIRA
      </div>
    </WidgetCard>
  );
}

/** Tile 2 — Review compliance. */
export async function HiraReviewComplianceWidget() {
  const data = await backendFetch<{
    overdue: number;
    dueSoon30Days: number;
    completedLast90Days: number;
  }>("/api/hira/dashboard/review-compliance").catch(() => ({
    overdue: 0,
    dueSoon30Days: 0,
    completedLast90Days: 0
  }));
  return (
    <WidgetCard
      title="Review Compliance"
      icon={<Calendar size={18} />}
      href="/hira/reviews"
      tone={data.overdue > 0 ? "warning" : "default"}
    >
      <div className="text-3xl font-bold text-slate-900">{data.overdue}</div>
      <div className="text-xs text-slate-500 mt-1">
        Overdue · {data.dueSoon30Days} due in 30 days · {data.completedLast90Days} closed in last 90 days
      </div>
    </WidgetCard>
  );
}

/** Tile 3 — High-residual entries. */
export async function HiraHighRiskWidget() {
  const data = await backendFetch<{ high: number; critical: number; total: number }>(
    "/api/hira/dashboard/high-risk"
  ).catch(() => ({ high: 0, critical: 0, total: 0 }));
  return (
    <WidgetCard
      title="High/Critical Residual Risk"
      icon={<ShieldAlert size={18} />}
      href="/hira"
      tone={data.critical > 0 ? "danger" : data.total > 0 ? "warning" : "default"}
    >
      <div className="text-3xl font-bold text-slate-900">{data.total}</div>
      <div className="text-xs text-slate-500 mt-1">
        {data.critical} critical · {data.high} high — entries needing escalation
      </div>
    </WidgetCard>
  );
}

/** Tile 4 — Top hazard categories. */
export async function HiraTopHazardsWidget() {
  const data = await backendFetch<{ category: string; count: number }[]>(
    "/api/hira/dashboard/top-hazards"
  ).catch(() => []);
  const max = data[0]?.count ?? 1;
  return (
    <WidgetCard title="Top Hazard Categories" icon={<AlertTriangle size={18} />} href="/configuration/hazards">
      {data.length === 0 ? (
        <div className="text-xs text-slate-400 py-2">No hazards in active studies yet.</div>
      ) : (
        <ul className="space-y-1.5 mt-1">
          {data.map(({ category, count }) => (
            <li key={category} className="text-xs">
              <div className="flex justify-between mb-0.5">
                <span className="capitalize">{category.replace(/_/g, " ")}</span>
                <span className="text-slate-500">{count}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
                <div
                  className="h-full bg-primary-500"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

/** Tile 5 — Recent review cycles. */
export async function HiraRecentReviewsWidget() {
  type Cycle = {
    id: string;
    triggeredBy: string;
    status: string;
    scheduledFor: string;
    entryId: string;
  };
  const data = await backendFetch<Cycle[]>("/api/hira/review-cycles").catch(() => []);
  return (
    <WidgetCard title="Recent Review Cycles" icon={<ScrollText size={18} />} href="/hira/reviews" wide>
      {data.length === 0 ? (
        <div className="text-xs text-slate-400 py-2">No open review cycles.</div>
      ) : (
        <ul className="divide-y mt-1 -mx-1">
          {data.slice(0, 5).map((r) => (
            <li key={r.id} className="px-1 py-1.5">
              <Link href={`/hira/reviews/${r.id}`} className="block hover:bg-slate-50 rounded px-1.5 py-0.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-medium text-slate-700 line-clamp-1">
                    Review cycle {r.id.slice(0, 8)}…
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border ${
                      r.triggeredBy === "INCIDENT"
                        ? "bg-rose-50 text-rose-800 border-rose-200"
                        : r.triggeredBy === "SCHEDULE"
                        ? "bg-blue-50 text-blue-800 border-blue-200"
                        : "bg-slate-50 text-slate-700 border-slate-200"
                    }`}
                  >
                    {r.triggeredBy}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {r.status} · scheduled {new Date(r.scheduledFor).toLocaleDateString()}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

/** Tile 6 — Risk reduction trend. */
export async function HiraRiskReductionWidget() {
  const data = await backendFetch<{
    initialTotal: number;
    residualTotal: number;
    reductionPct: number;
  }>("/api/hira/dashboard/risk-reduction").catch(() => ({
    initialTotal: 0,
    residualTotal: 0,
    reductionPct: 0
  }));
  return (
    <WidgetCard title="Risk Reduction Achieved" icon={<TrendingUp size={18} />}>
      <div className="text-3xl font-bold text-slate-900">{data.reductionPct}%</div>
      <div className="text-xs text-slate-500 mt-1">
        Aggregate residual {data.residualTotal} vs initial {data.initialTotal} across active entries
      </div>
    </WidgetCard>
  );
}

function WidgetCard({
  title,
  icon,
  href,
  children,
  tone,
  wide
}: {
  title: string;
  icon: React.ReactNode;
  href?: string;
  children: React.ReactNode;
  tone?: "default" | "warning" | "danger";
  wide?: boolean;
}) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200 bg-rose-50"
      : tone === "warning"
      ? "border-amber-200 bg-amber-50"
      : "border-slate-200 bg-white";
  const card = (
    <div className={`rounded-xl border ${toneClass} p-4 ${wide ? "lg:col-span-2" : ""} h-full`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wider text-slate-600 font-medium">{title}</div>
        <div className="text-slate-400">{icon}</div>
      </div>
      {children}
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:shadow-sm transition rounded-xl">
      {card}
    </Link>
  ) : (
    card
  );
}
