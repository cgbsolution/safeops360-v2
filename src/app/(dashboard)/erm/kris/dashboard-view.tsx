"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { Link2, X } from "lucide-react";
import { KpiTile } from "@/components/erm/shared";
import {
  KRI_STATUS_CHIP,
  KRI_STATUS_HEX,
  type KriListResponse,
  type KriOut,
} from "@/app/(dashboard)/erm/lib-p2";

type Filters = {
  category?: string;
  status?: string;
  feedType?: string;
  owner?: string;
};

const FEED_LABEL: Record<string, string> = {
  MANUAL: "Manual",
  MODULE_FED: "Module-fed",
  API: "API",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={
        "inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold " +
        (KRI_STATUS_CHIP[status] ?? KRI_STATUS_CHIP.NO_DATA)
      }
    >
      {status === "NO_DATA" ? "NO DATA" : status}
    </span>
  );
}

function Sparkline({ points, status }: { points: KriOut["sparkline"]; status: string }) {
  if (!points || points.length < 2) {
    return <div className="h-9 w-full text-[10px] leading-9 text-slate-300">no trend</div>;
  }
  const color = KRI_STATUS_HEX[status] ?? KRI_STATUS_HEX.NO_DATA;
  const data = points.slice(-6).map((p, i) => ({ i, value: p.value }));
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={data} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function KriDashboardView({ data, filters }: { data: KriListResponse; filters: Filters }) {
  const router = useRouter();
  const sc = data.statusCounts ?? {};

  // Build URL preserving other filters, toggling the given key.
  function filterHref(key: keyof Filters, value: string): string {
    const sp = new URLSearchParams();
    (Object.entries(filters) as [keyof Filters, string | undefined][]).forEach(([k, v]) => {
      if (v && k !== key) sp.set(k, v);
    });
    if (filters[key] !== value) sp.set(key, value);
    const s = sp.toString();
    return s ? `/erm/kris?${s}` : "/erm/kris";
  }

  const activeFilters = (Object.entries(filters) as [keyof Filters, string | undefined][]).filter(
    ([, v]) => !!v,
  );

  // Group tiles by category for the status wall.
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null; items: KriOut[] }>();
    for (const k of data.items) {
      const key = k.categoryId || "uncat";
      if (!map.has(key)) {
        map.set(key, {
          name: k.categoryName ?? "Uncategorised",
          color: k.categoryColor,
          items: [],
        });
      }
      map.get(key)!.items.push(k);
    }
    return Array.from(map.values());
  }, [data.items]);

  // Distinct facets for filter rows.
  const feedTypes = useMemo(
    () => Array.from(new Set(data.items.map((k) => k.feedType))).sort(),
    [data.items],
  );

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiTile label="Total Active" value={data.total} href="/erm/kris" />
        <KpiTile label="Red" value={sc.RED ?? 0} tone="critical" href={filterHref("status", "RED")} />
        <KpiTile label="Amber" value={sc.AMBER ?? 0} tone="warn" href={filterHref("status", "AMBER")} />
        <KpiTile label="No Data" value={sc.NO_DATA ?? 0} href={filterHref("status", "NO_DATA")} />
        <KpiTile label="Breaches Open" value={data.breachesOpen} tone="critical" href="/erm/kris?status=RED" />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <FilterRow label="Status">
            {["GREEN", "AMBER", "RED", "NO_DATA"].map((s) => (
              <FilterChip key={s} href={filterHref("status", s)} active={filters.status === s}>
                {s === "NO_DATA" ? "NO DATA" : s}
              </FilterChip>
            ))}
          </FilterRow>
          <FilterRow label="Feed">
            {feedTypes.map((f) => (
              <FilterChip key={f} href={filterHref("feedType", f)} active={filters.feedType === f}>
                {FEED_LABEL[f] ?? f}
              </FilterChip>
            ))}
          </FilterRow>
          {activeFilters.length > 0 && (
            <button
              onClick={() => router.push("/erm/kris")}
              className="ml-auto inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:border-rose-300 hover:text-rose-600"
            >
              <X size={12} /> Clear ({activeFilters.length})
            </button>
          )}
        </div>
      </div>

      {/* Status wall grouped by category */}
      {data.items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
          No KRIs match the current filters.
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.name} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: g.color ?? "#64748b" }}
                />
                <h2 className="text-sm font-semibold text-slate-900">{g.name}</h2>
                <span className="text-[11px] text-slate-400">{g.items.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {g.items.map((k) => (
                  <Link
                    key={k.id}
                    href={`/erm/kris/${k.id}`}
                    className="group flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          {k.kriCode}
                        </div>
                        <div className="line-clamp-2 text-sm font-medium text-slate-800 group-hover:text-primary-700">
                          {k.name}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {k.indicatorType && (
                          <span
                            title={k.indicatorType === "LEADING" ? "Leading — warns before the event" : k.indicatorType === "LAGGING" ? "Lagging — measures harm already done" : "Coincident"}
                            className={
                              "rounded border px-1.5 py-0.5 text-[9px] font-semibold " +
                              (k.indicatorType === "LEADING"
                                ? "border-sky-200 bg-sky-50 text-sky-700"
                                : k.indicatorType === "LAGGING"
                                  ? "border-slate-200 bg-slate-50 text-slate-500"
                                  : "border-violet-200 bg-violet-50 text-violet-700")
                            }
                          >
                            {k.indicatorType === "LEADING" ? "LEAD" : k.indicatorType === "LAGGING" ? "LAG" : "COIN"}
                          </span>
                        )}
                        <StatusChip status={k.currentStatus} />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold tabular-nums text-slate-900">
                        {k.currentValue != null ? k.currentValue : "—"}
                      </span>
                      {k.unit && <span className="text-xs text-slate-400">{k.unit}</span>}
                    </div>
                    <Sparkline points={k.sparkline} status={k.currentStatus} />
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Link2 size={11} /> {k.linkedRiskCount} risk{k.linkedRiskCount === 1 ? "" : "s"}
                      </span>
                      <span>{FEED_LABEL[k.feedType] ?? k.feedType}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={
        "rounded border px-2 py-0.5 text-[11px] font-medium transition-colors " +
        (active
          ? "border-primary-600 bg-primary-50 text-primary-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")
      }
    >
      {children}
    </Link>
  );
}
