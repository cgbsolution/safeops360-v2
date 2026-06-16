import Link from "next/link";
import { notFound } from "next/navigation";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { ChevronLeft } from "lucide-react";
import { EaiEntryCreateForm } from "./entry-create-form";

export const dynamic = "force-dynamic";

type StudyOut = {
  id: string;
  number: string;
  title: string;
  plantId: string;
  status: string;
  impactMatrixId: string;
};

type MatrixLevel = {
  id: string;
  score: number;
  label: string;
  description: string;
};

type MatrixOut = {
  id: string;
  name: string;
  likelihoodLevels: number;
  magnitudeLevels: number;
  likelihoods: MatrixLevel[];
  magnitudes: MatrixLevel[];
};

type AspectOut = {
  id: string;
  code: string;
  categoryId: string;
  name: string;
  typicallySignificant: boolean;
};

type CategoryOut = { id: string; code: string; name: string; sortOrder: number };
type ReceptorOut = { id: string; code: string; name: string };

export default async function EaiNewEntryPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const study = await backendFetch<StudyOut>(`/api/eai/studies/${id}`).catch(
    () => null
  );
  if (!study) return notFound();

  const [matrix, aspects, categories, receptors] = await Promise.all([
    backendFetch<MatrixOut>(`/api/eai/impact-matrices/${study.impactMatrixId}`).catch(
      () => null
    ),
    backendFetch<AspectOut[]>("/api/eai/aspects", { query: { limit: 500 } }).catch(
      () => [] as AspectOut[]
    ),
    backendFetch<CategoryOut[]>("/api/eai/aspect-categories").catch(
      () => [] as CategoryOut[]
    ),
    backendFetch<ReceptorOut[]>("/api/eai/receptors").catch(() => [] as ReceptorOut[])
  ]);

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href={`/eai/${study.id}`}
        className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline mb-3"
      >
        <ChevronLeft size={14} /> Back to study
      </Link>

      <PageHeader
        title="Add EAI Entry"
        description={`${study.number} — identify an activity's environmental aspects, impacts and controls`}
      />

      {!matrix ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          The study&apos;s impact matrix could not be loaded, so scoring is
          unavailable. Check that the study&apos;s impact matrix still exists.
        </div>
      ) : (
        <EaiEntryCreateForm
          studyId={study.id}
          matrix={matrix}
          aspects={aspects ?? []}
          categories={categories ?? []}
          receptors={receptors ?? []}
        />
      )}
    </div>
  );
}
