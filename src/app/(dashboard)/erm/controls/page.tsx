import Link from "next/link";
import { AlertTriangle, ArrowRight, BookOpen, Grid3x3, ShieldAlert } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { KpiTile } from "@/components/erm/shared";
import { fmtDate } from "@/app/(dashboard)/erm/lib";
import { DEF_SEVERITY_CHIP, type ControlsDashboard } from "@/app/(dashboard)/erm/lib-t3";
import { EffectivenessDonut } from "./dashboard-charts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const SEVERITY_ORDER = ["DEFICIENCY", "SIGNIFICANT_DEFICIENCY", "MATERIAL_WEAKNESS"] as const;
const SEVERITY_LABEL: Record<string, string> = {
  DEFICIENCY: "Deficiency",
  SIGNIFICANT_DEFICIENCY: "Significant Deficiency",
  MATERIAL_WEAKNESS: "Material Weakness",
};

export default async function ControlsDashboardPage() {
  let d: ControlsDashboard | null = null;
  let error: string | null = null;
  try {
    d = await backendFetch<ControlsDashboard>("/api/erm/controls/dashboard");
  } catch (e: any) {
    error = e?.message ?? "Failed to load controls dashboard";
  }

  return (
    <div>
      <PageHeader
        title="Internal Controls"
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "Internal Controls" }]}
        description="SOX-style internal controls register — design & operating effectiveness, segregated testing, deficiency remediation and risk-control coverage."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/erm/controls/library"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <BookOpen size={15} /> Library
            </Link>
            <Link
              href="/erm/controls/matrix"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Grid3x3 size={15} /> Risk-Control Matrix
            </Link>
            <Link
              href="/erm/controls/deficiencies"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ShieldAlert size={15} /> Deficiencies
            </Link>
          </div>
        }
      />

      {error || !d ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "No dashboard data."}. Ensure the ERM Tier 3 seed has been run and you are logged in with a controls role.
        </Alert>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <KpiTile label="Key Controls" value={d.keyControls} href="/erm/controls/library?keyOnly=true" />
            <KpiTile label="Tested This Cycle" value={`${d.testedThisCyclePct}%`} tone={d.testedThisCyclePct >= 80 ? "good" : "warn"} />
            <KpiTile label="Effective" value={`${d.effectivePct}%`} tone={d.effectivePct >= 80 ? "good" : "high"} />
            <KpiTile label="Open Deficiencies" value={d.openDeficiencies} tone={d.openDeficiencies > 0 ? "warn" : "neutral"} href="/erm/controls/deficiencies" />
            <KpiTile label="Material Weaknesses" value={d.materialWeaknesses} tone="critical" href="/erm/controls/deficiencies?severity=MATERIAL_WEAKNESS" />
            <KpiTile label="Overdue Tests" value={d.overdueTests} tone={d.overdueTests > 0 ? "high" : "neutral"} href="/erm/controls/library?overdueOnly=true" />
          </div>

          {/* Pinned: unreported material weaknesses */}
          {d.unreportedMaterialWeaknesses.length > 0 && (
            <Alert variant="destructive" className="mb-5 rounded-xl border border-rose-300 bg-rose-50 p-5">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-700" />
                <h2 className="text-sm font-semibold text-rose-900">
                  Unreported material weaknesses ({d.unreportedMaterialWeaknesses.length})
                </h2>
              </div>
              <p className="mb-3 text-xs text-rose-700">
                Material weaknesses must be reported to the Audit Committee. Open each deficiency to file a report (CRO).
              </p>
              <ul className="divide-y divide-rose-200/70">
                {d.unreportedMaterialWeaknesses.map((m) => (
                  <li key={m.deficiencyCode} className="flex items-start gap-3 py-2 text-sm">
                    <span className="shrink-0 font-mono text-xs font-semibold text-rose-800">{m.deficiencyCode}</span>
                    {m.controlCode && <span className="shrink-0 text-xs text-rose-600">{m.controlCode}</span>}
                    <span className="min-w-0 flex-1 text-rose-800">{m.description}</span>
                  </li>
                ))}
              </ul>
              <Link href="/erm/controls/deficiencies?severity=MATERIAL_WEAKNESS" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-rose-800 hover:underline">
                Go to deficiencies <ArrowRight size={12} />
              </Link>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Effectiveness donut */}
            <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Effectiveness distribution</h2>
              <EffectivenessDonut ratingDistribution={d.ratingDistribution} />
            </Card>

            {/* Deficiency by severity */}
            <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Deficiencies by severity</h2>
              <div className="space-y-2.5">
                {SEVERITY_ORDER.map((sev) => {
                  const count = d!.deficiencyBySeverity[sev] ?? 0;
                  const max = Math.max(...SEVERITY_ORDER.map((s) => d!.deficiencyBySeverity[s] ?? 0), 1);
                  return (
                    <div key={sev} className="flex items-center gap-3">
                      <span className={"w-44 shrink-0 rounded border px-2 py-0.5 text-[11px] " + (DEF_SEVERITY_CHIP[sev] ?? "")}>
                        {SEVERITY_LABEL[sev]}
                      </span>
                      <div className="flex h-5 flex-1 items-center overflow-hidden rounded bg-slate-100">
                        <div
                          className={
                            "flex h-full items-center rounded px-2 text-[10px] font-semibold text-white " +
                            (sev === "MATERIAL_WEAKNESS" ? "bg-rose-600" : sev === "SIGNIFICANT_DEFICIENCY" ? "bg-orange-500" : "bg-amber-500")
                          }
                          style={{ width: `${Math.max((count / max) * 100, count > 0 ? 8 : 0)}%` }}
                        >
                          {count > 0 ? count : ""}
                        </div>
                      </div>
                      <span className="w-6 shrink-0 text-right text-xs tabular-nums text-slate-500">{count}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Overdue tests table */}
          <Card className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-none">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Overdue tests <span className="text-slate-400">({d.overdueList.length})</span>
              </h2>
            </div>
            <Table className="w-full min-w-[640px] text-sm">
              <TableHeader className="bg-slate-50/95">
                <TableRow className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <TableHead className="px-4 py-2.5">Control</TableHead>
                  <TableHead className="px-4 py-2.5">Name</TableHead>
                  <TableHead className="px-4 py-2.5">Owner</TableHead>
                  <TableHead className="px-4 py-2.5">Next test due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.overdueList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                      No tests overdue — testing is on schedule.
                    </TableCell>
                  </TableRow>
                ) : (
                  d.overdueList.map((o) => (
                    <TableRow key={o.controlCode} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <TableCell className="px-4 py-2.5 font-mono text-xs font-medium text-slate-700">{o.controlCode}</TableCell>
                      <TableCell className="px-4 py-2.5 text-slate-700">{o.name}</TableCell>
                      <TableCell className="px-4 py-2.5 text-xs text-slate-600">{o.owner ?? "—"}</TableCell>
                      <TableCell className="px-4 py-2.5 text-xs">
                        <span className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 font-medium text-rose-700">
                          {fmtDate(o.nextTestDueDate)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
