"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

// Effectiveness donut — EFFECTIVE green / DEFICIENT rose / NOT_ASSESSED slate.
const RATING_HEX: Record<string, string> = {
  EFFECTIVE: "#2E8B57",
  DEFICIENT: "#C0392B",
  NOT_ASSESSED: "#94a3b8",
};
const RATING_ORDER = ["EFFECTIVE", "DEFICIENT", "NOT_ASSESSED"] as const;

function label(token: string): string {
  return token.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function EffectivenessDonut({ ratingDistribution }: { ratingDistribution: Record<string, number> }) {
  const data = RATING_ORDER.map((k) => ({ key: k, name: label(k), value: ratingDistribution[k] ?? 0 })).filter(
    (d) => d.value > 0,
  );
  if (data.length === 0) {
    return <p className="py-10 text-center text-xs text-slate-400">No controls assessed yet.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
          {data.map((d) => (
            <Cell key={d.key} fill={RATING_HEX[d.key] ?? "#94a3b8"} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
