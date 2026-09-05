import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { PROB_LABEL, READINESS_CHIP, type Scenario } from "@/app/(dashboard)/erm/lib-p3";
import { NewScenarioButton } from "./new-scenario-form";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  NATURAL_DISASTER: "Natural Disaster",
  CYBER_ATTACK: "Cyber Attack",
  SUPPLY_DISRUPTION: "Supply Disruption",
  UTILITY_FAILURE: "Utility Failure",
  PANDEMIC_WORKFORCE: "Pandemic / Workforce",
  MARKET_SHOCK: "Market Shock",
  REGULATORY_SHOCK: "Regulatory Shock",
  REPUTATIONAL_EVENT: "Reputational Event",
  GEOPOLITICAL: "Geopolitical",
};

const READINESS_LABEL: Record<string, string> = {
  NO_PLAN: "No plan",
  PLAN_EXISTS: "Plan exists",
  PLAN_TESTED: "Plan tested",
};

export default async function ScenarioLibraryPage() {
  let scenarios: Scenario[] = [];
  let error: string | null = null;
  try {
    scenarios = await backendFetch<Scenario[]>("/api/erm/bcm/scenarios");
  } catch (e: any) {
    error = e?.message ?? "Failed to load scenarios";
  }

  // Group by category, sorted by category label then title.
  const groups = new Map<string, Scenario[]>();
  for (const s of scenarios) {
    const arr = groups.get(s.category) ?? [];
    arr.push(s);
    groups.set(s.category, arr);
  }
  const sortedCategories = [...groups.keys()].sort((a, b) =>
    (CATEGORY_LABEL[a] ?? a).localeCompare(CATEGORY_LABEL[b] ?? b),
  );
  for (const c of sortedCategories) {
    groups.get(c)!.sort((a, b) => a.title.localeCompare(b.title));
  }

  return (
    <div>
      <PageHeader
        title="Scenario Library & What-If"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Business Continuity", href: "/erm/bcm" },
          { label: "Scenarios" },
        ]}
        description="A library of disruption scenarios with what-if stressors. Stress the enterprise heat map to visualise where exposure migrates — presentational only, the register is untouched."
        action={<NewScenarioButton />}
      />

      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}. Ensure the ERM Phase 3 (BCM) seed has been run and you are logged in with a BCM role.
        </Alert>
      ) : scenarios.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-none">
          <p className="text-sm font-medium text-slate-700">No scenarios yet</p>
          <p className="max-w-sm text-xs text-slate-500">
            Build your first what-if scenario. Each one estimates impact across dimensions and can stress the
            enterprise heat map to show where risk migrates under disruption.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedCategories.map((cat) => (
            <div key={cat}>
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {CATEGORY_LABEL[cat] ?? cat.replace(/_/g, " ")}{" "}
                <span className="text-slate-300">({groups.get(cat)!.length})</span>
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {groups.get(cat)!.map((s) => (
                  <Link
                    key={s.id}
                    href={`/erm/bcm/scenarios/${s.id}`}
                    className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{s.title}</h3>
                      <span
                        className={
                          "shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium " +
                          (READINESS_CHIP[s.mitigationReadiness] ?? "bg-slate-100 text-slate-600 border-slate-200")
                        }
                      >
                        {READINESS_LABEL[s.mitigationReadiness] ?? s.mitigationReadiness.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                        {s.scenarioCode}
                      </span>
                      <span>Probability: {PROB_LABEL[s.probabilityQualitative] ?? s.probabilityQualitative}</span>
                      {s.topImpactLevel != null && <span>· Top impact L{s.topImpactLevel}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
