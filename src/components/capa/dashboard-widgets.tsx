import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { ClipboardList, AlertCircle, CheckCircle2, Layers, TrendingUp, GitMerge } from "lucide-react";
import { PatternConfirmCard } from "@/components/capa/pattern-confirm-card";

// CAPA dashboard widgets — pure 3-tier.

export async function CapaVolumeBySourceWidget() {
  const data = await backendFetch<{ code: string; name: string; count: number }[]>(
    "/api/capa/dashboard/volume-by-source"
  ).catch(() => []);
  const total = data.reduce((a, b) => a + b.count, 0);
  return (
    <WidgetCard title="CAPAs by Source" icon={<Layers size={18} />} href="/capa">
      <div className="text-3xl font-bold text-slate-900">{total}</div>
      <div className="text-xs text-slate-500 mt-1">Total open + closed across sources</div>
      {data.length > 0 && (
        <ul className="mt-3 space-y-1">
          {data.map((d) => (
            <li key={d.code} className="text-xs flex justify-between">
              <span className="capitalize">{d.name}</span>
              <span className="text-slate-500">{d.count}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

export async function CapaOverdueWidget() {
  const data = await backendFetch<{
    total: number;
    bySeverity: Record<string, number>;
  }>("/api/capa/dashboard/overdue").catch(() => ({ total: 0, bySeverity: {} }));
  return (
    <WidgetCard
      title="Overdue CAPAs"
      icon={<AlertCircle size={18} />}
      href="/capa"
      tone={data.total > 0 ? "danger" : "default"}
    >
      <div className="text-3xl font-bold text-slate-900">{data.total}</div>
      <div className="text-xs text-slate-500 mt-1">
        Past closure target, not yet closed
      </div>
      {Object.keys(data.bySeverity).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {Object.entries(data.bySeverity).map(([sev, n]) => (
            <span key={sev} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
              {sev}: {n}
            </span>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

export async function CapaEffectivenessWidget() {
  const data = await backendFetch<{
    effective: number;
    total: number;
    percentEffective: number;
  }>("/api/capa/dashboard/effectiveness").catch(() => ({
    effective: 0,
    total: 0,
    percentEffective: 0
  }));
  return (
    <WidgetCard title="Effectiveness (90d)" icon={<CheckCircle2 size={18} />} href="/capa?state=VERIFIED">
      <div className="text-3xl font-bold text-slate-900">{data.percentEffective}%</div>
      <div className="text-xs text-slate-500 mt-1">
        {data.effective} of {data.total} verified CAPAs rated EFFECTIVE
      </div>
    </WidgetCard>
  );
}

export async function CapaTopRootCausesWidget() {
  const data = await backendFetch<{ category: string; count: number }[]>(
    "/api/capa/dashboard/top-root-causes"
  ).catch(() => []);
  const max = data[0]?.count ?? 1;
  return (
    <WidgetCard title="Top Root Cause Categories" icon={<TrendingUp size={18} />} href="/capa">
      {data.length === 0 ? (
        <div className="text-xs text-slate-400 py-2">No root causes recorded yet.</div>
      ) : (
        <ul className="space-y-1.5 mt-1">
          {data.map(({ category, count }) => (
            <li key={category} className="text-xs">
              <div className="flex justify-between mb-0.5">
                <span className="capitalize">{category.replace(/_/g, " ")}</span>
                <span className="text-slate-500">{count}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
                <div className="h-full bg-primary-500" style={{ width: `${(count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

export async function CapaStateDistributionWidget() {
  const data = await backendFetch<{ state: string; count: number }[]>(
    "/api/capa/dashboard/state-distribution"
  ).catch(() => []);
  const total = data.reduce((a, b) => a + b.count, 0);
  return (
    <WidgetCard title="CAPA State Distribution" icon={<ClipboardList size={18} />} href="/capa">
      <div className="text-3xl font-bold text-slate-900">{total}</div>
      <div className="text-xs text-slate-500 mt-1">Total across all states</div>
      {data.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {data.slice(0, 5).map((d) => (
            <li key={d.state} className="text-xs flex justify-between">
              <span>{d.state.replace(/_/g, " ")}</span>
              <span className="text-slate-500">{d.count}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

export async function CapaPatternsWidget() {
  type Candidate = {
    type: "candidate";
    plantId: string;
    primaryCategory: string;
    sourceTypeCode: string;
    capaCount: number;
    capaIds: string[];
    rationale: string;
  };
  type Confirmed = {
    type: "confirmed";
    id: string;
    plantId: string;
    status: string;
    rationale: string;
    capaIds: string[];
    reviewedAt: string | null;
  };
  type PatternItem = Candidate | Confirmed;
  const data = (await backendFetch<PatternItem[]>("/api/capa/patterns").catch(() => [])) as PatternItem[];
  const candidates: Candidate[] = [];
  const confirmed: Confirmed[] = [];
  for (const p of data) {
    if (p.type === "candidate") candidates.push(p);
    else confirmed.push(p);
  }
  return (
    <WidgetCard
      title="Pattern Detection"
      icon={<GitMerge size={18} />}
      href="/capa"
      tone={candidates.length > 0 ? "warning" : "default"}
      wide
    >
      {data.length === 0 ? (
        <div className="text-xs text-slate-400 py-2">
          No CAPA patterns detected. The detector looks for 3+ CAPAs at the same plant sharing primary
          category and source type in the last 180 days.
        </div>
      ) : (
        <div className="space-y-2 mt-1">
          {candidates.slice(0, 3).map((p, i) => (
            <PatternConfirmCard key={`c-${i}`} pattern={p} />
          ))}
          {confirmed.slice(0, 2).map((p) => (
            <div key={p.id} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-emerald-900">Confirmed pattern</span>
                <span className="text-emerald-700 text-[10px]">{p.capaIds.length} CAPAs</span>
              </div>
              <div className="text-slate-700 mt-1">{p.rationale}</div>
            </div>
          ))}
        </div>
      )}
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
