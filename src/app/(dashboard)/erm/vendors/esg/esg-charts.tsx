"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Printer } from "lucide-react";
import { inrCompact, type EsgPortfolio } from "@/app/(dashboard)/erm/lib-t3";
import { Button } from "@/components/ui/button";

const ESG_ORDER = ["LEADING", "ADEQUATE", "DEVELOPING", "LAGGING"] as const;

export function ExportButton() {
  return (
    <Button variant="outline"
      onClick={() => window.print()} className="gap-2 rounded-md px-4 py-2 text-sm shadow-sm transition-colors">
      <Printer size={16} /> Export
    </Button>
  );
}

/** Spend-by-ESG-band bar — coloured by ESG_BAND_HEX from the API rows. */
export function SpendByBandChart({ spendByBand }: { spendByBand: EsgPortfolio["spendByBand"] }) {
  const order = (b: string) => ESG_ORDER.indexOf(b as (typeof ESG_ORDER)[number]);
  const data = [...spendByBand].sort((a, b) => order(a.band) - order(b.band));
  if (data.length === 0) {
    return <p className="py-10 text-center text-xs text-slate-400">No spend data.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ left: 10, right: 20, top: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="band" tick={{ fontSize: 11 }} stroke="#64748b" />
        <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => inrCompact(v as number)} width={70} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
          formatter={(v: any) => inrCompact(Number(v))}
        />
        <Bar dataKey="spend" name="Annual spend" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.band} fill={d.colorHex ?? "#94a3b8"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
