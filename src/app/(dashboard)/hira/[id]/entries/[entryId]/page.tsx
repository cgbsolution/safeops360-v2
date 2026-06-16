import { notFound } from "next/navigation";
import Link from "next/link";
import { backendFetch, BackendError } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { EntryEditor } from "./entry-editor";

export const dynamic = "force-dynamic";

type EntryOut = {
  id: string;
  studyId: string;
  sequenceNumber: number;
  groupLabel: string | null;
  activityDescription: string;
  routine: string;
  frequency: string;
  typicalDurationMin: number | null;
  subLocation: string | null;
  areaId: string | null;
  personsEmployees: number;
  personsContractors: number;
  personsVisitors: number;
  personsPublic: number;
  affectedPersonGroups: string | null;
  equipmentUsed: string[] | null;
  materialsUsed: string[] | null;
  energySourcesPresent: string[] | null;
  initialLikelihoodId: string;
  initialLikelihoodScore: number;
  initialLikelihoodRationale: string | null;
  initialSeverityId: string;
  initialSeverityScore: number;
  initialSeverityRationale: string | null;
  initialRiskScore: number;
  initialRiskLevel: string;
  initialRiskColor: string | null;
  residualLikelihoodId: string | null;
  residualLikelihoodScore: number | null;
  residualLikelihoodRationale: string | null;
  residualSeverityId: string | null;
  residualSeverityScore: number | null;
  residualSeverityRationale: string | null;
  residualRiskScore: number | null;
  residualRiskLevel: string | null;
  residualRiskColor: string | null;
  residualAcceptable: boolean | null;
  residualAcceptanceRationale: string | null;
  status: string;
  versionNumber: number;
  triggersTrainingProgramIds: string[] | null;
  triggersInspectionTypeIds: string[] | null;
  influencesPtwRiskLevel: boolean;
  influencesPtwPermitTypes: string[] | null;
  linkedEmergencyProcIds: string[] | null;
  linkedEnvironmentalAspects: string[] | null;
  lastReviewedAt: string | null;
  nextReviewDue: string | null;
  reviewCount: number;
  lastReviewType: string | null;
  hazards: {
    id: string;
    hazardId: string;
    contextualDescription: string | null;
    consequence: string | null;
    sortOrder: number;
    hazardCode: string | null;
    hazardCategory: string | null;
    hazardName: string | null;
  }[];
  existingControls: {
    id: string;
    controlId: string | null;
    hierarchy: string;
    description: string;
    effectiveness: string | null;
    verificationMethod: string | null;
    verificationFreq: string | null;
    responsibleRole: string | null;
    evidenceAttached: boolean;
    documentReference: string | null;
    sortOrder: number;
  }[];
  recommendedControls: {
    id: string;
    hierarchy: string;
    description: string;
    rationale: string | null;
    estimatedCostBand: string | null;
    proposedImplementationDate: string | null;
    responsibleId: string | null;
    status: string;
    capaId: string | null;
  }[];
  regulationRefs: {
    id: string;
    regulation: string;
    section: string | null;
    requirementSummary: string | null;
  }[];
};

type StudyOut = {
  id: string;
  number: string;
  title: string;
  status: string;
  riskMatrixId: string;
  plantId: string;
};

