import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { CAPA_STATE_CHIP, SEVERITY_CHIP, fmtDate, labelize, type AuditCapaListResponse } from "../lib-cams";

export const dynamic = "force-dynamic";

const CAPA_SEV_CHIP: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
  MODERATE: "bg-amber-100 text-amber-800 border-amber-200",
  HIGH: "bg-orange-100 text-orange-900 border-orange-200",
  CRITICAL: "bg-rose-200 text-rose-900 border-rose-300 font-semibold",
};

export default async function AuditCapaPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("CAMS.READ");
  const sp = await props.searchParams;
  const get = (k: string) => { const v = sp[k]; return Array.isArray(v) ? v[0] : v; };
  const query: Record<string, string> = {};
  if (get("state")) query.state = get("state")!;
  if (get("overdueOnly") === "1") query.overdueOnly = "true";

  let data: AuditCapaListResponse = { items: [], total: 0, stateCounts: {}, overdueCount: 0, openCount: 0 };
  let error: string | null = null;
  try {
    data = await backendFetch<AuditCapaListResponse>("/api/cams/capa", { query });
  } catch (e: any) {
    error = e?.message ?? "Failed to load audit CAPAs";
  }

  const spStr: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) { if (typeof v === "string") spStr[k] = v; else if (Array.isArray(v) && v[0]) spStr[k] = v[0]; }
  const overdueActive = get("overdueOnly") === "1";
  const overdueHref = (() => { const n = new URLSearchParams(spStr); if (overdueActive) n.delete("overdueOnly"); else n.set("overdueOnly", "1"); return `/cams/capa?${n.toString()}`; })();

  return (
    <div>
      <PageHeader
        title="CAPA — Audit Source"
        description="Every corrective/preventive action raised from an audit or inspection finding — the same universal CAPA engine that runs your incidents and risk treatments, filtered to the AUDIT source. Finding → root cause → corrective action → verification, one chain."
        breadcrumbs={[{ label: "CAMS", href: "/cams" }, { label: "CAPA" }]}
      />
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">Open <span className="ml-1 font-semibold tabular-nums">{data.openCount}</span></div>
            <div className={"rounded-lg border bg-white px-3 py-1.5 text-xs " + (data.overdueCount ? "border-rose-200 text-rose-700" : "border-slate-200 text-slate-600")}>Overdue <span className="ml-1 font-semibold tabular-nums">{data.overdueCount}</span></div>
            <Link href={overdueHref} className={"rounded-full border px-3 py-1 text-xs font-medium " + (overdueActive ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")}>Overdue only</Link>
            <span className="ml-auto text-xs text-slate-500">{data.total} CAPA(s)</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50/95">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">CAPA</th>
                  <th className="px-3 py-2.5">Title</th>
                  <th className="px-3 py-2.5">Source</th>
                  <th className="px-3 py-2.5">From Finding</th>
                  <th className="px-3 py-2.5">Severity</th>
                  <th className="px-3 py-2.5">State</th>
                  <th className="px-3 py-2.5">Owner</th>
                  <th className="px-3 py-2.5">Target</th>
                  <th className="px-3 py-2.5 text-center">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr><td colSpan={9} className="px-3 py-10 text-center text-sm text-slate-400">No audit-source CAPAs.</td></tr>
                ) : (
                  data.items.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                      <td className="px-3 py-2.5"><Link href="/capa" className="font-medium text-primary-700 hover:underline">{c.capaNumber}</Link></td>
                      <td className="max-w-[260px] px-3 py-2.5 text-slate-700">{c.title}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{labelize(c.sourceTypeCode)}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {c.findingCode ? <Link href={c.sourceReferenceUrl ?? "#"} className="text-primary-700 hover:underline">{c.findingCode}</Link> : "—"}
                        {c.engagementCode && <span className="ml-1 text-slate-400">({c.engagementCode})</span>}
                      </td>
                      <td className="px-3 py-2.5"><span className={"rounded border px-2 py-0.5 text-[11px] " + (CAPA_SEV_CHIP[c.severity] ?? "")}>{labelize(c.severity)}</span></td>
                      <td className="px-3 py-2.5"><span className={"rounded border px-2 py-0.5 text-[11px] " + (CAPA_STATE_CHIP[c.state] ?? "")}>{labelize(c.state)}</span></td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{c.primaryOwnerName ?? "—"}</td>
                      <td className="px-3 py-2.5 text-xs tabular-nums text-slate-500">{fmtDate(c.closureTargetDate)}</td>
                      <td className="px-3 py-2.5 text-center text-xs tabular-nums">{c.overdueDays > 0 ? <span className="rounded bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-700">{c.overdueDays}d</span> : <span className="text-slate-300">—</span>}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
