"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const MX = { navy: "#0B1F4D", gold: "#C9A961" };

export type CalibrationReport = {
  rows: {
    observationType: string | null;
    categoryCode: string | null;
    subCategoryCode: string | null;
    suggestedSeverity: string;
    overrides: number;
    up: number;
    down: number;
    observations: number;
    overrideRatePct: number | null;
    dominantDirection: string;
    directionConsistencyPct: number | null;
  }[];
  since: string | null;
  sources: string[];
};

function label(code: string | null) {
  if (!code) return "—";
  return code.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

function severityLabel(v: string) {
  return v.charAt(0) + v.slice(1).toLowerCase();
}

/**
 * Two numbers carry the whole judgement, so they are the two the table leads on:
 *
 *   • override rate — how often observers disagree at all
 *   • direction consistency — whether they disagree the SAME way
 *
 * High on both is a wrong rule with an obvious fix. High rate but mixed
 * direction usually means the sub-category spans two different exposures, which
 * is a taxonomy problem the matrix cannot solve.
 */
export function CalibrationTable({
  report,
  days,
  includeAll,
}: {
  report: CalibrationReport;
  days: number;
  includeAll: boolean;
}) {
  const router = useRouter();

  function navigate(nextDays: number, nextAll: boolean) {
    router.push(`/configuration/severity-calibration?days=${nextDays}&all=${nextAll ? "1" : "0"}`);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1">
            <Label htmlFor="days">Window</Label>
            <Select
              id="days"
              value={String(days)}
              onChange={(e) => navigate(Number(e.target.value), includeAll)}
              className="w-40"
            >
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 180 days</option>
              <option value="365">Last 12 months</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sources">Counting</Label>
            <Select
              id="sources"
              value={includeAll ? "1" : "0"}
              onChange={(e) => navigate(days, e.target.value === "1")}
              className="w-64"
            >
              <option value="0">Observer form only</option>
              <option value="1">All sources (incl. triage &amp; edits)</option>
            </Select>
          </div>
          <p className="max-w-md text-xs text-slate-500">
            A triager&apos;s or an editor&apos;s severity call is not observer disagreement, so it is
            excluded by default.
          </p>
        </CardContent>
      </Card>

      {report.rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm font-medium" style={{ color: MX.navy }}>
              No overrides recorded in this window.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Either the suggestions are landing correctly, or the engine has not been in use long
              enough to say. Neither is a problem to fix yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Sub-category</th>
                  <th className="px-4 py-3 font-semibold">Axis</th>
                  <th className="px-4 py-3 font-semibold">Suggests</th>
                  <th className="px-4 py-3 text-right font-semibold">Overrides</th>
                  <th className="px-4 py-3 text-right font-semibold">Of</th>
                  <th className="px-4 py-3 text-right font-semibold">Rate</th>
                  <th className="px-4 py-3 font-semibold">Direction</th>
                  <th className="px-4 py-3 font-semibold">Reading</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => {
                  const consistent = (r.directionConsistencyPct ?? 0) >= 80;
                  const frequent = (r.overrideRatePct ?? 0) >= 40;
                  const actionable = consistent && frequent && r.overrides >= 3;
                  return (
                    <tr
                      key={`${r.observationType}|${r.categoryCode}|${r.subCategoryCode}`}
                      className="border-b last:border-0"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium" style={{ color: MX.navy }}>
                          {label(r.subCategoryCode)}
                        </div>
                        <div className="text-xs text-slate-500">{label(r.categoryCode)}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {r.observationType === "CONDITION" ? "Condition" : "Act"}
                      </td>
                      <td className="px-4 py-3">{severityLabel(r.suggestedSeverity)}</td>
                      <td className="px-4 py-3 text-right font-medium">{r.overrides}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{r.observations}</td>
                      <td className="px-4 py-3 text-right">
                        {r.overrideRatePct == null ? "—" : `${r.overrideRatePct}%`}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                            r.dominantDirection === "up" && "bg-rose-50 text-rose-700",
                            r.dominantDirection === "down" && "bg-sky-50 text-sky-700",
                            r.dominantDirection === "mixed" && "bg-slate-100 text-slate-600"
                          )}
                        >
                          {r.dominantDirection === "up" ? (
                            <ArrowUp size={11} />
                          ) : r.dominantDirection === "down" ? (
                            <ArrowDown size={11} />
                          ) : (
                            <Minus size={11} />
                          )}
                          {r.up}↑ / {r.down}↓
                          {r.directionConsistencyPct != null && r.dominantDirection !== "mixed"
                            ? ` · ${r.directionConsistencyPct}%`
                            : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {actionable ? (
                          <span className="font-medium" style={{ color: MX.gold }}>
                            Rule likely wrong — consider setting it{" "}
                            {r.dominantDirection === "up" ? "higher" : "lower"}.
                          </span>
                        ) : r.dominantDirection === "mixed" ? (
                          <span className="text-slate-500">
                            Split both ways — the sub-category may cover two different exposures.
                          </span>
                        ) : (
                          <span className="text-slate-500">Not yet enough signal to act on.</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-slate-500">
        Corrections are made deliberately — edit the baseline in{" "}
        <code className="rounded bg-slate-100 px-1">prisma/seed-severity-matrix.ts</code> and re-run
        it with <code className="rounded bg-slate-100 px-1">--force</code>, or update the
        SeverityMatrixRule row directly. Nothing here retunes the matrix automatically: a matrix that
        learned from its own overrides would drift toward whichever severity is least inconvenient to
        report.
      </p>
    </div>
  );
}
