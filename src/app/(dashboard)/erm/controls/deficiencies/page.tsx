import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { DEF_SEVERITY_CHIP, DEF_STATUS_CHIP, type DeficiencyListResponse } from "@/app/(dashboard)/erm/lib-t3";
import { DeficiencyRowActions } from "./deficiency-actions";

export const dynamic = "force-dynamic";

const SEVERITY_FILTERS = ["DEFICIENCY", "SIGNIFICANT_DEFICIENCY", "MATERIAL_WEAKNESS"] as const;
const STATUS_FILTERS = ["OPEN", "REMEDIATION_ACTIVE", "RETESTING", "CLOSED"] as const;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
function tidy(token: string) {
  return token.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function DeficienciesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  const severity = one(sp.severity);
  const status = one(sp.status);

  let data: DeficiencyListResponse = { items: [], total: 0, severityCounts: {} };
  let error: string | null = null;
  try {
    data = await backendFetch<DeficiencyListResponse>("/api/erm/controls/deficiencies", {
      query: { severity: severity ?? undefined, status: status ?? undefined },
    });
  } catch (e: any) {
    error = e?.message ?? "Failed to load deficiencies";
  }

  const counts = data.severityCounts ?? {};

  const hrefWith = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged: Record<string, string | undefined> = { severity, status, ...patch };
    Object.entries(merged).forEach(([k, v]) => {
      if (v) next.set(k, v);
    });
    const qs = next.toString();
    return `/erm/controls/deficiencies${qs ? `?${qs}` : ""}`;
  };
  const chipCls = (active: boolean) =>
    "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
    (active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400");

  // Material-weakness rows pinned at top.
  const rows = [...data.items].sort((a, b) => {
    const aw = a.severity === "MATERIAL_WEAKNESS" ? 0 : 1;
    const bw = b.severity === "MATERIAL_WEAKNESS" ? 0 : 1;
    if (aw !== bw) return aw - bw;
    return b.ageDays - a.ageDays;
  });

  return (
    <div>
      <PageHeader
        title="Control Deficiencies"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Internal Controls", href: "/erm/controls" },
          { label: "Deficiencies" },
        ]}
        description="Deficiencies raised from failed control tests — track remediation CAPAs, advance status and report material weaknesses to the Audit Committee."
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}. Ensure the ERM Tier 3 seed has been run and you are logged in with a controls role.
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Severity</span>
            <Link href={hrefWith({ severity: undefined })} className={chipCls(!severity)}>All</Link>
            {SEVERITY_FILTERS.map((s) => (
              <Link key={s} href={hrefWith({ severity: severity === s ? undefined : s })} className={chipCls(severity === s)}>
                {tidy(s)} <span className="tabular-nums opacity-70">{counts[s] ?? 0}</span>
              </Link>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</span>
            <Link href={hrefWith({ status: undefined })} className={chipCls(!status)}>All</Link>
            {STATUS_FILTERS.map((s) => (
              <Link key={s} href={hrefWith({ status: status === s ? undefined : s })} className={chipCls(status === s)}>
                {tidy(s)}
              </Link>
            ))}
            <span className="ml-auto text-xs text-slate-500">{data.items.length} of {data.total} shown</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-slate-50/95">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Deficiency</th>
                  <th className="px-3 py-2.5">Control</th>
                  <th className="px-3 py-2.5">Severity</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Remediation CAPA</th>
                  <th className="px-3 py-2.5 text-center">Reported</th>
                  <th className="px-3 py-2.5 text-right">Age</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-sm text-slate-400">No deficiencies match the current filter.</td>
                  </tr>
                ) : (
                  rows.map((def) => {
                    const isMw = def.severity === "MATERIAL_WEAKNESS";
                    return (
                      <tr key={def.id} className={"border-t border-slate-100 align-top " + (isMw ? "bg-rose-50/50" : "hover:bg-slate-50/70")}>
                        <td className="px-3 py-2.5">
                          <span className="font-mono text-xs font-semibold text-slate-800">{def.deficiencyCode}</span>
                          {def.description && <p className="mt-0.5 max-w-[280px] text-xs text-slate-500">{def.description}</p>}
                        </td>
                        <td className="px-3 py-2.5">
                          {def.controlId ? (
                            <Link href={`/erm/controls/${def.controlId}`} className="font-mono text-xs font-medium text-primary-700 hover:underline">
                              {def.controlCode ?? "—"}
                            </Link>
                          ) : (
                            <span className="font-mono text-xs text-slate-600">{def.controlCode ?? "—"}</span>
                          )}
                          {def.controlName && <p className="text-xs text-slate-500">{def.controlName}</p>}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={"rounded border px-2 py-0.5 text-[11px] " + (DEF_SEVERITY_CHIP[def.severity] ?? "")}>{tidy(def.severity)}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={"rounded border px-2 py-0.5 text-[11px] " + (DEF_STATUS_CHIP[def.status] ?? "")}>{tidy(def.status)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          {def.remediationCapaId ? (
                            <Link href={`/capa/${def.remediationCapaId}`} className="inline-flex items-center gap-1.5 text-primary-700 hover:underline">
                              <span className="font-medium">View CAPA</span>
                              {def.remediationCapaState && (
                                <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">{tidy(def.remediationCapaState)}</span>
                              )}
                            </Link>
                          ) : (
                            <span className="text-slate-400">No CAPA</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {def.reportedToAuditCommittee ? (
                            <span className="text-emerald-600" title={def.auditCommitteeReference ?? "Reported"}>✓</span>
                          ) : (
                            <span className="text-slate-300">✗</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">{def.ageDays}d</td>
                        <td className="px-3 py-2.5">
                          <DeficiencyRowActions def={def} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
