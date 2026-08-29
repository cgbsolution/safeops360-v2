import { notFound } from "next/navigation";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { EntryEditor } from "./entry-editor";
import type { EaiEntryOut, MatrixLevel, AspectItem, CategoryItem, ReceptorItem } from "./types";

export const dynamic = "force-dynamic";

type StudyOut = {
  id: string;
  number: string;
  title: string;
  status: string;
  impactMatrixId: string;
  plantId: string;
};

type MatrixOut = {
  id: string;
  name: string;
  likelihoods: MatrixLevel[];
  magnitudes: MatrixLevel[];
};

const EDITABLE_STATUSES = ["DRAFT", "IN_PROGRESS", "TEAM_REVIEW"];

export default async function EaiEntryDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  // Load entry first — we need studyId to load everything else.
  // ORDERING DEPENDENCY: The null-guard below (if (!entry) return notFound())
  // MUST remain between this fetch and the parallel Promise.all that follows.
  // The parallel block references entry.studyId; moving that block above the
  // guard — or hoisting the fetch into the same Promise.all — will throw at
  // runtime because entry may be null. TypeScript narrows the type after the
  // guard, so there is no compile-time protection against such a refactor.
  const entry = await backendFetch<EaiEntryOut>(`/api/eai/entries/${id}`).catch(() => null);
  if (!entry) return notFound();
  // entry is non-null from this point on; entry.studyId is safe to access.

  // Load study, aspects, categories, and receptors in parallel
  const [study, aspects, categories, receptors] = await Promise.all([
    backendFetch<StudyOut>(`/api/eai/studies/${entry.studyId}`).catch(() => null),
    backendFetch<AspectItem[]>(`/api/eai/aspects`).catch(() => [] as AspectItem[]),
    backendFetch<CategoryItem[]>(`/api/eai/aspect-categories`).catch(() => [] as CategoryItem[]),
    backendFetch<ReceptorItem[]>(`/api/eai/receptors`).catch(() => [] as ReceptorItem[])
  ]);

  if (!study) return notFound();

  // Load impact matrix using the study's impactMatrixId
  const matrix = await backendFetch<MatrixOut>(
    `/api/eai/impact-matrices/${study.impactMatrixId}`
  ).catch(() => null);

  if (!matrix) return notFound();

  const isEditable = EDITABLE_STATUSES.includes(study.status);

  return (
    <div>
      <PageHeader
        title={`Entry #${entry.sequenceNumber}`}
        description={`v${entry.versionNumber} · ${entry.status.replace(/_/g, " ")}`}
        breadcrumbs={[
          { label: "EAI", href: "/eai" },
          { label: study.number, href: `/eai/${study.id}` },
          { label: `Entry #${entry.sequenceNumber}` }
        ]}
      />

      <EntryEditor
        entry={entry}
        matrix={matrix}
        aspects={aspects}
        categories={categories}
        receptors={receptors}
        isEditable={isEditable}
        plantId={study.plantId}
      />
    </div>
  );
}
