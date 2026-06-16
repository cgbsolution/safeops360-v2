"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { POLICY_TYPE_LABEL, inrCompact } from "@/app/(dashboard)/erm/lib-t3";

const BAR_HEX = "#1d4ed8"; // primary-700

/** Policy-type coverage map — sum insured by policy type (recharts bar). */
export function CoverageByTypeChart({ data }: { data: { policyType: string; sumInsured: number }[] }) {
  const rows = (data ?? [])
    .filter((d) => (d.sumInsured ?? 0) > 0)
    .map((d) => ({
      key: d.policyType,
      name: POLICY_TYPE_LABEL[d.policyType] ?? d.policyType.replace(/_/g, " "),
      sumInsured: d.sumInsured ?? 0,
    }))
    .sort((a, b) => b.sumInsured - a.sumInsured);

  if (rows.length === 0) {
    return <p className="py-10 text-center text-xs text-slate-400">No active cover by type yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 34 + 40)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
        <CartesianGrid horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" tickFormatter={(v) => inrCompact(v)} tick={{ fontSize: 10, fill: "#64748b" }} />
        <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: "#334155" }} />
        <Tooltip
          formatter={(v: number) => [inrCompact(v), "Sum insured"]}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
        />
        <Bar dataKey="sumInsured" radius={[0, 4, 4, 0]}>
          {rows.map((r) => (
            <Cell key={r.key} fill={BAR_HEX} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
