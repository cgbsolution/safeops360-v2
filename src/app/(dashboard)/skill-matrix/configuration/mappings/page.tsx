import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import type { Competency, Mapping } from "@/lib/training-engine";
import { MappingsView } from "./mappings-view";

export const dynamic = "force-dynamic";

export default async function MappingsConfigPage() {
  let mappings: Mapping[] = [];
  let competencies: Competency[] = [];
  let error: string | null = null;
  try {
    [mappings, competencies] = await Promise.all([
      backendFetch<Mapping[]>("/api/training-engine/mappings"),
      backendFetch<Competency[]>("/api/skill-matrix/competencies")
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load mappings";
  }

  return (
    <div>
      <PageHeader
        title="Training Config — Hazard → Skill"
        description="Configurable trigger mapping — tune which classifications assign which competency, no code change."
        breadcrumbs={[
          { label: "People & Competency" },
          { label: "Skill Matrix", href: "/skill-matrix" },
          { label: "Training Config" }
        ]}
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}
        </div>
      ) : (
        <MappingsView mappings={mappings} competencies={competencies} />
      )}
    </div>
  );
}
