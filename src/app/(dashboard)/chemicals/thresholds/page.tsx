// Screen 5 — Threshold Dashboard (§7 #5): site quantity vs threshold by hazard
// class, with the obligation each one engages.

import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { resolvePlantContext } from "@/lib/plant-context";
import type { ThresholdRow } from "@/lib/chemicals/types";
import { fmtDate, fmtQty, prettyLabel } from "@/lib/chemicals/types";
import {
  EmptyState, ErrorState, Kpi, StatusChip, SubNav, ThresholdBar,
} from "../_components";
import { NewThresholdRuleDialog, RecomputeButton } from "./threshold-actions";

export const dynamic = "force-dynamic";

type Dashboard = { plantId: string; breached: ThresholdRow[]; approaching: ThresholdRow[]; rules: ThresholdRow[] };

export default async function ThresholdDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ plantId?: string; recompute?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await resolvePlantContext(sp.plantId);

  if (!ctx.plantId) {
    return (
      <div>
        <PageHeader title="Regulatory Thresholds" breadcrumbs={[{ label: "Chemical & Hazmat", href: "/chemicals" }]} />
        <SubNav current="/chemicals/thresholds" />
        <EmptyState title="No site available" />
      </div>
    );
  }

  let d: Dashboard | null = null;
  let error: string | null = null;
  try {
    d = await backendFetch<Dashboard>(
      `/api/chemicals/thresholds/dashboard?plantId=${ctx.plantId}` +
        (sp.recompute ? "&recompute=true" : "")
    );
  } catch (e: any) {
    error = e?.message ?? "Failed to load the threshold dashboard";
  }

  const rows = d?.rules ?? [];
  const caveats = rows.filter((r) => r.evaluationCaveat);

  return (
    <div>
      <PageHeader
        title="Regulatory Thresholds"
        breadcrumbs={[
          { label: "Operational Safety" },
          { label: "Chemical & Hazmat", href: "/chemicals" },
          { label: "Thresholds" },
        ]}
        description="Site inventory against MSIHC Schedule and PESO licence quantities. Crossing a limit raises a change request automatically and logs the outcome either way."
        action={
          <div className="flex flex-wrap gap-2">
            <RecomputeButton plantId={ctx.plantId} />
            <NewThresholdRuleDialog />
          </div>
        }
      />
      <SubNav current="/chemicals/thresholds" />

      {error ? (
        <ErrorState message={error} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Breached"
              value={d?.breached.length ?? 0}
              tone={(d?.breached.length ?? 0) ? "critical" : "good"}
              sub="obligation engaged"
            />
            <Kpi
              label="Approaching"
              value={d?.approaching.length ?? 0}
              tone={(d?.approaching.length ?? 0) ? "warn" : "good"}
              sub="still preventable"
            />
            <Kpi label="Rules evaluated" value={rows.length} sub="config-driven, per region" />
            <Kpi
              label="Partial evaluations"
              value={caveats.length}
              tone={caveats.length ? "warn" : "good"}
              sub="unit mismatch"
            />
          </div>

          {caveats.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-semibold text-amber-800">
                {caveats.length} threshold{caveats.length === 1 ? "" : "s"} could not be fully evaluated
              </div>
              <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
                {caveats.map((r) => (
                  <li key={r.ruleId}>
                    <strong>{r.scheduleReference}</strong> — {r.evaluationCaveat}
                  </li>
                ))}
              </ul>
              <div className="mt-2 text-[11px] text-amber-600">
                Stock is excluded rather than converted: comparing litres to kilograms needs a
                density, and this module treats SDS values as evidence rather than parsing them. Set
                the affected batches to the rule&apos;s unit, or add a rule in the batch&apos;s unit.
              </div>
            </div>
          )}

          {rows.length === 0 ? (
            <EmptyState
              title="No threshold rules apply to this site"
              hint="Thresholds are configuration, not code — an Admin adds rules per region and hazard class, which is what makes a GCC regulatory remap a data change."
              action={<NewThresholdRuleDialog />}
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Schedule / licence</th>
                    <th className="px-4 py-2.5 font-semibold">Scope</th>
                    <th className="px-4 py-2.5 text-right font-semibold">On site</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Threshold</th>
                    <th className="px-4 py-2.5 font-semibold">Utilisation</th>
                    <th className="px-4 py-2.5 font-semibold">Obligation</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.ruleId} className={r.status === "BREACHED" ? "bg-rose-50/40" : "hover:bg-slate-50"}>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-900">{r.scheduleReference}</div>
                        {r.lastBreachedAt && (
                          <div className="text-[11px] text-slate-400">
                            Last breached {fmtDate(r.lastBreachedAt)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {r.hazardClass ? prettyLabel(r.hazardClass) : "Specific chemical"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-800">
                        {fmtQty(r.currentQuantity, r.unit)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                        {fmtQty(r.thresholdQuantity, r.unit)}
                      </td>
                      <td className="px-4 py-2.5"><ThresholdBar percent={r.percentOfThreshold} /></td>
                      <td className="px-4 py-2.5">
                        <div className="text-xs text-slate-700">{prettyLabel(r.triggerObligation)}</div>
                        {!r.autoMocOnBreach && (
                          <Badge className="bg-slate-100 text-slate-600 border-slate-300">Auto-MOC off</Badge>
                        )}
                        {r.activeMocId && (
                          <Link
                            href={`/moc/${r.activeMocId}`}
                            className="text-[11px] font-medium text-slate-700 hover:underline"
                          >
                            Open change request →
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-2.5"><StatusChip status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
                A change request is raised on the transition into breach, not on every receipt while
                breached — one regulatory fact, one MOC. Every evaluation is recorded in the{" "}
                <Link href="/chemicals/trigger-log" className="underline">MOC trigger log</Link>{" "}
                whether it fired, was skipped, or failed.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
