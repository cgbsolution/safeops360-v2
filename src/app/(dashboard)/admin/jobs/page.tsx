import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Job = {
  jobId: string; label: string; intervalSeconds: number;
  lastRunAt: string | null; lastStatus: string; lastRecordsAffected: number | null;
  lastSummary: Record<string, unknown> | null; lastError: string | null;
};
type Resp = { jobs: Job[] };

const STATUS_CHIP: Record<string, string> = {
  SUCCESS: "bg-emerald-100 text-emerald-800 border-emerald-200",
  FAILED: "bg-rose-100 text-rose-800 border-rose-200",
  RUNNING: "bg-sky-100 text-sky-800 border-sky-200",
  NEVER_RUN: "bg-slate-100 text-slate-500 border-slate-200",
};

function fmtInterval(s: number): string {
  if (s % 86400 === 0) return `${s / 86400}d`;
  if (s % 3600 === 0) return `${s / 3600}h`;
  return `${Math.round(s / 60)}m`;
}

export default async function JobMonitorPage() {
  let data: Resp = { jobs: [] };
  let error: string | null = null;
  try {
    data = await backendFetch<Resp>("/api/jobs");
  } catch (e: any) {
    error = e?.message ?? "Failed to load jobs";
  }

  return (
    <div>
      <PageHeader title="Job Monitor"
        breadcrumbs={[{ label: "Admin" }, { label: "Job Monitor" }]}
        description="Background scheduler jobs — every computed feed (KRI, rollup, appetite, loss, alerts, integrity) with last-run time and status. System-Admin only." />
      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}. Requires a System-Admin role.</Alert>
      ) : (
        <Card className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-none">
          <Table className="w-full min-w-[800px] text-sm">
            <TableHeader className="bg-slate-50/95">
              <TableRow className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                <TableHead className="px-3 py-2.5">Job</TableHead><TableHead className="px-3 py-2.5">Every</TableHead>
                <TableHead className="px-3 py-2.5">Last Run</TableHead><TableHead className="px-3 py-2.5">Status</TableHead>
                <TableHead className="px-3 py-2.5">Affected</TableHead><TableHead className="px-3 py-2.5">Run Now</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.jobs.map((j) => (
                <TableRow key={j.jobId} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <TableCell className="px-3 py-2.5"><span className="font-medium text-slate-700">{j.label}</span><span className="block text-[10px] text-slate-400">{j.jobId}</span></TableCell>
                  <TableCell className="px-3 py-2.5 text-xs text-slate-500">{fmtInterval(j.intervalSeconds)}</TableCell>
                  <TableCell className="px-3 py-2.5 text-xs text-slate-500">{j.lastRunAt ? new Date(j.lastRunAt).toLocaleString("en-IN") : "—"}</TableCell>
                  <TableCell className="px-3 py-2.5"><span className={"inline-block rounded border px-2 py-0.5 text-[11px] " + (STATUS_CHIP[j.lastStatus] ?? STATUS_CHIP.NEVER_RUN)}>{j.lastStatus.replace(/_/g, " ")}</span>{j.lastError && <span className="block text-[10px] text-rose-500">{j.lastError.slice(0, 60)}</span>}</TableCell>
                  <TableCell className="px-3 py-2.5 text-xs tabular-nums text-slate-600">{j.lastRecordsAffected ?? "—"}</TableCell>
                  <TableCell className="px-3 py-2.5"><form action={`/api/jobs/${j.jobId}/run`} method="post"><Button variant="outline" className="rounded px-2 py-0.5 text-[11px]">Run</Button></form></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
