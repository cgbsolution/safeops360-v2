import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import type { Competency, Content } from "@/lib/training-engine";
import { ContentView } from "./content-view";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function ContentConfigPage() {
  let content: Content[] = [];
  let competencies: Competency[] = [];
  let error: string | null = null;
  try {
    [content, competencies] = await Promise.all([
      backendFetch<Content[]>("/api/training-engine/content"),
      backendFetch<Competency[]>("/api/skill-matrix/competencies")
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load learning content";
  }

  return (
    <div>
      <PageHeader
        title="Training Config — Content Adapter"
        description="Swap demo content for a vendor package here — no code change; the engine keys only on competency."
        breadcrumbs={[
          { label: "People & Competency" },
          { label: "Skill Matrix", href: "/skill-matrix" },
          { label: "Content Adapter" }
        ]}
      />

      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}
        </Alert>
      ) : (
        <ContentView content={content} competencies={competencies} />
      )}
    </div>
  );
}