type MatrixOut = {
  id: string;
  acceptableResidual: Record<string, string>;
  likelihoods: { id: string; score: number; label: string; description: string }[];
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

type Control = { id: string; code: string; hierarchy: string; description: string };

type Version = { id: string; versionNumber: number };

export default async function HiraEntryDetailPage(
  props: { params: Promise<{ id: string; entryId: string }> }
) {
  const { id: studyId, entryId } = await props.params;

  let entry: EntryOut;
  let study: StudyOut;
  let versions: Version[];
  try {
    [entry, study, versions] = await Promise.all([
      backendFetch<EntryOut>(`/api/hira/entries/${entryId}`),
      backendFetch<StudyOut>(`/api/hira/studies/${studyId}`),
      backendFetch<Version[]>(`/api/hira/entries/${entryId}/versions`)
    ]);
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }
  if (entry.studyId !== studyId) notFound();

  let matrix: MatrixOut;
  let controlLibrary: Control[];
  let capas: { id: string; number: string; description: string; status: string }[];
  try {
    [matrix, controlLibrary, capas] = await Promise.all([
      backendFetch<MatrixOut>(`/api/hira/risk-matrices/${study.riskMatrixId}`),
      backendFetch<Control[]>("/api/hira/controls"),
      backendFetch<{ id: string; number: string; description: string; status: string }[]>(
        `/api/hira/entries/${entryId}/capas`
      ).catch(() => [])
    ]);
  } catch {
    throw new Error("Failed to load study configuration");
  }

  let areaName = "";
  if (entry.areaId) {
    try {
      const area = await backendFetch<{ id: string; name: string }>(`/api/hira/areas/${entry.areaId}`);
      areaName = area.name;
    } catch {
      areaName = entry.areaId;
    }
  }

  const isEditable = ["DRAFT", "IN_PROGRESS"].includes(study.status);

  // Shape the entry for the EntryEditor client component
  const editorEntry = {
    ...entry,
    equipmentUsed: entry.equipmentUsed ?? [],
    materialsUsed: entry.materialsUsed ?? [],
    energySourcesPresent: entry.energySourcesPresent ?? [],
    triggersTrainingProgramIds: entry.triggersTrainingProgramIds ?? [],
    triggersInspectionTypeIds: entry.triggersInspectionTypeIds ?? [],
    influencesPtwPermitTypes: entry.influencesPtwPermitTypes ?? [],
    linkedEmergencyProcIds: entry.linkedEmergencyProcIds ?? [],
    linkedEnvironmentalAspects: entry.linkedEnvironmentalAspects ?? [],
    lastReviewedAt: entry.lastReviewedAt ? new Date(entry.lastReviewedAt) : null,
    nextReviewDue: entry.nextReviewDue ? new Date(entry.nextReviewDue) : null,
    area: entry.areaId ? { id: entry.areaId, name: areaName } : null,
    initialLikelihood: matrix.likelihoods.find((l) => l.id === entry.initialLikelihoodId) ?? null,
    initialSeverity: matrix.severities.find((s) => s.id === entry.initialSeverityId) ?? null,
    hazards: entry.hazards.map((h) => ({
      id: h.id,
      hazardId: h.hazardId,
      contextualDescription: h.contextualDescription,
      consequence: h.consequence,
      hazard: {
        id: h.hazardId,
        code: h.hazardCode ?? "",
        category: h.hazardCategory ?? "",
        name: h.hazardName ?? h.hazardId
      }
    })),
    recommendedControls: entry.recommendedControls.map((c) => ({
      ...c,
      proposedImplementationDate: c.proposedImplementationDate ? new Date(c.proposedImplementationDate) : null,
      responsibleId: c.responsibleId
    })),
    capas: capas,
    study: { riskMatrixId: study.riskMatrixId }
  };

  return (
    <div>
      <PageHeader
        title={`Entry #${entry.sequenceNumber} — ${entry.activityDescription.slice(0, 80)}${entry.activityDescription.length > 80 ? "…" : ""}`}
        description={`${study.number} — ${study.title} · v${entry.versionNumber}`}
        breadcrumbs={[
          { label: "HIRA", href: "/hira" },
          { label: study.number, href: `/hira/${studyId}` },
          { label: `Entry #${entry.sequenceNumber}` }
        ]}
        action={
          versions.length > 0 ? (
            <Link
              href={`/hira/${studyId}/entries/${entryId}/history`}
              className="text-sm text-primary-700 hover:underline"
            >
              History ({versions.length} versions)
            </Link>
          ) : null
        }
      />

      {!isEditable && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          Study is in status <strong>{study.status}</strong>. Edits create a new version and require a change reason.
        </div>
      )}

      <EntryEditor
        entry={editorEntry}
        matrix={{
          likelihoods: matrix.likelihoods,
          severities: matrix.severities,
          cells: matrix.cells,
          acceptableResidual: matrix.acceptableResidual
        }}
        controlLibrary={controlLibrary}
        requireChangeReason={!isEditable}
      />
    </div>
  );
}
