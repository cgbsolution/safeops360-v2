import { notFound } from "next/navigation";
import { backendFetch } from "@/lib/backend/fetch";
import { getPlants } from "@/lib/masters/plants";
import { PageHeader } from "@/components/page-header";
import { ProgramForm } from "../../program-form";
import { requirePermission } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function EditTrainingProgramPage(props: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("TRAINING.UPDATE");
  const params = await props.params;

  const [program, plants] = await Promise.all([
    backendFetch<any>(`/api/training/programs/${params.id}`).catch(() => null),
    getPlants()
  ]);
  if (!program) return notFound();

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={`Edit ${program.programName ?? program.name}`}
        description="Safety-sensitive changes (passing score, validity, mandatory mappings, SafeOps gates) flip an APPROVED program back to UNDER_REVIEW."
        breadcrumbs={[
          { label: "Training", href: "/training" },
          { label: "Programs", href: "/training/programs" },
          { label: program.programCode ?? program.code, href: `/training/programs/${program.id}` },
          { label: "Edit" }
        ]}
      />
      <ProgramForm
        plants={plants}
        initial={{
          id: program.id,
          programCode: program.programCode ?? program.code,
          programName: program.programName ?? program.name,
          description: program.description ?? "",
          category: program.category ?? "TECHNICAL",
          type: program.type ?? "CLASSROOM",
          ownerId: program.ownerId,
          plantId: program.plantId,
          isStatutory: program.isStatutory,
          statutoryReference: program.statutoryReference ?? "",
          isMandatoryForRoles: program.isMandatoryForRoles ?? [],
          isMandatoryForActivities: program.isMandatoryForActivities ?? [],
          isMandatoryForPermitTypes: program.isMandatoryForPermitTypes ?? [],
          durationHours: program.durationHours,
          durationSessions: program.durationSessions,
          maxParticipantsPerBatch: program.maxParticipantsPerBatch,
          language: program.language ?? [],
          prerequisitePrograms: program.prerequisitePrograms ?? [],
          prerequisiteRoles: program.prerequisiteRoles ?? [],
          minimumExperienceMonths: program.minimumExperienceMonths,
          medicalFitnessRequired: program.medicalFitnessRequired,
          hasAssessment: program.hasAssessment,
          assessmentType: program.assessmentType,
          passingScorePercent: program.passingScorePercent,
          practicalAssessmentRubric: program.practicalAssessmentRubric ?? "",
          attemptsAllowed: program.attemptsAllowed,
          issuesCertificate: program.issuesCertificate,
          certificateTemplateUrl: program.certificateTemplateUrl ?? "",
          certificateValidityMonths: program.certificateValidityMonths,
          certificateExpiryGracePeriodDays: program.certificateExpiryGracePeriodDays,
          refresherProgramCode: program.refresherProgramCode ?? "",
          learningObjectives: program.learningObjectives ?? [],
          approvedTrainerIds: program.approvedTrainerIds ?? [],
          externalTrainerAllowed: program.externalTrainerAllowed,
          trainerQualifications: program.trainerQualifications ?? "",
          evaluatesEffectiveness: program.evaluatesEffectiveness,
          effectivenessReviewMonths: program.effectivenessReviewMonths,
          blocksPtwIfMissing: program.blocksPtwIfMissing,
          blocksRoleAssignmentIfMissing: program.blocksRoleAssignmentIfMissing,
          blocksContractorOnboardingIfMissing: program.blocksContractorOnboardingIfMissing
        }}
      />
    </div>
  );
}
