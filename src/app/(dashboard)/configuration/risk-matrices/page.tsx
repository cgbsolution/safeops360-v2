import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

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
  isActive: boolean;
  isDefault: boolean;
  isGlobal: boolean;
};

export default async function RiskMatricesPage() {
  await requirePermission("HIRA.MATRIX_CONFIGURE");
  const matrices = await backendFetch<Matrix[]>("/api/hira/risk-matrices");

  return (
    <div>
      <PageHeader
        title="Risk Matrices"
        description="Configurable risk assessment matrices used by HIRA studies. Changes apply only to studies created after the change."
      />

      <Alert variant="warning" className="rounded-xl border bg-amber-50 border-amber-200 p-4 mb-4 text-sm text-amber-900">
        <div className="font-medium">Editing in this UI is read-only for now.</div>
        <div className="mt-1">
          To add or modify a matrix, edit{" "}
          <code className="px-1 rounded bg-amber-100">prisma/seed-hira-masters.ts</code> and re-run{" "}
          <code className="px-1 rounded bg-amber-100">npx tsx prisma/seed-hira-masters.ts</code>.
          Full cell-by-cell edit UI ships in Phase 1 follow-up.
        </div>
      </Alert>

      <div className="space-y-4">
        {matrices.map((m) => (
          <Card key={m.id} className="rounded-xl border bg-white overflow-hidden shadow-none">
            <div className="px-4 py-3 border-b flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/configuration/risk-matrices/${m.id}`}
                    className="font-semibold text-slate-900 hover:text-primary-700"
                  >
                    {m.name}
                  </Link>
                  {m.isDefault && (
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                      DEFAULT
                    </span>
                  )}
                  {m.isGlobal && (
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      global
                    </span>
                  )}
                  {!m.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-600">inactive</span>
                  )}
                </div>
                <div className="text-sm text-slate-500 mt-1">{m.description}</div>
                <div className="text-xs text-slate-400 mt-1">{m.code}</div>
              </div>
            </div>

            <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Stat label="Dimensions" value={`${m.likelihoodLevels} × ${m.severityLevels}`} />
              <Stat label="Control hierarchy" value={m.controlHierarchyEnforced ? "Enforced" : "Optional"} />
              <Stat label="Routine threshold" value={m.acceptableResidual.routine ?? "—"} />
              <Stat label="Emergency threshold" value={m.acceptableResidual.emergency ?? "—"} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-medium text-slate-800 mt-0.5">{value}</div>
    </div>
  );
}
