"use client";

// Feature 8 — cost-of-unsafety. Plant trailing-12-month rollup + this incident's
// contribution + the "unsafety vs. cost of preventive CAPAs" comparison, which
// reframes CAPA spend as risk-avoided.

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IndianRupee, TrendingUp, AlertTriangle } from "lucide-react";

type Rollup = {
  totalCost: number;
  currency: string;
  incidentCount: number;
  contributingCount: number;
  byType: Record<string, number>;
  byArea: Record<string, number>;
  capaPreventiveCost: number;
  hasPlantConfig: boolean;
};

function fmt(n: number, ccy = "INR") {
  const sym = ccy === "INR" ? "₹" : "";
  if (n >= 1e7) return `${sym}${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `${sym}${(n / 1e5).toFixed(2)} L`;
  return `${sym}${n.toLocaleString("en-IN")}`;
}

export function IncidentCostCard({
  plantId,
  costImpact,
}: {
  plantId: string;
  costImpact: { totalCost?: number; costConfidence?: string; currency?: string } | null;
}) {
  const [roll, setRoll] = useState<Rollup | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/plants/${plantId}/cost-of-unsafety`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) setRoll(j); })
      .catch(() => {});
    return () => { alive = false; };
  }, [plantId]);

  if (!roll) return null;
  const ccy = roll.currency || "INR";
  const thisIncident = costImpact?.totalCost ?? 0;
  const avoidRatio = roll.capaPreventiveCost > 0 ? roll.totalCost / roll.capaPreventiveCost : null;

  return (
    <Card className="border-emerald-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <IndianRupee size={16} className="text-emerald-600" /> Cost of Unsafety
        </CardTitle>
        <CardDescription>Plant rollup (trailing 12 months) + this incident's contribution.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Plant · Trailing 12 mo</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{fmt(roll.totalCost, ccy)}</div>
            <div className="text-xs text-slate-500">{roll.contributingCount} of {roll.incidentCount} incidents</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">This incident</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{fmt(thisIncident, ccy)}</div>
            {costImpact?.costConfidence && (
              <Badge className="mt-1 bg-slate-100 text-slate-600 border-slate-200 text-[10px]">{costImpact.costConfidence}</Badge>
            )}
          </div>
        </div>

        {/* CAPA comparison — unsafety cost vs. cost of prevention */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Preventive CAPA spend (T12M)</span>
            <span className="font-semibold text-slate-900">{fmt(roll.capaPreventiveCost, ccy)}</span>
          </div>
          {avoidRatio && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-800">
              <TrendingUp size={13} />
              Every {ccy === "INR" ? "₹1" : "1"} of prevention offsets ~{fmt(avoidRatio * 1, ccy).replace("₹", "₹")} of unsafety cost.
            </div>
          )}
        </div>

        {!roll.hasPlantConfig && (
          <div className="flex items-start gap-1.5 text-[11px] text-amber-700">
            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
            No plant cost config set — downtime/labor rates default to 0. Set rates via the plant cost config for a CFO-grade number.
          </div>
        )}

        {Object.keys(roll.byType).length > 0 && (
          <div className="text-xs text-slate-500">
            Top by type: {Object.entries(roll.byType).slice(0, 3).map(([t, v]) => `${t.replace(/_/g, " ")} ${fmt(v, ccy)}`).join(" · ")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
