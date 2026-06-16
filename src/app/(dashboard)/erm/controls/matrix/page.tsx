import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { RATING_CHIP, STRENGTH_CHIP, RISK_BAND_CHIP, type RiskControlMatrix, type MatrixCell } from "@/app/(dashboard)/erm/lib-t3";
import { MatrixFilters } from "./matrix-view";

export const dynamic = "force-dynamic";

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const STRENGTH_MARK: Record<string, string> = {
  PRIMARY: "P",
  SECONDARY: "S",
  COMPENSATING: "C",
};

function ControlChip({ cell }: { cell: MatrixCell }) {
  const rating = cell.operatingRating ?? "NOT_ASSESSED";
  return (
    <span
      className={"inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] " + (RATING_CHIP[rating] ?? RATING_CHIP.NOT_ASSESSED)}
      title={`${cell.name} · ${cell.mitigationStrength} · ${rating}`}
    >
      <span className={"rounded px-1 text-[9px] font-bold " + (STRENGTH_CHIP[cell.mitigationStrength] ?? "bg-slate-100 text-slate-600")}>
        {STRENGTH_MARK[cell.mitigationStrength] ?? "?"}
      </span>
      <span className="font-mono font-medium">{cell.controlCode}</span>
    </span>
  );
}

export default async function RiskControlMatrixPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  const category = one(sp.category);
  const siteId = one(sp.siteId);

  let m: RiskControlMatrix | null = null;
  let error: string | null = null;
  try {
    m = await backendFetch<RiskControlMatrix>("/api/erm/controls/matrix", {
      query: { category: category ?? undefined, siteId: siteId ?? undefined },
    });
  } catch (e: any) {
    error = e?.message ?? "Failed to load risk-control matrix";
  }

  return (
    <div>
      <PageHeader
        title="Risk-Control Matrix"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Internal Controls", href: "/erm/controls" },
          { label: "Matrix" },
        ]}
        description="Auditor view — which controls mitigate which risks, with operating effectiveness and primary-control coverage. Rows flagged red have no primary control."
      />

      {error || !m ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "No matrix data."}. Ensure the ERM Tier 3 seed has been run and you are logged in with a controls role.
        </div>
      ) : (
        <>
          <MatrixFilters />

          <div className="mb-4 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-slate-400">Legend</span>
            <span className="inline-flex items-center gap-1"><span className={"rounded px-1 text-[9px] font-bold " + STRENGTH_CHIP.PRIMARY}>P</span> Primary</span>
            <span className="inline-flex items-center gap-1"><span className={"rounded px-1 text-[9px] font-bold " + STRENGTH_CHIP.SECONDARY}>S</span> Secondary</span>
            <span className="inline-flex items-center gap-1"><span className={"rounded px-1 text-[9px] font-bold " + STRENGTH_CHIP.COMPENSATING}>C</span> Compensating</span>
            <span className="inline-flex items-center gap-1"><span className={"rounded border px-1.5 text-[10px] " + RATING_CHIP.EFFECTIVE}>Effective</span></span>
            <span className="inline-flex items-center gap-1"><span className={"rounded border px-1.5 text-[10px] " + RATING_CHIP.DEFICIENT}>Deficient</span></span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50/95">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="w-[36%] px-4 py-2.5">Risk</th>
                  <th className="px-4 py-2.5">Coverage</th>
                  <th className="px-4 py-2.5">Mitigating controls</th>
                </tr>
              </thead>
              <tbody>
                {m.rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm text-slate-400">No risks in scope for the current filter.</td>
                  </tr>
                ) : (
                  m.rows.map((row) => (
                    <tr
                      key={row.riskId}
                      className={"border-t border-slate-100 align-top " + (!row.hasPrimaryControl ? "bg-rose-50/60" : "hover:bg-slate-50/70")}
                    >
                      <td className="px-4 py-3">
                        <Link href={`/erm/register/${row.riskId}`} className="font-mono text-xs font-semibold text-primary-700 hover:underline">
                          {row.riskCode}
                        </Link>
                        <span className="ml-2 text-slate-700">{row.title}</span>
                        {row.residualBand && (
                          <span className={"ml-2 rounded border px-2 py-0.5 text-[11px] " + (RISK_BAND_CHIP[row.residualBand] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
                            {row.residualBand}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!row.hasPrimaryControl ? (
                          <span className="inline-flex items-center gap-1 rounded border border-rose-300 bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                            <AlertTriangle size={11} /> No primary control
                          </span>
                        ) : row.primaryControlDeficient ? (
                          <span className="inline-flex items-center gap-1 rounded border border-orange-300 bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800">
                            <AlertTriangle size={11} /> Primary deficient
                          </span>
                        ) : (
                          <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Covered</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.controls.length === 0 ? (
                          <span className="text-xs text-slate-400">No controls mapped</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {row.controls.map((cell) => (
                              <ControlChip key={cell.controlId} cell={cell} />
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Orphan controls */}
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              Orphan controls <span className="text-slate-400">({m.orphanControls.length})</span>
              <span className="ml-2 text-xs font-normal text-slate-400">— mitigating nothing</span>
            </h2>
            {m.orphanControls.length === 0 ? (
              <p className="py-2 text-sm text-slate-400">Every control is mapped to at least one risk, process or obligation.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {m.orphanControls.map((o) => (
                  <li key={o.controlId}>
                    <Link
                      href={`/erm/controls/${o.controlId}`}
                      className="inline-flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-800 hover:bg-amber-100"
                    >
                      <span className="font-mono font-semibold">{o.controlCode}</span>
                      <span className="text-amber-700">{o.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
