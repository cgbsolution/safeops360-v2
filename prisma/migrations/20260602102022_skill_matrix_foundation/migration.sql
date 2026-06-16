-- CreateTable
CREATE TABLE "EaiAspectCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "iconKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EaiAspectCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EaiAspect" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "typicalReceptors" JSONB NOT NULL,
    "typicalImpacts" JSONB,
    "typicalRegulations" JSONB,
    "typicalControls" JSONB,
    "typicallySignificant" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EaiAspect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EaiReceptor" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EaiReceptor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EaiRegulation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL DEFAULT 'INDIA',
    "section" TEXT,
    "description" TEXT,
    "authority" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EaiRegulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalImpactMatrix" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "likelihoodLevels" INTEGER NOT NULL,
    "magnitudeLevels" INTEGER NOT NULL,
    "significanceThresholds" JSONB NOT NULL,
    "acceptableResidual" JSONB NOT NULL,
    "controlHierarchyEnforced" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentalImpactMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalImpactMatrixLikelihood" (
    "id" TEXT NOT NULL,
    "matrixId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "occurrenceGuidance" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EnvironmentalImpactMatrixLikelihood_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalImpactMatrixMagnitude" (
    "id" TEXT NOT NULL,
    "matrixId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "geographicGuidance" TEXT,
    "reversibilityGuidance" TEXT,
    "durationGuidance" TEXT,
    "legalGuidance" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EnvironmentalImpactMatrixMagnitude_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalImpactMatrixCell" (
    "id" TEXT NOT NULL,
    "matrixId" TEXT NOT NULL,
    "likelihoodScore" INTEGER NOT NULL,
    "magnitudeScore" INTEGER NOT NULL,
    "impactScore" INTEGER NOT NULL,
    "impactLevel" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL,
    "actionRequired" TEXT NOT NULL,
    "responseTimeDays" INTEGER NOT NULL,

    CONSTRAINT "EnvironmentalImpactMatrixCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EaiStudy" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "departmentId" TEXT,
    "areaId" TEXT,
    "scopeType" TEXT NOT NULL,
    "activityIds" JSONB,
    "processCode" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "impactMatrixId" TEXT NOT NULL,
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
    "applicableRegulations" JSONB,
    "regulatoryReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "aggregateMetrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "EaiStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EaiStudyTeamMember" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamRole" TEXT NOT NULL,
    "department" TEXT,
    "signedAt" TIMESTAMP(3),
    "signedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EaiStudyTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EaiEntry" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "groupLabel" TEXT,
    "activityDescription" TEXT NOT NULL,
    "areaId" TEXT,
    "subLocation" TEXT,
    "occurrence" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "typicalDurationMin" INTEGER,
    "equipmentUsed" JSONB,
    "materialsUsed" JSONB,
    "processInputs" JSONB,
    "initialLikelihoodId" TEXT NOT NULL,
    "initialLikelihoodScore" INTEGER NOT NULL,
    "initialLikelihoodRationale" TEXT,
    "initialMagnitudeId" TEXT NOT NULL,
    "initialMagnitudeScore" INTEGER NOT NULL,
    "initialMagnitudeRationale" TEXT,
    "initialImpactScore" INTEGER NOT NULL,
    "initialImpactLevel" TEXT NOT NULL,
    "initialImpactColor" TEXT,
    "initialSignificant" BOOLEAN NOT NULL DEFAULT false,
    "residualLikelihoodId" TEXT,
    "residualLikelihoodScore" INTEGER,
    "residualLikelihoodRationale" TEXT,
    "residualMagnitudeId" TEXT,
    "residualMagnitudeScore" INTEGER,
    "residualMagnitudeRationale" TEXT,
    "residualImpactScore" INTEGER,
    "residualImpactLevel" TEXT,
    "residualImpactColor" TEXT,
    "residualAcceptable" BOOLEAN,
    "residualAcceptanceRationale" TEXT,
    "residualSignificant" BOOLEAN NOT NULL DEFAULT false,
    "legalComplianceStatus" TEXT,
    "linkedHiraEntryIds" JSONB,
    "triggersTrainingProgramIds" JSONB,
    "triggersInspectionTypeIds" JSONB,
    "triggersComplianceTaskIds" JSONB,
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

    CONSTRAINT "EaiEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EaiEntryAspect" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "aspectId" TEXT NOT NULL,
    "contextualDescription" TEXT,
    "quantification" JSONB,
    "occurrence" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EaiEntryAspect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EaiEntryImpact" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "affectedReceptor" TEXT NOT NULL,
    "impactType" TEXT NOT NULL,
    "reversibility" TEXT NOT NULL,
    "geographicExtent" TEXT NOT NULL,
    "temporalExtent" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EaiEntryImpact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EaiEntryControl" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "hierarchy" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "effectiveness" TEXT,
    "verificationMethod" TEXT,
    "verificationFreq" TEXT,
    "responsibleRole" TEXT,
    "evidenceAttached" BOOLEAN NOT NULL DEFAULT false,
    "monitoringPoint" TEXT,
    "monitoringParameter" TEXT,
    "monitoringFrequency" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EaiEntryControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EaiEntryRecommendedControl" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "hierarchy" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rationale" TEXT,
    "targetLikelihoodReduction" INTEGER,
    "targetMagnitudeReduction" INTEGER,
    "estimatedCostBand" TEXT,
    "proposedImplementationDate" TIMESTAMP(3),
    "responsibleUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "capaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EaiEntryRecommendedControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EaiComplianceObligation" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "regulationCode" TEXT NOT NULL,
    "section" TEXT,
    "parameter" TEXT NOT NULL,
    "permittedLimit" TEXT NOT NULL,
    "monitoringFrequency" TEXT NOT NULL,
    "reportingAuthority" TEXT,
    "reportingFrequency" TEXT,
    "nextMonitoringDue" TIMESTAMP(3),
    "lastMonitoringDate" TIMESTAMP(3),
    "lastMonitoringResult" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EaiComplianceObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EaiEntryRegulationRef" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "regulationCode" TEXT NOT NULL,
    "section" TEXT,
    "requirementSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EaiEntryRegulationRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EaiReviewCycle" (
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

    CONSTRAINT "EaiReviewCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EaiVersion" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changes" JSONB NOT NULL,
    "changeReason" TEXT NOT NULL,
    "changeTrigger" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "EaiVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EaiFeatureFlag" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "eaiRegisterEnabled" BOOLEAN NOT NULL DEFAULT false,
    "combinedRegisterEnabled" BOOLEAN NOT NULL DEFAULT false,
    "riskDashboardEnabled" BOOLEAN NOT NULL DEFAULT false,
    "hiraAssistantV2Enabled" BOOLEAN NOT NULL DEFAULT false,
    "enabledAt" TIMESTAMP(3),
    "enabledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EaiFeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competency" (
    "id" TEXT NOT NULL,
    "plantId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "validationMethods" JSONB NOT NULL,
    "relatedTrainingProgramIds" TEXT[],
    "defaultValidityMonths" INTEGER NOT NULL,
    "preExpiryWarningDays" INTEGER NOT NULL DEFAULT 90,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 30,
    "prerequisiteCompetencyIds" TEXT[],
    "supersededByCompetencyIds" TEXT[],
    "supersededAt" TIMESTAMP(3),
    "regulatoryReferences" JSONB,
    "enablesRoleIds" TEXT[],
    "enablesPermitTypes" TEXT[],
    "enablesActivityTypes" TEXT[],
    "reValidationWorkflow" TEXT NOT NULL DEFAULT 'assessment_required',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "plantId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "contributesToCompetencyIds" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleDefinition" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "roleMasterId" TEXT,
    "roleName" TEXT NOT NULL,
    "appliesToDepartments" TEXT[],
    "appliesToPlants" TEXT[],
    "minimumExperience" JSONB,
    "medicalFitnessRequirements" JSONB,
    "authorityLimits" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededByDefinitionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleCompetencyRequirement" (
    "id" TEXT NOT NULL,
    "roleDefinitionId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "requirementType" TEXT NOT NULL,
    "conditionalLogic" TEXT,
    "gracePeriodForNewHiresDays" INTEGER NOT NULL DEFAULT 0,
    "rationale" TEXT,

    CONSTRAINT "RoleCompetencyRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyRecord" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "personUserId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'not_yet_attempted',
    "currentValidatedAt" TIMESTAMP(3),
    "currentValidatedByUserId" TEXT,
    "currentValidationMethod" TEXT,
    "currentScore" DOUBLE PRECISION,
    "externalCertificateReference" TEXT,
    "externalCertificateAuthority" TEXT,
    "externalCertificateUrl" TEXT,
    "currentEvidenceAttachments" JSONB,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "conditions" TEXT,
    "restrictions" TEXT,
    "requiredValidationsTotal" INTEGER NOT NULL DEFAULT 0,
    "requiredValidationsCompleted" INTEGER NOT NULL DEFAULT 0,
    "lastProgressEventAt" TIMESTAMP(3),
    "estimatedCompletionDate" TIMESTAMP(3),
    "nextRevalidationDue" TIMESTAMP(3),
    "revalidationHistory" JSONB,
    "suspensionHistory" JSONB,
    "relatedTrainingRecords" TEXT[],
    "relatedAssessments" TEXT[],
    "relatedSupervisions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CompetencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyValidationAttempt" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "result" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "assessorUserId" TEXT,
    "evidenceAttachments" JSONB,
    "notes" TEXT,

    CONSTRAINT "CompetencyValidationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyRecordVersion" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changes" JSONB NOT NULL,
    "changeReason" TEXT NOT NULL,
    "changeTrigger" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "CompetencyRecordVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonRoleAssignment" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "personUserId" TEXT NOT NULL,
    "roleDefinitionId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByUserId" TEXT NOT NULL,
    "assignmentRationale" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "competencyAssessmentAtAssignment" JSONB,
    "operatingUnderGracePeriod" BOOLEAN NOT NULL DEFAULT false,
    "gracePeriodExpires" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "statusHistory" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyAssessment" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "personUserId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "assessmentType" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "conductedAt" TIMESTAMP(3),
    "location" TEXT,
    "assessorUserId" TEXT NOT NULL,
    "assessorRole" TEXT,
    "assessmentTemplateId" TEXT,
    "questionsCount" INTEGER NOT NULL DEFAULT 0,
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "rawScore" DOUBLE PRECISION,
    "maximumScore" DOUBLE PRECISION,
    "percentageScore" DOUBLE PRECISION,
    "minimumPassScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "result" TEXT,
    "scoringBreakdown" JSONB,
    "assessorObservations" TEXT,
    "assesseeFeedback" TEXT,
    "evidenceAttachments" JSONB,
    "competencyValidated" BOOLEAN NOT NULL DEFAULT false,
    "remedialActionsRequired" TEXT,
    "reAssessmentEligibleFrom" TIMESTAMP(3),
    "sourceTrainingAssessmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CompetencyAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisedPerformanceRecord" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "personUserId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "activityDescription" TEXT NOT NULL,
    "activityDate" TIMESTAMP(3) NOT NULL,
    "activityLocation" TEXT,
    "hiraEntryId" TEXT,
    "permitId" TEXT,
    "supervisorUserId" TEXT NOT NULL,
    "supervisorCompetencyToSupervise" TEXT,
    "performanceRating" TEXT NOT NULL,
    "observations" JSONB,
    "contributesToValidation" BOOLEAN NOT NULL DEFAULT true,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "evidenceAttachments" JSONB,
    "supervisorSignatureAt" TIMESTAMP(3),
    "superviseeAcknowledgmentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupervisedPerformanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecertificationCycle" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "cycleNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scopeCompetencyIds" TEXT[],
    "scopeRoleIds" TEXT[],
    "scopeDepartmentIds" TEXT[],
    "scopePlantIds" TEXT[],
    "windowStart" TIMESTAMP(3),
    "windowEnd" TIMESTAMP(3),
    "ownerUserId" TEXT NOT NULL,
    "affectedPersonsCount" INTEGER NOT NULL DEFAULT 0,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,

    CONSTRAINT "RecertificationCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecertificationTask" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "personUserId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "recordId" TEXT,
    "revalidationMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecertificationTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EaiAspectCategory_code_key" ON "EaiAspectCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EaiAspect_code_key" ON "EaiAspect"("code");

-- CreateIndex
CREATE INDEX "EaiAspect_categoryId_isActive_idx" ON "EaiAspect"("categoryId", "isActive");

-- CreateIndex
CREATE INDEX "EaiAspect_isGlobal_isActive_idx" ON "EaiAspect"("isGlobal", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EaiReceptor_code_key" ON "EaiReceptor"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EaiRegulation_code_key" ON "EaiRegulation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentalImpactMatrix_code_key" ON "EnvironmentalImpactMatrix"("code");

-- CreateIndex
CREATE INDEX "EnvironmentalImpactMatrix_isActive_isDefault_idx" ON "EnvironmentalImpactMatrix"("isActive", "isDefault");

-- CreateIndex
CREATE INDEX "EnvironmentalImpactMatrixLikelihood_matrixId_sortOrder_idx" ON "EnvironmentalImpactMatrixLikelihood"("matrixId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentalImpactMatrixLikelihood_matrixId_score_key" ON "EnvironmentalImpactMatrixLikelihood"("matrixId", "score");

-- CreateIndex
CREATE INDEX "EnvironmentalImpactMatrixMagnitude_matrixId_sortOrder_idx" ON "EnvironmentalImpactMatrixMagnitude"("matrixId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentalImpactMatrixMagnitude_matrixId_score_key" ON "EnvironmentalImpactMatrixMagnitude"("matrixId", "score");

-- CreateIndex
CREATE INDEX "EnvironmentalImpactMatrixCell_matrixId_impactLevel_idx" ON "EnvironmentalImpactMatrixCell"("matrixId", "impactLevel");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentalImpactMatrixCell_matrixId_likelihoodScore_magn_key" ON "EnvironmentalImpactMatrixCell"("matrixId", "likelihoodScore", "magnitudeScore");

-- CreateIndex
CREATE UNIQUE INDEX "EaiStudy_number_key" ON "EaiStudy"("number");

-- CreateIndex
CREATE INDEX "EaiStudy_plantId_status_idx" ON "EaiStudy"("plantId", "status");

-- CreateIndex
CREATE INDEX "EaiStudy_status_nextScheduledReviewDate_idx" ON "EaiStudy"("status", "nextScheduledReviewDate");

-- CreateIndex
CREATE INDEX "EaiStudy_plantId_departmentId_idx" ON "EaiStudy"("plantId", "departmentId");

-- CreateIndex
CREATE INDEX "EaiStudyTeamMember_studyId_idx" ON "EaiStudyTeamMember"("studyId");

-- CreateIndex
CREATE UNIQUE INDEX "EaiStudyTeamMember_studyId_userId_key" ON "EaiStudyTeamMember"("studyId", "userId");

-- CreateIndex
CREATE INDEX "EaiEntry_studyId_status_idx" ON "EaiEntry"("studyId", "status");

-- CreateIndex
CREATE INDEX "EaiEntry_status_nextReviewDue_idx" ON "EaiEntry"("status", "nextReviewDue");

-- CreateIndex
CREATE INDEX "EaiEntry_initialImpactLevel_idx" ON "EaiEntry"("initialImpactLevel");

-- CreateIndex
CREATE INDEX "EaiEntry_residualImpactLevel_idx" ON "EaiEntry"("residualImpactLevel");

-- CreateIndex
CREATE INDEX "EaiEntry_residualSignificant_idx" ON "EaiEntry"("residualSignificant");

-- CreateIndex
CREATE UNIQUE INDEX "EaiEntry_studyId_sequenceNumber_key" ON "EaiEntry"("studyId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "EaiEntryAspect_entryId_idx" ON "EaiEntryAspect"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "EaiEntryAspect_entryId_aspectId_key" ON "EaiEntryAspect"("entryId", "aspectId");

-- CreateIndex
CREATE INDEX "EaiEntryImpact_entryId_idx" ON "EaiEntryImpact"("entryId");

-- CreateIndex
CREATE INDEX "EaiEntryControl_entryId_idx" ON "EaiEntryControl"("entryId");

-- CreateIndex
CREATE INDEX "EaiEntryRecommendedControl_entryId_status_idx" ON "EaiEntryRecommendedControl"("entryId", "status");

-- CreateIndex
CREATE INDEX "EaiComplianceObligation_entryId_status_idx" ON "EaiComplianceObligation"("entryId", "status");

-- CreateIndex
CREATE INDEX "EaiComplianceObligation_nextMonitoringDue_idx" ON "EaiComplianceObligation"("nextMonitoringDue");

-- CreateIndex
CREATE INDEX "EaiEntryRegulationRef_entryId_idx" ON "EaiEntryRegulationRef"("entryId");

-- CreateIndex
CREATE INDEX "EaiReviewCycle_entryId_status_idx" ON "EaiReviewCycle"("entryId", "status");

-- CreateIndex
CREATE INDEX "EaiReviewCycle_assignedToId_status_idx" ON "EaiReviewCycle"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "EaiReviewCycle_status_scheduledFor_idx" ON "EaiReviewCycle"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "EaiVersion_entryId_idx" ON "EaiVersion"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "EaiVersion_entryId_versionNumber_key" ON "EaiVersion"("entryId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EaiFeatureFlag_plantId_key" ON "EaiFeatureFlag"("plantId");

-- CreateIndex
CREATE UNIQUE INDEX "Competency_code_key" ON "Competency"("code");

-- CreateIndex
CREATE INDEX "Competency_plantId_category_isActive_idx" ON "Competency"("plantId", "category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_code_key" ON "Skill"("code");

-- CreateIndex
CREATE INDEX "RoleDefinition_plantId_isActive_idx" ON "RoleDefinition"("plantId", "isActive");

-- CreateIndex
CREATE INDEX "RoleCompetencyRequirement_roleDefinitionId_idx" ON "RoleCompetencyRequirement"("roleDefinitionId");

-- CreateIndex
CREATE INDEX "RoleCompetencyRequirement_competencyId_idx" ON "RoleCompetencyRequirement"("competencyId");

-- CreateIndex
CREATE INDEX "CompetencyRecord_plantId_personUserId_state_idx" ON "CompetencyRecord"("plantId", "personUserId", "state");

-- CreateIndex
CREATE INDEX "CompetencyRecord_plantId_competencyId_state_idx" ON "CompetencyRecord"("plantId", "competencyId", "state");

-- CreateIndex
CREATE INDEX "CompetencyRecord_plantId_validUntil_idx" ON "CompetencyRecord"("plantId", "validUntil");

-- CreateIndex
CREATE INDEX "CompetencyRecord_nextRevalidationDue_idx" ON "CompetencyRecord"("nextRevalidationDue");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyRecord_personUserId_competencyId_key" ON "CompetencyRecord"("personUserId", "competencyId");

-- CreateIndex
CREATE INDEX "CompetencyValidationAttempt_recordId_idx" ON "CompetencyValidationAttempt"("recordId");

-- CreateIndex
CREATE INDEX "CompetencyRecordVersion_recordId_idx" ON "CompetencyRecordVersion"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyRecordVersion_recordId_versionNumber_key" ON "CompetencyRecordVersion"("recordId", "versionNumber");

-- CreateIndex
CREATE INDEX "PersonRoleAssignment_plantId_personUserId_status_idx" ON "PersonRoleAssignment"("plantId", "personUserId", "status");

-- CreateIndex
CREATE INDEX "PersonRoleAssignment_roleDefinitionId_status_idx" ON "PersonRoleAssignment"("roleDefinitionId", "status");

-- CreateIndex
CREATE INDEX "CompetencyAssessment_recordId_idx" ON "CompetencyAssessment"("recordId");

-- CreateIndex
CREATE INDEX "CompetencyAssessment_plantId_personUserId_idx" ON "CompetencyAssessment"("plantId", "personUserId");

-- CreateIndex
CREATE INDEX "CompetencyAssessment_assessorUserId_status_idx" ON "CompetencyAssessment"("assessorUserId", "status");

-- CreateIndex
CREATE INDEX "SupervisedPerformanceRecord_recordId_idx" ON "SupervisedPerformanceRecord"("recordId");

-- CreateIndex
CREATE INDEX "SupervisedPerformanceRecord_plantId_personUserId_idx" ON "SupervisedPerformanceRecord"("plantId", "personUserId");

-- CreateIndex
CREATE UNIQUE INDEX "RecertificationCycle_cycleNumber_key" ON "RecertificationCycle"("cycleNumber");

-- CreateIndex
CREATE INDEX "RecertificationCycle_plantId_status_idx" ON "RecertificationCycle"("plantId", "status");

-- CreateIndex
CREATE INDEX "RecertificationTask_cycleId_status_idx" ON "RecertificationTask"("cycleId", "status");

-- CreateIndex
CREATE INDEX "RecertificationTask_personUserId_status_idx" ON "RecertificationTask"("personUserId", "status");

-- AddForeignKey
ALTER TABLE "EaiAspect" ADD CONSTRAINT "EaiAspect_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EaiAspectCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentalImpactMatrixLikelihood" ADD CONSTRAINT "EnvironmentalImpactMatrixLikelihood_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "EnvironmentalImpactMatrix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentalImpactMatrixMagnitude" ADD CONSTRAINT "EnvironmentalImpactMatrixMagnitude_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "EnvironmentalImpactMatrix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentalImpactMatrixCell" ADD CONSTRAINT "EnvironmentalImpactMatrixCell_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "EnvironmentalImpactMatrix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiStudy" ADD CONSTRAINT "EaiStudy_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiStudy" ADD CONSTRAINT "EaiStudy_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiStudy" ADD CONSTRAINT "EaiStudy_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiStudy" ADD CONSTRAINT "EaiStudy_impactMatrixId_fkey" FOREIGN KEY ("impactMatrixId") REFERENCES "EnvironmentalImpactMatrix"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiStudy" ADD CONSTRAINT "EaiStudy_teamLeaderId_fkey" FOREIGN KEY ("teamLeaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiStudy" ADD CONSTRAINT "EaiStudy_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiStudy" ADD CONSTRAINT "EaiStudy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiStudy" ADD CONSTRAINT "EaiStudy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiStudyTeamMember" ADD CONSTRAINT "EaiStudyTeamMember_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "EaiStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiStudyTeamMember" ADD CONSTRAINT "EaiStudyTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiEntry" ADD CONSTRAINT "EaiEntry_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "EaiStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiEntry" ADD CONSTRAINT "EaiEntry_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiEntry" ADD CONSTRAINT "EaiEntry_initialLikelihoodId_fkey" FOREIGN KEY ("initialLikelihoodId") REFERENCES "EnvironmentalImpactMatrixLikelihood"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiEntry" ADD CONSTRAINT "EaiEntry_initialMagnitudeId_fkey" FOREIGN KEY ("initialMagnitudeId") REFERENCES "EnvironmentalImpactMatrixMagnitude"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiEntry" ADD CONSTRAINT "EaiEntry_residualLikelihoodId_fkey" FOREIGN KEY ("residualLikelihoodId") REFERENCES "EnvironmentalImpactMatrixLikelihood"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiEntry" ADD CONSTRAINT "EaiEntry_residualMagnitudeId_fkey" FOREIGN KEY ("residualMagnitudeId") REFERENCES "EnvironmentalImpactMatrixMagnitude"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiEntry" ADD CONSTRAINT "EaiEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiEntry" ADD CONSTRAINT "EaiEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiEntryAspect" ADD CONSTRAINT "EaiEntryAspect_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "EaiEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiEntryAspect" ADD CONSTRAINT "EaiEntryAspect_aspectId_fkey" FOREIGN KEY ("aspectId") REFERENCES "EaiAspect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiEntryImpact" ADD CONSTRAINT "EaiEntryImpact_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "EaiEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiEntryControl" ADD CONSTRAINT "EaiEntryControl_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "EaiEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiEntryRecommendedControl" ADD CONSTRAINT "EaiEntryRecommendedControl_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "EaiEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiComplianceObligation" ADD CONSTRAINT "EaiComplianceObligation_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "EaiEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiEntryRegulationRef" ADD CONSTRAINT "EaiEntryRegulationRef_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "EaiEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiReviewCycle" ADD CONSTRAINT "EaiReviewCycle_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "EaiEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiReviewCycle" ADD CONSTRAINT "EaiReviewCycle_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiReviewCycle" ADD CONSTRAINT "EaiReviewCycle_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiVersion" ADD CONSTRAINT "EaiVersion_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "EaiEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaiVersion" ADD CONSTRAINT "EaiVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleCompetencyRequirement" ADD CONSTRAINT "RoleCompetencyRequirement_roleDefinitionId_fkey" FOREIGN KEY ("roleDefinitionId") REFERENCES "RoleDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleCompetencyRequirement" ADD CONSTRAINT "RoleCompetencyRequirement_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyRecord" ADD CONSTRAINT "CompetencyRecord_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyValidationAttempt" ADD CONSTRAINT "CompetencyValidationAttempt_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "CompetencyRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyRecordVersion" ADD CONSTRAINT "CompetencyRecordVersion_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "CompetencyRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonRoleAssignment" ADD CONSTRAINT "PersonRoleAssignment_roleDefinitionId_fkey" FOREIGN KEY ("roleDefinitionId") REFERENCES "RoleDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "CompetencyRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisedPerformanceRecord" ADD CONSTRAINT "SupervisedPerformanceRecord_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "CompetencyRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecertificationTask" ADD CONSTRAINT "RecertificationTask_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "RecertificationCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
