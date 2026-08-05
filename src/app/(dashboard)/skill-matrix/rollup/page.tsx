import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { PlantSwitcher } from "@/components/plant-switcher";
import { resolvePlantContext } from "@/lib/plant-context";
import { cn } from "@/lib/utils";
import { compliancePctTone, type RollupResponse } from "@/lib/training-engine";

export const dynamic = "force-dynamic";

export default async function CompetencyRollupPage(props: {
  searchParams: Promise<{ plantId?: string }>;
}) {
  const searchParams = await props.searchParams;
  const { plantId, plants } = await resolvePlantContext(searchParams.plantId);

  if (!plantId) {
    return (
      <div>
        <PageHeader
          title="Competency Roll-up"
          description="Workforce competency compliance, aggregated per skill node."
          breadcrumbs={[{ label: "People & Competency" }, { label: "Competency Roll-up" }]}
        />
        <div className="rounded-xl border bg-white p-10 text-center text-slate-500">
          Select a plant to view its competency roll-up.
        </div>
      </div>
    );
  }

  let data: RollupResponse = {
    plantId,
    competencies: [],
    summary: {
      workforceCompliancePct: 0,
      recordCount: 0,
      competencyCount: 0,
      atRiskCount: 0
    }
  };
  let error: string | null = null;
  try {
    data = await backendFetch<RollupResponse>("/api/skill-matrix/rollup", {
      query: { plantId }
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load competency roll-up";
  }

  const overall = compliancePctTone(data.summary.workforceCompliancePct);
  const rows = [...data.competencies].sort((a, b) => a.compliancePct - b.compliancePct);

  return (
    <div>
      <PageHeader
        title="Competency Roll-up"
        description="Workforce competency compliance, aggregated per skill node — worst-covered competencies first."
        breadcrumbs={[{ label: "People & Competency" }, { label: "Competency Roll-up" }]}
        action={<PlantSwitcher plants={plants} currentPlantId={plantId} />}
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className={cn("text-3xl font-bold tabular-nums", overall.text)}>
                {data.summary.workforceCompliancePct}%
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-slate-500">
                Workforce compliance
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-3xl font-bold tabular-nums text-slate-900">
                {data.summary.recordCount}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-slate-500">
                Records
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-3xl font-bold tabular-nums text-slate-900">
                {data.summary.competencyCount}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-slate-500">
                Competencies
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-3xl font-bold tabular-nums text-rose-700">
                {data.summary.atRiskCount}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-slate-500">
                At risk
              </div>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-xl border bg-white p-10 text-center text-slate-500">
              No competency records for this plant yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-2.5 font-semibold">Competency</th>
                    <th className="px-4 py-2.5 font-semibold">Compliance</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Met</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Expired</th>
                    <th className="px-4 py-2.5 text-right font-semibold">In progress</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((c) => {
                    const tone = compliancePctTone(c.compliancePct);
                    return (
                      <tr key={c.competencyId} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium text-slate-900">{c.name}</div>
                          <div className="text-[11px] text-slate-500">
                            <span className="font-mono">{c.code}</span>
                            {c.category ? ` · ${c.category}` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={cn("h-full rounded-full", tone.bar)}
                                style={{ width: `${Math.max(0, Math.min(100, c.compliancePct))}%` }}
                              />
                            </div>
                            <span className={cn("text-xs font-semibold tabular-nums", tone.text)}>
                              {c.compliancePct}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-right tabular-nums text-emerald-700">
                          {c.met}
                        </td>
                        <td className="px-4 py-3 align-top text-right tabular-nums text-rose-700">
                          {c.expired}
                        </td>
                        <td className="px-4 py-3 align-top text-right tabular-nums text-sky-700">
                          {c.inProgress}
                        </td>
                        <td className="px-4 py-3 align-top text-right tabular-nums text-slate-600">
                          {c.total}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
