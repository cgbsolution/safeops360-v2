import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import type { Exercise, PlanListResponse, Scenario } from "@/app/(dashboard)/erm/lib-p3";
import { ExerciseWorkspace } from "./workspace";

export const dynamic = "force-dynamic";

export default async function ExerciseWorkspacePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  let exercise: Exercise | null = null;
  let error: string | null = null;
  try {
    exercise = await backendFetch<Exercise>(`/api/erm/bcm/exercises/${id}`);
  } catch (e: any) {
    error = e?.message ?? "Failed to load exercise";
  }

  // Resolve tested-plan / tested-scenario ids → codes (no raw cuids in the UI).
  const planLabels: Record<string, string> = {};
  const scenarioLabels: Record<string, string> = {};
  if (exercise) {
    const [plans, scns] = await Promise.all([
      backendFetch<PlanListResponse>("/api/erm/bcm/plans").catch(() => ({ items: [], total: 0, statusCounts: {} } as PlanListResponse)),
      backendFetch<Scenario[]>("/api/erm/bcm/scenarios").catch(() => [] as Scenario[]),
    ]);
    for (const p of plans.items ?? []) planLabels[p.id] = `${p.planCode} · ${p.title}`;
    for (const s of scns ?? []) scenarioLabels[s.id] = `${s.scenarioCode} · ${s.title}`;
  }

  if (error || !exercise) {
    return (
      <div>
        <PageHeader
          title="Exercise"
          breadcrumbs={[
            { label: "Enterprise Risk", href: "/erm" },
            { label: "Business Continuity", href: "/erm/bcm" },
            { label: "Exercises", href: "/erm/bcm/exercises" },
          ]}
        />
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "Exercise not found"}.{" "}
          <Link href="/erm/bcm/exercises" className="underline">
            Back to programme
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={exercise.exerciseCode}
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Business Continuity", href: "/erm/bcm" },
          { label: "Exercises", href: "/erm/bcm/exercises" },
          { label: exercise.exerciseCode },
        ]}
        description={exercise.title}
      />
      <ExerciseWorkspace exercise={exercise} planLabels={planLabels} scenarioLabels={scenarioLabels} />
    </div>
  );
}
