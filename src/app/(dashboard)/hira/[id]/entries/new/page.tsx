import { notFound } from "next/navigation";
import { backendFetch, BackendError } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { EntryCreateForm } from "./entry-create-form";

export const dynamic = "force-dynamic";

type EntryWizardOptions = {
  studyStatus: string;
  matrix: {
    id: string;
    code: string;
    name: string;
    likelihoodLevels: number;
    severityLevels: number;
    acceptableResidual: Record<string, string>;
    controlHierarchyEnforced: boolean;
    likelihoods: { id: string; score: number; label: string; description: string; frequencyGuidance: string | null }[];
    severities: { id: string; score: number; label: string; description: string }[];
    cells: {
      likelihoodScore: number;
      severityScore: number;
      riskScore: number;
      riskLevel: string;
      colorHex: string;
      actionRequired: string;
      responseTimeDays: number;
    }[];
  };
  hazards: {
    id: string;
    code: string;
    category: string;
    subcategory: string | null;
    name: string;
    description: string;
    typicalHarmPotential: string[];
    typicalAffectedPersons: string[];
    energyForm: string | null;
  }[];
  areas: { id: string; name: string }[];
};

type StudyOut = { id: string; number: string; title: string; status: string };

export default async function NewHiraEntryPage(
  props: { params: Promise<{ id: string }> }
) {
  await requirePermission("HIRA.UPDATE");
  const { id: studyId } = await props.params;

  let opts: EntryWizardOptions;
  let study: StudyOut;
  try {
    [opts, study] = await Promise.all([
      backendFetch<EntryWizardOptions>("/api/hira/wizard/entry-options", {
        query: { studyId }
      }),
      backendFetch<StudyOut>(`/api/hira/studies/${studyId}`)
    ]);
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  if (!["DRAFT", "IN_PROGRESS"].includes(opts.studyStatus)) {
    return (
      <div>
        <PageHeader title="Add Entry" description={`${study.number} — ${study.title}`} />
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          This study is in status <strong>{opts.studyStatus}</strong>. New entries can only be added to studies in DRAFT or IN_PROGRESS.
          To revise an approved study, initiate a review cycle.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={`Add Entry — ${study.number}`} description={study.title} />
      <EntryCreateForm
        studyId={studyId}
        areas={opts.areas}
        matrix={opts.matrix}
        hazards={opts.hazards}
      />
    </div>
  );
}
