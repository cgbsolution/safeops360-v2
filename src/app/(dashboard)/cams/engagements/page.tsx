import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Can } from "@/components/auth/can";
import { requirePermission } from "@/lib/auth/server";
import {
  ENGAGEMENT_STATUS_CHIP, ENGAGEMENT_TYPE_CHIP, RESULT_CHIP,
  fmtDate, engagementTypeLabel, labelize,
  type EngagementListResponse, type AuditType, type Template,
} from "../lib-cams";
import { ScheduleEngagementButton } from "./schedule-engagement";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function EngagementsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("CAMS.READ");
  const sp = await props.searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  // Inspections page: hard-scope to inspection-type engagements. Audits run on
  // the ComplianceAudit flow (/cams/audits) and must NOT appear or be created
  // here — otherwise navigating "into an audit via Inspections" lands on the old
  // Cams workspace / schedule modal.
  const query: Record<string, string> = { engagementType: "INSPECTION" };
  for (const k of ["status", "siteId", "sourceModule", "q"]) {
    const v = get(k);
    if (v) query[k] = v;
  }

  let data: EngagementListResponse = { items: [], total: 0, statusCounts: {}, typeCounts: {} };
  let auditTypes: AuditType[] = [];
  let templates: Template[] = [];
  let plants: { id: string; name: string; code: string }[] = [];
  let error: string | null = null;
  try {
    [data, auditTypes, templates, plants] = await Promise.all([
      backendFetch<EngagementListResponse>("/api/cams/engagements", { query }),
      backendFetch<AuditType[]>("/api/cams/audit-types", { query: { activeOnly: true } }),
      backendFetch<{ items: Template[] }>("/api/cams/templates", { query: { status: "APPROVED" } }).then((r) => r.items),
      prisma.plant.findMany({ select: { id: true, name: true, code: true }, orderBy: { code: "asc" } }).catch(() => []),
    ]);
  } catch (e: any) {
    error = e?.message ?? "Failed to load engagements";
  }

  const spStr: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") spStr[k] = v;
    else if (Array.isArray(v) && v[0]) spStr[k] = v[0];
  }
  const chip = (key: string, value: string, label: string, count?: number) => {
    const next = new URLSearchParams(spStr);
    const active = get(key) === value;
    if (active) next.delete(key);
    else next.set(key, value);
    return (
      <Link key={value} href={`/cams/engagements?${next.toString()}`}
        className={"rounded-full border px-3 py-1 text-xs font-medium transition-colors " + (active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")}>
        {label} {count != null && <span className="tabular-nums opacity-70">{count}</span>}
      </Link>
    );
  };

  return (
    <div>
      <PageHeader
        title="Inspections"
        description="Routine inspections on the CAMS engine — scheduled, executed, scored, closed. Consumer-raised inspections (Fire / PPE / Pharma / EPC) appear here with a source badge. Audits run on the audit flow under Audits."
        breadcrumbs={[{ label: "CAMS", href: "/cams" }, { label: "Inspections" }]}
        action={
          <Can permission="CAMS.SCHEDULE">
            <ScheduleEngagementButton auditTypes={auditTypes} templates={templates} plants={plants} inspectionOnly />
          </Can>
        }
      />

      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</Alert>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</span>
            {["PLANNED", "SCHEDULED", "IN_PROGRESS", "FIELDWORK_COMPLETE", "REPORT_ISSUED", "CLOSED"].map((s) =>
              chip("status", s, labelize(s), data.statusCounts[s]))}
            <span className="ml-auto text-xs text-slate-500">{data.total} inspection(s)</span>
          </div>

          <Card className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-none">
            <Table className="w-full min-w-[1100px] text-sm">
              <TableHeader className="sticky top-0 z-10 bg-slate-50/95">
                <TableRow className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <TableHead className="px-3 py-2.5">Code</TableHead>
                  <TableHead className="px-3 py-2.5">Title</TableHead>
                  <TableHead className="px-3 py-2.5">Type</TableHead>
                  <TableHead className="px-3 py-2.5">Site</TableHead>
                  <TableHead className="px-3 py-2.5">Lead</TableHead>
                  <TableHead className="px-3 py-2.5">Planned</TableHead>
                  <TableHead className="px-3 py-2.5">Status</TableHead>
                  <TableHead className="px-3 py-2.5">Result</TableHead>
                  <TableHead className="px-3 py-2.5 text-center">Findings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="px-3 py-10 text-center text-sm text-slate-400">No inspections match the current filter.</TableCell></TableRow>
                ) : (
                  data.items.map((e) => (
                    <TableRow key={e.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                      <TableCell className="px-3 py-2.5">
                        <Link href={`/cams/engagements/${e.id}`} className="font-medium text-primary-700 hover:underline">{e.engagementCode}</Link>
                      </TableCell>
                      <TableCell className="max-w-[260px] px-3 py-2.5 text-slate-700">
                        {e.title}
                        {e.sourceModule && <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500">via {e.sourceModule}</span>}
                      </TableCell>
                      <TableCell className="px-3 py-2.5"><span className={"rounded border px-2 py-0.5 text-[11px] " + (ENGAGEMENT_TYPE_CHIP[e.engagementType] ?? "")}>{engagementTypeLabel(e.engagementType)}</span></TableCell>
                      <TableCell className="px-3 py-2.5 text-xs text-slate-600">{e.siteName ?? "—"}</TableCell>
                      <TableCell className="px-3 py-2.5 text-xs text-slate-600">{e.leadAuditorName ?? "—"}</TableCell>
                      <TableCell className="px-3 py-2.5 text-xs tabular-nums text-slate-500">{fmtDate(e.plannedDate)}</TableCell>
                      <TableCell className="px-3 py-2.5"><span className={"rounded border px-2 py-0.5 text-[11px] " + (ENGAGEMENT_STATUS_CHIP[e.status] ?? "")}>{labelize(e.status)}</span></TableCell>
                      <TableCell className="px-3 py-2.5">
                        {e.overallResult ? (
                          <span className={"rounded border px-2 py-0.5 text-[11px] " + (RESULT_CHIP[e.overallResult] ?? "")}>
                            {labelize(e.overallResult)}{e.scorePercent != null ? ` · ${e.scorePercent}%` : ""}
                          </span>
                        ) : <span className="text-xs text-slate-300">—</span>}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-center text-xs tabular-nums">
                        {e.findingCount > 0 ? (
                          <span className="text-slate-600">{e.openFindingCount}/{e.findingCount}<span className="text-slate-400"> open</span></span>
                        ) : <span className="text-slate-300">0</span>}
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
