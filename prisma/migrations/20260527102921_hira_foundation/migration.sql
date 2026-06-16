/*
  Warnings:

  - A unique constraint covering the columns `[sourceNearMissId]` on the table `Incident` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[programCode]` on the table `TrainingProgram` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "InspectionTypeCategory" AS ENUM ('ROUTINE', 'STATUTORY', 'PRE_OPERATIONAL', 'POST_INCIDENT', 'CONDITION_BASED', 'THIRD_PARTY', 'FOCUSED');

-- CreateEnum
CREATE TYPE "ChecklistItemType" AS ENUM ('PASS_FAIL', 'NUMERIC', 'MEASUREMENT', 'SELECT', 'TEXT', 'PHOTO', 'SIGNATURE', 'CHECKBOX', 'SECTION_HEADER');

-- CreateEnum
CREATE TYPE "ChecklistItemResultStatus" AS ENUM ('PASS', 'FAIL', 'MARGINAL', 'NA', 'OBSERVATION', 'PENDING');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'IN_PROGRESS', 'DEFERRED', 'DUPLICATE', 'CLOSED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "FindingCapaType" AS ENUM ('CORRECTION', 'CORRECTIVE_ACTION', 'PREVENTIVE_ACTION');

-- CreateEnum
CREATE TYPE "FindingCapaStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'OVERDUE', 'REJECTED');

-- AlterEnum
ALTER TYPE "IncidentType" ADD VALUE 'PROCESS_SAFETY';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InspectionStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "InspectionStatus" ADD VALUE 'DEFERRED';

-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN     "commissioningDate" TIMESTAMP(3),
ADD COLUMN     "criticality" TEXT,
ADD COLUMN     "decommissionDate" TIMESTAMP(3),
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "lastInspectionDate" TIMESTAMP(3),
ADD COLUMN     "make" TEXT,
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "modelNumber" TEXT,
ADD COLUMN     "nextInspectionDue" TIMESTAMP(3),
ADD COLUMN     "serialNumber" TEXT,
ADD COLUMN     "statutoryRegistrationNumber" TEXT,
ADD COLUMN     "subCategory" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "FLRA" ADD COLUMN     "areaCode" TEXT,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "emergencyContactsConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "exitRoutesIdentified" TEXT,
ADD COLUMN     "gpsLatitude" DOUBLE PRECISION,
ADD COLUMN     "gpsLongitude" DOUBLE PRECISION,
ADD COLUMN     "isStandalone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "jobIsRoutine" BOOLEAN,
ADD COLUMN     "ppeChecklistResponses" JSONB,
ADD COLUMN     "specificLocation" TEXT,
ADD COLUMN     "startTime" TIMESTAMP(3),
ADD COLUMN     "toolboxTalkConducted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "toolboxTalkConductedAt" TIMESTAMP(3),
ADD COLUMN     "toolboxTalkLanguage" TEXT,
ADD COLUMN     "toolboxTalkTopics" JSONB,
ADD COLUMN     "toolsCheckedResponses" JSONB;

-- AlterTable
ALTER TABLE "FLRACrewSignature" ADD COLUMN     "refusalEscalatedAt" TIMESTAMP(3),
ADD COLUMN     "refusalEscalatedToId" TEXT,
ADD COLUMN     "refusalReason" TEXT,
ADD COLUMN     "refusedToSign" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "activePermitId" TEXT,
ADD COLUMN     "activityBeingPerformed" TEXT,
ADD COLUMN     "activityIsRoutine" BOOLEAN,
ADD COLUMN     "capaSlaTargetAt" TIMESTAMP(3),
ADD COLUMN     "classificationRationale" TEXT,
ADD COLUMN     "classificationSlaTargetAt" TIMESTAMP(3),
ADD COLUMN     "classifiedAt" TIMESTAMP(3),
ADD COLUMN     "classifiedById" TEXT,
ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "closingRemark" TEXT,
ADD COLUMN     "contractorScoreImpact" JSONB,
ADD COLUMN     "contributingFactors" TEXT[],
ADD COLUMN     "corporateHseApprovedAt" TIMESTAMP(3),
ADD COLUMN     "corporateHseApprovedById" TEXT,
ADD COLUMN     "costInsurance" DECIMAL(14,2),
ADD COLUMN     "costLegalRegulatory" DECIMAL(14,2),
ADD COLUMN     "costLostProduction" DECIMAL(14,2),
ADD COLUMN     "costMedical" DECIMAL(14,2),
ADD COLUMN     "costOther" DECIMAL(14,2),
ADD COLUMN     "costPropertyDamage" DECIMAL(14,2),
ADD COLUMN     "costTotal" DECIMAL(14,2),
ADD COLUMN     "cpcbSubmissionDate" TIMESTAMP(3),
ADD COLUMN     "cpcbSubmitted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "dgfasliSubmissionDate" TIMESTAMP(3),
ADD COLUMN     "dgfasliSubmitted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "effectivenessNotes" TEXT,
ADD COLUMN     "effectivenessRating" INTEGER,
ADD COLUMN     "effectivenessReviewDueAt" TIMESTAMP(3),
ADD COLUMN     "effectivenessReviewedAt" TIMESTAMP(3),
ADD COLUMN     "effectivenessReviewedById" TEXT,
ADD COLUMN     "form18PreparedAt" TIMESTAMP(3),
ADD COLUMN     "form18PreparedById" TEXT,
ADD COLUMN     "form18SubmissionDate" TIMESTAMP(3),
ADD COLUMN     "form18SubmissionRef" TEXT,
ADD COLUMN     "form18Submitted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gpsLatitude" DOUBLE PRECISION,
ADD COLUMN     "gpsLongitude" DOUBLE PRECISION,
ADD COLUMN     "hseManagerApprovedAt" TIMESTAMP(3),
ADD COLUMN     "hseManagerApprovedById" TEXT,
ADD COLUMN     "immediateAction" TEXT,
ADD COLUMN     "immediateCauses" TEXT[],
ADD COLUMN     "initialDescription" TEXT,
ADD COLUMN     "initialReportSlaTargetAt" TIMESTAMP(3),
ADD COLUMN     "internalNotificationsSent" JSONB,
ADD COLUMN     "investigationCharterDate" TIMESTAMP(3),
ADD COLUMN     "investigationReportSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "investigationSlaTargetAt" TIMESTAMP(3),
ADD COLUMN     "investigationTeamLead" TEXT,
ADD COLUMN     "isReportable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lessonsDistributedTo" JSONB,
ADD COLUMN     "lessonsLearned" TEXT,
ADD COLUMN     "linkedIncidentIds" TEXT[],
ADD COLUMN     "linkedNearMissIds" TEXT[],
ADD COLUMN     "linkedObservationIds" TEXT[],
ADD COLUMN     "occurredAt" TIMESTAMP(3),
ADD COLUMN     "plantHeadApprovedAt" TIMESTAMP(3),
ADD COLUMN     "plantHeadApprovedById" TEXT,
ADD COLUMN     "reportableUnder" JSONB,
ADD COLUMN     "reportedAt" TIMESTAMP(3),
ADD COLUMN     "reporterRole" TEXT,
ADD COLUMN     "reportingDelayMinutes" INTEGER,
ADD COLUMN     "rootCauses" TEXT[],
ADD COLUMN     "severity" TEXT,
ADD COLUMN     "shiftId" TEXT,
ADD COLUMN     "sourceNearMissId" TEXT,
ADD COLUMN     "specificLocation" TEXT,
ADD COLUMN     "statutoryDeadline" TIMESTAMP(3),
ADD COLUMN     "triggeredCapaIds" TEXT[],
ADD COLUMN     "triggeredTrainingFor" TEXT[],
ADD COLUMN     "triggeredTrainingKeywords" TEXT[],
ADD COLUMN     "underlyingCauses" TEXT[],
ADD COLUMN     "weatherConditions" TEXT;

-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "checklistTemplateId" TEXT,
ADD COLUMN     "checklistTemplateVersion" INTEGER,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "deferredAt" TIMESTAMP(3),
ADD COLUMN     "deferredById" TEXT,
ADD COLUMN     "deferredReason" TEXT,
ADD COLUMN     "deferredUntil" TIMESTAMP(3),
ADD COLUMN     "equipmentInspectionTypeId" TEXT,
ADD COLUMN     "inspectionTypeId" TEXT,
ADD COLUMN     "inspectorSignature" TEXT,
ADD COLUMN     "inspectorSignedAt" TIMESTAMP(3),
ADD COLUMN     "isStatutory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pdfUrl" TEXT,
ADD COLUMN     "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rescheduleReason" TEXT,
ADD COLUMN     "rescheduledFromInspectionId" TEXT,
ADD COLUMN     "reviewerId" TEXT,
ADD COLUMN     "reviewerSignature" TEXT,
ADD COLUMN     "reviewerSignedAt" TIMESTAMP(3),
ADD COLUMN     "statutoryFormAcknowledgmentNumber" TEXT,
ADD COLUMN     "statutoryFormSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "statutoryFormType" TEXT,
ADD COLUMN     "triggeredByIncidentId" TEXT,
ADD COLUMN     "triggeredByIncidentType" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "NearMiss" ADD COLUMN     "activePermitId" TEXT,
ADD COLUMN     "activityBeingPerformed" TEXT,
ADD COLUMN     "activityIsRoutine" BOOLEAN,
ADD COLUMN     "autoPromoteToIncident" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "closingRemark" TEXT,
ADD COLUMN     "closureTriggers" JSONB,
ADD COLUMN     "contractorCompanyId" TEXT,
ADD COLUMN     "controlsThatFailed" TEXT,
ADD COLUMN     "controlsThatWorked" TEXT,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "effectivenessRating" INTEGER,
ADD COLUMN     "energySource" TEXT,
ADD COLUMN     "equipmentId" TEXT,
ADD COLUMN     "gpsLatitude" DOUBLE PRECISION,
ADD COLUMN     "gpsLongitude" DOUBLE PRECISION,
ADD COLUMN     "hazardCategory" TEXT,
ADD COLUMN     "initialRootCauseCategory" TEXT,
ADD COLUMN     "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isRepeat" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lessonsDistributedTo" JSONB,
ADD COLUMN     "lessonsLearned" TEXT,
ADD COLUMN     "multipleWorkersAggravator" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permitReviewFlagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "potentialConsequences" JSONB,
ADD COLUMN     "promotedAt" TIMESTAMP(3),
ADD COLUMN     "recommendedActions" TEXT,
ADD COLUMN     "refinedRootCauseCategory" TEXT,
ADD COLUMN     "relatedObservationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reporterType" TEXT,
ADD COLUMN     "reviewByHseManagerAt" TIMESTAMP(3),
ADD COLUMN     "reviewByHseManagerId" TEXT,
ADD COLUMN     "reviewBySectionHeadAt" TIMESTAMP(3),
ADD COLUMN     "reviewBySectionHeadId" TEXT,
ADD COLUMN     "reviewerNotes" TEXT,
ADD COLUMN     "riskConsequence" INTEGER,
ADD COLUMN     "riskLevel" TEXT,
ADD COLUMN     "riskLikelihood" INTEGER,
ADD COLUMN     "riskScore" INTEGER,
ADD COLUMN     "shiftId" TEXT,
ADD COLUMN     "similarNearMissIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "slaActualClosedAt" TIMESTAMP(3),
ADD COLUMN     "slaPerformance" TEXT,
ADD COLUMN     "slaTargetAt" TIMESTAMP(3),
ADD COLUMN     "specificLocation" TEXT,
ADD COLUMN     "suggestedActionOwnerId" TEXT,
ADD COLUMN     "triggeredCapaId" TEXT,
ADD COLUMN     "triggeredInspectionId" TEXT,
ADD COLUMN     "triggeredPermitFlagId" TEXT,
ADD COLUMN     "triggeredTbtId" TEXT,
ADD COLUMN     "verificationMethod" TEXT,
ADD COLUMN     "verificationNotes" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT,
ALTER COLUMN "location" DROP NOT NULL,
ALTER COLUMN "potentialConsequence" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Observation" ADD COLUMN     "activePermitId" TEXT,
ADD COLUMN     "closureTriggers" JSONB,
ADD COLUMN     "contributedToIncidentId" TEXT,
ADD COLUMN     "isRepeat" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permitReviewFlagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "riskConsequence" INTEGER,
ADD COLUMN     "riskLevel" TEXT,
ADD COLUMN     "riskLikelihood" INTEGER,
ADD COLUMN     "riskScore" INTEGER,
ADD COLUMN     "similarObservationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "triggeredCapaId" TEXT,
ADD COLUMN     "triggeredInspectionId" TEXT,
ADD COLUMN     "triggeredTbtId" TEXT;

-- AlterTable
ALTER TABLE "Permit" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "activatedById" TEXT,
ADD COLUMN     "adjacentAreaNotifications" JSONB,
ADD COLUMN     "attachedDrawingIds" TEXT[],
ADD COLUMN     "autoExpiredAt" TIMESTAMP(3),
ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "closingRemark" TEXT,
ADD COLUMN     "conflictingPermitIds" TEXT[],
ADD COLUMN     "currentActiveFlraId" TEXT,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "expirationReason" TEXT,
ADD COLUMN     "fireWatchPersonId" TEXT,
ADD COLUMN     "gpsLatitude" DOUBLE PRECISION,
ADD COLUMN     "gpsLongitude" DOUBLE PRECISION,
ADD COLUMN     "isCurrentlySuspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "returnNotes" TEXT,
ADD COLUMN     "returnPhotos" JSONB,
ADD COLUMN     "returnedAt" TIMESTAMP(3),
ADD COLUMN     "returnedById" TEXT,
ADD COLUMN     "siteVerificationChecklist" JSONB,
ADD COLUMN     "siteVerificationPhotos" JSONB,
ADD COLUMN     "siteVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "siteVerifiedById" TEXT,
ADD COLUMN     "specificLocation" TEXT,
ADD COLUMN     "standbyPersonId" TEXT,
ADD COLUMN     "triggeredIncidentId" TEXT,
ADD COLUMN     "triggeredObservations" TEXT[],
ADD COLUMN     "validityHours" INTEGER,
ADD COLUMN     "weatherConditionsAtIssue" TEXT,
ADD COLUMN     "windSpeedKmh" DOUBLE PRECISION,
ADD COLUMN     "workOrderNumber" TEXT,
ADD COLUMN     "workflowDefinitionCode" TEXT;

-- AlterTable
ALTER TABLE "PermitCrewMember" ADD COLUMN     "contractorActiveAtIssuance" BOOLEAN DEFAULT false,
ADD COLUMN     "medicalValidAtIssuance" BOOLEAN DEFAULT false,
ADD COLUMN     "removalReason" TEXT,
ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "trainingValidAtIssuance" BOOLEAN DEFAULT false,
ADD COLUMN     "trainingValidationNotes" TEXT;

-- AlterTable
ALTER TABLE "TrainingProgram" ADD COLUMN     "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "approvedTrainerIds" TEXT[],
ADD COLUMN     "assessmentType" TEXT,
ADD COLUMN     "attemptsAllowed" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "blocksContractorOnboardingIfMissing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "blocksPtwIfMissing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "blocksRoleAssignmentIfMissing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "certificateExpiryGracePeriodDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "certificateTemplateUrl" TEXT,
ADD COLUMN     "certificateValidityMonths" INTEGER,
ADD COLUMN     "contentOutline" JSONB,
ADD COLUMN     "durationSessions" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "effectiveFrom" TIMESTAMP(3),
ADD COLUMN     "effectiveTo" TIMESTAMP(3),
ADD COLUMN     "effectivenessReviewMonths" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "evaluatesEffectiveness" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "externalTrainerAllowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "feedbackQuestionnaireId" TEXT,
ADD COLUMN     "hasAssessment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isMandatoryForActivities" TEXT[],
ADD COLUMN     "isMandatoryForPermitTypes" TEXT[],
ADD COLUMN     "isMandatoryForRoles" TEXT[],
ADD COLUMN     "isStatutory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "issuesCertificate" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "language" TEXT[],
ADD COLUMN     "lastReviewedAt" TIMESTAMP(3),
ADD COLUMN     "learningObjectives" TEXT[],
ADD COLUMN     "maxParticipantsPerBatch" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "medicalFitnessRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "minimumExperienceMonths" INTEGER,
ADD COLUMN     "nextReviewAt" TIMESTAMP(3),
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "passingScorePercent" INTEGER DEFAULT 70,
ADD COLUMN     "plantId" TEXT,
ADD COLUMN     "practicalAssessmentRubric" TEXT,
ADD COLUMN     "prerequisitePrograms" TEXT[],
ADD COLUMN     "prerequisiteRoles" TEXT[],
ADD COLUMN     "programCode" TEXT,
ADD COLUMN     "programName" TEXT,
ADD COLUMN     "refresherProgramCode" TEXT,
ADD COLUMN     "reviewFrequencyMonths" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "statutoryReference" TEXT,
ADD COLUMN     "trainerQualifications" TEXT,
ADD COLUMN     "type" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "durationHours" SET DEFAULT 4,
ALTER COLUMN "durationHours" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "WorkflowStep" ADD COLUMN     "parallelStrategy" TEXT,
ADD COLUMN     "slaBySeverity" JSONB;

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "contactPerson" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "score" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterItem" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachingTask" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceObservationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "completionRemark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anomaly" (
    "id" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detectorId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "plantId" TEXT,
    "category" TEXT,
    "area" TEXT,
    "personId" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'WARNING',
    "signalData" JSONB NOT NULL,
    "description" TEXT NOT NULL,
    "contributingRecordIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "fingerprint" TEXT,
    "emailNotifiedAt" TIMESTAMP(3),

    CONSTRAINT "Anomaly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NearMissPersonInvolved" (
    "id" TEXT NOT NULL,
    "nearMissId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,

    CONSTRAINT "NearMissPersonInvolved_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NearMissPersonAffected" (
    "id" TEXT NOT NULL,
    "nearMissId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "proximityToHazard" TEXT,

    CONSTRAINT "NearMissPersonAffected_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NearMissWitness" (
    "id" TEXT NOT NULL,
    "nearMissId" TEXT NOT NULL,
    "witnessId" TEXT NOT NULL,
    "statementCaptured" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NearMissWitness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NearMissCapa" (
    "id" TEXT NOT NULL,
    "nearMissId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "evidenceUrl" TEXT,
    "evidenceDescription" TEXT,
    "completionNotes" TEXT,
    "completedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "reworkRound" INTEGER NOT NULL DEFAULT 0,
    "workflowTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NearMissCapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NearMissAttachment" (
    "id" TEXT NOT NULL,
    "nearMissId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "caption" TEXT,
    "exifData" JSONB,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "NearMissAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NearMissComment" (
    "id" TEXT NOT NULL,
    "nearMissId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NearMissComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermitIsolation" (
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "isolationType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isolationPointTag" TEXT NOT NULL,
    "lotoTagNumber" TEXT,
    "isolationVerifiedAt" TIMESTAMP(3),
    "isolationVerifiedById" TEXT,
    "restoredAt" TIMESTAMP(3),
    "restoredById" TEXT,

    CONSTRAINT "PermitIsolation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermitToolEquipment" (
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "freeTextDescription" TEXT,
    "inspectionCurrentAtIssuance" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PermitToolEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermitSubjectEquipment" (
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "workNature" TEXT NOT NULL,

    CONSTRAINT "PermitSubjectEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermitGasTestPlan" (
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "refreshFrequencyMinutes" INTEGER NOT NULL,
    "parametersToTest" JSONB NOT NULL,
    "instrumentSerial" TEXT,
    "instrumentLastCalibrated" TIMESTAMP(3),

    CONSTRAINT "PermitGasTestPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermitGasTestReading" (
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT NOT NULL,
    "readings" JSONB NOT NULL,
    "isExceedance" BOOLEAN NOT NULL DEFAULT false,
    "exceedanceAction" TEXT,
    "instrumentSerial" TEXT,
    "isPreEntry" BOOLEAN NOT NULL DEFAULT false,
    "refreshDueBy" TIMESTAMP(3),

    CONSTRAINT "PermitGasTestReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermitApproval" (
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comments" TEXT,
    "conditions" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermitApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermitSuspension" (
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "suspendedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspendedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reasonDetail" TEXT,
    "resumedAt" TIMESTAMP(3),
    "resumedById" TEXT,
    "resumptionConditions" TEXT,
    "reFlraRequired" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PermitSuspension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermitExtension" (
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedById" TEXT NOT NULL,
    "newValidTo" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approverComments" TEXT,
    "status" TEXT NOT NULL,

    CONSTRAINT "PermitExtension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermitAttachment" (
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "caption" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PermitAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermitComment" (
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermitComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FLRAJobStep" (
    "id" TEXT NOT NULL,
    "flraId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "stepDescription" TEXT NOT NULL,

    CONSTRAINT "FLRAJobStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FLRAStepHazard" (
    "id" TEXT NOT NULL,
    "jobStepId" TEXT NOT NULL,
    "hazardDescription" TEXT NOT NULL,
    "hazardCategory" TEXT NOT NULL,
    "energySource" TEXT,
    "initialLikelihood" INTEGER NOT NULL,
    "initialSeverity" INTEGER NOT NULL,
    "initialRiskScore" INTEGER NOT NULL,
    "initialRiskLevel" TEXT NOT NULL,
    "controlMeasures" TEXT NOT NULL,
    "residualLikelihood" INTEGER NOT NULL,
    "residualSeverity" INTEGER NOT NULL,
    "residualRiskScore" INTEGER NOT NULL,
    "residualRiskLevel" TEXT NOT NULL,

    CONSTRAINT "FLRAStepHazard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FLRAFitnessDeclaration" (
    "id" TEXT NOT NULL,
    "flraId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isFit" BOOLEAN NOT NULL,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasMedicalCondition" BOOLEAN NOT NULL DEFAULT false,
    "conditionsDeclared" TEXT,
    "hadAdequateRest" BOOLEAN NOT NULL,
    "underInfluenceCheck" BOOLEAN NOT NULL,
    "notes" TEXT,

    CONSTRAINT "FLRAFitnessDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FLRAAttachment" (
    "id" TEXT NOT NULL,
    "flraId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "caption" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FLRAAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentPerson" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "userId" TEXT,
    "externalName" TEXT,
    "externalContact" TEXT,
    "role" TEXT NOT NULL,
    "isContractor" BOOLEAN NOT NULL DEFAULT false,
    "contractorCompanyId" TEXT,
    "isInjured" BOOLEAN NOT NULL DEFAULT false,
    "bodyPartAffected" TEXT,
    "natureOfInjury" TEXT,
    "injurySeverity" TEXT,
    "treatment" TEXT,
    "hospitalName" TEXT,
    "daysOff" INTEGER,
    "daysRestricted" INTEGER,
    "returnToWorkDate" TIMESTAMP(3),
    "isFitForDuty" BOOLEAN,
    "ppeWornAtTime" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentReclassification" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "fromType" TEXT NOT NULL,
    "toType" TEXT NOT NULL,
    "fromSeverity" TEXT,
    "toSeverity" TEXT,
    "reason" TEXT NOT NULL,
    "reclassifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reclassifiedById" TEXT NOT NULL,
    "triggersStatutoryUpdate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "IncidentReclassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentTimelineEvent" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceReference" TEXT,

    CONSTRAINT "IncidentTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentEvidence" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "collectedById" TEXT,
    "collectedAt" TIMESTAMP(3),
    "preservedFor" TEXT,

    CONSTRAINT "IncidentEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentDocumentReview" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentReference" TEXT NOT NULL,
    "documentLinkId" TEXT,
    "reviewNotes" TEXT,
    "complianceFinding" TEXT,

    CONSTRAINT "IncidentDocumentReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentWitnessStatement" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "witnessUserId" TEXT,
    "witnessName" TEXT NOT NULL,
    "witnessRole" TEXT,
    "statementText" TEXT,
    "statementFileUrl" TEXT,
    "audioRecordingUrl" TEXT,
    "takenById" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "language" TEXT,

    CONSTRAINT "IncidentWitnessStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentEquipment" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "involvement" TEXT NOT NULL,
    "damageEstimate" DECIMAL(14,2),
    "repairStatus" TEXT,

    CONSTRAINT "IncidentEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentCapa" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "capaNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rootCauseAddressed" TEXT,
    "ownerId" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "evidenceUrls" TEXT[],
    "evidenceDescription" TEXT,
    "beforePhotoUrl" TEXT,
    "afterPhotoUrl" TEXT,
    "completedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "effectivenessRating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncidentCapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentComment" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPrivilegedLegal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingProgramQuestion" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "questionText" TEXT NOT NULL,
    "questionType" TEXT NOT NULL,
    "options" JSONB,
    "correctAnswer" TEXT,
    "marks" INTEGER NOT NULL DEFAULT 1,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "explanation" TEXT,

    CONSTRAINT "TrainingProgramQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingProgramMaterial" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT,
    "externalUrl" TEXT,
    "fileSize" INTEGER,
    "duration" INTEGER,
    "language" TEXT,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TrainingProgramMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSchedule" (
    "id" TEXT NOT NULL,
    "scheduleNumber" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "venue" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "trainerId" TEXT,
    "isExternalTrainer" BOOLEAN NOT NULL DEFAULT false,
    "externalTrainerName" TEXT,
    "externalTrainerOrg" TEXT,
    "externalTrainerCert" TEXT,
    "maxParticipants" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "trainerEffectivenessScore" DOUBLE PRECISION,
    "participantSatisfaction" DOUBLE PRECISION,
    "immediateAssessmentPassRate" DOUBLE PRECISION,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "trainerId" TEXT,
    "topicsCovered" JSONB,
    "conductedAt" TIMESTAMP(3),
    "durationMinutesActual" INTEGER,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingRegistration" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "registrationType" TEXT NOT NULL,
    "nominatedById" TEXT,
    "triggerReason" TEXT,
    "triggerSourceId" TEXT,
    "prerequisitesMet" BOOLEAN NOT NULL DEFAULT false,
    "prerequisiteCheckResult" JSONB,
    "approvalStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "attendancePercent" DOUBLE PRECISION,
    "assessmentScore" DOUBLE PRECISION,
    "assessmentAttempts" INTEGER NOT NULL DEFAULT 0,
    "passed" BOOLEAN,
    "certificateId" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "arrivalTime" TIMESTAMP(3),
    "departureTime" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "signatureCaptured" BOOLEAN NOT NULL DEFAULT false,
    "signatureUrl" TEXT,
    "qrScanned" BOOLEAN NOT NULL DEFAULT false,
    "qrScannedAt" TIMESTAMP(3),
    "geoLocation" JSONB,
    "attendancePhotos" JSONB,
    "notes" TEXT,
    "capturedById" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingAssessment" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "practicalScores" JSONB,
    "practicalNotes" TEXT,
    "assessorNarrative" TEXT,
    "totalScore" DOUBLE PRECISION,
    "totalMarks" DOUBLE PRECISION NOT NULL,
    "scorePercent" DOUBLE PRECISION,
    "passed" BOOLEAN NOT NULL,
    "failureReasons" TEXT[],
    "assessedById" TEXT NOT NULL,
    "remediationRequired" BOOLEAN NOT NULL DEFAULT false,
    "remediationPlan" TEXT,
    "retakeAllowed" BOOLEAN NOT NULL DEFAULT true,
    "retakeAfterDate" TIMESTAMP(3),

    CONSTRAINT "TrainingAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingAssessmentResponse" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptions" JSONB,
    "textAnswer" TEXT,
    "numericAnswer" DOUBLE PRECISION,
    "isCorrect" BOOLEAN NOT NULL,
    "marksAwarded" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TrainingAssessmentResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingCertificate" (
    "id" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "registrationId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "finalAssessmentScore" DOUBLE PRECISION,
    "attendancePercent" DOUBLE PRECISION,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isRenewable" BOOLEAN NOT NULL DEFAULT true,
    "renewedFromCertificateId" TEXT,
    "firstExpiryReminderSent" TIMESTAMP(3),
    "secondExpiryReminderSent" TIMESTAMP(3),
    "thirdExpiryReminderSent" TIMESTAMP(3),
    "finalExpiryReminderSent" TIMESTAMP(3),
    "refresherScheduledForUserAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revocationReason" TEXT,
    "revocationDetails" TEXT,
    "certificatePdfUrl" TEXT,
    "certificateQrCode" TEXT,
    "digitalSignature" TEXT,
    "effectivenessReviewedAt" TIMESTAMP(3),
    "effectivenessReviewedById" TEXT,
    "effectivenessRating" INTEGER,
    "effectivenessNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "InspectionTypeCategory" NOT NULL DEFAULT 'ROUTINE',
    "defaultFrequency" "InspectionFrequency" NOT NULL DEFAULT 'MONTHLY',
    "applicableEquipmentCategories" TEXT[],
    "isStatutory" BOOLEAN NOT NULL DEFAULT false,
    "statutoryReference" TEXT,
    "regulatoryAuthority" TEXT,
    "statutoryFormType" TEXT,
    "retentionYears" INTEGER NOT NULL DEFAULT 7,
    "requiresCertifiedInspector" BOOLEAN NOT NULL DEFAULT false,
    "requiredCertificationCodes" TEXT[],
    "workflowDefinitionCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "defaultChecklistTemplateId" TEXT,

    CONSTRAINT "InspectionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "inspectionTypeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentTemplateId" TEXT,
    "applicableEquipmentCategories" TEXT[],
    "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "sectionTitle" TEXT,
    "itemText" TEXT NOT NULL,
    "itemType" "ChecklistItemType" NOT NULL DEFAULT 'PASS_FAIL',
    "options" JSONB,
    "units" TEXT,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "expectedValue" TEXT,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "requiresPhoto" BOOLEAN NOT NULL DEFAULT false,
    "requiresComment" BOOLEAN NOT NULL DEFAULT false,
    "guidanceText" TEXT,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentInspectionType" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "inspectionTypeId" TEXT NOT NULL,
    "frequencyOverride" "InspectionFrequency",
    "checklistTemplateId" TEXT,
    "defaultInspectorId" TEXT,
    "lastInspectionDate" TIMESTAMP(3),
    "nextInspectionDue" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentInspectionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionItemResult" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "checklistItemId" TEXT,
    "sequence" INTEGER NOT NULL,
    "sectionTitle" TEXT,
    "itemTextSnapshot" TEXT NOT NULL,
    "itemTypeSnapshot" "ChecklistItemType" NOT NULL,
    "isCriticalSnapshot" BOOLEAN NOT NULL DEFAULT false,
    "resultStatus" "ChecklistItemResultStatus" NOT NULL DEFAULT 'PENDING',
    "valueText" TEXT,
    "valueNumeric" DOUBLE PRECISION,
    "valueDate" TIMESTAMP(3),
    "photoUrls" TEXT[],
    "signatureData" TEXT,
    "comment" TEXT,
    "capturedById" TEXT,
    "capturedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionItemResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionFinding" (
    "id" TEXT NOT NULL,
    "findingNumber" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "itemResultId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL DEFAULT 'MEDIUM',
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "ownerId" TEXT,
    "dueDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closureNote" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "effectivenessReviewedAt" TIMESTAMP(3),
    "effectivenessReviewedById" TEXT,
    "effectivenessRating" TEXT,
    "effectivenessNote" TEXT,
    "deferredUntil" TIMESTAMP(3),
    "deferredReason" TEXT,
    "duplicateOfFindingId" TEXT,
    "rootCauseCategory" TEXT,
    "rootCauseNote" TEXT,
    "photoUrls" TEXT[],
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "spawnedObservationId" TEXT,
    "spawnedNearMissId" TEXT,
    "spawnedIncidentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionFindingCapa" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "capaType" "FindingCapaType" NOT NULL DEFAULT 'CORRECTIVE_ACTION',
    "description" TEXT NOT NULL,
    "ownerId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "FindingCapaStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "evidenceUrls" TEXT[],
    "evidenceNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionFindingCapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManhoursSubmission" (
    "id" TEXT NOT NULL,
    "submissionNumber" TEXT,
    "plantId" TEXT NOT NULL,
    "reportingYear" INTEGER NOT NULL,
    "reportingMonth" INTEGER NOT NULL,
    "reportingPeriodStart" TIMESTAMP(3) NOT NULL,
    "reportingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "totalManhoursPermanent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalManhoursContract" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalManhoursTrainee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalManhoursAll" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEmployeeStrength" INTEGER NOT NULL DEFAULT 0,
    "totalContractorStrength" INTEGER NOT NULL DEFAULT 0,
    "totalDaysWorked" INTEGER NOT NULL DEFAULT 0,
    "totalShiftsWorked" INTEGER NOT NULL DEFAULT 0,
    "hoursAnnualLeave" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hoursSickLeave" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hoursTraining" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hoursMaternityLeave" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hoursOther" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hoursDeductionsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netExposureHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kpiSnapshot" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "submissionNotes" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewerNotes" TEXT,
    "reviewDecision" TEXT,
    "lockedById" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManhoursSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManhoursEmployeeCategory" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "categoryType" TEXT NOT NULL,
    "departmentId" TEXT,
    "shiftId" TEXT,
    "contractorCompanyId" TEXT,
    "averageHeadcount" INTEGER NOT NULL DEFAULT 0,
    "peakHeadcount" INTEGER NOT NULL DEFAULT 0,
    "endOfPeriodHeadcount" INTEGER NOT NULL DEFAULT 0,
    "regularHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "ManhoursEmployeeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManhoursVisitorRecord" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "totalVisitorCount" INTEGER NOT NULL DEFAULT 0,
    "totalVisitorHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notableVisits" TEXT,

    CONSTRAINT "ManhoursVisitorRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManhoursUnlockEvent" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlockedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "changeLog" JSONB,
    "reLockedAt" TIMESTAMP(3),
    "reLockedById" TEXT,

    CONSTRAINT "ManhoursUnlockEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManhoursAttachment" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "caption" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManhoursAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManhoursComment" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManhoursComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "capabilities" JSONB NOT NULL,
    "primaryModelId" TEXT NOT NULL,
    "escalationModelId" TEXT,
    "activePromptId" TEXT,
    "currentAuthorityLevel" TEXT NOT NULL DEFAULT 'L0',
    "maxAuthorityLevel" TEXT NOT NULL DEFAULT 'L0',
    "authorityRationale" TEXT,
    "availableTools" TEXT[],
    "estimatedTokensPerInvocation" INTEGER NOT NULL DEFAULT 8000,
    "estimatedCostPerInvocation" DOUBLE PRECISION NOT NULL DEFAULT 0.012,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isInPilot" BOOLEAN NOT NULL DEFAULT true,
    "rateLimit" INTEGER NOT NULL DEFAULT 50,
    "totalInvocations" INTEGER NOT NULL DEFAULT 0,
    "totalAcceptances" INTEGER NOT NULL DEFAULT 0,
    "totalModifications" INTEGER NOT NULL DEFAULT 0,
    "totalRejections" INTEGER NOT NULL DEFAULT 0,
    "averageLatencyMs" INTEGER,
    "averageCostUsd" DOUBLE PRECISION,
    "calibrationScore" DOUBLE PRECISION,
    "lastCalibrationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPrompt" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "promptDescription" TEXT NOT NULL,
    "variantLabel" TEXT,
    "invocationCount" INTEGER NOT NULL DEFAULT 0,
    "acceptanceRate" DOUBLE PRECISION,
    "modificationRate" DOUBLE PRECISION,
    "rejectionRate" DOUBLE PRECISION,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentInvocation" (
    "id" TEXT NOT NULL,
    "invocationNumber" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "invokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invokedById" TEXT,
    "invocationTrigger" TEXT NOT NULL DEFAULT 'USER_INITIATED',
    "sourceModule" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceRecordType" TEXT NOT NULL,
    "sourcePlantId" TEXT,
    "authorityLevelUsed" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalCostUsd" DOUBLE PRECISION,
    "latencyMs" INTEGER,
    "inputContext" JSONB NOT NULL,
    "rawApiResponse" JSONB,
    "agentReasoning" TEXT,
    "agentSuggestion" JSONB,
    "agentConfidence" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "humanDecisionAt" TIMESTAMP(3),
    "humanDecisionById" TEXT,
    "humanDecision" TEXT,
    "humanModifications" JSONB,
    "rejectionReason" TEXT,
    "ratingByHuman" INTEGER,
    "detailedFeedback" TEXT,
    "hadError" BOOLEAN NOT NULL DEFAULT false,
    "errorType" TEXT,
    "errorDetails" TEXT,
    "hallucinationFlagged" BOOLEAN NOT NULL DEFAULT false,
    "hallucinationDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentInvocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentToolCall" (
    "id" TEXT NOT NULL,
    "invocationId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "toolInput" JSONB NOT NULL,
    "toolOutput" JSONB,
    "executionMs" INTEGER,
    "hadError" BOOLEAN NOT NULL DEFAULT false,
    "errorDetails" TEXT,
    "sequence" INTEGER NOT NULL,
    "invokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskMatrix" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "likelihoodLevels" INTEGER NOT NULL,
    "severityLevels" INTEGER NOT NULL,
    "acceptableResidual" JSONB NOT NULL,
    "controlHierarchyEnforced" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskMatrixLikelihood" (
    "id" TEXT NOT NULL,
    "matrixId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "frequencyGuidance" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RiskMatrixLikelihood_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskMatrixSeverity" (
    "id" TEXT NOT NULL,
    "matrixId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "healthSafetyGuidance" TEXT,
    "propertyDamageGuidance" TEXT,
    "environmentalGuidance" TEXT,
    "reputationGuidance" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RiskMatrixSeverity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskMatrixCell" (
    "id" TEXT NOT NULL,
    "matrixId" TEXT NOT NULL,
    "likelihoodScore" INTEGER NOT NULL,
    "severityScore" INTEGER NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL,
    "actionRequired" TEXT NOT NULL,
    "responseTimeDays" INTEGER NOT NULL,

    CONSTRAINT "RiskMatrixCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiraHazard" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "typicalHarmPotential" JSONB NOT NULL,
    "typicalAffectedPersons" JSONB NOT NULL,
    "energyForm" TEXT,
    "oshaStandard" TEXT,
    "factoriesActSection" TEXT,
    "isStandard" TEXT,
    "isoReference" TEXT,
    "typicalControlsSuggested" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiraHazard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiraControl" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hierarchy" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "verificationMethod" TEXT,
    "verificationFrequency" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiraControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiraStudy" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "departmentId" TEXT,
    "areaId" TEXT,
    "scopeType" TEXT NOT NULL,
    "activityIds" JSONB,
    "equipmentIds" JSONB,
    "processCode" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "riskMatrixId" TEXT NOT NULL,
    "teamLeaderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetCompletionDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "nextScheduledReviewDate" TIMESTAMP(3),
    "reviewFrequency" TEXT NOT NULL DEFAULT 'ANNUAL',
    "customReviewMonths" INTEGER,
    "supersedesStudyId" TEXT,
    "supersessionReason" TEXT,
    "applicableRegulations" JSONB,
    "regulatoryReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "aggregateMetrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "HiraStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiraStudyTeamMember" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamRole" TEXT NOT NULL,
    "department" TEXT,
    "signedAt" TIMESTAMP(3),
    "signedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiraStudyTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiraStudyAttachment" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "category" TEXT,
    "description" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT NOT NULL,

    CONSTRAINT "HiraStudyAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiraEntry" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "groupLabel" TEXT,
    "activityDescription" TEXT NOT NULL,
    "areaId" TEXT,
    "subLocation" TEXT,
    "gpsLatitude" DOUBLE PRECISION,
    "gpsLongitude" DOUBLE PRECISION,
    "routine" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "typicalDurationMin" INTEGER,
    "personsEmployees" INTEGER NOT NULL DEFAULT 0,
    "personsContractors" INTEGER NOT NULL DEFAULT 0,
    "personsVisitors" INTEGER NOT NULL DEFAULT 0,
    "personsPublic" INTEGER NOT NULL DEFAULT 0,
    "equipmentUsed" JSONB,
    "materialsUsed" JSONB,
    "energySourcesPresent" JSONB,
    "initialLikelihoodId" TEXT NOT NULL,
    "initialLikelihoodScore" INTEGER NOT NULL,
    "initialLikelihoodRationale" TEXT,
    "initialSeverityId" TEXT NOT NULL,
    "initialSeverityScore" INTEGER NOT NULL,
    "initialSeverityRationale" TEXT,
    "initialRiskScore" INTEGER NOT NULL,
    "initialRiskLevel" TEXT NOT NULL,
    "initialRiskColor" TEXT,
    "residualLikelihoodId" TEXT,
    "residualLikelihoodScore" INTEGER,
    "residualLikelihoodRationale" TEXT,
    "residualSeverityId" TEXT,
    "residualSeverityScore" INTEGER,
    "residualSeverityRationale" TEXT,
    "residualRiskScore" INTEGER,
    "residualRiskLevel" TEXT,
    "residualRiskColor" TEXT,
    "residualAcceptable" BOOLEAN,
    "residualAcceptanceRationale" TEXT,
    "triggersTrainingProgramIds" JSONB,
    "triggersInspectionTypeIds" JSONB,
    "influencesPtwRiskLevel" BOOLEAN NOT NULL DEFAULT false,
    "influencesPtwPermitTypes" JSONB,
    "linkedEmergencyProcIds" JSONB,
    "linkedEnvironmentalAspects" JSONB,
    "lastReviewedAt" TIMESTAMP(3),
    "lastReviewedById" TEXT,
    "nextReviewDue" TIMESTAMP(3),
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "lastReviewType" TEXT,
    "triggeredByRecordId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "isCurrentVersion" BOOLEAN NOT NULL DEFAULT true,
    "parentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "HiraEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiraEntryHazard" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "hazardId" TEXT NOT NULL,
    "contextualDescription" TEXT,
    "potentialHarm" JSONB,
    "affectedPersons" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiraEntryHazard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiraEntryControl" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "controlId" TEXT,
    "hierarchy" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "effectiveness" TEXT,
    "verificationMethod" TEXT,
    "verificationFreq" TEXT,
    "responsibleRole" TEXT,
    "evidenceAttached" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiraEntryControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiraEntryRecommendedControl" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "hierarchy" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rationale" TEXT,
    "targetLikelihoodReduction" INTEGER,
    "targetSeverityReduction" INTEGER,
    "estimatedCostBand" TEXT,
    "proposedImplementationDate" TIMESTAMP(3),
    "responsibleId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "capaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiraEntryRecommendedControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiraEntryRegulationRef" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "regulation" TEXT NOT NULL,
    "section" TEXT,
    "requirementSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiraEntryRegulationRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiraCapa" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "controlHierarchy" TEXT,
    "ownerId" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "completionNote" TEXT,
    "verifierId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifyMethod" TEXT,
    "effectiveness" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiraCapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiraReviewCycle" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "triggerReferenceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "assignedToId" TEXT NOT NULL,
    "assignedRole" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "outcome" TEXT,
    "outcomeNotes" TEXT,
    "changesMade" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiraReviewCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiraVersion" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changes" JSONB NOT NULL,
    "changeReason" TEXT NOT NULL,
    "changeTrigger" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "HiraVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Department_plantId_active_idx" ON "Department"("plantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Department_plantId_name_key" ON "Department"("plantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorCompany_name_key" ON "ContractorCompany"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorCompany_code_key" ON "ContractorCompany"("code");

-- CreateIndex
CREATE INDEX "ContractorCompany_status_idx" ON "ContractorCompany"("status");

-- CreateIndex
CREATE INDEX "MasterItem_type_active_idx" ON "MasterItem"("type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "MasterItem_type_code_key" ON "MasterItem"("type", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CoachingTask_number_key" ON "CoachingTask"("number");

-- CreateIndex
CREATE INDEX "CoachingTask_assignedToId_status_idx" ON "CoachingTask"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "CoachingTask_personId_idx" ON "CoachingTask"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "Anomaly_fingerprint_key" ON "Anomaly"("fingerprint");

-- CreateIndex
CREATE INDEX "Anomaly_status_detectedAt_idx" ON "Anomaly"("status", "detectedAt");

-- CreateIndex
CREATE INDEX "Anomaly_plantId_status_idx" ON "Anomaly"("plantId", "status");

-- CreateIndex
CREATE INDEX "Anomaly_detectorId_status_idx" ON "Anomaly"("detectorId", "status");

-- CreateIndex
CREATE INDEX "NearMissPersonInvolved_nearMissId_idx" ON "NearMissPersonInvolved"("nearMissId");

-- CreateIndex
CREATE UNIQUE INDEX "NearMissPersonInvolved_nearMissId_userId_key" ON "NearMissPersonInvolved"("nearMissId", "userId");

-- CreateIndex
CREATE INDEX "NearMissPersonAffected_nearMissId_idx" ON "NearMissPersonAffected"("nearMissId");

-- CreateIndex
CREATE UNIQUE INDEX "NearMissPersonAffected_nearMissId_userId_key" ON "NearMissPersonAffected"("nearMissId", "userId");

-- CreateIndex
CREATE INDEX "NearMissWitness_nearMissId_idx" ON "NearMissWitness"("nearMissId");

-- CreateIndex
CREATE UNIQUE INDEX "NearMissWitness_nearMissId_witnessId_key" ON "NearMissWitness"("nearMissId", "witnessId");

-- CreateIndex
CREATE INDEX "NearMissCapa_nearMissId_idx" ON "NearMissCapa"("nearMissId");

-- CreateIndex
CREATE INDEX "NearMissCapa_ownerId_status_idx" ON "NearMissCapa"("ownerId", "status");

-- CreateIndex
CREATE INDEX "NearMissAttachment_nearMissId_deletedAt_idx" ON "NearMissAttachment"("nearMissId", "deletedAt");

-- CreateIndex
CREATE INDEX "NearMissComment_nearMissId_createdAt_idx" ON "NearMissComment"("nearMissId", "createdAt");

-- CreateIndex
CREATE INDEX "PermitIsolation_permitId_idx" ON "PermitIsolation"("permitId");

-- CreateIndex
CREATE INDEX "PermitToolEquipment_permitId_idx" ON "PermitToolEquipment"("permitId");

-- CreateIndex
CREATE INDEX "PermitSubjectEquipment_permitId_idx" ON "PermitSubjectEquipment"("permitId");

-- CreateIndex
CREATE INDEX "PermitSubjectEquipment_equipmentId_idx" ON "PermitSubjectEquipment"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PermitGasTestPlan_permitId_key" ON "PermitGasTestPlan"("permitId");

-- CreateIndex
CREATE INDEX "PermitGasTestReading_permitId_recordedAt_idx" ON "PermitGasTestReading"("permitId", "recordedAt");

-- CreateIndex
CREATE INDEX "PermitApproval_permitId_step_idx" ON "PermitApproval"("permitId", "step");

-- CreateIndex
CREATE INDEX "PermitSuspension_permitId_idx" ON "PermitSuspension"("permitId");

-- CreateIndex
CREATE INDEX "PermitExtension_permitId_status_idx" ON "PermitExtension"("permitId", "status");

-- CreateIndex
CREATE INDEX "PermitAttachment_permitId_category_idx" ON "PermitAttachment"("permitId", "category");

-- CreateIndex
CREATE INDEX "PermitComment_permitId_idx" ON "PermitComment"("permitId");

-- CreateIndex
CREATE INDEX "FLRAJobStep_flraId_sequence_idx" ON "FLRAJobStep"("flraId", "sequence");

-- CreateIndex
CREATE INDEX "FLRAStepHazard_jobStepId_idx" ON "FLRAStepHazard"("jobStepId");

-- CreateIndex
CREATE INDEX "FLRAFitnessDeclaration_userId_idx" ON "FLRAFitnessDeclaration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FLRAFitnessDeclaration_flraId_userId_key" ON "FLRAFitnessDeclaration"("flraId", "userId");

-- CreateIndex
CREATE INDEX "FLRAAttachment_flraId_category_idx" ON "FLRAAttachment"("flraId", "category");

-- CreateIndex
CREATE INDEX "IncidentPerson_incidentId_idx" ON "IncidentPerson"("incidentId");

-- CreateIndex
CREATE INDEX "IncidentPerson_userId_idx" ON "IncidentPerson"("userId");

-- CreateIndex
CREATE INDEX "IncidentPerson_contractorCompanyId_idx" ON "IncidentPerson"("contractorCompanyId");

-- CreateIndex
CREATE INDEX "IncidentReclassification_incidentId_idx" ON "IncidentReclassification"("incidentId");

-- CreateIndex
CREATE INDEX "IncidentTimelineEvent_incidentId_sequence_idx" ON "IncidentTimelineEvent"("incidentId", "sequence");

-- CreateIndex
CREATE INDEX "IncidentEvidence_incidentId_category_idx" ON "IncidentEvidence"("incidentId", "category");

-- CreateIndex
CREATE INDEX "IncidentDocumentReview_incidentId_idx" ON "IncidentDocumentReview"("incidentId");

-- CreateIndex
CREATE INDEX "IncidentWitnessStatement_incidentId_idx" ON "IncidentWitnessStatement"("incidentId");

-- CreateIndex
CREATE INDEX "IncidentEquipment_incidentId_idx" ON "IncidentEquipment"("incidentId");

-- CreateIndex
CREATE INDEX "IncidentEquipment_equipmentId_idx" ON "IncidentEquipment"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentCapa_capaNumber_key" ON "IncidentCapa"("capaNumber");

-- CreateIndex
CREATE INDEX "IncidentCapa_incidentId_idx" ON "IncidentCapa"("incidentId");

-- CreateIndex
CREATE INDEX "IncidentCapa_ownerId_idx" ON "IncidentCapa"("ownerId");

-- CreateIndex
CREATE INDEX "IncidentCapa_status_idx" ON "IncidentCapa"("status");

-- CreateIndex
CREATE INDEX "IncidentComment_incidentId_idx" ON "IncidentComment"("incidentId");

-- CreateIndex
CREATE INDEX "TrainingProgramQuestion_programId_sequence_idx" ON "TrainingProgramQuestion"("programId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingSchedule_scheduleNumber_key" ON "TrainingSchedule"("scheduleNumber");

-- CreateIndex
CREATE INDEX "TrainingSchedule_plantId_status_idx" ON "TrainingSchedule"("plantId", "status");

-- CreateIndex
CREATE INDEX "TrainingSchedule_programId_startDate_idx" ON "TrainingSchedule"("programId", "startDate");

-- CreateIndex
CREATE INDEX "TrainingSession_scheduleId_sequence_idx" ON "TrainingSession"("scheduleId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingRegistration_certificateId_key" ON "TrainingRegistration"("certificateId");

-- CreateIndex
CREATE INDEX "TrainingRegistration_userId_status_idx" ON "TrainingRegistration"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingRegistration_scheduleId_userId_key" ON "TrainingRegistration"("scheduleId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingAttendance_sessionId_registrationId_key" ON "TrainingAttendance"("sessionId", "registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingAssessment_registrationId_attemptNumber_key" ON "TrainingAssessment"("registrationId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingCertificate_certificateNumber_key" ON "TrainingCertificate"("certificateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingCertificate_registrationId_key" ON "TrainingCertificate"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingCertificate_renewedFromCertificateId_key" ON "TrainingCertificate"("renewedFromCertificateId");

-- CreateIndex
CREATE INDEX "TrainingCertificate_userId_status_idx" ON "TrainingCertificate"("userId", "status");

-- CreateIndex
CREATE INDEX "TrainingCertificate_programId_status_idx" ON "TrainingCertificate"("programId", "status");

-- CreateIndex
CREATE INDEX "TrainingCertificate_validTo_status_idx" ON "TrainingCertificate"("validTo", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionType_code_key" ON "InspectionType"("code");

-- CreateIndex
CREATE INDEX "InspectionType_category_isActive_idx" ON "InspectionType"("category", "isActive");

-- CreateIndex
CREATE INDEX "InspectionType_isStatutory_idx" ON "InspectionType"("isStatutory");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplate_code_key" ON "ChecklistTemplate"("code");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_inspectionTypeId_isActive_idx" ON "ChecklistTemplate"("inspectionTypeId", "isActive");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_approvalStatus_idx" ON "ChecklistTemplate"("approvalStatus");

-- CreateIndex
CREATE INDEX "ChecklistItem_templateId_sequence_idx" ON "ChecklistItem"("templateId", "sequence");

-- CreateIndex
CREATE INDEX "EquipmentInspectionType_nextInspectionDue_isActive_idx" ON "EquipmentInspectionType"("nextInspectionDue", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentInspectionType_equipmentId_inspectionTypeId_key" ON "EquipmentInspectionType"("equipmentId", "inspectionTypeId");

-- CreateIndex
CREATE INDEX "InspectionItemResult_inspectionId_sequence_idx" ON "InspectionItemResult"("inspectionId", "sequence");

-- CreateIndex
CREATE INDEX "InspectionItemResult_resultStatus_idx" ON "InspectionItemResult"("resultStatus");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionFinding_findingNumber_key" ON "InspectionFinding"("findingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionFinding_itemResultId_key" ON "InspectionFinding"("itemResultId");

-- CreateIndex
CREATE INDEX "InspectionFinding_status_dueDate_idx" ON "InspectionFinding"("status", "dueDate");

-- CreateIndex
CREATE INDEX "InspectionFinding_severity_isCritical_idx" ON "InspectionFinding"("severity", "isCritical");

-- CreateIndex
CREATE INDEX "InspectionFinding_ownerId_status_idx" ON "InspectionFinding"("ownerId", "status");

-- CreateIndex
CREATE INDEX "InspectionFindingCapa_findingId_status_idx" ON "InspectionFindingCapa"("findingId", "status");

-- CreateIndex
CREATE INDEX "InspectionFindingCapa_ownerId_status_idx" ON "InspectionFindingCapa"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ManhoursSubmission_submissionNumber_key" ON "ManhoursSubmission"("submissionNumber");

-- CreateIndex
CREATE INDEX "ManhoursSubmission_status_idx" ON "ManhoursSubmission"("status");

-- CreateIndex
CREATE INDEX "ManhoursSubmission_plantId_reportingYear_reportingMonth_idx" ON "ManhoursSubmission"("plantId", "reportingYear", "reportingMonth");

-- CreateIndex
CREATE UNIQUE INDEX "ManhoursSubmission_plantId_reportingYear_reportingMonth_key" ON "ManhoursSubmission"("plantId", "reportingYear", "reportingMonth");

-- CreateIndex
CREATE INDEX "ManhoursEmployeeCategory_submissionId_categoryType_idx" ON "ManhoursEmployeeCategory"("submissionId", "categoryType");

-- CreateIndex
CREATE INDEX "ManhoursEmployeeCategory_contractorCompanyId_idx" ON "ManhoursEmployeeCategory"("contractorCompanyId");

-- CreateIndex
CREATE INDEX "ManhoursEmployeeCategory_departmentId_idx" ON "ManhoursEmployeeCategory"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ManhoursVisitorRecord_submissionId_key" ON "ManhoursVisitorRecord"("submissionId");

-- CreateIndex
CREATE INDEX "ManhoursUnlockEvent_submissionId_idx" ON "ManhoursUnlockEvent"("submissionId");

-- CreateIndex
CREATE INDEX "ManhoursAttachment_submissionId_idx" ON "ManhoursAttachment"("submissionId");

-- CreateIndex
CREATE INDEX "ManhoursComment_submissionId_idx" ON "ManhoursComment"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_code_key" ON "Agent"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_activePromptId_key" ON "Agent"("activePromptId");

-- CreateIndex
CREATE INDEX "Agent_module_idx" ON "Agent"("module");

-- CreateIndex
CREATE INDEX "Agent_isActive_idx" ON "Agent"("isActive");

-- CreateIndex
CREATE INDEX "AgentPrompt_agentId_idx" ON "AgentPrompt"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentPrompt_agentId_version_key" ON "AgentPrompt"("agentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AgentInvocation_invocationNumber_key" ON "AgentInvocation"("invocationNumber");

-- CreateIndex
CREATE INDEX "AgentInvocation_agentId_invokedAt_idx" ON "AgentInvocation"("agentId", "invokedAt");

-- CreateIndex
CREATE INDEX "AgentInvocation_sourceModule_sourceRecordId_idx" ON "AgentInvocation"("sourceModule", "sourceRecordId");

-- CreateIndex
CREATE INDEX "AgentInvocation_sourcePlantId_invokedAt_idx" ON "AgentInvocation"("sourcePlantId", "invokedAt");

-- CreateIndex
CREATE INDEX "AgentInvocation_status_idx" ON "AgentInvocation"("status");

-- CreateIndex
CREATE INDEX "AgentToolCall_invocationId_sequence_idx" ON "AgentToolCall"("invocationId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "RiskMatrix_code_key" ON "RiskMatrix"("code");

-- CreateIndex
CREATE INDEX "RiskMatrix_isActive_isDefault_idx" ON "RiskMatrix"("isActive", "isDefault");

-- CreateIndex
CREATE INDEX "RiskMatrixLikelihood_matrixId_sortOrder_idx" ON "RiskMatrixLikelihood"("matrixId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RiskMatrixLikelihood_matrixId_score_key" ON "RiskMatrixLikelihood"("matrixId", "score");

-- CreateIndex
CREATE INDEX "RiskMatrixSeverity_matrixId_sortOrder_idx" ON "RiskMatrixSeverity"("matrixId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RiskMatrixSeverity_matrixId_score_key" ON "RiskMatrixSeverity"("matrixId", "score");

-- CreateIndex
CREATE INDEX "RiskMatrixCell_matrixId_riskLevel_idx" ON "RiskMatrixCell"("matrixId", "riskLevel");

-- CreateIndex
CREATE UNIQUE INDEX "RiskMatrixCell_matrixId_likelihoodScore_severityScore_key" ON "RiskMatrixCell"("matrixId", "likelihoodScore", "severityScore");

-- CreateIndex
CREATE UNIQUE INDEX "HiraHazard_code_key" ON "HiraHazard"("code");

-- CreateIndex
CREATE INDEX "HiraHazard_category_isActive_idx" ON "HiraHazard"("category", "isActive");

-- CreateIndex
CREATE INDEX "HiraHazard_isGlobal_isActive_idx" ON "HiraHazard"("isGlobal", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "HiraControl_code_key" ON "HiraControl"("code");

-- CreateIndex
CREATE INDEX "HiraControl_hierarchy_isActive_idx" ON "HiraControl"("hierarchy", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "HiraStudy_number_key" ON "HiraStudy"("number");

-- CreateIndex
CREATE UNIQUE INDEX "HiraStudy_supersedesStudyId_key" ON "HiraStudy"("supersedesStudyId");

-- CreateIndex
CREATE INDEX "HiraStudy_plantId_status_idx" ON "HiraStudy"("plantId", "status");

-- CreateIndex
CREATE INDEX "HiraStudy_status_nextScheduledReviewDate_idx" ON "HiraStudy"("status", "nextScheduledReviewDate");

-- CreateIndex
CREATE INDEX "HiraStudy_plantId_departmentId_idx" ON "HiraStudy"("plantId", "departmentId");

-- CreateIndex
CREATE INDEX "HiraStudyTeamMember_studyId_idx" ON "HiraStudyTeamMember"("studyId");

-- CreateIndex
CREATE UNIQUE INDEX "HiraStudyTeamMember_studyId_userId_key" ON "HiraStudyTeamMember"("studyId", "userId");

-- CreateIndex
CREATE INDEX "HiraStudyAttachment_studyId_idx" ON "HiraStudyAttachment"("studyId");

-- CreateIndex
CREATE INDEX "HiraEntry_studyId_status_idx" ON "HiraEntry"("studyId", "status");

-- CreateIndex
CREATE INDEX "HiraEntry_status_nextReviewDue_idx" ON "HiraEntry"("status", "nextReviewDue");

-- CreateIndex
CREATE INDEX "HiraEntry_initialRiskLevel_idx" ON "HiraEntry"("initialRiskLevel");

-- CreateIndex
CREATE INDEX "HiraEntry_residualRiskLevel_idx" ON "HiraEntry"("residualRiskLevel");

-- CreateIndex
CREATE UNIQUE INDEX "HiraEntry_studyId_sequenceNumber_key" ON "HiraEntry"("studyId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "HiraEntryHazard_entryId_idx" ON "HiraEntryHazard"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "HiraEntryHazard_entryId_hazardId_key" ON "HiraEntryHazard"("entryId", "hazardId");

-- CreateIndex
CREATE INDEX "HiraEntryControl_entryId_idx" ON "HiraEntryControl"("entryId");

-- CreateIndex
CREATE INDEX "HiraEntryRecommendedControl_entryId_status_idx" ON "HiraEntryRecommendedControl"("entryId", "status");

-- CreateIndex
CREATE INDEX "HiraEntryRegulationRef_entryId_idx" ON "HiraEntryRegulationRef"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "HiraCapa_number_key" ON "HiraCapa"("number");

-- CreateIndex
CREATE INDEX "HiraCapa_entryId_status_idx" ON "HiraCapa"("entryId", "status");

-- CreateIndex
CREATE INDEX "HiraCapa_ownerId_status_idx" ON "HiraCapa"("ownerId", "status");

-- CreateIndex
CREATE INDEX "HiraReviewCycle_entryId_status_idx" ON "HiraReviewCycle"("entryId", "status");

-- CreateIndex
CREATE INDEX "HiraReviewCycle_assignedToId_status_idx" ON "HiraReviewCycle"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "HiraReviewCycle_status_scheduledFor_idx" ON "HiraReviewCycle"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "HiraVersion_entryId_idx" ON "HiraVersion"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "HiraVersion_entryId_versionNumber_key" ON "HiraVersion"("entryId", "versionNumber");

-- CreateIndex
CREATE INDEX "Equipment_plantId_active_idx" ON "Equipment"("plantId", "active");

-- CreateIndex
CREATE INDEX "Equipment_nextInspectionDue_idx" ON "Equipment"("nextInspectionDue");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_sourceNearMissId_key" ON "Incident"("sourceNearMissId");

-- CreateIndex
CREATE INDEX "Incident_occurredAt_idx" ON "Incident"("occurredAt");

-- CreateIndex
CREATE INDEX "Incident_severity_idx" ON "Incident"("severity");

-- CreateIndex
CREATE INDEX "Incident_isReportable_statutoryDeadline_idx" ON "Incident"("isReportable", "statutoryDeadline");

-- CreateIndex
CREATE INDEX "Incident_sourceNearMissId_idx" ON "Incident"("sourceNearMissId");

-- CreateIndex
CREATE INDEX "Incident_date_idx" ON "Incident"("date");

-- CreateIndex
CREATE INDEX "Incident_status_date_idx" ON "Incident"("status", "date");

-- CreateIndex
CREATE INDEX "Incident_type_status_idx" ON "Incident"("type", "status");

-- CreateIndex
CREATE INDEX "Incident_plantId_status_idx" ON "Incident"("plantId", "status");

-- CreateIndex
CREATE INDEX "Inspection_plantId_status_idx" ON "Inspection"("plantId", "status");

-- CreateIndex
CREATE INDEX "Inspection_scheduledDate_status_idx" ON "Inspection"("scheduledDate", "status");

-- CreateIndex
CREATE INDEX "Inspection_inspectorId_status_idx" ON "Inspection"("inspectorId", "status");

-- CreateIndex
CREATE INDEX "Inspection_inspectionTypeId_idx" ON "Inspection"("inspectionTypeId");

-- CreateIndex
CREATE INDEX "NearMiss_plantId_status_idx" ON "NearMiss"("plantId", "status");

-- CreateIndex
CREATE INDEX "NearMiss_reporterId_idx" ON "NearMiss"("reporterId");

-- CreateIndex
CREATE INDEX "NearMiss_potentialSeverity_status_idx" ON "NearMiss"("potentialSeverity", "status");

-- CreateIndex
CREATE INDEX "NearMiss_date_idx" ON "NearMiss"("date");

-- CreateIndex
CREATE INDEX "NearMiss_status_date_idx" ON "NearMiss"("status", "date");

-- CreateIndex
CREATE INDEX "Observation_status_idx" ON "Observation"("status");

-- CreateIndex
CREATE INDEX "Observation_plantId_status_idx" ON "Observation"("plantId", "status");

-- CreateIndex
CREATE INDEX "Observation_date_idx" ON "Observation"("date");

-- CreateIndex
CREATE INDEX "Observation_observerId_idx" ON "Observation"("observerId");

-- CreateIndex
CREATE INDEX "Observation_responsiblePersonId_idx" ON "Observation"("responsiblePersonId");

-- CreateIndex
CREATE INDEX "Permit_validTo_status_idx" ON "Permit"("validTo", "status");

-- CreateIndex
CREATE INDEX "Permit_plantId_areaId_status_idx" ON "Permit"("plantId", "areaId", "status");

-- CreateIndex
CREATE INDEX "Permit_currentActiveFlraId_idx" ON "Permit"("currentActiveFlraId");

-- CreateIndex
CREATE INDEX "Permit_createdAt_idx" ON "Permit"("createdAt");

-- CreateIndex
CREATE INDEX "Permit_type_status_idx" ON "Permit"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingProgram_programCode_key" ON "TrainingProgram"("programCode");

-- CreateIndex
CREATE INDEX "TrainingProgram_category_isActive_idx" ON "TrainingProgram"("category", "isActive");

-- CreateIndex
CREATE INDEX "TrainingProgram_isStatutory_idx" ON "TrainingProgram"("isStatutory");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_activePermitId_fkey" FOREIGN KEY ("activePermitId") REFERENCES "Permit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_triggeredInspectionId_fkey" FOREIGN KEY ("triggeredInspectionId") REFERENCES "Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_triggeredTbtId_fkey" FOREIGN KEY ("triggeredTbtId") REFERENCES "TrainingRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_triggeredCapaId_fkey" FOREIGN KEY ("triggeredCapaId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_contributedToIncidentId_fkey" FOREIGN KEY ("contributedToIncidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingTask" ADD CONSTRAINT "CoachingTask_personId_fkey" FOREIGN KEY ("personId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingTask" ADD CONSTRAINT "CoachingTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingTask" ADD CONSTRAINT "CoachingTask_sourceObservationId_fkey" FOREIGN KEY ("sourceObservationId") REFERENCES "Observation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_personId_fkey" FOREIGN KEY ("personId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMiss" ADD CONSTRAINT "NearMiss_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMiss" ADD CONSTRAINT "NearMiss_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMiss" ADD CONSTRAINT "NearMiss_contractorCompanyId_fkey" FOREIGN KEY ("contractorCompanyId") REFERENCES "ContractorCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMiss" ADD CONSTRAINT "NearMiss_suggestedActionOwnerId_fkey" FOREIGN KEY ("suggestedActionOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMiss" ADD CONSTRAINT "NearMiss_activePermitId_fkey" FOREIGN KEY ("activePermitId") REFERENCES "Permit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMissPersonInvolved" ADD CONSTRAINT "NearMissPersonInvolved_nearMissId_fkey" FOREIGN KEY ("nearMissId") REFERENCES "NearMiss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMissPersonInvolved" ADD CONSTRAINT "NearMissPersonInvolved_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMissPersonAffected" ADD CONSTRAINT "NearMissPersonAffected_nearMissId_fkey" FOREIGN KEY ("nearMissId") REFERENCES "NearMiss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMissPersonAffected" ADD CONSTRAINT "NearMissPersonAffected_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMissWitness" ADD CONSTRAINT "NearMissWitness_nearMissId_fkey" FOREIGN KEY ("nearMissId") REFERENCES "NearMiss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMissWitness" ADD CONSTRAINT "NearMissWitness_witnessId_fkey" FOREIGN KEY ("witnessId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMissCapa" ADD CONSTRAINT "NearMissCapa_nearMissId_fkey" FOREIGN KEY ("nearMissId") REFERENCES "NearMiss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMissCapa" ADD CONSTRAINT "NearMissCapa_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMissCapa" ADD CONSTRAINT "NearMissCapa_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMissAttachment" ADD CONSTRAINT "NearMissAttachment_nearMissId_fkey" FOREIGN KEY ("nearMissId") REFERENCES "NearMiss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMissAttachment" ADD CONSTRAINT "NearMissAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMissComment" ADD CONSTRAINT "NearMissComment_nearMissId_fkey" FOREIGN KEY ("nearMissId") REFERENCES "NearMiss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMissComment" ADD CONSTRAINT "NearMissComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_fireWatchPersonId_fkey" FOREIGN KEY ("fireWatchPersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_standbyPersonId_fkey" FOREIGN KEY ("standbyPersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitIsolation" ADD CONSTRAINT "PermitIsolation_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitToolEquipment" ADD CONSTRAINT "PermitToolEquipment_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitToolEquipment" ADD CONSTRAINT "PermitToolEquipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitSubjectEquipment" ADD CONSTRAINT "PermitSubjectEquipment_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitSubjectEquipment" ADD CONSTRAINT "PermitSubjectEquipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitGasTestPlan" ADD CONSTRAINT "PermitGasTestPlan_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitGasTestReading" ADD CONSTRAINT "PermitGasTestReading_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitGasTestReading" ADD CONSTRAINT "PermitGasTestReading_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitApproval" ADD CONSTRAINT "PermitApproval_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitApproval" ADD CONSTRAINT "PermitApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitSuspension" ADD CONSTRAINT "PermitSuspension_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitSuspension" ADD CONSTRAINT "PermitSuspension_suspendedById_fkey" FOREIGN KEY ("suspendedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitSuspension" ADD CONSTRAINT "PermitSuspension_resumedById_fkey" FOREIGN KEY ("resumedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitExtension" ADD CONSTRAINT "PermitExtension_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitExtension" ADD CONSTRAINT "PermitExtension_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitExtension" ADD CONSTRAINT "PermitExtension_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitAttachment" ADD CONSTRAINT "PermitAttachment_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitAttachment" ADD CONSTRAINT "PermitAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitComment" ADD CONSTRAINT "PermitComment_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitComment" ADD CONSTRAINT "PermitComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FLRAJobStep" ADD CONSTRAINT "FLRAJobStep_flraId_fkey" FOREIGN KEY ("flraId") REFERENCES "FLRA"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FLRAStepHazard" ADD CONSTRAINT "FLRAStepHazard_jobStepId_fkey" FOREIGN KEY ("jobStepId") REFERENCES "FLRAJobStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FLRAFitnessDeclaration" ADD CONSTRAINT "FLRAFitnessDeclaration_flraId_fkey" FOREIGN KEY ("flraId") REFERENCES "FLRA"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FLRAFitnessDeclaration" ADD CONSTRAINT "FLRAFitnessDeclaration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FLRAAttachment" ADD CONSTRAINT "FLRAAttachment_flraId_fkey" FOREIGN KEY ("flraId") REFERENCES "FLRA"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FLRAAttachment" ADD CONSTRAINT "FLRAAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_activePermitId_fkey" FOREIGN KEY ("activePermitId") REFERENCES "Permit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_sourceNearMissId_fkey" FOREIGN KEY ("sourceNearMissId") REFERENCES "NearMiss"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_classifiedById_fkey" FOREIGN KEY ("classifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_investigationTeamLead_fkey" FOREIGN KEY ("investigationTeamLead") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentPerson" ADD CONSTRAINT "IncidentPerson_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentPerson" ADD CONSTRAINT "IncidentPerson_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentPerson" ADD CONSTRAINT "IncidentPerson_contractorCompanyId_fkey" FOREIGN KEY ("contractorCompanyId") REFERENCES "ContractorCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReclassification" ADD CONSTRAINT "IncidentReclassification_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReclassification" ADD CONSTRAINT "IncidentReclassification_reclassifiedById_fkey" FOREIGN KEY ("reclassifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentTimelineEvent" ADD CONSTRAINT "IncidentTimelineEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentEvidence" ADD CONSTRAINT "IncidentEvidence_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentEvidence" ADD CONSTRAINT "IncidentEvidence_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentDocumentReview" ADD CONSTRAINT "IncidentDocumentReview_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentWitnessStatement" ADD CONSTRAINT "IncidentWitnessStatement_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentWitnessStatement" ADD CONSTRAINT "IncidentWitnessStatement_witnessUserId_fkey" FOREIGN KEY ("witnessUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentWitnessStatement" ADD CONSTRAINT "IncidentWitnessStatement_takenById_fkey" FOREIGN KEY ("takenById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentEquipment" ADD CONSTRAINT "IncidentEquipment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentEquipment" ADD CONSTRAINT "IncidentEquipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentCapa" ADD CONSTRAINT "IncidentCapa_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentCapa" ADD CONSTRAINT "IncidentCapa_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentCapa" ADD CONSTRAINT "IncidentCapa_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentComment" ADD CONSTRAINT "IncidentComment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentComment" ADD CONSTRAINT "IncidentComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingProgram" ADD CONSTRAINT "TrainingProgram_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingProgram" ADD CONSTRAINT "TrainingProgram_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingProgram" ADD CONSTRAINT "TrainingProgram_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingProgramQuestion" ADD CONSTRAINT "TrainingProgramQuestion_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingProgramMaterial" ADD CONSTRAINT "TrainingProgramMaterial_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSchedule" ADD CONSTRAINT "TrainingSchedule_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSchedule" ADD CONSTRAINT "TrainingSchedule_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSchedule" ADD CONSTRAINT "TrainingSchedule_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSchedule" ADD CONSTRAINT "TrainingSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSchedule" ADD CONSTRAINT "TrainingSchedule_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "TrainingSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRegistration" ADD CONSTRAINT "TrainingRegistration_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "TrainingSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRegistration" ADD CONSTRAINT "TrainingRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRegistration" ADD CONSTRAINT "TrainingRegistration_nominatedById_fkey" FOREIGN KEY ("nominatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRegistration" ADD CONSTRAINT "TrainingRegistration_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRegistration" ADD CONSTRAINT "TrainingRegistration_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "TrainingCertificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAttendance" ADD CONSTRAINT "TrainingAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAttendance" ADD CONSTRAINT "TrainingAttendance_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "TrainingRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAttendance" ADD CONSTRAINT "TrainingAttendance_capturedById_fkey" FOREIGN KEY ("capturedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAssessment" ADD CONSTRAINT "TrainingAssessment_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "TrainingRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAssessment" ADD CONSTRAINT "TrainingAssessment_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAssessmentResponse" ADD CONSTRAINT "TrainingAssessmentResponse_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "TrainingAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAssessmentResponse" ADD CONSTRAINT "TrainingAssessmentResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "TrainingProgramQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCertificate" ADD CONSTRAINT "TrainingCertificate_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCertificate" ADD CONSTRAINT "TrainingCertificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCertificate" ADD CONSTRAINT "TrainingCertificate_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCertificate" ADD CONSTRAINT "TrainingCertificate_renewedFromCertificateId_fkey" FOREIGN KEY ("renewedFromCertificateId") REFERENCES "TrainingCertificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCertificate" ADD CONSTRAINT "TrainingCertificate_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCertificate" ADD CONSTRAINT "TrainingCertificate_effectivenessReviewedById_fkey" FOREIGN KEY ("effectivenessReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionType" ADD CONSTRAINT "InspectionType_defaultChecklistTemplateId_fkey" FOREIGN KEY ("defaultChecklistTemplateId") REFERENCES "ChecklistTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_inspectionTypeId_fkey" FOREIGN KEY ("inspectionTypeId") REFERENCES "InspectionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentInspectionType" ADD CONSTRAINT "EquipmentInspectionType_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentInspectionType" ADD CONSTRAINT "EquipmentInspectionType_inspectionTypeId_fkey" FOREIGN KEY ("inspectionTypeId") REFERENCES "InspectionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentInspectionType" ADD CONSTRAINT "EquipmentInspectionType_checklistTemplateId_fkey" FOREIGN KEY ("checklistTemplateId") REFERENCES "ChecklistTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentInspectionType" ADD CONSTRAINT "EquipmentInspectionType_defaultInspectorId_fkey" FOREIGN KEY ("defaultInspectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_inspectionTypeId_fkey" FOREIGN KEY ("inspectionTypeId") REFERENCES "InspectionType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_equipmentInspectionTypeId_fkey" FOREIGN KEY ("equipmentInspectionTypeId") REFERENCES "EquipmentInspectionType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_checklistTemplateId_fkey" FOREIGN KEY ("checklistTemplateId") REFERENCES "ChecklistTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_rescheduledFromInspectionId_fkey" FOREIGN KEY ("rescheduledFromInspectionId") REFERENCES "Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_deferredById_fkey" FOREIGN KEY ("deferredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionItemResult" ADD CONSTRAINT "InspectionItemResult_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionItemResult" ADD CONSTRAINT "InspectionItemResult_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionItemResult" ADD CONSTRAINT "InspectionItemResult_capturedById_fkey" FOREIGN KEY ("capturedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_itemResultId_fkey" FOREIGN KEY ("itemResultId") REFERENCES "InspectionItemResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_effectivenessReviewedById_fkey" FOREIGN KEY ("effectivenessReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_duplicateOfFindingId_fkey" FOREIGN KEY ("duplicateOfFindingId") REFERENCES "InspectionFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFindingCapa" ADD CONSTRAINT "InspectionFindingCapa_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "InspectionFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFindingCapa" ADD CONSTRAINT "InspectionFindingCapa_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFindingCapa" ADD CONSTRAINT "InspectionFindingCapa_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFindingCapa" ADD CONSTRAINT "InspectionFindingCapa_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManhoursSubmission" ADD CONSTRAINT "ManhoursSubmission_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManhoursSubmission" ADD CONSTRAINT "ManhoursSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManhoursSubmission" ADD CONSTRAINT "ManhoursSubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManhoursSubmission" ADD CONSTRAINT "ManhoursSubmission_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManhoursEmployeeCategory" ADD CONSTRAINT "ManhoursEmployeeCategory_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ManhoursSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManhoursEmployeeCategory" ADD CONSTRAINT "ManhoursEmployeeCategory_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManhoursEmployeeCategory" ADD CONSTRAINT "ManhoursEmployeeCategory_contractorCompanyId_fkey" FOREIGN KEY ("contractorCompanyId") REFERENCES "ContractorCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManhoursVisitorRecord" ADD CONSTRAINT "ManhoursVisitorRecord_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ManhoursSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManhoursUnlockEvent" ADD CONSTRAINT "ManhoursUnlockEvent_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ManhoursSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManhoursUnlockEvent" ADD CONSTRAINT "ManhoursUnlockEvent_unlockedById_fkey" FOREIGN KEY ("unlockedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManhoursUnlockEvent" ADD CONSTRAINT "ManhoursUnlockEvent_reLockedById_fkey" FOREIGN KEY ("reLockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManhoursAttachment" ADD CONSTRAINT "ManhoursAttachment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ManhoursSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManhoursAttachment" ADD CONSTRAINT "ManhoursAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManhoursComment" ADD CONSTRAINT "ManhoursComment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ManhoursSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManhoursComment" ADD CONSTRAINT "ManhoursComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_activePromptId_fkey" FOREIGN KEY ("activePromptId") REFERENCES "AgentPrompt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPrompt" ADD CONSTRAINT "AgentPrompt_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPrompt" ADD CONSTRAINT "AgentPrompt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPrompt" ADD CONSTRAINT "AgentPrompt_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInvocation" ADD CONSTRAINT "AgentInvocation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInvocation" ADD CONSTRAINT "AgentInvocation_invokedById_fkey" FOREIGN KEY ("invokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInvocation" ADD CONSTRAINT "AgentInvocation_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "AgentPrompt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInvocation" ADD CONSTRAINT "AgentInvocation_humanDecisionById_fkey" FOREIGN KEY ("humanDecisionById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentToolCall" ADD CONSTRAINT "AgentToolCall_invocationId_fkey" FOREIGN KEY ("invocationId") REFERENCES "AgentInvocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskMatrixLikelihood" ADD CONSTRAINT "RiskMatrixLikelihood_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "RiskMatrix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskMatrixSeverity" ADD CONSTRAINT "RiskMatrixSeverity_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "RiskMatrix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskMatrixCell" ADD CONSTRAINT "RiskMatrixCell_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "RiskMatrix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraStudy" ADD CONSTRAINT "HiraStudy_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraStudy" ADD CONSTRAINT "HiraStudy_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraStudy" ADD CONSTRAINT "HiraStudy_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraStudy" ADD CONSTRAINT "HiraStudy_riskMatrixId_fkey" FOREIGN KEY ("riskMatrixId") REFERENCES "RiskMatrix"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraStudy" ADD CONSTRAINT "HiraStudy_teamLeaderId_fkey" FOREIGN KEY ("teamLeaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraStudy" ADD CONSTRAINT "HiraStudy_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraStudy" ADD CONSTRAINT "HiraStudy_supersedesStudyId_fkey" FOREIGN KEY ("supersedesStudyId") REFERENCES "HiraStudy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraStudy" ADD CONSTRAINT "HiraStudy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraStudy" ADD CONSTRAINT "HiraStudy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraStudyTeamMember" ADD CONSTRAINT "HiraStudyTeamMember_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "HiraStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraStudyTeamMember" ADD CONSTRAINT "HiraStudyTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraStudyAttachment" ADD CONSTRAINT "HiraStudyAttachment_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "HiraStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraStudyAttachment" ADD CONSTRAINT "HiraStudyAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraEntry" ADD CONSTRAINT "HiraEntry_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "HiraStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraEntry" ADD CONSTRAINT "HiraEntry_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraEntry" ADD CONSTRAINT "HiraEntry_initialLikelihoodId_fkey" FOREIGN KEY ("initialLikelihoodId") REFERENCES "RiskMatrixLikelihood"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraEntry" ADD CONSTRAINT "HiraEntry_initialSeverityId_fkey" FOREIGN KEY ("initialSeverityId") REFERENCES "RiskMatrixSeverity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraEntry" ADD CONSTRAINT "HiraEntry_residualLikelihoodId_fkey" FOREIGN KEY ("residualLikelihoodId") REFERENCES "RiskMatrixLikelihood"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraEntry" ADD CONSTRAINT "HiraEntry_residualSeverityId_fkey" FOREIGN KEY ("residualSeverityId") REFERENCES "RiskMatrixSeverity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraEntry" ADD CONSTRAINT "HiraEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraEntry" ADD CONSTRAINT "HiraEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraEntryHazard" ADD CONSTRAINT "HiraEntryHazard_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "HiraEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraEntryHazard" ADD CONSTRAINT "HiraEntryHazard_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "HiraHazard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraEntryControl" ADD CONSTRAINT "HiraEntryControl_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "HiraEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraEntryControl" ADD CONSTRAINT "HiraEntryControl_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "HiraControl"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraEntryRecommendedControl" ADD CONSTRAINT "HiraEntryRecommendedControl_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "HiraEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraEntryRecommendedControl" ADD CONSTRAINT "HiraEntryRecommendedControl_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraEntryRecommendedControl" ADD CONSTRAINT "HiraEntryRecommendedControl_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "HiraCapa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraEntryRegulationRef" ADD CONSTRAINT "HiraEntryRegulationRef_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "HiraEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraCapa" ADD CONSTRAINT "HiraCapa_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "HiraEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraCapa" ADD CONSTRAINT "HiraCapa_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraCapa" ADD CONSTRAINT "HiraCapa_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraReviewCycle" ADD CONSTRAINT "HiraReviewCycle_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "HiraEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraReviewCycle" ADD CONSTRAINT "HiraReviewCycle_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraReviewCycle" ADD CONSTRAINT "HiraReviewCycle_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraVersion" ADD CONSTRAINT "HiraVersion_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "HiraEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiraVersion" ADD CONSTRAINT "HiraVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
