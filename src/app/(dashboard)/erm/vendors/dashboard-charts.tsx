"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { RISK_BAND_HEX, ESG_BAND_HEX } from "@/app/(dashboard)/erm/lib-t3";

const RISK_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const ESG_ORDER = ["LEADING", "ADEQUATE", "DEVELOPING", "LAGGING"] as const;

function label(token: string): string {
  return token.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function BandDonut({
  distribution,
  order,
  hex,
}: {
  distribution: Record<string, number>;
  order: readonly string[];
  hex: Record<string, string>;
}) {
  const data = order
    .map((k) => ({ key: k, name: label(k), value: distribution[k] ?? 0 }))
    .filter((d) => d.value > 0);
  if (data.length === 0) {
    return <p className="py-10 text-center text-xs text-slate-400">No vendors scored yet.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
          {data.map((d) => (
            <Cell key={d.key} fill={hex[d.key] ?? "#94a3b8"} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** THE SIGNATURE: two donuts side by side — Risk band + ESG band distribution. */
export function DualBandDonuts({
  riskBandDistribution,
  esgBandDistribution,
}: {
  riskBandDistribution: Record<string, number>;
  esgBandDistribution: Record<string, number>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-1 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RISK_BAND_HEX.CRITICAL }} />
          <h2 className="text-sm font-semibold text-slate-900">Risk Band Distribution</h2>
        </div>
        <p className="mb-2 text-xs text-slate-500">Third-party risk lens — higher band is worse.</p>
        <BandDonut distribution={riskBandDistribution} order={RISK_ORDER} hex={RISK_BAND_HEX} />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-1 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ESG_BAND_HEX.LEADING }} />
          <h2 className="text-sm font-semibold text-slate-900">ESG Band Distribution</h2>
        </div>
        <p className="mb-2 text-xs text-slate-500">Supplier ESG posture lens — higher band is better.</p>
        <BandDonut distribution={esgBandDistribution} order={ESG_ORDER} hex={ESG_BAND_HEX} />
      </div>
    </div>
  );
}
