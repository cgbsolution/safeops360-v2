import { TrendingDown, TrendingUp } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { PlantSwitcher } from "@/components/plant-switcher";
import { resolvePlantContext } from "@/lib/plant-context";
import { cn } from "@/lib/utils";
import { fmtDate, type CorrelationResponse } from "@/lib/training-engine";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function TrainingImpactPage(props: {
  searchParams: Promise<{ plantId?: string }>;
}) {
  const searchParams = await props.searchParams;
  const { plantId, plants } = await resolvePlantContext(searchParams.plantId);

  if (!plantId) {
    return (
      <div>
        <PageHeader
          title="Training Impact"
          description="Does training actually reduce re-incidents? This measures it."
          breadcrumbs={[{ label: "People & Competency" }, { label: "Training Impact" }]}
        />
        <Card className="rounded-xl border bg-white p-10 text-center text-slate-500 shadow-none">
          Select a plant to view its training impact.
        </Card>
      </div>
    );
  }

  let data: CorrelationResponse = { generatedAt: new Date().toISOString(), rows: [] };
  let error: string | null = null;
  try {
    data = await backendFetch<CorrelationResponse>("/api/training-engine/correlation", {
      query: { plantId }
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load training impact";
  }

  const rows = data.rows ?? [];

  return (
    <div>
      <PageHeader
        title="Training Impact"
        description="Training-to-outcome correlation — proof the competency engine moves the needle."
        breadcrumbs={[{ label: "People & Competency" }, { label: "Training Impact" }]}
        action={<PlantSwitcher plants={plants} currentPlantId={plantId} />}
      />

      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}
        </Alert>
      ) : (
        <>
          <Card className="mb-4 rounded-xl border border-primary-200 bg-primary-50/50 px-4 py-3 text-sm text-primary-900 shadow-none">
            Compares re-incident rate in the N days before vs after training completion, per skill
            node. A positive improvement means fewer re-incidents after training.
          </Card>

          <Card className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-none">
            <Table className="w-full text-sm">
              <TableHeader>
                <TableRow className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <TableHead className="px-4 py-2.5 font-semibold">Competency</TableHead>
                  <TableHead className="px-4 py-2.5 text-right font-semibold">Cohort</TableHead>
                  <TableHead className="px-4 py-2.5 text-center font-semibold">Pre → Post</TableHead>
                  <TableHead className="px-4 py-2.5 text-right font-semibold">Improvement</TableHead>
                  <TableHead className="px-4 py-2.5 text-right font-semibold">Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                      No completed training with enough follow-up window to correlate yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => {
                    const positive = r.improvementPct > 0;
                    const negative = r.improvementPct < 0;
                    return (
                      <TableRow key={r.competencyId} className="hover:bg-slate-50/70">
                        <TableCell className="px-4 py-3 align-top">
                          <div className="font-medium text-slate-900">{r.competencyName}</div>
                          <div className="text-[11px] text-slate-500">
                            {r.windowDays}-day window
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 align-top text-right tabular-nums text-slate-600">
                          {r.computedCohortSize}
                          {r.cohortSize !== r.computedCohortSize ? (
                            <span className="text-slate-400"> / {r.cohortSize}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="px-4 py-3 align-top text-center tabular-nums text-slate-700">
                          <span className="font-semibold">{r.preTotal}</span>
                          <span className="mx-1.5 text-slate-400">→</span>
                          <span className="font-semibold">{r.postTotal}</span>
                        </TableCell>
                        <TableCell className="px-4 py-3 align-top text-right">
                          <span
                            className={cn(
                              "inline-flex items-center justify-end gap-1 text-sm font-semibold tabular-nums",
                              positive
                                ? "text-emerald-700"
                                : negative
                                  ? "text-rose-700"
                                  : "text-slate-500"
                            )}
                          >
                            {positive && <TrendingDown size={14} />}
                            {negative && <TrendingUp size={14} />}
                            {positive ? "+" : ""}
                            {r.improvementPct}%
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 align-top text-right tabular-nums text-slate-500">
                          {r.pending}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>

          <p className="mt-3 text-xs text-slate-400">
            Generated {fmtDate(data.generatedAt)}.
          </p>
        </>
      )}
    </div>
  );
}
