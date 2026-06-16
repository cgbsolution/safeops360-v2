import { notFound } from "next/navigation";
import { backendFetch, BackendError } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

type Matrix = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  likelihoodLevels: number;
  severityLevels: number;
  acceptableResidual: Record<string, string>;
  controlHierarchyEnforced: boolean;
  likelihoods: {
    id: string;
    score: number;
    label: string;
    description: string;
    frequencyGuidance: string | null;
  }[];
  severities: {
    id: string;
    score: number;
    label: string;
    description: string;
    healthSafetyGuidance: string | null;
  }[];
  cells: {
    likelihoodScore: number;
    severityScore: number;
    riskScore: number;
    riskLevel: string;
    colorHex: string;
    actionRequired: string;
    responseTimeDays: number;
  }[];
};

export default async function RiskMatrixDetailPage(
  props: { params: Promise<{ id: string }> }
) {
  await requirePermission("HIRA.MATRIX_CONFIGURE");
  const { id } = await props.params;

  let matrix: Matrix;
  try {
    matrix = await backendFetch<Matrix>(`/api/hira/risk-matrices/${id}`);
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  const cellByKey = new Map(
    matrix.cells.map((c) => [`${c.likelihoodScore}|${c.severityScore}`, c])
  );

  return (
    <div>
      <PageHeader title={matrix.name} description={matrix.description ?? ""} />

      <div className="rounded-xl border bg-white overflow-hidden mb-6">
        <div className="px-4 py-3 border-b text-xs uppercase tracking-wider text-slate-600">
          Matrix Visualisation
        </div>
        <div className="p-4 overflow-x-auto">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-xs font-medium text-slate-500 text-left">
                  Likelihood ↓ &nbsp; Severity →
                </th>
                {matrix.severities.map((s) => (
                  <th
                    key={s.id}
                    className="p-2 text-xs font-medium text-slate-700 text-center min-w-[110px] border-b border-l"
                    title={s.description}
                  >
                    <div>{s.score}</div>
                    <div className="font-semibold">{s.label}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.likelihoods.map((l) => (
                <tr key={l.id}>
                  <th
                    className="p-2 text-xs font-medium text-slate-700 text-right border-r border-b min-w-[180px]"
                    title={l.description}
                  >
                    <div>{l.score} — {l.label}</div>
                    {l.frequencyGuidance && (
                      <div className="font-normal text-slate-500">{l.frequencyGuidance}</div>
                    )}
                  </th>
                  {matrix.severities.map((s) => {
                    const c = cellByKey.get(`${l.score}|${s.score}`);
                    if (!c) {
                      return (
                        <td key={s.id} className="border-b border-l p-2 text-center text-slate-400">
                          —
                        </td>
                      );
                    }
                    return (
                      <td
                        key={s.id}
                        className="border-b border-l p-3 text-center"
                        style={{ backgroundColor: c.colorHex + "33" }}
                        title={c.actionRequired}
                      >
                        <div className="font-bold text-slate-900">{c.riskScore}</div>
                        <div
                          className="text-[10px] font-medium uppercase tracking-wider mt-0.5"
                          style={{ color: c.colorHex }}
                        >
                          {c.riskLevel}
                        </div>
                        <div className="text-[9px] text-slate-500 mt-0.5">
                          Response: {c.responseTimeDays}d
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-white">
          <div className="px-4 py-2.5 border-b text-xs uppercase tracking-wider text-slate-600">
            Likelihood Scale
          </div>
          <ul className="divide-y">
            {matrix.likelihoods.map((l) => (
              <li key={l.id} className="px-4 py-2.5">
                <div className="font-medium text-sm">{l.score} — {l.label}</div>
                <div className="text-xs text-slate-600 mt-0.5">{l.description}</div>
                {l.frequencyGuidance && (
                  <div className="text-xs text-slate-500 mt-0.5 italic">{l.frequencyGuidance}</div>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border bg-white">
          <div className="px-4 py-2.5 border-b text-xs uppercase tracking-wider text-slate-600">
            Severity Scale
          </div>
          <ul className="divide-y">
            {matrix.severities.map((s) => (
              <li key={s.id} className="px-4 py-2.5">
                <div className="font-medium text-sm">{s.score} — {s.label}</div>
                <div className="text-xs text-slate-600 mt-0.5">{s.description}</div>
                {s.healthSafetyGuidance && (
                  <div className="text-xs text-slate-500 mt-1">
                    <span className="font-medium">H&S:</span> {s.healthSafetyGuidance}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
