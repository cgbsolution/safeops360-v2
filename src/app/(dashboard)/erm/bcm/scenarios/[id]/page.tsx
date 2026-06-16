import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import type { Scenario, ProcessListResponse } from "@/app/(dashboard)/erm/lib-p3";
import { ScenarioDetailView, type RefLabel } from "./stressed-view";

export const dynamic = "force-dynamic";

export default async function ScenarioDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  let scenario: Scenario | null = null;
  let error: string | null = null;
  try {
    scenario = await backendFetch<Scenario>(`/api/erm/bcm/scenarios/${id}`);
  } catch (e: any) {
    error = e?.message ?? "Failed to load scenario";
  }

  // Resolve affected risk/process ids → human labels (board-grade detail must not
  // show raw cuids). Both lists are small; degrade gracefully to the raw id.
  const riskLabels: Record<string, RefLabel> = {};
  const processLabels: Record<string, RefLabel> = {};
  if (scenario) {
    const [risks, procs] = await Promise.all([
      backendFetch<{ items: { id: string; riskCode: string; title: string }[] }>("/api/erm/risks").catch(() => ({ items: [] })),
      backendFetch<ProcessListResponse>("/api/erm/bcm/processes").catch(() => ({ items: [], total: 0, criticalityCounts: {} } as ProcessListResponse)),
    ]);
    for (const r of risks.items ?? []) riskLabels[r.id] = { code: r.riskCode, title: r.title, href: `/erm/register/${r.id}` };
    for (const p of procs.items ?? []) processLabels[p.id] = { code: p.processCode, title: p.name, href: `/erm/bcm/processes/${p.id}` };
  }

  if (error || !scenario) {
    return (
      <div>
        <PageHeader
          title="Scenario"
          breadcrumbs={[
            { label: "Enterprise Risk", href: "/erm" },
            { label: "Business Continuity", href: "/erm/bcm" },
            { label: "Scenarios", href: "/erm/bcm/scenarios" },
          ]}
        />
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "Scenario not found"}.{" "}
          <Link href="/erm/bcm/scenarios" className="underline">
            Back to library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={scenario.scenarioCode}
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Business Continuity", href: "/erm/bcm" },
          { label: "Scenarios", href: "/erm/bcm/scenarios" },
          { label: scenario.scenarioCode },
        ]}
        description={scenario.title}
      />
      <ScenarioDetailView scenario={scenario} riskLabels={riskLabels} processLabels={processLabels} />
    </div>
  );
}
