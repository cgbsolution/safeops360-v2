import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Entry = {
  id: string; sequenceNo: number; entityType: string; entityId: string; entityCode: string | null;
  action: string; plantId: string | null; actorId: string | null; actorName: string | null; actorType: string;
  actorIp: string | null; timestamp: string | null; before: Record<string, unknown> | null;
  after: Record<string, unknown> | null; changedFields: string[] | null; reason: string | null;
  entryHash: string; previousEntryHash: string | null;
};
type Resp = { entries: Entry[]; total: number };

const ACTION_CHIP: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  UPDATE: "bg-sky-100 text-sky-800 border-sky-200",
  STATE_TRANSITION: "bg-violet-100 text-violet-800 border-violet-200",
  SOFT_DELETE: "bg-rose-100 text-rose-800 border-rose-200",
  RESTORE: "bg-amber-100 text-amber-800 border-amber-200",
  READ_SENSITIVE: "bg-slate-100 text-slate-700 border-slate-200",
  // Written explicitly by `allocate_checkpoints`, not by ORM capture:
  // AuditCheckpointResponse is deliberately unregistered (a hash-chained row per
  // verdict save is the wrong trade on a 1,500-checkpoint audit), but WHO MAY
  // CONDUCT a discipline is a governance decision a certification body asks
  // about. One entry per allocation change, on the audit's own chain.
  ALLOCATION_CHANGED: "bg-indigo-100 text-indigo-800 border-indigo-200",
};

export default async function AuditTrailPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = (await props.searchParams) ?? {};
  const query: Record<string, string> = {};
  for (const k of ["entityType", "action", "actorId", "entityId"]) if (sp[k]) query[k] = sp[k];
  let data: Resp = { entries: [], total: 0 };
  let error: string | null = null;
  try {
    data = await backendFetch<Resp>("/api/audit-trail/log", { query });
  } catch (e: any) {
    error = e?.message ?? "Failed to load audit trail";
  }

  const ENTITY_TYPES = ["EnterpriseRisk", "Incident", "Capa", "Permit", "ComplianceAudit", "FireEquipment", "FireDrill"];
  const ACTIONS = ["CREATE", "UPDATE", "STATE_TRANSITION", "ALLOCATION_CHANGED", "SOFT_DELETE", "RESTORE", "READ_SENSITIVE"];
  const chip = (key: string, val: string) => {
    const next = new URLSearchParams(sp as Record<string, string>);
    if (next.get(key) === val) next.delete(key); else next.set(key, val);
    const active = sp[key] === val;
    return (
      <a key={`${key}-${val}`} href={`/audit-trail?${next.toString()}`}
        className={"rounded-full border px-2.5 py-0.5 text-[11px] font-medium " + (active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")}>
        {val.replace(/_/g, " ")}
      </a>
    );
  };

  return (
    <div>
      <PageHeader title="Audit Trail" breadcrumbs={[{ label: "Compliance" }, { label: "Audit Trail" }]}
        description="Tamper-evident, hash-chained record of every change to governed data — who, what, when, before/after. The regulator's view." />
      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}. Requires a compliance/audit role.</Alert>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Entity</span>
            {ENTITY_TYPES.map((t) => chip("entityType", t))}
            <span className="ml-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Action</span>
            {ACTIONS.map((a) => chip("action", a))}
            <span className="ml-auto text-xs text-slate-500">{data.total} entr{data.total === 1 ? "y" : "ies"}</span>
            <a href={`/api/audit-trail/log/export.csv${sp.entityType ? `?entityType=${sp.entityType}` : ""}`} className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-slate-400">Export CSV</a>
          </div>
          <Card className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-none">
            <Table className="w-full min-w-[1000px] text-sm">
              <TableHeader className="sticky top-0 bg-slate-50/95">
                <TableRow className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <TableHead className="px-3 py-2.5">When</TableHead><TableHead className="px-3 py-2.5">Entity</TableHead><TableHead className="px-3 py-2.5">Action</TableHead>
                  <TableHead className="px-3 py-2.5">Actor</TableHead><TableHead className="px-3 py-2.5">Changed</TableHead><TableHead className="px-3 py-2.5">Chain</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="px-3 py-10 text-center text-sm text-slate-400">No audit entries match the filter.</TableCell></TableRow>
                ) : data.entries.map((e) => (
                  <TableRow key={e.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                    <TableCell className="px-3 py-2.5 text-xs text-slate-500 tabular-nums">{e.timestamp ? new Date(e.timestamp).toLocaleString("en-IN") : "—"}</TableCell>
                    <TableCell className="px-3 py-2.5"><span className="font-medium text-slate-700">{e.entityType}</span><span className="block text-[11px] text-slate-400">{e.entityCode ?? e.entityId.slice(0, 10)} · seq {e.sequenceNo}</span></TableCell>
                    <TableCell className="px-3 py-2.5"><span className={"inline-block rounded border px-2 py-0.5 text-[11px] " + (ACTION_CHIP[e.action] ?? "bg-slate-100 text-slate-600 border-slate-200")}>{e.action.replace(/_/g, " ")}</span></TableCell>
                    <TableCell className="px-3 py-2.5 text-xs text-slate-600">{e.actorName ?? e.actorId ?? "system"}<span className="block text-[10px] text-slate-400">{e.actorType}{e.actorIp ? ` · ${e.actorIp}` : ""}</span></TableCell>
                    <TableCell className="max-w-[320px] px-3 py-2.5 text-xs text-slate-600">
                      {(e.changedFields ?? []).slice(0, 4).map((f) => (
                        <span key={f} className="mr-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{f}</span>
                      ))}
                      {e.reason && <span className="block text-[10px] italic text-amber-600">reason: {e.reason}</span>}
                    </TableCell>
                    <TableCell className="px-3 py-2.5"><span title={e.entryHash} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-mono text-emerald-700">🔒 {e.entryHash.slice(0, 8)}</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
