import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { AttachmentCountBadge } from "@/components/evidence/AttachmentCountBadge";
import { requirePermission } from "@/lib/auth/server";
import {
  SEVERITY_CHIP, FINDING_STATUS_CHIP, fmtDate, labelize,
  type FindingListResponse,
} from "../lib-cams";

export const dynamic = "force-dynamic";

export default async function FindingsRegisterPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("CAMS.READ");
  const sp = await props.searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const query: Record<string, string> = {};
  for (const k of ["severity", "status", "standardClauseRef", "siteId"]) {
    const v = get(k);
    if (v) query[k] = v;
  }
  if (get("repeatOnly") === "1") query.repeatOnly = "true";
  if (get("overdueOnly") === "1") query.overdueOnly = "true";

  let data: FindingListResponse = { items: [], total: 0, severityCounts: {}, statusCounts: {}, repeatCount: 0 };
  let error: string | null = null;
  try {
    data = await backendFetch<FindingListResponse>("/api/cams/unified-findings", { query });
  } catch (e: any) {
    error = e?.message ?? "Failed to load findings";
  }

  // Per-finding evidence counts for the row paperclip badge (spec §5.2).
  // Tolerant: non-fatal if the evidence endpoint is unavailable. Only native
  // CAMS findings resolve as `cams_finding`; merged audit rows simply return 0.
  let attachmentCounts: Record<string, number> = {};
  if (data.items.length) {
    try {
      const ids = data.items.map((f) => f.id).join(",");
      const cres = await backendFetch<{ counts: Record<string, number> }>(
        "/api/evidence/cams_finding/counts",
        { query: { ids } }
      );
      attachmentCounts = cres.counts ?? {};
    } catch {
      /* non-fatal — badges just won't render */
    }
  }

  const spStr: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") spStr[k] = v;
    else if (Array.isArray(v) && v[0]) spStr[k] = v[0];
  }
  const chip = (key: string, value: string, label: string, count?: number) => {
    const next = new URLSearchParams(spStr);
    const active = get(key) === value;
    if (active) next.delete(key); else next.set(key, value);
    return (
      <Link key={value} href={`/cams/findings?${next.toString()}`}
        className={"rounded-full border px-3 py-1 text-xs font-medium transition-colors " + (active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")}>
        {label} {count != null && <span className="tabular-nums opacity-70">{count}</span>}
      </Link>
    );
  };
  const toggle = (key: string, label: string) => {
    const next = new URLSearchParams(spStr);
    const active = get(key) === "1";
    if (active) next.delete(key); else next.set(key, "1");
    return (
      <Link href={`/cams/findings?${next.toString()}`}
        className={"rounded-full border px-3 py-1 text-xs font-medium transition-colors " + (active ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")}>
        {label}
      </Link>
    );
  };

  return (
    <div>
      <PageHeader
        title="Findings Register"
        description="Every finding across every engagement — severity, ISO clause, CAPA status, and the repeat-finding flag that is your real certification risk."
        breadcrumbs={[{ label: "CAMS", href: "/cams" }, { label: "Findings" }]}
      />
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Severity</span>
            {["CRITICAL_NC", "MAJOR_NC", "MINOR_NC", "OBSERVATION"].map((s) => chip("severity", s, labelize(s), data.severityCounts[s]))}
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</span>
            {["OPEN", "CAPA_RAISED", "IN_REMEDIATION", "VERIFICATION", "CLOSED"].map((s) => chip("status", s, labelize(s), data.statusCounts[s]))}
            {toggle("repeatOnly", `Repeat only (${data.repeatCount})`)}
            {toggle("overdueOnly", "Overdue")}
            <span className="ml-auto text-xs text-slate-500">{data.total} finding(s)</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50/95">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Code</th>
                  <th className="px-3 py-2.5">Finding</th>
                  <th className="px-3 py-2.5">Engagement</th>
                  <th className="px-3 py-2.5">Severity</th>
                  <th className="px-3 py-2.5">Clause</th>
                  <th className="px-3 py-2.5">Site</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">CAPA</th>
                  <th className="px-3 py-2.5">Due</th>
                  <th className="px-3 py-2.5 text-center">Age</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr><td colSpan={10} className="px-3 py-10 text-center text-sm text-slate-400">No findings match the current filter.</td></tr>
                ) : (
                  data.items.map((f) => (
                    <tr key={f.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                      <td className="px-3 py-2.5">
                        <Link href={f.href ?? `/cams/findings/${f.id}`} className="font-medium text-primary-700 hover:underline">{f.findingCode}</Link>
                        {f.isRepeatFinding && <span className="ml-1 rounded bg-rose-100 px-1 text-[10px] font-semibold text-rose-700">repeat</span>}
                        {f.href?.startsWith("/cams/audits") && <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] font-semibold text-violet-700">audit</span>}
                      </td>
                      <td className="max-w-[260px] px-3 py-2.5 text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate">{f.title}</span>
                          <AttachmentCountBadge count={attachmentCounts[f.id] ?? 0} />
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs"><Link href={f.href ?? `/cams/engagements/${f.engagementId}`} className="text-primary-700 hover:underline">{f.engagementCode}</Link></td>
                      <td className="px-3 py-2.5"><span className={"rounded border px-2 py-0.5 text-[11px] " + (SEVERITY_CHIP[f.severity] ?? "")}>{labelize(f.severity)}</span></td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{f.standardClauseRef ?? "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{f.siteName ?? "—"}</td>
                      <td className="px-3 py-2.5"><span className={"rounded border px-2 py-0.5 text-[11px] " + (FINDING_STATUS_CHIP[f.status] ?? "")}>{labelize(f.status)}</span></td>
                      <td className="px-3 py-2.5 text-xs">
                        {f.capaNumber ? <Link href="/capa" className="text-blue-700 hover:underline">{f.capaNumber}</Link>
                          : f.capaRequired ? <span className="text-rose-500">required</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs tabular-nums text-slate-500">{fmtDate(f.dueDate)}</td>
                      <td className="px-3 py-2.5 text-center text-xs tabular-nums text-slate-500">{f.ageDays}d</td>
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
