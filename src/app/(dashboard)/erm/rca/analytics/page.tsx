import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { DOMAINS, DOMAIN_LABEL, type CauseAnalyticsResponse } from "../lib";
import { AnalyticsView } from "./analytics-view";

export const dynamic = "force-dynamic";

export default async function RcaAnalyticsPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const query: Record<string, string> = {};
  if (sp.domain) query.domain = sp.domain;

  let data: CauseAnalyticsResponse | null = null;
  let error: string | null = null;
  try {
    data = await backendFetch<CauseAnalyticsResponse>("/api/erm/rca/analytics/causes", { query });
  } catch (e: any) {
    error = e?.message ?? "Failed to load analytics";
  }

  const domainChip = (val: string | null, label: string) => {
    const next = new URLSearchParams(sp as Record<string, string>);
    if (!val) next.delete("domain");
    else next.set("domain", val);
    const active = (sp.domain ?? null) === val;
    return (
      <Link
        key={val ?? "all"}
        href={`/erm/rca/analytics?${next.toString()}`}
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
        title="Root-Cause Analytics"
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "RCA", href: "/erm/rca" }, { label: "Analytics" }]}
        description="Which root causes recur, how many distinct risks each drives, and which causes cross risk domains — computed from approved RCA records."
      />
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">View</span>
        {domainChip(null, "Enterprise-wide")}
        {DOMAINS.map((d) => domainChip(d, DOMAIN_LABEL[d]))}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>
      ) : data ? (
        <AnalyticsView data={data} domain={sp.domain ?? null} />
      ) : null}
    </div>
  );
}
