-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "classification" TEXT NOT NULL DEFAULT 'minor',
    "isTemporary" BOOLEAN NOT NULL DEFAULT false,
    "temporaryExpiryDate" TIMESTAMP(3),
    "origin" TEXT NOT NULL,
    "originSourceType" TEXT,
    "originSourceId" TEXT,
    "departmentId" TEXT,
    "affectedDepartments" TEXT[],
    "affectedLocations" TEXT[],
    "affectedEquipmentIds" TEXT[],
    "affectedProcesses" TEXT[],
    "affectedRoles" TEXT[],
    "initiatedByUserId" TEXT NOT NULL,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "businessJustification" TEXT,
    "expectedBenefits" TEXT,
    "costEstimate" DOUBLE PRECISION,
    "costCurrency" TEXT NOT NULL DEFAULT 'INR',
    "proposedImplementationDate" TIMESTAMP(3),
    "targetCompletionDate" TIMESTAMP(3),
    "actualImplementationDate" TIMESTAMP(3),
    "actualCompletionDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "safetyRiskLevel" TEXT,
    "environmentalRiskLevel" TEXT,
    "qualityRiskLevel" TEXT,
    "operationalRiskLevel" TEXT,
    "overallResidualRisk" TEXT,
    "pssrRequired" BOOLEAN NOT NULL DEFAULT false,
    "pssrOutcome" TEXT,
    "pssrConductedAt" TIMESTAMP(3),
    "returnToNormalCompletedAt" TIMESTAMP(3),
    "spawnedFromCapaId" TEXT,
    "supersededByMocId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MocApprovalStep" (
    "id" TEXT NOT NULL,
    "changeRequestId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "specificUserId" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "decision" TEXT NOT NULL DEFAULT 'pending',
    "decidedAt" TIMESTAMP(3),
    "decidedByUserId" TEXT,
    "rationale" TEXT,
    "conditions" TEXT,

    CONSTRAINT "MocApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MocDependentRecord" (
    "id" TEXT NOT NULL,
    "changeRequestId" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "recordId" TEXT,
    "recordReference" TEXT NOT NULL,
    "impactType" TEXT NOT NULL,
    "impactDescription" TEXT,
    "updateStatus" TEXT NOT NULL DEFAULT 'not_started',
    "updatedAt" TIMESTAMP(3),
    "updatedByUserId" TEXT,
    "updateEvidence" TEXT,

    CONSTRAINT "MocDependentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MocStateHistory" (
    "id" TEXT NOT NULL,
    "changeRequestId" TEXT NOT NULL,
    "fromState" TEXT,
    "toState" TEXT NOT NULL,
    "transitionedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transitionedByUserId" TEXT,
    "rationale" TEXT,

    CONSTRAINT "MocStateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MocImpactAssessment" (
    "id" TEXT NOT NULL,
    "changeRequestId" TEXT NOT NULL,
    "assessorUserId" TEXT,
    "assessorRole" TEXT,
    "methodology" TEXT,
    "dimensions" JSONB,
    "recommendedClassification" TEXT,
    "pssrRequired" BOOLEAN NOT NULL DEFAULT false,
    "rollbackPlanRequired" BOOLEAN NOT NULL DEFAULT false,
    "assessmentDate" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MocImpactAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MocFreeze" (
    "id" TEXT NOT NULL,
    "plantIds" TEXT[],
    "departmentIds" TEXT[],
    "categoryFilters" TEXT[],
    "classificationFilters" TEXT[],
    "reason" TEXT NOT NULL,
    "reasonDetail" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "exceptionsAllowed" BOOLEAN NOT NULL DEFAULT false,
    "exceptionApprovalAuthority" TEXT,
    "imposedByUserId" TEXT NOT NULL,
    "imposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftedAt" TIMESTAMP(3),
    "liftedByUserId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MocFreeze_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChangeRequest_number_key" ON "ChangeRequest"("number");

-- CreateIndex
CREATE INDEX "ChangeRequest_plantId_status_idx" ON "ChangeRequest"("plantId", "status");

-- CreateIndex
CREATE INDEX "ChangeRequest_plantId_category_idx" ON "ChangeRequest"("plantId", "category");

-- CreateIndex
CREATE INDEX "ChangeRequest_initiatedByUserId_status_idx" ON "ChangeRequest"("initiatedByUserId", "status");

-- CreateIndex
CREATE INDEX "ChangeRequest_targetCompletionDate_status_idx" ON "ChangeRequest"("targetCompletionDate", "status");

-- CreateIndex
CREATE INDEX "ChangeRequest_isTemporary_temporaryExpiryDate_idx" ON "ChangeRequest"("isTemporary", "temporaryExpiryDate");

-- CreateIndex
CREATE INDEX "MocApprovalStep_changeRequestId_idx" ON "MocApprovalStep"("changeRequestId");

-- CreateIndex
CREATE INDEX "MocDependentRecord_changeRequestId_updateStatus_idx" ON "MocDependentRecord"("changeRequestId", "updateStatus");

-- CreateIndex
CREATE INDEX "MocStateHistory_changeRequestId_idx" ON "MocStateHistory"("changeRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "MocImpactAssessment_changeRequestId_key" ON "MocImpactAssessment"("changeRequestId");

-- CreateIndex
CREATE INDEX "MocFreeze_isActive_idx" ON "MocFreeze"("isActive");

-- AddForeignKey
ALTER TABLE "MocApprovalStep" ADD CONSTRAINT "MocApprovalStep_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MocDependentRecord" ADD CONSTRAINT "MocDependentRecord_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MocStateHistory" ADD CONSTRAINT "MocStateHistory_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MocImpactAssessment" ADD CONSTRAINT "MocImpactAssessment_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

