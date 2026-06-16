import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { fmtDate } from "../../lib";
import { OBLIGATION_STATUS_CHIP, type ObligationListResponse } from "../../lib-p2";
import { NewObligationButton } from "./new-obligation";

export const dynamic = "force-dynamic";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "COMPLIANT", label: "Compliant" },
  { value: "DUE_SOON", label: "Due Soon" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "UNDER_RENEWAL", label: "Under Renewal" },
  { value: "NOT_APPLICABLE", label: "N/A" },
];

function typeLabel(token: string): string {
  return token.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function ObligationRegisterPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const query: Record<string, string> = {};
  for (const k of ["obligationType", "status", "siteId", "owner"]) {
    const v = get(k);
    if (v) query[k] = v;
  }

  let data: ObligationListResponse = { items: [], total: 0, statusCounts: {}, typeCounts: {} };
  let error: string | null = null;
  try {
    data = await backendFetch<ObligationListResponse>("/api/erm/compliance/obligations", { query });
  } catch (e: any) {
    error = e?.message ?? "Failed to load obligations register";
  }

  const spStr: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") spStr[k] = v;
    else if (Array.isArray(v) && v[0]) spStr[k] = v[0];
  }

  const statusChip = (value: string, label: string) => {
    const next = new URLSearchParams(spStr);
    const active = get("status") === value;
    if (active) next.delete("status");
    else next.set("status", value);
    return (
      <Link
        key={value}
        href={`/erm/compliance/register?${next.toString()}`}
        className={
          "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
          (active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")
        }
      >
        {label}{" "}
        {data.statusCounts[value] != null && <span className="tabular-nums opacity-70">{data.statusCounts[value] ?? 0}</span>}
      </Link>
    );
  };

  const typeChip = (value: string, count: number) => {
    const next = new URLSearchParams(spStr);
    const active = get("obligationType") === value;
    if (active) next.delete("obligationType");
    else next.set("obligationType", value);
    return (
      <Link
        key={value}
        href={`/erm/compliance/register?${next.toString()}`}
        className={
          "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
          (active ? "border-primary-700 bg-primary-50 text-primary-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")
        }
      >
        {typeLabel(value)} <span className="tabular-nums opacity-70">{count}</span>
      </Link>
    );
  };

  return (
    <div>
      <PageHeader
        title="Obligations Register"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Compliance", href: "/erm/compliance" },
          { label: "Register" },
        ]}
        description="Every statutory & regulatory obligation the enterprise carries — its statute, regulator, owner, validity window and live compliance status."
        action={<NewObligationButton />}
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</span>
            {STATUS_FILTERS.map((s) => statusChip(s.value, s.label))}
            <span className="ml-auto text-xs text-slate-500">{data.total} obligation(s)</span>
          </div>

          {Object.keys(data.typeCounts).length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Type</span>
              {Object.entries(data.typeCounts).map(([t, c]) => typeChip(t, c))}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50/95">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Code</th>
                  <th className="px-3 py-2.5">Title</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Statute</th>
                  <th className="px-3 py-2.5">Regulator</th>
                  <th className="px-3 py-2.5">Site</th>
                  <th className="px-3 py-2.5">Owner</th>
                  <th className="px-3 py-2.5">Frequency</th>
                  <th className="px-3 py-2.5">Valid Until</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Tasks</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-10 text-center text-sm text-slate-400">
                      No obligations match the current filter.
                    </td>
                  </tr>
                ) : (
                  data.items.map((o) => (
                    <tr key={o.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                      <td className="px-3 py-2.5">
                        <Link href={`/erm/compliance/${o.id}`} className="font-medium text-primary-700 hover:underline">
                          {o.obligationCode}
                        </Link>
                      </td>
                      <td className="max-w-[240px] px-3 py-2.5 text-slate-700">{o.title}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {typeLabel(o.obligationType)}
                        </span>
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-2.5 text-xs text-slate-600" title={o.statuteReference}>
                        {o.statuteReference || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{o.regulatorName || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{o.siteName ?? "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{o.ownerName ?? "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{typeLabel(o.frequency)}</td>
                      <td className="px-3 py-2.5 text-xs tabular-nums text-slate-500">{fmtDate(o.validUntil)}</td>
                      <td className="px-3 py-2.5">
                        <span className={"inline-block rounded border px-2 py-0.5 text-[11px] " + (OBLIGATION_STATUS_CHIP[o.status] ?? "")}>
                          {o.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {o.openTaskCount > 0 ? (
                          <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                            {o.openTaskCount}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">0</span>
                        )}
                      </td>
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
