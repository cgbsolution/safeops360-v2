import { Suspense } from "react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { PlantSwitcher } from "@/components/plant-switcher";
import { resolvePlantContext } from "@/lib/plant-context";
import { cn } from "@/lib/utils";
import { SyncFromTrainingButton } from "./sync-from-training-button";
import { AnalyticsStripSkeleton } from "@/components/dashboard/analytics-strip";
import { SkillMatrixAnalyticsStrip } from "@/components/skill-matrix/analytics-strip";

export const dynamic = "force-dynamic";

// State metadata — kept in sync with the §3.2 lifecycle states emitted by
// prisma/seed-competency-records.ts. `cell` styles the grid square; `abbr` is
// the single-glyph label shown inside it.
const STATE_META: Record<string, { label: string; cell: string; abbr: string }> = {
  validated_active: { label: "Valid", cell: "bg-emerald-100 text-emerald-800 border-emerald-200", abbr: "✓" },
  expiring_soon: { label: "Expiring soon", cell: "bg-amber-100 text-amber-800 border-amber-200", abbr: "!" },
  expired_in_grace: { label: "Expired (in grace)", cell: "bg-orange-100 text-orange-800 border-orange-200", abbr: "G" },
  expired_revoked: { label: "Expired", cell: "bg-rose-100 text-rose-800 border-rose-200", abbr: "✕" },
  lapsed_requires_full_redo: { label: "Lapsed — full redo", cell: "bg-rose-200 text-rose-900 border-rose-300", abbr: "L" },
  not_yet_attempted: { label: "Not started", cell: "bg-slate-100 text-slate-400 border-slate-200", abbr: "–" },
  in_training: { label: "In training", cell: "bg-sky-100 text-sky-800 border-sky-200", abbr: "T" },
  training_complete_pending_assessment: { label: "Pending assessment", cell: "bg-indigo-100 text-indigo-800 border-indigo-200", abbr: "P" },
  under_assessment: { label: "Under assessment", cell: "bg-violet-100 text-violet-800 border-violet-200", abbr: "A" },
  suspended: { label: "Suspended", cell: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200", abbr: "S" },
  superseded: { label: "Superseded", cell: "bg-slate-200 text-slate-600 border-slate-300", abbr: "↻" }
};

type Cell = { state: string; validUntil: string | null; currentScore: number | null };
type Person = {
  userId: string;
  name: string;
  role: string;
  department: string | null;
  designation: string | null;
  cells: Record<string, Cell>;
};
type Comp = { id: string; code: string; name: string; category: string; subcategory: string | null };
type Matrix = {
  plantId: string;
  competencies: Comp[];
  persons: Person[];
  summary: {
    byState: Record<string, number>;
    totalCells: number;
    personCount: number;
    competencyCount: number;
  };
};

export default async function SkillMatrixPage(props: {
  searchParams: Promise<{ plantId?: string; category?: string }>;
}) {
  const searchParams = await props.searchParams;
  const { plantId, plants } = await resolvePlantContext(searchParams.plantId);

  if (!plantId) {
    return (
      <div>
        <PageHeader
          title="Skill Matrix"
          description="Workforce competency status — person × competency, per ISO 45001 §7.2"
        />
        <div className="rounded-xl border bg-white p-10 text-center text-slate-500">
          Select a plant to view its skill matrix.
        </div>
      </div>
    );
  }

  const data = await backendFetch<Matrix>("/api/skill-matrix/matrix", {
    query: { plantId, category: searchParams.category ?? null }
  }).catch(
    () =>
      ({
        plantId,
        competencies: [],
        persons: [],
        summary: { byState: {}, totalCells: 0, personCount: 0, competencyCount: 0 }
      }) as Matrix
  );

  const s = data.summary.byState;
  const valid = s.validated_active ?? 0;
  const compliancePct =
    data.summary.totalCells > 0 ? Math.round((valid / data.summary.totalCells) * 100) : 0;

  // Per-person compliance (valid cells / tracked competencies).
  const personCompliance = (p: Person) => {
    const tracked = data.competencies.filter((c) => p.cells[c.id]).length;
    if (!tracked) return 0;
    const ok = data.competencies.filter((c) => p.cells[c.id]?.state === "validated_active").length;
    return Math.round((ok / tracked) * 100);
  };

  return (
    <div>
      <PageHeader
        title="Skill Matrix"
        description="Workforce competency status — person × competency, per ISO 45001 §7.2"
        action={
          <div className="flex items-center gap-2">
            <SyncFromTrainingButton plantId={plantId} />
            <PlantSwitcher plants={plants} currentPlantId={plantId} />
          </div>
        }
      />

      <div className="mb-4">
        <Suspense fallback={<AnalyticsStripSkeleton />}>
          <SkillMatrixAnalyticsStrip />
        </Suspense>
      </div>

      {data.persons.length === 0 || data.competencies.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-slate-500">
          No competency records for this plant yet.
        </div>
      ) : (
        <>
          <div className="mb-3 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{data.summary.personCount}</span> people ×{" "}
            <span className="font-semibold text-slate-900">{data.summary.competencyCount}</span>{" "}
            competencies · overall validity{" "}
            <span
              className={cn(
                "font-semibold",
                compliancePct >= 75 ? "text-emerald-700" : compliancePct >= 50 ? "text-amber-700" : "text-rose-700"
              )}
            >
              {compliancePct}%
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="sticky left-0 z-10 bg-slate-50 text-left px-3 py-2 border-b border-r min-w-[220px]">
                    <span className="text-xs uppercase tracking-wider text-slate-500">Person</span>
                  </th>
                  {data.competencies.map((c) => (
                    <th
                      key={c.id}
                      className="border-b border-l px-1 py-2 align-bottom"
                      title={`${c.name} (${c.category})`}
                    >
                      <div className="mx-auto h-32 [writing-mode:vertical-rl] rotate-180 text-[11px] font-mono text-slate-600 whitespace-nowrap overflow-hidden">
                        {c.code}
                      </div>
                    </th>
                  ))}
                  <th className="border-b border-l px-2 py-2 text-xs uppercase tracking-wider text-slate-500 align-bottom">
                    <div className="mx-auto h-32 [writing-mode:vertical-rl] rotate-180 whitespace-nowrap">
                      Compliance
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.persons.map((p) => {
                  const pct = personCompliance(p);
                  return (
                    <tr key={p.userId} className="hover:bg-slate-50/60">
                      <td className="sticky left-0 z-10 bg-white px-3 py-1.5 border-b border-r min-w-[220px]">
                        <div className="font-medium text-slate-900 text-sm truncate max-w-[200px]">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                          {p.designation ?? p.role}
                          {p.department ? ` · ${p.department}` : ""}
                        </div>
                      </td>
                      {data.competencies.map((c) => {
                        const cell = p.cells[c.id];
                        const meta = cell ? STATE_META[cell.state] : null;
                        return (
                          <td key={c.id} className="border-b border-l p-1 text-center">
                            {cell && meta ? (
                              <div
                                className={cn(
                                  "mx-auto h-6 w-6 rounded border flex items-center justify-center text-[11px] font-semibold",
                                  meta.cell
                                )}
                                title={`${c.name}\n${meta.label}${
                                  cell.validUntil
                                    ? ` · valid until ${new Date(cell.validUntil).toLocaleDateString()}`
                                    : ""
                                }`}
                              >
                                {meta.abbr}
                              </div>
                            ) : (
                              <div className="mx-auto h-6 w-6 rounded bg-slate-50" title="No record" />
                            )}
                          </td>
                        );
                      })}
                      <td className="border-b border-l px-2 py-1.5 text-center">
                        <span
                          className={cn(
                            "text-xs font-semibold tabular-nums",
                            pct >= 75 ? "text-emerald-700" : pct >= 50 ? "text-amber-700" : "text-rose-700"
                          )}
                        >
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs">
            {Object.entries(STATE_META).map(([key, meta]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-5 w-5 rounded border flex items-center justify-center text-[10px] font-semibold",
                    meta.cell
                  )}
                >
                  {meta.abbr}
                </span>
                <span className="text-slate-600">{meta.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
