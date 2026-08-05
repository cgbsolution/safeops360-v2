import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { RiskDetailView } from "./detail-view";
import { Tier3RiskPanel } from "./tier3-panel";
import { AdvancedRiskPanel } from "./advanced-panel";
import { AdvancedRiskEditor } from "./advanced-edit";
import { RcaRiskPanel } from "@/components/erm/rca-risk-panel";
import type { RiskDetail, ScoringMatrix } from "../../lib";

export const dynamic = "force-dynamic";

export default async function RiskDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  let risk: RiskDetail | null = null;
  let matrix: ScoringMatrix | null = null;
  let phase2: any = null;
  let error: string | null = null;
  try {
    [risk, matrix, phase2] = await Promise.all([
      backendFetch<RiskDetail>(`/api/erm/risks/${id}`),
      backendFetch<ScoringMatrix>("/api/erm/matrix").catch(() => null as any),
      backendFetch<any>(`/api/erm/risks/${id}/phase2-context`).catch(() => null),
    ]);
  } catch (e: any) {
    error = e?.message ?? "Failed to load risk";
  }

  if (error || !risk) {
    return (
      <div>
        <PageHeader title="Risk" breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "Register", href: "/erm/register" }]} />
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "Risk not found"}. <Link href="/erm/register" className="underline">Back to register</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={risk.riskCode}
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "Register", href: "/erm/register" }, { label: risk.riskCode }]}
      />
      <RiskDetailView risk={risk} matrix={matrix} phase2={phase2} />
      <AdvancedRiskPanel risk={risk} />
      <AdvancedRiskEditor risk={risk} />
      <RcaRiskPanel riskId={id} riskCode={risk.riskCode} riskTitle={risk.title} />
      <Tier3RiskPanel riskId={id} />
    </div>
  );
}
