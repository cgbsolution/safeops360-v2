"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const DONUT_PALETTE = ["#1E6FB8", "#2E8B57", "#E6A817", "#E67E22", "#C0392B", "#7c3aed", "#0891b2", "#64748b"];

function label(token: string): string {
  return token.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ComplianceCharts({
  typeCounts,
  siteSplit,
  chart,
}: {
  typeCounts: Record<string, number>;
  siteSplit: Record<string, number>;
  chart: "donut" | "site";
}) {
  if (chart === "donut") {
    const data = Object.entries(typeCounts)
      .map(([k, v]) => ({ name: label(k), value: v }))
      .filter((d) => d.value > 0);
    if (data.length === 0) {
      return <p className="py-10 text-center text-xs text-slate-400">No obligations to chart.</p>;
    }
    return (
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
            {data.map((d, i) => (
              <Cell key={d.name} fill={DONUT_PALETTE[i % DONUT_PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // Site split — horizontal chip bars
  const entries = Object.entries(siteSplit).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return <p className="py-6 text-center text-xs text-slate-400">No site distribution available.</p>;
  }
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="space-y-2">
      {entries.map(([site, count]) => (
        <div key={site} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-xs font-medium text-slate-600" title={site}>
            {site}
          </span>
          <div className="flex h-5 flex-1 items-center overflow-hidden rounded bg-slate-100">
            <div
              className="flex h-full items-center rounded bg-primary-600 px-2 text-[10px] font-semibold text-white"
              style={{ width: `${Math.max((count / max) * 100, 8)}%` }}
            >
              {count}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
