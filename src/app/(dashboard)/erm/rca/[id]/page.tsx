import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import type { RcaDetail, SubCauseOut } from "../lib";
import { RcaWorkspace } from "./detail-view";

export const dynamic = "force-dynamic";

type RiskOpt = { id: string; riskCode: string; title: string };

export default async function RcaDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  let rca: RcaDetail | null = null;
  let error: string | null = null;
  try {
    rca = await backendFetch<RcaDetail>(`/api/erm/rca/${id}`);
  } catch (e: any) {
    error = e?.message ?? "Failed to load RCA";
  }

  if (error || !rca) {
    return (
      <div>
        <PageHeader title="RCA" breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "RCA", href: "/erm/rca" }, { label: "Analysis" }]} />
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "RCA not found."} <Link href="/erm/rca" className="underline">Back to register</Link>.
        </div>
      </div>
    );
  }

  const [subCauses, riskResp] = await Promise.all([
    backendFetch<SubCauseOut[]>("/api/erm/rca/sub-causes", { query: { domain: rca.primaryDomain } }).catch(() => [] as SubCauseOut[]),
    backendFetch<{ items: RiskOpt[] }>("/api/erm/risks").catch(() => ({ items: [] as RiskOpt[] })),
  ]);
  const riskOptions = (riskResp.items ?? []).map((r) => ({ id: r.id, code: r.riskCode, title: r.title }));

  return (
    <div>
      <PageHeader
        title={rca.rcaCode}
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "RCA", href: "/erm/rca" }, { label: rca.rcaCode }]}
      />
      <RcaWorkspace rca={rca} subCauses={subCauses} riskOptions={riskOptions} />
    </div>
  );
}
