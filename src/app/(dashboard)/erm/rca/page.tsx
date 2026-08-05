import Link from "next/link";
import { BarChart3, Network } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import {
  DOMAINS, DOMAIN_COLOR, DOMAIN_LABEL, ORIGIN_CHIP, ORIGIN_LABEL, STATUS_CHIP, METHOD_LABEL,
  fmtDate, type RcaListResponse, type RcaOriginType, type RcaStatus,
} from "./lib";
import { LinkedRisksCell } from "@/components/erm/rca-register-actions";

export const dynamic = "force-dynamic";

const ORIGINS: RcaOriginType[] = ["EVENT", "RISK", "LOSS_EVENT"];
const STATUSES: RcaStatus[] = ["DRAFT", "IN_ANALYSIS", "PEER_REVIEW", "APPROVED", "SUPERSEDED"];

export default async function RcaRegisterPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const query: Record<string, string> = {};
  for (const k of ["domain", "originType", "status", "plantId"]) if (sp[k]) query[k] = sp[k]!;

  let data: RcaListResponse = { items: [], total: 0 };
  let error: string | null = null;
  try {
    data = await backendFetch<RcaListResponse>("/api/erm/rca", { query });
  } catch (e: any) {
    error = e?.message ?? "Failed to load RCA register";
  }

  const chip = (key: string, val: string, label: string, active: boolean) => {
    const next = new URLSearchParams(sp as Record<string, string>);
    if (active) next.delete(key);
    else next.set(key, val);
    return (
      <Link
        key={`${key}-${val}`}
        href={`/erm/rca?${next.toString()}`}
        className={
          "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
          (active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")
        }
      >
        {label}
      </Link>
    );
  };

  return (
    <div>
      <PageHeader
        title="Root-Cause Analysis Register"
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "RCA Register" }]}
        description="Every RCA across all origin types and risk domains — operational events, risk deep-dives and loss-event investigations in one register."
        action={
          <div className="flex gap-2">
            <Link href="/erm/rca/analytics" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-400">
              <BarChart3 size={16} /> Analytics
            </Link>
            <Link href="/erm/rca/map" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-400">
              <Network size={16} /> Cause-to-Risk Map
            </Link>
          </div>
        }
      />

      <div className="mb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Domain</span>
          {DOMAINS.map((d) => chip("domain", d, DOMAIN_LABEL[d], sp.domain === d))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Origin</span>
          {ORIGINS.map((o) => chip("originType", o, ORIGIN_LABEL[o], sp.originType === o))}
          <span className="ml-3 mr-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</span>
          {STATUSES.map((s) => chip("status", s, s.replace("_", " "), sp.status === s))}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50/95">
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2.5">Code</th>
                <th className="px-3 py-2.5">Title</th>
                <th className="px-3 py-2.5">Origin</th>
                <th className="px-3 py-2.5">Source</th>
                <th className="px-3 py-2.5">Domain</th>
                <th className="px-3 py-2.5">Method</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-center">Causes</th>
                <th className="px-3 py-2.5">Linked Risks</th>
                <th className="px-3 py-2.5">Occurred</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-10 text-center text-sm text-slate-400">No RCAs match these filters.</td></tr>
              ) : (
                data.items.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-3 py-2.5">
                      <Link href={`/erm/rca/${r.id}`} className="font-medium text-primary-700 hover:underline">{r.rcaCode}</Link>
                    </td>
                    <td className="max-w-[280px] truncate px-3 py-2.5 text-slate-700">{r.title}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block rounded border px-2 py-0.5 text-[11px] font-medium ${ORIGIN_CHIP[r.originType]}`}>{ORIGIN_LABEL[r.originType]}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {r.sourceCode && r.sourceHref ? (
                        <Link href={r.sourceHref} className="font-medium text-primary-700 hover:underline">{r.sourceCode}</Link>
                      ) : (
                        <span className="text-slate-400">{ORIGIN_LABEL[r.originType]}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DOMAIN_COLOR[r.primaryDomain] }} />
                        {DOMAIN_LABEL[r.primaryDomain]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{METHOD_LABEL[r.methodology]}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block rounded border px-2 py-0.5 text-[11px] font-medium ${STATUS_CHIP[r.status]}`}>{r.status.replace("_", " ")}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-slate-700">{r.causeCount}</td>
                    <td className="px-3 py-2.5">
                      <LinkedRisksCell risks={r.linkedRisks} />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{fmtDate(r.occurrenceDate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-400">{data.total} analyses · computed from RCA records.</p>
    </div>
  );
}
